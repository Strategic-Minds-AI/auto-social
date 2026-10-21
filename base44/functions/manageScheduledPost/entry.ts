import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolvePost, appendHistory, maxAttempts } from '../../shared/access.ts';
import { zonedToUtcIso, isValidTimeZone, DEFAULT_TIMEZONE } from '../../shared/time.ts';
import { publishToPage, pageTokenFor, postUrl } from '../../shared/facebook.ts';

// The approval and scheduling state machine.
//
// planned -> approved -> scheduled -> publishing -> published | failed
//                                     ^ any pre-published state can be cancelled
//
// Every transition validates the requested move, checks that the caller can reach
// the post's business, and appends a receipt to the post's history.

const ACTIONS = ['approve', 'reopen', 'schedule', 'reschedule', 'cancel', 'retry', 'publish_now'];

// Actions allowed from each status.
const ALLOWED_FROM = {
  approve: ['planned', 'cancelled', 'failed'],
  reopen: ['approved', 'scheduled', 'failed', 'cancelled'],
  schedule: ['planned', 'approved', 'scheduled', 'failed'],
  reschedule: ['planned', 'approved', 'scheduled', 'failed'],
  cancel: ['planned', 'approved', 'scheduled', 'failed'],
  retry: ['failed'],
  publish_now: ['planned', 'approved', 'scheduled', 'failed'],
};

function scheduleFields(post, body, base44) {
  const date = String(body.scheduled_date || post.scheduled_date || '').slice(0, 10);
  const time = String(body.scheduled_time || post.scheduled_time || '09:00').slice(0, 5);
  const zoneInput = body.timezone || post.timezone || DEFAULT_TIMEZONE;
  const timezone = isValidTimeZone(zoneInput) ? zoneInput : DEFAULT_TIMEZONE;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: 'A valid posting date is required.' };
  }
  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    return { ok: false, message: 'A valid posting time is required, for example 09:00.' };
  }
  const scheduledAt = zonedToUtcIso(date, time, timezone);
  if (!scheduledAt) return { ok: false, message: 'That date and time could not be interpreted.' };

  return {
    ok: true,
    fields: { scheduled_date: date, scheduled_time: time, timezone, scheduled_at: scheduledAt },
  };
}

