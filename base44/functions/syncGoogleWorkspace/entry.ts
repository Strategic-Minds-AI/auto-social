import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Keeps the owner's Google workspace in step with the content calendar: every
// approved or scheduled post becomes a Calendar entry, and every post still
// waiting for review becomes one open Google Task. Both are keyed off stored ids
// plus a hash of the mirrored fields, so an unchanged post costs no API calls.

const CAL = 'https://www.googleapis.com/calendar/v3';
const TASKS = 'https://tasks.googleapis.com/tasks/v1';
const TASK_LIST_TITLE = 'Strategic Minds AI - Content Approvals';
const OPEN_STATUSES = ['planned', 'approved', 'scheduled', 'cancelled', 'failed'];
const CALENDAR_STATUSES = ['approved', 'scheduled'];
const DROPPED_STATUSES = ['cancelled', 'failed'];
const POST_LIMIT = 100;
const TIMEOUT_MS = 20000;
const HALF_HOUR = 1800000;

function contentHash(post) {
  const source = [
    post.title,
    post.hook,
    post.caption,
    post.call_to_action,
    post.hashtags,
    post.scheduled_date,
    post.scheduled_time,
    post.scheduled_at,
    post.timezone,
    post.status,
    post.platform,
    post.format,
    post.business_id,
  ]
    .map((value) => String(value == null ? '' : value))
    .join('|');

  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function google(url, token, { method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
  }
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

// Posts carry both a derived UTC instant and a local date/time. The instant wins
// when present; otherwise the local values are sent with their own timezone.
function eventWindow(post) {
  if (post.scheduled_at) {
    const start = new Date(post.scheduled_at);
    if (!Number.isNaN(start.getTime())) {
      return {
        start: { dateTime: start.toISOString() },
        end: { dateTime: new Date(start.getTime() + HALF_HOUR).toISOString() },
      };
    }
  }
  if (!post.scheduled_date) return null;

  const naive = new Date(`${post.scheduled_date}T${post.scheduled_time || '09:00'}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;

  const local = (date) => date.toISOString().slice(0, 19);
  const timeZone = post.timezone || 'America/New_York';
  return {
    start: { dateTime: local(naive), timeZone },
    end: { dateTime: local(new Date(naive.getTime() + HALF_HOUR)), timeZone },
  };
}

function postLabel(post, businessName) {
  const subject = post.title || post.hook || `${post.platform} post`;
  return businessName ? `${businessName}: ${subject}` : subject;
}

function eventBody(post, businessName) {
  const window = eventWindow(post);
  if (!window) return null;

  const description = [
    post.hook ? `Hook: ${post.hook}` : null,
    post.caption || null,
    post.call_to_action ? `Call to action: ${post.call_to_action}` : null,
    post.hashtags || null,
    `Planned for ${post.platform}${post.format ? ` (${post.format})` : ''}. Mirrored by Strategic Minds AI.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return { summary: postLabel(post, businessName), description, ...window };
}

async function ensureTaskList(token, cache) {
  if (cache.id) return cache.id;

  const existing = await google(`${TASKS}/users/@me/lists?maxResults=100`, token);
  const found = (existing?.items || []).find((list) => list.title === TASK_LIST_TITLE);
  if (found) {
    cache.id = found.id;
    return cache.id;
  }

  const created = await google(`${TASKS}/users/@me/lists`, token, {
    method: 'POST',
    body: { title: TASK_LIST_TITLE },
  });
  cache.id = created?.id || null;
  return cache.id;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // This writes into the app's shared Google account, so it stays admin-only.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only an app admin can sync the Google workspace.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const businessId = typeof body?.business_id === 'string' && body.business_id ? body.business_id : null;

    let calendarToken = '';
    let tasksToken = '';
    try {
      ({ accessToken: calendarToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar'));
    } catch {
      calendarToken = '';
    }
    try {
      ({ accessToken: tasksToken } = await base44.asServiceRole.connectors.getConnection('googletasks'));
    } catch {
      tasksToken = '';
    }
    if (!calendarToken && !tasksToken) {
      return Response.json({ error: 'Google Calendar and Tasks are not connected yet.' }, { status: 409 });
    }

    const query = { status: { $in: OPEN_STATUSES } };
    if (businessId) query.business_id = businessId;

    const posts = await base44.entities.ScheduledPost
      .filter(query, { sort: 'scheduled_at', limit: POST_LIMIT })
      .then((page) => page.items || []);

    const businessNames = new Map();
    const listCache = { id: null };
    const errors = [];
    const result = { considered: posts.length, synced: 0, skipped: 0, events: 0, tasks: 0 };

    for (const post of posts) {
      const hash = contentHash(post);
      if (post.google_sync_hash === hash) {
        result.skipped += 1;
        continue;
      }

      if (!businessNames.has(post.business_id)) {
        const business = await base44.entities.Business.get(post.business_id).catch(() => null);
        businessNames.set(post.business_id, business?.name || '');
      }
      const businessName = businessNames.get(post.business_id) || '';

      const patch = {};
      let ok = true;

      const dropped = DROPPED_STATUSES.includes(post.status);
      const wantsEvent = CALENDAR_STATUSES.includes(post.status);

      if (calendarToken && (wantsEvent || (dropped && post.google_event_id))) {
        try {
          if (dropped) {
            await google(
              `${CAL}/calendars/primary/events/${encodeURIComponent(post.google_event_id)}`,
              calendarToken,
              { method: 'DELETE' }
            );
            patch.google_event_id = '';
          } else {
            const payload = eventBody(post, businessName);
            if (payload) {
              const saved = post.google_event_id
                ? await google(
                    `${CAL}/calendars/primary/events/${encodeURIComponent(post.google_event_id)}`,
                    calendarToken,
                    { method: 'PATCH', body: payload }
                  )
                : await google(`${CAL}/calendars/primary/events`, calendarToken, {
                    method: 'POST',
                    body: payload,
                  });
              if (saved?.id) {
                patch.google_event_id = saved.id;
                result.events += 1;
              } else {
                ok = false;
              }
            }
          }
        } catch (error) {
          ok = false;
          errors.push(`Calendar: ${error.message}`);
        }
      }

      if (tasksToken) {
        try {
          if (post.status === 'planned') {
            if (!post.google_task_id) {
              const listId = await ensureTaskList(tasksToken, listCache);
              if (!listId) {
                ok = false;
              } else {
                const task = await google(
                  `${TASKS}/lists/${encodeURIComponent(listId)}/tasks`,
                  tasksToken,
                  {
                    method: 'POST',
                    body: {
                      title: postLabel(post, businessName),
                      notes: [
                        post.caption || '',
                        post.scheduled_date
                          ? `Planned for ${post.scheduled_date}${post.scheduled_time ? ` at ${post.scheduled_time}` : ''}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join('\n\n'),
                    },
                  }
                );
                if (task?.id) {
                  patch.google_task_id = task.id;
                  result.tasks += 1;
                } else {
                  ok = false;
                }
              }
            }
          } else if (post.google_task_id) {
            // The post has moved on, so its review task is done.
            const listId = await ensureTaskList(tasksToken, listCache);
            if (listId) {
              await google(
                `${TASKS}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(post.google_task_id)}`,
                tasksToken,
                { method: 'PATCH', body: { status: 'completed' } }
              );
            }
          }
        } catch (error) {
          ok = false;
          errors.push(`Tasks: ${error.message}`);
        }
      }

      // Only record the hash once Google accepted everything, so a failed post is
      // retried on the next run rather than silently marked as done.
      if (!ok) continue;

      patch.google_sync_hash = hash;
      await base44.entities.ScheduledPost.update(post.id, patch);
      result.synced += 1;
    }

    return Response.json({ ...result, errors: errors.slice(0, 5) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}