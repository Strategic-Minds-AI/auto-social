import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { appendHistory } from '../../shared/access.ts';
import { publishToPage, pageTokenFor, postUrl } from '../../shared/facebook.ts';
import { publishReelToInstagram, validateReelForInstagram } from '../../shared/instagram.ts';
import { linkedinProfile, publishToLinkedIn } from '../../shared/linkedin.ts';
import { publishingAccountError, unconfirmedPublishMessage, needsPublishReconciliation } from '../../shared/publish-safety.ts';

// Durable publishing job. Scheduled to run frequently; picks up every post whose
// slot has passed and records publishing attempts and provider receipts.
//
// Safety properties:
// - admin-only, because it acts across all businesses through the service role
// - the linked account must match the post's business and platform
// - unknown provider outcomes are quarantined for reconciliation, never auto-retried
// - Base44 update/get is NOT an atomic claim. Concurrent execution remains a
//   release blocker; idempotency_key is local metadata, not provider deduplication
// - attempts are bounded and spaced, so a broken connection fails visibly instead
//   of retrying forever
// - a platform whose integration is not connected is reported and left alone, so
//   an outage cannot burn a post's attempts

const BATCH_LIMIT = 10;
const STALE_LOCK_MS = 10 * 60 * 1000;
const RETRY_BACKOFF_MS = 5 * 60 * 1000;

// The connector that backs each platform this pipeline can publish through.
const CONNECTOR_FOR = { facebook: 'facebook_pages', instagram: 'instagram', linkedin: 'linkedin' };

const ACCOUNT_LABEL = {
  facebook: 'Facebook Page',
  instagram: 'Instagram account',
  linkedin: 'LinkedIn account',
};

async function claimPost(base44, post, token, now) {
  await base44.asServiceRole.entities.ScheduledPost.update(post.id, {
    status: 'publishing',
    lock_token: token,
    locked_at: now,
    last_attempt_at: now,
    publish_attempts: (post.publish_attempts || 0) + 1,
  });
  // Re-read to confirm this run actually holds the claim.
  const check = await base44.asServiceRole.entities.ScheduledPost.get(post.id).catch(() => null);
  return check && check.lock_token === token ? check : null;
}

async function publishToFacebookPage({ base44, post, account, message, connection }) {
  let pageAccessToken;
  try {
    pageAccessToken = await pageTokenFor(account.external_id, connection.accessToken);
  } catch (error) {
    await base44.asServiceRole.entities.SocialAccount
      .update(account.id, { status: 'needs_reauth' })
      .catch(() => {});
    throw error;
  }

  const outcome = await publishToPage({
    pageId: account.external_id,
    pageAccessToken,
    message,
    imageUrl: post.image_url || '',
  });

  return { external_post_id: outcome.postId, published_url: postUrl(account.external_id, outcome.postId) };
}

