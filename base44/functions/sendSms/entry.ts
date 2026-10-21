import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { getTwilioConfig, normalizePhone, sendSms as deliverSms } from '../../shared/twilio.ts';

// Outbound texts. Called two ways:
//   - from the Text Alerts page, for a test or a message the owner typed themselves
//   - from the "Post Alerts by Text" workflow, when a post goes live or fails
//
// The destination is never taken from the caller: it is always the business's own
// notification number, so this can't be used to text anybody else.

const SITE = 'Strategic Minds AI';

function composeAlert(post) {
  if (!post) return '';
  const channel = String(post.platform || 'social').replace(/^./, (character) => character.toUpperCase());
  const label = String(post.title || post.caption || '').trim().slice(0, 60) || 'Your post';

  if (post.status === 'published') {
    return `${SITE}: "${label}" is live on ${channel}. Reply YES to approve the next post waiting for you.`;
  }
  if (post.status === 'failed') {
    return `${SITE}: "${label}" could not be published to ${channel}. ${post.publish_error || ''}`.trim();
  }
  return '';
}

function defaultText(kind) {
  if (kind === 'test') {
    return `${SITE}: your text alerts are working. Reply YES to approve the next post waiting for you, or STOP to switch texts off.`;
  }
  return '';
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kind = body.kind === 'alert' ? 'alert' : body.kind === 'test' ? 'test' : 'manual';
    // A workflow-fired alert must never fail its run over something the owner can fix
    // by simply switching alerts on, so those outcomes come back as a soft skip.
    const soft = kind === 'alert';
    const stop = (message, status) =>
      soft ? Response.json({ sent: false, skipped: message }) : Response.json({ error: message }, { status });

    const config = getTwilioConfig();
    if (!config.configured) {
      return stop(`Twilio is not configured yet. Add ${config.missing.join(', ')} on the Secrets page.`, 400);
    }

    const db = base44.asServiceRole.entities;

    let post = null;
    let business = null;
    if (body.post_id) {
      post = await db.ScheduledPost.get(String(body.post_id)).catch(() => null);
      if (!post) return stop('That post no longer exists.', 404);
      business = await db.Business.get(post.business_id).catch(() => null);
    } else if (body.business_id) {
      business = await db.Business.get(String(body.business_id)).catch(() => null);
    }

    if (!business) return stop('A business is required.', 400);
    if (business.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const to = normalizePhone(business.notification_phone);
    if (!to) return stop('Add a mobile number for text alerts first.', 400);

    if (business.sms_opt_out) {
      return stop('That phone replied STOP. Text START from it to switch alerts back on.', 409);
    }

    if (kind === 'alert' && !business.sms_alerts) {
      return Response.json({ sent: false, skipped: 'Text alerts are switched off for this business.' });
    }

    const text = kind === 'alert'
      ? composeAlert(post)
      : String(body.message_text || defaultText(kind)).trim().slice(0, 900);

    if (!text) return stop('There was nothing to send.', 400);

    try {
      const result = await deliverSms({ to, body: text });
      const logged = await db.CommsMessage.create({
        business_id: business.id,
        owner_id: business.created_by_id || '',
        direction: 'out',
        counterparty: to,
        body: text,
        kind,
        status: 'sent',
        twilio_sid: result.sid,
        related_post_id: post?.id || '',
      });
      return Response.json({ sent: true, message: logged });
    } catch (error) {
      await db.CommsMessage.create({
        business_id: business.id,
        owner_id: business.created_by_id || '',
        direction: 'out',
        counterparty: to,
        body: text,
        kind,
        status: 'failed',
        related_post_id: post?.id || '',
        error: error.message,
      }).catch(() => {});
      return stop(error.message, 502);
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}