async function publishOne({ base44, post, business, user, now, dryRun }) {
  if (post.platform !== 'facebook') {
    return {
      ok: false,
      message: `Publishing to ${post.platform} is not connected. Connect an account for ${post.platform} before scheduling it.`,
    };
  }

  const accountId = post.social_account_id;
  if (!accountId) {
    return { ok: false, message: 'No Facebook Page is linked to this post. Choose one in Social Accounts.' };
  }

  const account = await base44.entities.SocialAccount.get(accountId).catch(() => null);
  if (!account) {
    return { ok: false, message: 'The linked Facebook Page is no longer available. Re-link it in Social Accounts.' };
  }

  const caption = [post.caption, post.hashtags].filter(Boolean).join('\n\n').trim();
  const message = caption || post.title || '';

  let connection;
  try {
    connection = await base44.asServiceRole.connectors.getConnection('facebook_pages');
  } catch (error) {
    return { ok: false, message: `Facebook is not connected: ${error.message}` };
  }

  let pageAccessToken;
  try {
    pageAccessToken = await pageTokenFor(account.external_id, connection.accessToken);
  } catch (error) {
    await base44.entities.SocialAccount.update(account.id, { status: 'needs_reauth' }).catch(() => {});
    return { ok: false, message: error.message };
  }

  // Validation-only pass: the Page and its token are confirmed, nothing is sent.
  if (dryRun) {
    return { ok: true, dry: true, account_name: account.name, external_post_id: '', published_url: '' };
  }

  const result = await publishToPage({
    pageId: account.external_id,
    pageAccessToken,
    message,
    imageUrl: post.image_url || '',
  });

  await base44.entities.SocialAccount
    .update(account.id, { status: 'connected', last_verified_at: now })
    .catch(() => {});

  return {
    ok: true,
    external_post_id: result.postId,
    published_url: postUrl(account.external_id, result.postId),
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = ACTIONS.includes(body.action) ? body.action : null;
    if (!action) return Response.json({ error: 'Unsupported action.' }, { status: 400 });

    const resolved = await resolvePost(base44, body.post_id);
    if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });

    const { post, business } = resolved;
    const now = new Date().toISOString();
    const dryRun = body.dry_run === true;

    const allowed = ALLOWED_FROM[action] || [];
    if (!allowed.includes(post.status)) {
      return Response.json(
        { error: `A ${post.status} post cannot be ${action === 'publish_now' ? 'published' : action + 'd'}.` },
        { status: 409 }
      );
    }

    if (action === 'approve') {
      const updated = await base44.entities.ScheduledPost.update(post.id, {
        status: 'approved',
        approved_by: user.email || '',
        approved_at: now,
        approval_note: String(body.note || ''),
        publish_error: '',
        lock_token: '',
        locked_at: '',
        publish_history: appendHistory(post, 'approved', `Approved by ${user.email || 'a user'}`),
      });
      return Response.json({ post: updated });
    }

    if (action === 'reopen') {
      const updated = await base44.entities.ScheduledPost.update(post.id, {
        status: 'planned',
        approved_by: '',
        approved_at: '',
        publish_error: '',
        lock_token: '',
        locked_at: '',
        publish_history: appendHistory(post, 'reopened', 'Returned to review'),
      });
      return Response.json({ post: updated });
    }

    if (action === 'schedule' || action === 'reschedule') {
      const fields = scheduleFields(post, body, base44);
      if (!fields.ok) return Response.json({ error: fields.message }, { status: 400 });

      // The publishing Page must belong to this post's own business, so a forged
      // account id cannot route a post to a Page the caller does not own.
      let accountId = post.social_account_id || '';
      if (body.social_account_id !== undefined) {
        const requested = String(body.social_account_id || '');
        if (!requested) {
          accountId = '';
        } else {
          const account = await base44.entities.SocialAccount.get(requested).catch(() => null);
          if (!account) return Response.json({ error: 'That account is not available to you.' }, { status: 403 });
          if (account.business_id !== post.business_id) {
            return Response.json({ error: 'That account belongs to a different business.' }, { status: 403 });
          }
          accountId = account.id;
        }
      }

      const updated = await base44.entities.ScheduledPost.update(post.id, {
        ...fields.fields,
        social_account_id: accountId,
        status: 'scheduled',
        approved_by: post.approved_by || user.email || '',
        approved_at: post.approved_at || now,
        // A fresh schedule is a new intent to publish, so the receipt is cleared
        // and the idempotency key is re-minted from the new slot.
        idempotency_key: `${post.id}:${fields.fields.scheduled_at}`,
        publish_error: '',
        lock_token: '',
        locked_at: '',
        publish_attempts: 0,
        publish_history: appendHistory(
          post,
          action === 'schedule' ? 'scheduled' : 'rescheduled',
          `Set for ${fields.fields.scheduled_date} ${fields.fields.scheduled_time} (${fields.fields.timezone})`
        ),
      });
      return Response.json({ post: updated });
    }

    if (action === 'cancel') {
      if (post.status === 'published') {
        return Response.json({ error: 'A published post cannot be cancelled.' }, { status: 409 });
      }
      const updated = await base44.entities.ScheduledPost.update(post.id, {
        status: 'cancelled',
        cancelled_reason: String(body.reason || ''),
        lock_token: '',
        locked_at: '',
        publish_history: appendHistory(post, 'cancelled', String(body.reason || 'Cancelled')),
      });
      return Response.json({ post: updated });
    }

    if (action === 'retry') {
      const updated = await base44.entities.ScheduledPost.update(post.id, {
        status: post.scheduled_at ? 'scheduled' : 'approved',
        publish_attempts: 0,
        max_attempts: maxAttempts(body.max_attempts ?? post.max_attempts),
        publish_error: '',
        lock_token: '',
        locked_at: '',
        publish_history: appendHistory(post, 'retry', 'Retry requested'),
      });
      return Response.json({ post: updated });
    }

    // publish_now — an explicit, user-initiated publish of their own post.
    const fields = scheduleFields(post, body, base44);
    if (!fields.ok) return Response.json({ error: fields.message }, { status: 400 });

    const claimToken = `${user.id}-${Date.now()}`;
    await base44.entities.ScheduledPost.update(post.id, {
      status: 'publishing',
      lock_token: claimToken,
      locked_at: now,
      last_attempt_at: now,
      publish_attempts: (post.publish_attempts || 0) + 1,
      ...fields.fields,
      idempotency_key: post.idempotency_key || `${post.id}:${fields.fields.scheduled_at}`,
    });

    try {
      const outcome = await publishOne({ base44, post: { ...post, ...fields.fields }, business, user, now, dryRun });

      if (outcome.ok && outcome.dry) {
        const released = await base44.entities.ScheduledPost.update(post.id, {
          status: post.scheduled_at ? 'scheduled' : 'approved',
          lock_token: '',
          locked_at: '',
          publish_attempts: post.publish_attempts || 0,
          publish_error: '',
          publish_history: appendHistory(post, 'dry_run', `Validated against ${outcome.account_name}; nothing was sent.`),
        });
        return Response.json({ dry_run: true, account: outcome.account_name, post: released });
      }

      if (!outcome.ok) {
        const updated = await base44.entities.ScheduledPost.update(post.id, {
          status: 'failed',
          publish_error: outcome.message,
          lock_token: '',
          locked_at: '',
          publish_history: appendHistory(post, 'failed', outcome.message),
        });
        return Response.json({ error: outcome.message, post: updated }, { status: 502 });
      }

      const updated = await base44.entities.ScheduledPost.update(post.id, {
        status: 'published',
        external_post_id: outcome.external_post_id,
        published_url: outcome.published_url,
        published_at: now,
        publish_error: '',
        lock_token: '',
        locked_at: '',
        publish_history: appendHistory(post, 'published', `Published as ${outcome.external_post_id}`),
      });
      return Response.json({ post: updated });
    } catch (error) {
      const updated = await base44.entities.ScheduledPost.update(post.id, {
        status: 'failed',
        publish_error: error.message,
        lock_token: '',
        locked_at: '',
        publish_history: appendHistory(post, 'failed', error.message),
      });
      return Response.json({ error: error.message, post: updated }, { status: 502 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}