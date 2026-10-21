// Tenant access + AI budget enforcement.
//
// Every function that touches business-owned data resolves it through here, so a
// forged business/campaign/post id in a direct function request is rejected even
// though the caller is authenticated. Reads go through the user-scoped client, so
// the entity's own row-level security is the first gate; this module is the second.

const MAX_ATTEMPTS_DEFAULT = 3;

export const DAILY_CALL_LIMIT = 250;
export const DAILY_TOKEN_BUDGET = 500000;

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolve a business the caller is actually allowed to use.
 * Returns { ok: true, business } or { ok: false, status, message }.
 */
export async function resolveBusiness(base44, businessId) {
  if (!businessId || typeof businessId !== 'string') {
    return { ok: false, status: 400, message: 'Select a business first.' };
  }
  const business = await base44.entities.Business.get(businessId).catch(() => null);
  if (!business) {
    return { ok: false, status: 403, message: 'That business is not available to you.' };
  }
  return { ok: true, business };
}

/**
 * Resolve a scheduled post and confirm the caller can act on its business.
 * A post whose business the caller cannot read is treated as not found.
 */
export async function resolvePost(base44, postId) {
  if (!postId || typeof postId !== 'string') {
    return { ok: false, status: 400, message: 'Missing post id.' };
  }
  const post = await base44.entities.ScheduledPost.get(postId).catch(() => null);
  if (!post) {
    return { ok: false, status: 404, message: 'That post is not available to you.' };
  }
  const business = await base44.entities.Business.get(post.business_id).catch(() => null);
  if (!business) {
    return { ok: false, status: 403, message: 'That post belongs to a business you cannot access.' };
  }
  return { ok: true, post, business };
}

/**
 * Resolve a campaign and confirm the caller can act on its business.
 */
export async function resolveCampaign(base44, campaignId) {
  if (!campaignId || typeof campaignId !== 'string') {
    return { ok: false, status: 400, message: 'Missing campaign id.' };
  }
  const campaign = await base44.entities.Campaign.get(campaignId).catch(() => null);
  if (!campaign) {
    return { ok: false, status: 404, message: 'That campaign is not available to you.' };
  }
  const business = await base44.entities.Business.get(campaign.business_id).catch(() => null);
  if (!business) {
    return { ok: false, status: 403, message: 'That campaign belongs to a business you cannot access.' };
  }
  return { ok: true, campaign, business };
}

function todayRow(rows, userId) {
  const day = utcDay();
  return (rows || []).find((r) => r.user_id === userId && r.day === day) || null;
}

/**
 * Per-user daily AI budget. Called before any gateway request.
 * Returns the current usage so callers can report cost impact.
 */
export async function checkAiBudget(base44, user) {
  const rows = await base44.entities.AiUsage
    .filter({ user_id: user.id, day: utcDay() }, { limit: 1 })
    .then((page) => page.items || [])
    .catch(() => []);

  const row = todayRow(rows, user.id);
  const calls = row?.calls || 0;
  const tokens = row?.tokens || 0;

  if (calls >= DAILY_CALL_LIMIT) {
    return {
      ok: false,
      status: 429,
      message: `Daily AI request limit reached (${DAILY_CALL_LIMIT}). It resets at midnight UTC.`,
      usage: { calls, tokens, call_limit: DAILY_CALL_LIMIT, token_budget: DAILY_TOKEN_BUDGET },
    };
  }
  if (tokens >= DAILY_TOKEN_BUDGET) {
    return {
      ok: false,
      status: 429,
      message: `Daily AI token budget reached (${DAILY_TOKEN_BUDGET}). It resets at midnight UTC.`,
      usage: { calls, tokens, call_limit: DAILY_CALL_LIMIT, token_budget: DAILY_TOKEN_BUDGET },
    };
  }
  return {
    ok: true,
    usage: { calls, tokens, call_limit: DAILY_CALL_LIMIT, token_budget: DAILY_TOKEN_BUDGET },
  };
}

/**
 * Record one AI call and its token usage against the caller's daily budget.
 * Never throws: a bookkeeping failure must not lose generated content.
 */
export async function recordAiUsage(base44, user, meta) {
  try {
    const tokens = Number(meta?.total_tokens) || 0;
    const rows = await base44.entities.AiUsage
      .filter({ user_id: user.id, day: utcDay() }, { limit: 1 })
      .then((page) => page.items || []);
    const row = todayRow(rows, user.id);
    if (row) {
      await base44.entities.AiUsage.update(row.id, {
        calls: (row.calls || 0) + 1,
        tokens: (row.tokens || 0) + tokens,
      });
    } else {
      await base44.entities.AiUsage.create({
        user_id: user.id,
        user_email: user.email || '',
        day: utcDay(),
        calls: 1,
        tokens,
      });
    }
  } catch {
    // Intentionally swallowed.
  }
}

export function maxAttempts(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 5) : MAX_ATTEMPTS_DEFAULT;
}

/** Append one entry to a post's publish/approval receipt trail. */
export function appendHistory(post, event, message) {
  const history = Array.isArray(post?.publish_history) ? post.publish_history : [];
  const next = history.concat([{ at: new Date().toISOString(), event, message: String(message || '') }]);
  return next.slice(-25);
}