// A LinkedIn post publishes to the member's own feed, with the post copy as its
// commentary and the post image uploaded ahead of it.
async function publishToLinkedInAccount({ post, account, message, connection }) {
  return publishToLinkedIn({
    accessToken: connection.accessToken,
    authorUrn: account.external_id,
    text: message,
    imageUrl: post.image_url || '',
  });
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const nowMs = Date.now();
    // A validation-only pass: every check and token derivation runs, nothing is sent.
    const dryRun = body.dry_run === true;

    const due = await base44.asServiceRole.entities.ScheduledPost.filter(
      { status: 'scheduled', scheduled_at: { $lte: now } },
      { sort: 'scheduled_at', limit: BATCH_LIMIT }
    );

    const candidates = (due?.items || []).filter((post) => {
      // Space out retries so a failing connection is not hammered every run.
      if (!post.last_attempt_at) return true;
      return nowMs - new Date(post.last_attempt_at).getTime() >= RETRY_BACKOFF_MS;
    });

    // A stale lock may hide a successful provider write whose receipt was lost.
    // Never release that uncertainty back into the automatic publishing queue.
    const reconciliations = [];
    const stuck = await base44.asServiceRole.entities.ScheduledPost.filter(
      { status: 'publishing' },
      { limit: BATCH_LIMIT }
    );
    for (const post of stuck?.items || []) {
      const lockedAt = post.locked_at ? new Date(post.locked_at).getTime() : 0;
      if (!dryRun && nowMs - lockedAt > STALE_LOCK_MS) {
        const knownReceipt = typeof post.external_post_id === 'string' && post.external_post_id.trim();
        const message = knownReceipt ? 'Recovered the saved provider receipt.' : unconfirmedPublishMessage('A previous publishing attempt was interrupted.');
        await base44.asServiceRole.entities.ScheduledPost.update(post.id, {
          status: knownReceipt ? 'published' : 'failed',
          lock_token: '',
          locked_at: '',
          publish_error: knownReceipt ? '' : message,
          publish_history: appendHistory(post, knownReceipt ? 'receipt_recovered' : 'outcome_unknown', message),
        });
        reconciliations.push({ id: post.id, outcome: knownReceipt ? 'receipt_recovered' : 'reconciliation_required', message });
      }
    }

    if (!candidates.length) {
      return Response.json({ processed: 0, published: 0, failed: 0, skipped: 0, blocked: 0, results: reconciliations });
    }

    // A missing connection is not the post's fault, so those posts are reported
    // and left untouched instead of spending their publish attempts.
    const connections = {};
    const blocked = [];
    for (const platform of Array.from(new Set(candidates.map((post) => post.platform)))) {
      const connector = CONNECTOR_FOR[platform];
      if (!connector) continue; // surfaced below as a per-post failure
      try {
        connections[platform] = await base44.asServiceRole.connectors.getConnection(connector);
      } catch (error) {
        for (const post of candidates.filter((p) => p.platform === platform)) {
          blocked.push({ id: post.id, outcome: 'blocked', message: `${platform} is not connected: ${error.message}` });
        }
      }
    }

    const blockedIds = new Set(blocked.map((entry) => entry.id));
    const eligible = candidates.filter((post) => !blockedIds.has(post.id));

    if (!eligible.length) {
      return Response.json({
        processed: 0,
        published: 0,
        failed: 0,
        skipped: 0,
        blocked: blocked.length,
        results: [...reconciliations, ...blocked],
      });
    }

    const results = [...reconciliations, ...blocked];
    let published = 0;
    let failed = 0;
    let skipped = 0;

    for (const candidate of eligible) {
      if (needsPublishReconciliation(candidate)) {
        skipped += 1;
        results.push({ id: candidate.id, outcome: 'reconciliation_required', message: 'Reconcile the previous provider outcome before publishing this post.' });
        continue;
      }
      const token = crypto.randomUUID();
      const claimed = dryRun ? candidate : await claimPost(base44, candidate, token, now);
      if (!claimed) {
        skipped += 1;
        results.push({ id: candidate.id, outcome: 'skipped', message: 'Another run is publishing this post.' });
        continue;
      }
      const post = claimed;

      // Already published by an earlier attempt — never send it twice.
      if (claimed.external_post_id) {
        if (!dryRun) await base44.asServiceRole.entities.ScheduledPost.update(post.id, {
          status: 'published',
          lock_token: '',
          locked_at: '',
        });
        skipped += 1;
        results.push({ id: post.id, outcome: 'skipped', message: 'Already published.' });
        continue;
      }

      const attemptNumber = claimed.publish_attempts || 1;
      const limit = claimed.max_attempts || 3;

      const fail = async (message, unconfirmed = false) => {
        const exhausted = attemptNumber >= limit;
        const nextStatus = unconfirmed || exhausted ? 'failed' : 'scheduled';
        const recordedMessage = unconfirmed ? unconfirmedPublishMessage(message) : message;
        if (!dryRun) await base44.asServiceRole.entities.ScheduledPost.update(post.id, {
          status: nextStatus,
          publish_error: unconfirmed ? recordedMessage : exhausted
            ? `${message} (gave up after ${attemptNumber} attempts)`
            : `${message} (attempt ${attemptNumber} of ${limit})`,
          lock_token: '',
          locked_at: '',
          publish_history: appendHistory(claimed, unconfirmed ? 'outcome_unknown' : exhausted ? 'failed' : 'attempt_failed', recordedMessage),
        });
        failed += 1;
        results.push({ id: post.id, outcome: dryRun ? 'validation_failed' : unconfirmed ? 'reconciliation_required' : exhausted ? 'failed' : 'will_retry', message: recordedMessage });
      };

      if (!CONNECTOR_FOR[post.platform]) {
        await fail(`No publishing integration is connected for ${post.platform}.`);
        continue;
      }

      const label = ACCOUNT_LABEL[post.platform] || 'account';

      if (!post.social_account_id) {
        await fail(`No ${label} is linked to this post.`);
        continue;
      }

      const account = await base44.asServiceRole.entities.SocialAccount.get(post.social_account_id).catch(() => null);
      const accountError = publishingAccountError(post, account);
      if (accountError) {
        await fail(accountError);
        continue;
      }
      if (!connections[post.platform]) {
        await fail('The publishing connection changed while this post was being claimed.');
        continue;
      }

      const message = [post.caption, post.hashtags].filter(Boolean).join('\n\n').trim() || post.title || '';

      // Validation-only pass: every precondition is checked, nothing is sent.
      if (dryRun) {
        try {
          if (post.platform === 'instagram') {
            await validateReelForInstagram({ base44, post });
          } else if (post.platform === 'linkedin') {
            await linkedinProfile(connections.linkedin.accessToken);
          } else {
            await pageTokenFor(account.external_id, connections.facebook.accessToken);
          }
        } catch (error) {
          await fail(error.message);
          continue;
        }

        skipped += 1;
        results.push({ id: post.id, outcome: 'dry_run', account: account.name, message: `Ready to publish to ${account.name}.` });
        continue;
      }

      try {
        let outcome;
        if (post.platform === 'instagram') {
          outcome = await publishReelToInstagram({ base44, post, account });
        } else if (post.platform === 'linkedin') {
          outcome = await publishToLinkedInAccount({ post, account, message, connection: connections.linkedin });
        } else {
          outcome = await publishToFacebookPage({
            base44,
            post,
            account,
            message,
            connection: connections.facebook,
          });
        }

        if (typeof outcome?.external_post_id !== 'string' || !outcome.external_post_id.trim()) {
          throw new Error('The provider returned no durable post receipt.');
        }

        await base44.asServiceRole.entities.SocialAccount
          .update(account.id, { status: 'connected', last_verified_at: now })
          .catch(() => {});

        const updated = await base44.asServiceRole.entities.ScheduledPost.update(post.id, {
          status: 'published',
          external_post_id: outcome.external_post_id,
          published_url: outcome.published_url || '',
          published_at: now,
          publish_error: '',
          lock_token: '',
          locked_at: '',
          publish_history: appendHistory(claimed, 'published', `Published as ${outcome.external_post_id}`),
        });

        published += 1;
        results.push({ id: post.id, outcome: 'published', post_id: outcome.external_post_id, url: updated?.published_url || '' });
      } catch (error) {
        if (error?.needsReauth) {
          await base44.asServiceRole.entities.SocialAccount
            .update(account.id, { status: 'needs_reauth' })
            .catch(() => {});
        }
        await fail(error.message, true);
      }
    }

    return Response.json({
      processed: eligible.length,
      published,
      failed,
      skipped,
      blocked: blocked.length,
      results,
      dry_run: dryRun,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
