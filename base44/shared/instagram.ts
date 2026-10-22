// Instagram publishing helpers (Instagram API with Instagram Login).
//
// The Instagram connector token only works against graph.instagram.com — never
// graph.facebook.com — and travels as a query parameter rather than a header.
// Tokens are derived on demand inside a function and are never persisted on an
// entity or returned to the frontend.

const API_VERSION = 'v23.0';
const API_BASE = `https://graph.instagram.com/${API_VERSION}`;
const REQUEST_TIMEOUT_MS = 20000;
const DELIVERY_TIMEOUT_MS = 15000;
// Instagram processes a video container before it can be published, so the
// container is polled for a short while rather than published too early.
const PROCESSING_POLLS = 12;
const PROCESSING_INTERVAL_MS = 2000;
// Video job statuses that mean the clip has been cleared for publishing.
const REEL_READY_STATUSES = ['approved', 'passed'];

class InstagramError extends Error {
  constructor(message, needsReauth = false) {
    super(message);
    this.needsReauth = needsReauth;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function apiUrl(path, accessToken, params = {}) {
  const url = new URL(`${API_BASE}/${String(path).replace(/^\/+/, '')}`);
  url.searchParams.set('access_token', accessToken);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// An OAuth error means the connection itself is broken rather than the post, so
// the caller can mark the account as needing a reconnect.
function toError(payload, response, fallback) {
  const message = payload?.error?.message || `${fallback} (HTTP ${response.status})`;
  const oauth = Number(payload?.error?.code) === 190 || payload?.error?.type === 'OAuthException';
  return new InstagramError(message, oauth);
}

async function igGet(path, accessToken, params) {
  const response = await fetch(apiUrl(path, accessToken, params), {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw toError(payload, response, 'Instagram request failed');
  return payload;
}

async function igPost(path, accessToken, body) {
  const response = await fetch(apiUrl(path, accessToken), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw toError(payload, response, 'Instagram rejected the request');
  return payload;
}

/** The Instagram professional account behind the connected token. */
export async function instagramProfile(accessToken) {
  const res = await igGet('me', accessToken, { fields: 'id,username' });
  return { id: String(res?.id || ''), username: String(res?.username || '') };
}

/** The clip a Reel publishes: the newest video the factory cleared for this post. */
export async function reelVideoFor(base44, postId) {
  const page = await base44.asServiceRole.entities.VideoJob.filter(
    { post_id: postId, status: { $in: REEL_READY_STATUSES } },
    { sort: '-created_date', limit: 1 }
  );
  const job = (page?.items || [])[0];
  return job?.video_url ? job : null;
}

/**
 * Instagram downloads the file itself, so it has to be readable without signing
 * in. Checking here turns a silent platform-side failure into a clear message.
 */
async function assertPubliclyReadable(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Range: 'bytes=0-2048' },
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  }).catch(() => null);

  const contentType = response?.headers.get('content-type') || '';
  if (!response?.ok || !contentType.startsWith('video/')) {
    throw new InstagramError(
      `Instagram fetches the video itself, and this file is not publicly readable (HTTP ${
        response?.status ?? 'no response'
      }${contentType ? ` as ${contentType}` : ''}).`
    );
  }
}

/** Every precondition a Reel needs, without sending anything. */
export async function validateReelForInstagram({ base44, post }) {
  const job = await reelVideoFor(base44, post.id);
  if (!job) {
    throw new InstagramError(
      'Instagram publishes Reels, and this post has no cleared video yet. Approve a video for it in Video Studio first.'
    );
  }
  await assertPubliclyReadable(job.video_url);
  return job;
}

async function createReelContainer({ igUserId, accessToken, videoUrl, caption }) {
  const res = await igPost(`${igUserId}/media`, accessToken, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: true,
  });
  const id = res?.id;
  if (!id) throw new InstagramError('Instagram did not accept the video for publishing.');
  return id;
}

async function waitForContainer({ containerId, accessToken }) {
  for (let attempt = 0; attempt < PROCESSING_POLLS; attempt += 1) {
    const res = await igGet(containerId, accessToken, { fields: 'status_code,status' });
    const code = res?.status_code;
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new InstagramError(res?.status || `Instagram could not process this video (${code}).`);
    }
    await sleep(PROCESSING_INTERVAL_MS);
  }
  throw new InstagramError('Instagram is still processing this video. The next publishing run will try again.');
}

async function publishContainer({ igUserId, accessToken, containerId }) {
  const res = await igPost(`${igUserId}/media_publish`, accessToken, { creation_id: containerId });
  const id = res?.id;
  if (!id) throw new InstagramError('Instagram accepted the video but did not return the published post.');
  return id;
}

async function mediaPermalink(mediaId, accessToken) {
  try {
    const res = await igGet(mediaId, accessToken, { fields: 'permalink' });
    return res?.permalink || '';
  } catch {
    // The Reel is live even when the permalink cannot be read back.
    return '';
  }
}

/**
 * Publish one Reel through the connected Instagram account and return the receipt
 * the post records. Throws a plain-language error for anything that stopped it.
 */
export async function publishReelToInstagram({ base44, post, account }) {
  const caption = [post.caption, post.hashtags].filter(Boolean).join('\n\n').trim() || post.title || '';
  if (!caption) throw new InstagramError('This post has no caption, so there is nothing to publish.');

  const igUserId = String(account?.external_id || '');
  if (!igUserId) {
    throw new InstagramError('The linked Instagram account has no id on file. Link it again in Social Accounts.');
  }

  const job = await validateReelForInstagram({ base44, post });

  let connection;
  try {
    connection = await base44.asServiceRole.connectors.getConnection('instagram');
  } catch (error) {
    throw new InstagramError(`Instagram is not connected: ${error.message}`);
  }

  const accessToken = connection.accessToken;
  const containerId = await createReelContainer({ igUserId, accessToken, videoUrl: job.video_url, caption });
  await waitForContainer({ containerId, accessToken });
  const mediaId = await publishContainer({ igUserId, accessToken, containerId });

  return {
    external_post_id: mediaId,
    published_url: await mediaPermalink(mediaId, accessToken),
  };
}