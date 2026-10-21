import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';

// Eden's inbox sweep. Reads recent mail on the app's shared Google account, keeps
// only messages that are a real person asking for something, and files each one as
// a lead. It runs from the Leads page and from a daily schedule, so an enquiry is
// never left sitting only in the inbox.

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const LIST_LIMIT = 20;
const ANALYZE_LIMIT = 10;
const LOOKBACK_DAYS = 7;
const BODY_CHARS = 1500;
const TIMEOUT_MS = 20000;

const LEAD_SCHEMA = {
  type: 'object',
  properties: {
    leads: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          message_id: { type: 'string' },
          is_enquiry: { type: 'boolean' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          company: { type: 'string' },
          service: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['message_id', 'is_enquiry'],
      },
    },
  },
  required: ['leads'],
};

function headerValue(payload, name) {
  const headers = payload?.headers || [];
  const found = headers.find((h) => String(h?.name || '').toLowerCase() === name.toLowerCase());
  return found ? String(found.value || '') : '';
}

function decodeBase64Url(data) {
  try {
    const normalized = String(data || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function htmlToText(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractText(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  const parts = payload.parts || [];
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  for (const part of parts) {
    const nested = extractText(part);
    if (nested) return nested;
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return htmlToText(decodeBase64Url(payload.body.data));
  }
  return '';
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // This reads the whole shared inbox, so only an app admin may run it.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only an app admin can scan the inbox.' }, { status: 403 });
    }

    let accessToken = '';
    try {
      ({ accessToken } = await base44.asServiceRole.connectors.getConnection('gmail'));
    } catch {
      accessToken = '';
    }
    if (!accessToken) {
      return Response.json(
        { error: 'Your Google inbox is not connected yet. Reconnect it and try again.' },
        { status: 409 }
      );
    }

    const auth = { Authorization: `Bearer ${accessToken}` };
    const query = `in:inbox newer_than:${LOOKBACK_DAYS}d -from:me -category:promotions -category:social`;
    const listRes = await fetch(`${GMAIL}/messages?maxResults=${LIST_LIMIT}&q=${encodeURIComponent(query)}`, {
      headers: auth,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!listRes.ok) {
      return Response.json(
        { error: `Gmail returned HTTP ${listRes.status} while listing messages.` },
        { status: 502 }
      );
    }

    const listed = await listRes.json();
    const ids = (listed.messages || []).map((m) => m?.id).filter(Boolean);
    if (!ids.length) {
      return Response.json({ scanned: 0, created: 0, message: 'Nothing new in the inbox.' });
    }

    // Every email is read once. Non-enquiries are recorded as read too, otherwise
    // each sweep would spend its whole analysis budget re-reading the same
    // marketing mail and never reach genuine new enquiries.
    const already = await base44.entities.SweptEmail
      .filter({ message_id: { $in: ids } }, { limit: 200 })
      .then((page) => page.items || [])
      .catch(() => []);
    const seen = new Set(already.map((row) => row.message_id));
    const fresh = ids.filter((id) => !seen.has(id));

    if (!fresh.length) {
      return Response.json({ scanned: ids.length, created: 0, message: 'No new messages since the last sweep.' });
    }

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) {
      return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });
    }

    const messages = [];
    for (const id of fresh.slice(0, ANALYZE_LIMIT)) {
      const res = await fetch(`${GMAIL}/messages/${id}?format=full`, {
        headers: auth,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const message = await res.json();
      const payload = message.payload || {};
      const received = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : null;
      messages.push({
        id,
        from: headerValue(payload, 'From'),
        subject: headerValue(payload, 'Subject'),
        received,
        body: extractText(payload).slice(0, BODY_CHARS),
      });
    }

    if (!messages.length) {
      return Response.json({ scanned: ids.length, created: 0, message: 'None of the new messages could be read.' });
    }

    const prompt = `You are an executive assistant triaging a business owner's inbox.

Below is a batch of recent emails. Decide which of them are genuine enquiries from a real person — someone asking about a service, requesting a quote or a price, checking availability, asking for a callback, or describing a project they need done.

Ignore completely: newsletters, receipts, invoices, order and delivery updates, password or security notices, automated notifications, marketing and promotional mail, social media alerts, and anything sent by a machine rather than a person.

Return one entry for EVERY message in the batch, using its message_id exactly as given, so nothing is silently dropped.
- is_enquiry: true only for a genuine enquiry from a person, false for everything else
- name: the person's name if the message states it, otherwise an empty string
- email: the sender's email address
- phone: only if a phone number actually appears in the message body
- company: only if a company name actually appears
- service: what they are asking about, in a few words
- summary: one or two sentences on what they want, including any deadline, location, quantity or budget they mentioned

Never invent an email address, name, phone number, company or detail that is not in the message. Return an empty string for any field the message does not contain.

Emails:
${JSON.stringify(messages, null, 2)}`;

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt,
      schema: LEAD_SCHEMA,
      maxTokens: 3000,
      temperature: 0.2,
    });
    await recordAiUsage(base44, user, meta);

    const returned = Array.isArray(data?.leads) ? data.leads : [];
    const enquiryIds = new Set(
      returned.filter((lead) => lead?.is_enquiry).map((lead) => String(lead.message_id || ''))
    );

    // Mark everything the model actually read, enquiry or not, so the next sweep
    // starts on genuinely new mail.
    await base44.entities.SweptEmail.bulkCreate(
      messages.map((message) => ({
        message_id: message.id,
        received_at: message.received || new Date().toISOString(),
        is_enquiry: enquiryIds.has(message.id),
      }))
    );

    const byId = new Map(messages.map((message) => [message.id, message]));
    const records = [];
    for (const lead of returned) {
      if (!lead?.is_enquiry) continue;
      const email = String(lead.email || '').trim();
      if (!email.includes('@')) continue;
      const message = byId.get(String(lead.message_id || ''));
      if (!message) continue;
      records.push({
        name: String(lead.name || '').trim() || email.split('@')[0],
        email,
        phone: String(lead.phone || '').trim(),
        company: String(lead.company || '').trim(),
        service: String(lead.service || '').trim(),
        message: String(lead.summary || '').trim(),
        source: 'email',
        source_ref: message.id,
        received_at: message.received || new Date().toISOString(),
        status: 'new',
      });
    }

    if (!records.length) {
      return Response.json({
        scanned: messages.length,
        created: 0,
        message: 'No genuine enquiries among the new messages.',
        meta,
      });
    }

    const saved = await base44.entities.Lead.bulkCreate(records);

    return Response.json({
      scanned: messages.length,
      created: records.length,
      leads: Array.isArray(saved) ? saved.map((lead) => ({ id: lead.id, name: lead.name, email: lead.email })) : [],
      meta,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}