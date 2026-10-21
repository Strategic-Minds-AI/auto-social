import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { buildTransformerPrompt, TRANSFORM_SCHEMA, TRANSFORM_PLATFORMS } from '../../shared/promptStudio.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';

// The prompt transformer. One sentence goes in; a runnable image brief, a video
// brief, a finished post and a per-platform rewrite come out.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sentence = String(body.sentence || '').trim();
    if (!sentence) return Response.json({ error: 'Write the sentence you want turned into content.' }, { status: 400 });
    if (sentence.length > 1200) return Response.json({ error: 'Keep the sentence under 1200 characters.' }, { status: 400 });

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });

    // RLS-scoped: a business the caller cannot read will not resolve.
    const business = await base44.entities.Business.get(body.business_id).catch(() => null);
    if (!business) return Response.json({ error: 'Select a business first.' }, { status: 403 });

    const requested = (Array.isArray(body.platforms) ? body.platforms : []).filter((p) => TRANSFORM_PLATFORMS.includes(p));
    const platforms = requested.length ? requested : TRANSFORM_PLATFORMS.slice(0, 3);

    const discovery = await base44.entities.BusinessDiscovery
      .filter({ business_id: business.id }, { limit: 1 })
      .then((page) => (page.items || [])[0] || null)
      .catch(() => null);

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt: buildTransformerPrompt({ sentence, business, discovery, platforms }),
      schema: TRANSFORM_SCHEMA,
      maxTokens: 3500,
      temperature: 0.8,
    });

    await recordAiUsage(base44, user, meta);

    const content = data?.content || {};
    const angles = (Array.isArray(data?.social_angles) ? data.social_angles : []).filter(
      (angle) => angle && String(angle.caption || '').trim()
    );

    let savedDraft = null;
    if (body.save) {
      const platform = TRANSFORM_PLATFORMS.includes(body.platform) ? body.platform : platforms[0];
      savedDraft = await base44.entities.ContentDraft.create({
        business_id: business.id,
        platform,
        format: 'post',
        source: 'create',
        brief: sentence,
        tone: business.tone || '',
        audience: business.target_audience || '',
        title: content.title || '',
        hook: content.hook || '',
        caption: content.caption || '',
        hashtags: content.hashtags || '',
        call_to_action: content.call_to_action || '',
        image_prompt: data?.image_prompt || '',
        status: 'draft',
        ai_provider: meta?.provider || '',
        ai_model: meta?.model || '',
      });
    }

    return Response.json({
      image_prompt: data?.image_prompt || '',
      video_prompt: data?.video_prompt || '',
      content: {
        title: content.title || '',
        hook: content.hook || '',
        caption: content.caption || '',
        hashtags: content.hashtags || '',
        call_to_action: content.call_to_action || '',
      },
      social_angles: angles,
      saved_draft_id: savedDraft?.id || null,
      meta,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}