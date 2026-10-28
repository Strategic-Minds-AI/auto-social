import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

/* PAIRING A MACHINE WITHOUT THE KEY EVER CHANGING HANDS — portable copy.

   The bridge key is a credential, so no agent may read it, print it or carry it anywhere.
   A pairing code fixes that:

   mint   — an admin asks for a code. Short, readable, single use, dead in 30 minutes.
   redeem — the machine trades the code for the key and the code stops working.

   Only the hash of a code is stored, so a database read cannot recover a live code. */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_GROUPS = 4;
const GROUP_SIZE = 4;
const LIFETIME_MINUTES = 30;

const clean = (value, max) => String(value === null || value === undefined ? '' : value).trim().slice(0, max);

function makeCode() {
  const bytes = new Uint8Array(CODE_GROUPS * GROUP_SIZE);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]);
  const groups = [];
  for (let index = 0; index < CODE_GROUPS; index += 1) {
    groups.push(chars.slice(index * GROUP_SIZE, index * GROUP_SIZE + GROUP_SIZE).join(''));
  }
  return groups.join('-');
}

async function hashCode(code) {
  const normalised = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalised));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/* The gateway lives on this same app, so its address is taken from the request the app
   itself signs — nothing is hardcoded to one deployment. */
function gatewayUrl(req) {
  const origin = clean(req.headers.get('X-Base44-App-Url'), 200).replace(/\/$/, '');
  return origin ? `${origin}/functions/x1Bridge` : '';
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = clean(body && body.action, 20) || 'mint';

    if (action === 'mint') {
      const user = await base44.auth.me().catch((error) => (error.status === 401 ? null : Promise.reject(error)));
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

      const code = makeCode();
      const expiresAt = new Date(Date.now() + LIFETIME_MINUTES * 60000).toISOString();
      const workerName = clean(body && body.worker_name, 120);

      await base44.asServiceRole.entities.X1PairingCode.create({
        code_hash: await hashCode(code),
        prefix: code.slice(0, 4),
        worker_name: workerName,
        expires_at: expiresAt,
        note: `Minted by ${user.email || user.id} for ${LIFETIME_MINUTES} minutes.`,
      });

      return Response.json({
        ok: true,
        code,
        expires_at: expiresAt,
        minutes: LIFETIME_MINUTES,
        worker_name: workerName,
        gateway: gatewayUrl(req),
      });
    }

    if (action === 'redeem') {
      const code = clean(body && body.code, 40);
      if (!code) return Response.json({ error: 'A pairing code is required.' }, { status: 400 });

      const key = clean(secrets.get('X1_BRIDGE_KEY'), 400);
      if (!key) return Response.json({ error: 'No bridge key is set on this app, so there is nothing to pair with.' }, { status: 503 });

      const hash = await hashCode(code);
      const page = await base44.asServiceRole.entities.X1PairingCode.filter({ code_hash: hash }, { limit: 1 });
      const record = ((page && page.items) || [])[0];
      if (!record) return Response.json({ error: 'That pairing code is not valid.' }, { status: 404 });
      if (record.used_at) return Response.json({ error: 'That pairing code was already used. Make a new one.' }, { status: 409 });

      const now = new Date().toISOString();
      if (clean(record.expires_at, 40) && clean(record.expires_at, 40) < now) {
        return Response.json({ error: 'That pairing code has expired. Make a new one.' }, { status: 410 });
      }

      const note = clean(req.headers.get('x-forwarded-for') || req.headers.get('user-agent'), 200);
      await base44.asServiceRole.entities.X1PairingCode.update(record.id, { used_at: now, redeemed_note: note });

      return Response.json({
        ok: true,
        key,
        worker_name: record.worker_name || '',
        paired_at: now,
        gateway: gatewayUrl(req),
      });
    }

    return Response.json({ error: `Unknown action "${action}". Use mint or redeem.` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}