import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { appendHistory, DAILY_CALL_LIMIT, DAILY_TOKEN_BUDGET } from '../../shared/access.ts';
import { zonedToUtcIso, isValidTimeZone, DEFAULT_TIMEZONE } from '../../shared/time.ts';

// The self-healing loop.
//
// One sweep looks for everything that is stalled, blocked or broken, repairs what
// can be repaired without a human decision, flushes the publishing queue, and
// writes every finding to SystemIssue so the health board can show it. Anything
// that genuinely needs a person — a reconnect prompt, an unapproved post — is
// recorded as needs_you rather than guessed at.
//
// Safe to run as often as we like: every repair is idempotent, a re-queued post is
// capped so it cannot loop forever, and a finding that is gone next sweep clears
// itself.

const STALE_LOCK_MS = 15 * 60 * 1000;
const STALLED_JOB_MS = 60 * 60 * 1000;
const STALE_QUEUE_MS = 24 * 60 * 60 * 1000;
const OVERDUE_UNREVIEWED_MS = 24 * 60 * 60 * 1000;
const RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const EXTRA_ATTEMPTS = 2;
const WARN_AT = 0.8;

const TRANSIENT_FAILURE =
  /timeout|timed out|429|rate limit|5\d\d|unavailable|network|reset|fetch failed|temporarily|try again/i;

// Only platforms this app can actually publish to are watched.
const PUBLISH_CONNECTOR = { facebook: 'facebook_pages', instagram: 'instagram', linkedin: 'linkedin' };

const at = (value) => (value ? new Date(value).getTime() : 0);
const label = (post) =>
  post?.title || String(post?.caption || '').replace(/\s+/g, ' ').trim().slice(0, 48) || 'a post';
