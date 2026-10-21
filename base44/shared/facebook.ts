// Facebook Pages Graph API helpers.
//
// Page access tokens are treated as secrets: they are derived on demand inside a
// function and never persisted on an entity or returned to the frontend.

const GRAPH_VERSION = 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const REQUEST_TIMEOUT_MS = 20000;

function graphUrl(path) {
  return `${GRAPH_BASE}/${path.replace(/^\/+/, '')}`;
}

async function graphGet(path, accessToken) {
  const url = `${graphUrl(path)}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Facebook request failed (HTTP ${response.status})`);
  }
  return payload;
}

async function graphPost(path, accessToken, body) {
  const response = await fetch(graphUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: accessToken }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Facebook publish failed (HTTP ${response.status})`);
  }
  return payload;
}

function pageRecord(page, business) {
  return {
    id: page.id,
    name: page.name || 'Untitled Page',
    has_token: Boolean(page.access_token),
    business_id: business?.id || null,
    business_name: business?.name || null,
    // Access token is intentionally dropped here.
  };
}

/**
 * List every Page the connected account can publish to.
 *
 * /me/accounts only returns Pages with a direct task assignment, so Pages owned
 * by or shared with a Business Manager are invisible without also walking the
 * businesses. A Page can appear in both lists, so results are merged by id and a
 * Business Manager match always wins the business label.
 */
export async function listManagedPages(accessToken) {
  const pages = new Map();

  const accounts = await graphGet('/me/accounts?fields=id,name,access_token&limit=100', accessToken);
  for (const page of accounts?.data || []) {
    pages.set(page.id, {
      token: page.access_token || '',
      record: pageRecord(page, null),
    });
  }

  let businesses = [];
  try {
    const res = await graphGet('/me/businesses?fields=id,name&limit=100', accessToken);
    businesses = res?.data || [];
  } catch {
    // business_management may not be granted; direct Pages still work.
    businesses = [];
  }

  for (const business of businesses) {
    for (const edge of ['client_pages', 'owned_pages']) {
      let rows = [];
      try {
        const res = await graphGet(`/${business.id}/${edge}?fields=id,name,access_token&limit=100`, accessToken);
        rows = res?.data || [];
      } catch {
        rows = [];
      }
      for (const page of rows) {
        const existing = pages.get(page.id);
        if (existing) {
          // Never let the direct record blank out the Business Manager label.
          existing.record.business_id = business.id;
          existing.record.business_name = business.name || null;
          if (!existing.token && page.access_token) existing.token = page.access_token;
          if (!existing.record.has_token && page.access_token) existing.record.has_token = true;
        } else {
          pages.set(page.id, {
            token: page.access_token || '',
            record: pageRecord(page, business),
          });
        }
      }
    }
  }

  return {
    pages: Array.from(pages.values()).map((entry) => entry.record),
    businesses: businesses.map((b) => ({ id: b.id, name: b.name })),
  };
}

/** Derive the page access token for one Page. */
export async function pageTokenFor(pageId, accessToken) {
  const { pages } = await listManagedPages(accessToken);
  const match = pages.find((p) => p.id === pageId);
  if (!match) {
    throw new Error('That Page is not available on the connected Facebook account. Re-select it in Social Accounts.');
  }
  const res = await graphGet(`/${pageId}?fields=access_token`, accessToken);
  const token = res?.access_token;
  if (!token) {
    throw new Error('Facebook did not return a publishing token for that Page. Reconnect the Facebook connector.');
  }
  return token;
}

/**
 * Publish one post to a Page.
 * Uses the photos edge when an image is attached, otherwise the feed edge.
 */
export async function publishToPage({ pageId, pageAccessToken, message, imageUrl }) {
  const text = String(message || '').trim();
  if (!text) throw new Error('This post has no caption, so there is nothing to publish.');

  if (imageUrl) {
    const photo = await graphPost(`/${pageId}/photos`, pageAccessToken, { url: imageUrl, caption: text });
    return { postId: photo?.post_id || photo?.id || '' };
  }

  const feed = await graphPost(`/${pageId}/feed`, pageAccessToken, { message: text });
  return { postId: feed?.id || '' };
}

export function postUrl(pageId, postId) {
  if (!pageId || !postId) return '';
  const bare = String(postId).includes('_') ? String(postId).split('_').pop() : String(postId);
  return `https://www.facebook.com/${pageId}/posts/${bare}`;
}

/** Current Page follower counts. Impressions/fans metrics are retired by Meta. */
export async function pageFollowerCounts(pageId, pageAccessToken) {
  const res = await graphGet(`/${pageId}?fields=fan_count,followers_count`, pageAccessToken);
  return { fan_count: res?.fan_count ?? null, followers_count: res?.followers_count ?? null };
}