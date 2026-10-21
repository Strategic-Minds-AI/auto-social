import { secrets } from 'base44:runtime';

// Shared Twilio plumbing for the text-message layer. Every outbound send and every
// inbound webhook goes through here so the credentials, the phone normalisation and
// the signature check live in exactly one place.

const API_ROOT = 'https://api.twilio.com/2010-04-01';
const PUBLISHED_ORIGIN = 'https://auto-social.base44.app';

export const WEBHOOK_PATH = '/functions/twilioInbound';
export const WEBHOOK_URL = `${PUBLISHED_ORIGIN}${WEBHOOK_PATH}`;

// Secrets are pasted by hand, so a stray space or newline is the most common way a
// perfectly good credential stops working. Trim before use.
function readSecret(name) {
  try {
    const value = secrets.get(name);
    return value ? String(value).trim() : '';
  } catch (error) {
    return '';
  }
}

export function getTwilioConfig() {
  const accountSid = readSecret('TWILIO_ACCOUNT_SID');
  const authToken = readSecret('TWILIO_AUTH_TOKEN');
  const fromNumber = readSecret('TWILIO_FROM_NUMBER');
  const missing = [];
  if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
  if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
  if (!fromNumber) missing.push('TWILIO_FROM_NUMBER');
  return { accountSid, authToken, fromNumber, missing, configured: missing.length === 0 };
}

// Twilio speaks E.164 (+18665551234). Stored numbers are whatever the owner typed,
// so everything is compared through this.
export function normalizePhone(raw) {
  const trimmed = String(raw == null ? '' : raw).trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export async function sendSms({ to, body }) {
  const config = getTwilioConfig();
  if (!config.configured) {
    throw new Error(`Twilio is not fully configured. Missing: ${config.missing.join(', ')}`);
  }
  if (!to) throw new Error('A destination number is required.');

  const form = new URLSearchParams();
  form.set('To', to);
  form.set('From', config.fromNumber);
  form.set('Body', body);

  const response = await fetch(`${API_ROOT}/Accounts/${config.accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Twilio rejected the message (${response.status}).`);
  }
  return { sid: data.sid || '', status: data.status || 'queued' };
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function hmacSha1Base64(key, payload) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload));
  return bytesToBase64(new Uint8Array(signature));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

// Twilio signs the exact URL it was configured with, plus the POST fields sorted by
// name and concatenated. Which host the request arrives on depends on whether the app
// is served from the built-in domain or a custom one, so every plausible spelling is
// tried — each still has to produce a real signature from the auth token.
export async function verifyTwilioSignature({ authToken, url, params, signature }) {
  if (!authToken || !signature || !url) return false;
  const payload = Object.keys(params || {})
    .sort()
    .reduce((accumulator, key) => accumulator + key + params[key], url);
  const expected = await hmacSha1Base64(authToken, payload);
  return timingSafeEqual(expected, String(signature));
}

export function candidateWebhookUrls(req) {
  const urls = [];
  const host = req.headers.get('host');
  if (host) urls.push(`https://${host}${WEBHOOK_PATH}`);

  const appUrl = req.headers.get('x-base44-app-url');
  if (appUrl) urls.push(`${appUrl.replace(/\/+$/, '')}${WEBHOOK_PATH}`);

  urls.push(WEBHOOK_URL);

  try {
    const parsed = new URL(req.url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      urls.push(`${parsed.origin}${WEBHOOK_PATH}`);
    }
  } catch (error) {
    // req.url is not absolute in every runtime; the configured origin still covers it.
  }

  return urls.filter((value, index) => value && urls.indexOf(value) === index);
}