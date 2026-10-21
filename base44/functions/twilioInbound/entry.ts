import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { getTwilioConfig, normalizePhone, verifyTwilioSignature, candidateWebhookUrls } from '../../shared/twilio.ts';
import { appendHistory } from '../../shared/access.ts';
import { zonedToUtcIso, isValidTimeZone, DEFAULT_TIMEZONE } from '../../shared/time.ts';

// Twilio posts here when the owner replies to a text. Public endpoint, so the Twilio
// signature is checked before anything is read or written, and a repeated delivery of
// the same message id is ignored.
//
// Replies are sent back as TwiML in this response rather than a second API call, so
// one exchange is one request and there is no way for the reply to go out twice.

const SITE = 'Strategic Minds AI';

const OPT_OUT = /^(stop|stopall|unsubscribe|cancel|end|quit)$/i;
const OPT_IN = /^(start|unstop|yes)$/i;
const APPROVE = /^(yes|y|approve|ok|okay|go|send)$/i;
const HOLD = /^(no|n|hold|wait|later|skip)$/i;
const HELP = /^(help|info)$/i;

const HELP_TEXT =
  `${SITE} text commands:\n` +
  'YES - approve and queue the next post waiting for review\n' +
  'HOLD - leave it for later\n' +
  'STOP - stop all texts\n' +
  'START - switch texts back on';

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twiml(message) {
  const inner = message ? `<Message>${xmlEscape(message)}</Message>` : '';
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

export default async function (req) {
  try {
    const config = getTwilioConfig();
    if (!config.configured) return twiml('');

    const raw = await req.text();
    const params = {};
    for (const [key, value] of new URLSearchParams(raw)) params[key] = value;

    const signature = req.headers.get('x-twilio-signature') || '';
    let verified = false;
    for (const url of candidateWebhookUrls(req)) {
      if (await verifyTwilioSignature({ authToken: config.authToken, url, params, signature })) {
        verified = true;
        break;
      }
    }
    if (!verified) return Response.json({ error: 'Invalid Twilio signature' }, { status: 403 });

    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    const sid = params.MessageSid || params.SmsSid || '';
    if (sid) {
      const seen = await db.CommsMessage.filter({ twilio_sid: sid }, { limit: 1 });
      if ((seen?.items || []).length) return twiml('');
    }

    const from = normalizePhone(params.From);
    const text = String(params.Body || '').trim();
    if (!from) return twiml('');

    const registered = await db.Business.filter({}, { limit: 200 });
    const business = (registered?.items || []).find(
      (candidate) => normalizePhone(candidate.notification_phone) === from
    );

    // An unrecognised sender is recorded for the operator but never answered: replying
    // to strangers would turn this endpoint into an open relay.
    if (!business) {
      await db.CommsMessage.create({
        direction: 'in',
        counterparty: from,
        body: text,
        kind: 'unknown',
        status: 'received',
        twilio_sid: sid,
      }).catch(() => {});
      return twiml('');
    }

    const ownerId = business.created_by_id || '';
    const now = new Date().toISOString();

    await db.CommsMessage.create({
      business_id: business.id,
      owner_id: ownerId,
      direction: 'in',
      counterparty: from,
      body: text,
      kind: 'command',
      status: 'received',
      twilio_sid: sid,
    });

    const reply = async (message, kind) => {
      await db.CommsMessage.create({
        business_id: business.id,
        owner_id: ownerId,
        direction: 'out',
        counterparty: from,
        body: message,
        kind,
        status: 'sent',
      }).catch(() => {});
      return twiml(message);
    };

    if (business.sms_opt_out) {
      if (OPT_IN.test(text)) {
        await db.Business.update(business.id, { sms_opt_out: false });
        return reply(`${SITE}: you are subscribed again. Reply YES to approve the next post waiting for you, or STOP to opt out.`, 'opt_in');
      }
      if (HELP.test(text)) return reply(HELP_TEXT, 'help');
      return twiml('');
    }

    if (OPT_OUT.test(text)) {
      await db.Business.update(business.id, { sms_opt_out: true });
      return reply(`${SITE}: you will not receive any more texts. Reply START to switch them back on.`, 'opt_out');
    }

    if (HELP.test(text)) return reply(HELP_TEXT, 'help');

    if (HOLD.test(text)) {
      return reply(`${SITE}: nothing was changed. That post is still waiting for your review.`, 'command');
    }

    if (APPROVE.test(text)) {
      const pending = await db.ScheduledPost.filter(
        { business_id: business.id, status: 'planned' },
        { sort: 'scheduled_date', limit: 1 }
      );
      const post = (pending?.items || [])[0];
      if (!post) return reply(`${SITE}: nothing is waiting for your review right now.`, 'command');

      const date = String(post.scheduled_date || '').slice(0, 10);
      const time = String(post.scheduled_time || '09:00').slice(0, 5);
      const requestedZone = post.timezone || DEFAULT_TIMEZONE;
      const timezone = isValidTimeZone(requestedZone) ? requestedZone : DEFAULT_TIMEZONE;
      const scheduledAt = zonedToUtcIso(date, time, timezone);

      // Same slot resolution the app itself uses, so an approved post lands in exactly
      // the state the publishing job picks up.
      if (!scheduledAt) {
        return reply(`${SITE}: I could not read the posting slot on that post, so nothing was changed.`, 'command');
      }

      await db.ScheduledPost.update(post.id, {
        status: 'scheduled',
        scheduled_date: date,
        scheduled_time: time,
        timezone,
        scheduled_at: scheduledAt,
        approved_by: 'Text message',
        approved_at: now,
        approval_note: 'Approved by SMS reply',
        idempotency_key: `${post.id}:${scheduledAt}`,
        publish_error: '',
        lock_token: '',
        locked_at: '',
        publish_attempts: 0,
        publish_history: appendHistory(post, 'scheduled', 'Approved and queued from a text message'),
      });

      const label = String(post.title || post.caption || '').trim().slice(0, 60) || 'That post';
      const alreadyDue = new Date(scheduledAt).getTime() <= Date.now();
      return reply(
        alreadyDue
          ? `${SITE}: "${label}" is approved and goes out on the next publishing run.`
          : `${SITE}: "${label}" is approved and queued for ${date} at ${time}.`,
        'command'
      );
    }

    return reply(
      `${SITE}: I did not understand that. Reply YES to approve the next post waiting for you, HELP for options, or STOP to opt out.`,
      'command'
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}