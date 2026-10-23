// LinkedIn publishing helpers (LinkedIn REST API).
//
// The LinkedIn connector holds one member's own authorization, so publishing goes
// out to that member's feed as a person author. Tokens are derived inside a
// function and are never persisted on an entity or returned to the frontend.

const API_BASE = 'https://api.linkedin.com';
const REQUEST_TIMEOUT_MS = 20000;
const UPLOAD_TIMEOUT_MS = 60000;
// LinkedIn's own limit on the commentary field of a post.
const COMMENTARY_LIMIT = 3000;

class LinkedInError extends Error {
  constructor(message, needsReauth = false) {
    super(message);
    this.needsReauth = needsReauth;
  }
}

// LinkedIn versions the API by calendar month (YYYYMM) and sunsets older
// versions, so the version is derived from the current date rather than
// hardcoded: a month-old version is always one LinkedIn still serves.
function apiVersion() {
  const now = new Date();
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${month.getUTCFullYear()}${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
}

function restHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': apiVersion(),
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

// A refused authorization means the connection itself is broken rather than the
// post, so the caller can mark the account as needing a reconnect.
function toError(payload, response, fallback) {
  const message = payload?.message || payload?.error_description || `${fallback} (HTTP ${response.status})`;
  return new LinkedInError(message, response.status === 401 || response.status === 403);
}

// LinkedIn builds the display name from the profile's own fields, so a blank or
// placeholder part of that profile arrives as the literal word "undefined".
// Dropping it keeps the account reading as a name rather than as a defect.
const CLEAN_PART = /\b(?:undefined|null)\b/gi;

function cleanName(payload) {
  const joined = String(payload?.name || '').replace(CLEAN_PART, ' ').replace(/\s+/g, ' ').trim();
  if (joined) return joined;
  return [payload?.given_name, payload?.family_name]
    .map((part) => String(part || '').replace(CLEAN_PART, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

/** The member behind the connected LinkedIn token. */
export async function linkedinProfile(accessToken) {
  const response = await fetch(`${API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw toError(payload, response, 'LinkedIn could not be read');

  const id = String(payload?.sub || '');
  return {
    id,
    name: cleanName(payload),
    picture: String(payload?.picture || ''),
    author_urn: id ? `urn:li:person:${id}` : '',
  };
}

/**
 * LinkedIn will not fetch an image from a URL, so the post image is downloaded
 * here and uploaded to LinkedIn first, which returns the image to reference.
 */
async function uploadImage({ accessToken, ownerUrn, imageUrl }) {
  const initResponse = await fetch(`${API_BASE}/rest/images?action=initializeUpload`, {
    method: 'POST',
    headers: restHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const init = await initResponse.json().catch(() => ({}));
  if (!initResponse.ok) throw toError(init, initResponse, 'LinkedIn did not accept the image');

  const uploadUrl = init?.value?.uploadUrl;
  const imageUrn = init?.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new LinkedInError('LinkedIn did not return an upload location for the image.');
  }

  const source = await fetch(imageUrl, { signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) });
  if (!source.ok) {
    throw new LinkedInError(`The image on this post could not be read (HTTP ${source.status}).`);
  }
  const bytes = await source.arrayBuffer();

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': source.headers.get('content-type') || 'image/jpeg' },
    body: bytes,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });
  if (!upload.ok) throw new LinkedInError(`LinkedIn rejected the image upload (HTTP ${upload.status}).`);

  return imageUrn;
}

/**
 * Publish one post to the connected member's LinkedIn feed and return the receipt
 * the post records. Throws a plain-language error for anything that stopped it.
 */
export async function publishToLinkedIn({ accessToken, authorUrn, text, imageUrl }) {
  const commentary = String(text || '').trim();
  if (!commentary) throw new LinkedInError('This post has no caption, so there is nothing to publish.');
  if (!authorUrn) {
    throw new LinkedInError('The linked LinkedIn account has no id on file. Link it again in Social Accounts.');
  }
  if (commentary.length > COMMENTARY_LIMIT) {
    throw new LinkedInError(
      `LinkedIn allows ${COMMENTARY_LIMIT} characters in a post and this one has ${commentary.length}. Shorten the caption and try again.`
    );
  }

  const content = imageUrl ? { media: { id: await uploadImage({ accessToken, ownerUrn: authorUrn, imageUrl }) } } : null;

  const body = {
    author: authorUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
    ...(content ? { content } : {}),
  };

  const response = await fetch(`${API_BASE}/rest/posts`, {
    method: 'POST',
    headers: restHeaders(accessToken),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw toError(payload, response, 'LinkedIn rejected the post');
  }

  const id = response.headers.get('x-restli-id') || '';
  return {
    external_post_id: id,
    published_url: id ? `https://www.linkedin.com/feed/update/${id}` : '',
  };
}