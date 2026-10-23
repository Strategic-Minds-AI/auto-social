import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';
import {
  ENHANCE_KINDS,
  ENHANCE_SCHEMA,
  buildEnhancePrompt,
  validateEnhanceRequest,
} from '../../shared/visualX.ts';

// VISUAL-X enhance. Whatever the owner is typing goes in; an engineered prompt or a
// finished piece of content comes back, ready to drop straight back into the field.
//
// The kind is chosen by the field they typed into, so a caption comes back as a post
// and a brief comes back as a prompt. Runs on the owner's own gateway.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const kind = ENHANCE_KINDS[body.kind] ? String(body.kind) : 'prompt';

    // The studio's own safety gate, before anything is spent.
    const checked = validateEnhanceRequest(body.text);
    if (!checked.valid) {
      return Response.json({ error: checked.reason, flagged: checked.flagged === true }, { status: 400 });
    }

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) {
      return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });
    }

    // Optional: the brand context sharpens the answer, but enhancing a field before a
    // business exists must still work.
    const business = body.business_id
      ? await base44.entities.Business.get(String(body.business_id)).catch(() => null)
      : null;

    const discovery = business
      ? await base44.entities.BusinessDiscovery
          .filter({ business_id: business.id }, { limit: 1 })
          .then((page) => (page.items || [])[0] || null)
          .catch(() => null)
      : null;

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt: buildEnhancePrompt({
        text: checked.text,
        kind,
        business,
        discovery,
        category: body.category,
      }),
      schema: ENHANCE_SCHEMA,
      maxTokens: 4000,
      temperature: 0.75,
    });

    await recordAiUsage(base44, user, meta);

    // A model occasionally returns literal "\n" inside a JSON string; the field needs
    // real line breaks.
    const tidy = (value) =>
      String(value || '')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, ' ')
        .trim();

    const enhanced = tidy(data?.enhanced);
    if (!enhanced) {
      return Response.json({ error: 'The enhance came back empty. Try again with a little more detail.' }, { status: 502 });
    }

    return Response.json({
      original: checked.text,
      kind,
      output: ENHANCE_KINDS[kind].output,
      enhanced,
      why: tidy(data?.why),
      category: String(data?.category || 'general'),
      alternatives: (Array.isArray(data?.alternatives) ? data.alternatives : [])
        .filter((entry) => String(entry || '').trim())
        .slice(0, 3)
        .map((entry) => tidy(entry)),
      meta,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}