const clock = (value) =>
  value ? `${new Date(value).toISOString().slice(0, 16).replace('T', ' ')} UTC` : 'an earlier run';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const findings = [];
    let detectorsOk = true;

    // One failing detector must never make the others look clean, so each is
    // isolated and a failure simply suspends the auto-resolve pass.
    const track = async (run) => {
      try {
        await run();
      } catch {
        detectorsOk = false;
      }
    };

    // Owners, so a business's findings are readable by that business's owner.
    const owners = {};
    await track(async () => {
      const page = await svc.entities.Business.list({ limit: 50 });
      for (const business of page?.items || []) owners[business.id] = business.created_by_id || '';
    });

    const finding = (row) => findings.push({ owner_id: owners[row.business_id] || '', ...row });

    // --- 1. A post left mid-publish by a run that died. -----------------------
    await track(async () => {
      const page = await svc.entities.ScheduledPost.filter({ status: 'publishing' }, { limit: 25 });
      for (const post of page?.items || []) {
        if (now - at(post.locked_at) <= STALE_LOCK_MS) continue;
        const due = at(post.scheduled_at) <= now;
        await svc.entities.ScheduledPost.update(post.id, {
          status: due ? 'scheduled' : 'approved',
          lock_token: '',
          locked_at: '',
          publish_error: 'Released after an interrupted publishing run.',
          publish_history: appendHistory(post, 'released', 'Watchdog released a stale publishing lock'),
        });
        finding({
          key: `stuck:${post.id}`,
          kind: 'stuck_publish',
          severity: 'warning',
          status: 'auto_fixed',
          title: `Released a stuck publish on "${label(post)}"`,
          detail: `It had been sitting in publishing since ${clock(post.locked_at)} with no run holding it.`,
          fix: due
            ? 'Put back in the queue; the publisher picks it up within five minutes.'
            : 'Put back to approved until its slot arrives.',
          entity_name: 'ScheduledPost',
          record_id: post.id,
          business_id: post.business_id,
        });
      }
    });

    // --- 2. A post with no publishable instant. ------------------------------
    await track(async () => {
      // A missing instant is stored as null rather than left absent, so the page is
      // read and checked here instead of being trusted to a query operator.
      const page = await svc.entities.ScheduledPost.filter(
        { status: { $in: ['planned', 'approved', 'scheduled'] } },
        { sort: '-created_date', limit: 200 }
      );
      for (const post of page?.items || []) {
        if (post.scheduled_at) continue;
        if (!post.scheduled_date) {
          finding({
            key: `nodate:${post.id}`,
            kind: 'missing_due_date',
            severity: 'warning',
            status: 'needs_you',
            title: `"${label(post)}" has no posting date`,
            detail: 'It has no calendar day, so no instant to publish from.',
            fix: 'Give it a day and time in the Calendar, or cancel it.',
            entity_name: 'ScheduledPost',
            record_id: post.id,
            business_id: post.business_id,
          });
          continue;
        }
        const time = /^\d{1,2}:\d{2}$/.test(String(post.scheduled_time || '')) ? post.scheduled_time : '09:00';
        const zone = isValidTimeZone(post.timezone) ? post.timezone : DEFAULT_TIMEZONE;
        const scheduledAt = zonedToUtcIso(post.scheduled_date, time, zone);
        if (!scheduledAt) continue;
        await svc.entities.ScheduledPost.update(post.id, {
          scheduled_time: time,
          timezone: zone,
          scheduled_at: scheduledAt,
          idempotency_key: post.idempotency_key || `${post.id}:${scheduledAt}`,
          publish_history: appendHistory(post, 'healed', `Watchdog derived the publish instant: ${scheduledAt}`),
        });
        finding({
          key: `nodue:${post.id}`,
          kind: 'missing_due_date',
          severity: 'warning',
          status: 'auto_fixed',
          title: `Restored the publish time on "${label(post)}"`,
          detail: `It had no due instant even though it was set for ${post.scheduled_date}.`,
          fix: `Rebuilt it from ${post.scheduled_date} ${time} (${zone}), so it can now go out.`,
          entity_name: 'ScheduledPost',
          record_id: post.id,
          business_id: post.business_id,
        });
      }
    });

    // --- 3. Approved and past its slot, but never handed to the publisher. ---
    await track(async () => {
      const page = await svc.entities.ScheduledPost.filter(
        { status: 'approved', scheduled_at: { $lte: nowIso } },
        { sort: 'scheduled_at', limit: 25 }
      );
      for (const post of page?.items || []) {
        await svc.entities.ScheduledPost.update(post.id, {
          status: 'scheduled',
          publish_history: appendHistory(post, 'healed', 'Watchdog handed an approved, due post to the publisher'),
        });
        finding({
          key: `handover:${post.id}`,
          kind: 'due_not_scheduled',
          severity: 'warning',
          status: 'auto_fixed',
          title: `Handed "${label(post)}" to the publisher`,
          detail: `It was approved and due at ${clock(post.scheduled_at)} but had never been queued.`,
          fix: 'Moved it into the publishing queue; approval was already given, so nothing was sent unasked.',
          entity_name: 'ScheduledPost',
          record_id: post.id,
          business_id: post.business_id,
        });
      }
    });

    // --- 4. Posts that failed, split into retryable and needs-you. -----------
    await track(async () => {
      const page = await svc.entities.ScheduledPost.filter({ status: 'failed' }, { sort: '-last_attempt_at', limit: 25 });
      for (const post of page?.items || []) {
        const attempts = Number(post.publish_attempts) || 0;
        const limit = Number(post.max_attempts) || 3;
        const fresh = now - at(post.last_attempt_at || post.updated_date) <= RETRY_WINDOW_MS;
        const transient = TRANSIENT_FAILURE.test(String(post.publish_error || ''));
        const canRetry = fresh && transient && attempts < limit + EXTRA_ATTEMPTS;

        if (canRetry) {
          await svc.entities.ScheduledPost.update(post.id, {
            status: post.scheduled_at ? 'scheduled' : 'approved',
            max_attempts: attempts + 1,
            publish_error: '',
            lock_token: '',
            locked_at: '',
            publish_history: appendHistory(post, 'requeued', 'Watchdog re-queued a transient publishing failure'),
          });
          finding({
            key: `retry:${post.id}`,
            kind: 'failed_publish',
            severity: 'warning',
            status: 'auto_fixed',
            title: `Re-queued "${label(post)}" after a transient failure`,
            detail: String(post.publish_error || '').slice(0, 200) || 'The platform returned a temporary error.',
            fix: `Given one more attempt (${attempts + 1} of ${limit + EXTRA_ATTEMPTS} allowed).`,
            entity_name: 'ScheduledPost',
            record_id: post.id,
            business_id: post.business_id,
          });
        } else {
          finding({
            key: `dead:${post.id}`,
            kind: 'failed_publish',
            severity: 'critical',
            status: 'needs_you',
            title: `"${label(post)}" could not be published`,
            detail: String(post.publish_error || '').slice(0, 200) || 'Publishing failed.',
            fix: 'Reconnect the account in Social Accounts, then retry the post in the Approval Queue.',
            entity_name: 'ScheduledPost',
            record_id: post.id,
            business_id: post.business_id,
          });
        }
      }
    });

    // --- 5. Reviewed-by-nobody posts that are a day past their slot. ---------
    await track(async () => {
      const cutoff = new Date(now - OVERDUE_UNREVIEWED_MS).toISOString();
      const page = await svc.entities.ScheduledPost.filter(
        { status: 'planned', scheduled_at: { $lt: cutoff } },
        { sort: 'scheduled_at', limit: 25 }
      );
      for (const post of page?.items || []) {
        finding({
          key: `unreviewed:${post.id}`,
          kind: 'overdue_unapproved',
          severity: 'warning',
          status: 'needs_you',
          title: `"${label(post)}" is over a day past its slot, waiting for review`,
          detail: `It was set for ${clock(post.scheduled_at)} and is still unapproved.`,
          fix: 'Approve it in the Approval Queue, or reschedule it for a day that still works.',
          entity_name: 'ScheduledPost',
          record_id: post.id,
          business_id: post.business_id,
        });
      }
    });

    // --- 6. Video jobs stuck in flight. -------------------------------------
    await track(async () => {
      const page = await svc.entities.VideoJob.filter(
        { status: { $in: ['queued', 'generating'] } },
        { sort: 'submitted_at', limit: 25 }
      );
      for (const job of page?.items || []) {
        const since = at(job.submitted_at || job.created_date);
        const waiting = now - since;
        const attempts = Number(job.attempts) || 0;
        const title = job.post_title || 'a video';
        if (job.status === 'generating' && waiting > STALLED_JOB_MS) {
          if (attempts >= 3) {
            await svc.entities.VideoJob.update(job.id, {
              status: 'failed',
              last_error: 'Stalled for over an hour and was set aside after three attempts.',
            });
            finding({
              key: `video:${job.id}`,
              kind: 'video_stuck',
              severity: 'warning',
              status: 'needs_you',
              title: `Video for "${title}" stalled`,
              detail: `It sat generating since ${clock(job.submitted_at || job.created_date)} across ${attempts} attempts.`,
              fix: 'Set aside so it stops burning credits. Queue it again from Video Studio when you want it.',
              entity_name: 'VideoJob',
              record_id: job.id,
              business_id: job.business_id,
            });
          } else {
            await svc.entities.VideoJob.update(job.id, {
              status: 'queued',
              attempts: attempts + 1,
              last_error: 'Re-queued by the watchdog after stalling.',
            });
            finding({
              key: `video:${job.id}`,
              kind: 'video_stuck',
              severity: 'warning',
              status: 'auto_fixed',
              title: `Re-queued the video for "${title}"`,
              detail: `It had been generating since ${clock(job.submitted_at || job.created_date)}.`,
              fix: `Put back in the queue (attempt ${attempts + 1} of 3).`,
              entity_name: 'VideoJob',
              record_id: job.id,
              business_id: job.business_id,
            });
          }
        } else if (job.status === 'queued' && waiting > STALE_QUEUE_MS) {
          finding({
            key: `video:${job.id}`,
            kind: 'video_stuck',
            severity: 'warning',
            status: 'needs_you',
            title: `Video for "${title}" has waited a day`,
            detail: `Queued since ${clock(job.submitted_at || job.created_date)} and never started.`,
            fix: 'Check whether the video factory is paused, or queue it again from Video Studio.',
            entity_name: 'VideoJob',
            record_id: job.id,
            business_id: job.business_id,
          });
        }
      }
    });

    // --- 7. A connection whose token has died. ------------------------------
    await track(async () => {
      const page = await svc.entities.SocialAccount.filter({ status: 'needs_reauth' }, { limit: 25 });
      for (const account of page?.items || []) {
        finding({
          key: `reauth:${account.id}`,
          kind: 'account_reauth',
          severity: 'critical',
          status: 'needs_you',
          title: `${account.name || account.platform} needs reconnecting`,
          detail: `The ${account.platform} connection stopped accepting calls, so its posts cannot go out.`,
          fix: 'Open Social Accounts and reconnect it. This is the one thing no system can do for you.',
          entity_name: 'SocialAccount',
          record_id: account.id,
          business_id: account.business_id,
        });
      }
    });

    // --- 8. A connector the app publishes through being unreachable. --------
    await track(async () => {
      const accounts = await svc.entities.SocialAccount.list({ limit: 100 });
      const platforms = Array.from(new Set((accounts?.items || []).map((a) => a.platform))).filter(
        (p) => PUBLISH_CONNECTOR[p]
      );
      for (const platform of platforms) {
        try {
          await svc.connectors.getConnection(PUBLISH_CONNECTOR[platform]);
        } catch (error) {
          finding({
            key: `connector:${PUBLISH_CONNECTOR[platform]}`,
            kind: 'integration_down',
            severity: 'critical',
            status: 'needs_you',
            title: `${platform} is not connected right now`,
            detail: String(error?.message || 'The connection could not be reached.').slice(0, 200),
            fix: 'Reconnect it in Social Accounts. Posts queued for it will wait rather than fail.',
            entity_name: 'SocialAccount',
            record_id: '',
            business_id: '',
          });
        }
      }
    });

    // --- 9. The daily AI budget. --------------------------------------------
    await track(async () => {
      const day = nowIso.slice(0, 10);
      const page = await svc.entities.AiUsage.filter({ day }, { limit: 300 });
      const rows = page?.items || [];
      const calls = rows.reduce((n, r) => n + (Number(r.calls) || 0), 0);
      const tokens = rows.reduce((n, r) => n + (Number(r.tokens) || 0), 0);
      const spent = calls >= DAILY_CALL_LIMIT || tokens >= DAILY_TOKEN_BUDGET;
      const near = calls >= DAILY_CALL_LIMIT * WARN_AT || tokens >= DAILY_TOKEN_BUDGET * WARN_AT;
      if (!spent && !near) return;
      finding({
        key: 'budget:today',
        kind: 'ai_budget',
        severity: spent ? 'critical' : 'warning',
        status: spent ? 'needs_you' : 'open',
        title: spent ? 'The daily AI budget is used up' : 'The AI budget is nearly used up',
        detail: `${calls} of ${DAILY_CALL_LIMIT} calls and ${tokens} of ${DAILY_TOKEN_BUDGET} tokens used today.`,
        fix: spent
          ? 'Generation is paused until midnight UTC. Raise the limits in the app secrets to go higher.'
          : 'Generation still runs. It pauses on its own if the budget runs out.',
        entity_name: 'AiUsage',
        record_id: '',
        business_id: '',
      });
    });

    // --- Repair pass: hand anything due to the publisher. -------------------
    let flush = null;
    const dueNow = await svc.entities.ScheduledPost
      .count({ status: 'scheduled', scheduled_at: { $lte: nowIso } })
      .catch(() => 0);
    if (dueNow > 0) {
      try {
        const response = await base44.functions.invoke('publishDuePosts', {});
        flush = response?.data || null;
        const outcomes = flush?.results || [];
        const blocked = outcomes.filter((r) => r.outcome === 'blocked' || r.outcome === 'failed');
        for (const item of blocked.slice(0, 5)) {
          finding({
            key: `publish:${item.id}`,
            kind: 'failed_publish',
            severity: 'warning',
            status: 'needs_you',
            title: 'A post could not be published on this pass',
            detail: String(item.message || '').slice(0, 200),
            fix: 'Reconnect the account if it is the cause, then retry the post in the Approval Queue.',
            entity_name: 'ScheduledPost',
            record_id: item.id,
            business_id: '',
          });
        }
      } catch (error) {
        detectorsOk = false;
        finding({
          key: 'flush:failed',
          kind: 'publish_flush',
          severity: 'warning',
          status: 'needs_you',
          title: 'The publisher could not be triggered',
          detail: String(error?.message || '').slice(0, 200),
          fix: 'The publish job runs on its own every five minutes, so due posts still go out.',
          entity_name: '',
          record_id: '',
          business_id: '',
        });
      }
    }

    // --- Keep one row per problem, not one per sweep. -----------------------
    const keys = findings.map((f) => f.key);
    const rows = keys.length
      ? await svc.entities.SystemIssue
          .filter({ dedupe_key: { $in: keys } }, { sort: '-last_seen_at', limit: 200 })
          .then((page) => page?.items || [])
          .catch(() => [])
      : [];
    const byKey = new Map();
    for (const row of rows) if (!byKey.has(row.dedupe_key)) byKey.set(row.dedupe_key, row);

    const creates = [];
    const updates = [];
    for (const item of findings) {
      const existing = byKey.get(item.key);
      const payload = {
        owner_id: item.owner_id,
        business_id: item.business_id || '',
        kind: item.kind,
        severity: item.severity,
        title: item.title,
        detail: item.detail,
        fix: item.fix,
        status: item.status,
        entity_name: item.entity_name || '',
        record_id: item.record_id || '',
        dedupe_key: item.key,
        last_seen_at: nowIso,
        resolved_at: '',
        source: 'watchdog',
      };
      if (existing) {
        updates.push({ id: existing.id, ...payload, occurrences: (Number(existing.occurrences) || 1) + 1 });
      } else {
        creates.push({ ...payload, occurrences: 1, first_seen_at: nowIso });
      }
    }

    if (creates.length) await svc.entities.SystemIssue.bulkCreate(creates).catch(() => {});
    if (updates.length) await svc.entities.SystemIssue.bulkUpdate(updates).catch(() => {});

    // A problem that is gone is closed by itself, unless a detector failed.
    if (detectorsOk) {
      const open = await svc.entities.SystemIssue
        .filter({ status: { $in: ['open', 'needs_you', 'auto_fixed'] } }, { limit: 200 })
        .then((page) => page?.items || [])
        .catch(() => []);
      const seen = new Set(keys);
      const cleared = open.filter((row) => !seen.has(row.dedupe_key));
      if (cleared.length) {
        await svc.entities.SystemIssue
          .bulkUpdate(cleared.map((row) => ({ id: row.id, status: 'resolved', resolved_at: nowIso })))
          .catch(() => {});
      }
    }

    const repaired = findings.filter((f) => f.status === 'auto_fixed');
    const needsYou = findings.filter((f) => f.status === 'needs_you');
    const total = findings.length;
    const health = total ? Math.round((repaired.length / total) * 100) : 100;

    const list = (items, empty) =>
      (items.length ? items.map((f) => f.title) : [empty]).join(' · ').slice(0, 600);

    return Response.json({
      detected: total,
      auto_fixed: repaired.length,
      needs_you: needsYou.length,
      health,
      alert_count: needsYou.length,
      recipient: user.email,
      repaired: list(repaired, 'Nothing needed repair on this sweep.'),
      attention: list(needsYou, 'Nothing needs you.'),
      ran_at_label: `${nowIso.slice(0, 16).replace('T', ' ')} UTC`,
      flush: flush ? { published: flush.published, failed: flush.failed, blocked: flush.blocked } : null,
      detectors_ok: detectorsOk,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}