import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { groundingBlock } from '../../shared/discovery.ts';
import { libraryBlock } from '../../shared/library.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube'];
const FORMATS = ['post', 'story', 'reel', 'short_video', 'image'];
const MODES = ['create', 'rewrite', 'variation'];

const PIECE_SCHEMA = {
  type: 'object',
  properties: {
    pieces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          hook: { type: 'string' },
          caption: { type: 'string' },
          hashtags: { type: 'string' },
          call_to_action: { type: 'string' },
          image_prompt: { type: 'string' }
        },
        required: ['caption']
      }
    }
  },
  required: ['pieces']
};

const VOICE_RULES = `Hard rules for every piece:
- Be specific to this business. Never write generic advice that could fit any company.
- caption: platform-native, 2 to 4 short lines separated by line breaks, at most 3 emojis, ending with a clear call to action.
- hook: one scroll-stopping opening line, under 12 words.
- hashtags: 8 to 15 relevant tags in one string, each starting with #.
- call_to_action: one short imperative line.
- image_prompt: a photorealistic visual brief covering subject, setting, lighting, mood and brand colours. Describe the scene only and never put text, words or lettering in the image.`;

function businessBlock(business) {
  return `BUSINESS
Name: ${business.name}
Industry: ${business.industry || 'not specified'}
Description: ${business.description || 'not specified'}
Target audience: ${business.target_audience || 'not specified'}
Brand tone: ${business.tone || 'professional'}
Website: ${business.website || 'not specified'}`;
}

function buildPrompt({ mode, business, platform, format, tone, count, brief, existingText, discovery, library }) {
  const voice = tone ? `Tone override: ${tone}` : `Tone: ${business.tone || 'professional'}`;
  // The discovery plan and the saved library ride along with every mode: the tags
  // proven for this business, the patterns measured to win in its category, and
  // the hooks, scripts and editing methods the owner has kept.
  const settings = `PLATFORM: ${platform}\nFORMAT: ${format}\n${voice}\nAudience: ${business.target_audience || 'the business audience'}${discovery ? `\n\n${discovery}` : ''}${library ? `\n\n${library}` : ''}`;

  if (mode === 'rewrite') {
    return `You are the senior content writer inside Auto Social.

${businessBlock(business)}

${settings}

Rewrite and improve the post below for this platform.

${VOICE_RULES}

Keep the original message and every concrete fact. Sharpen the hook, tighten the wording, remove filler. Never invent claims, prices, dates, offers or statistics that are not in the original.

ORIGINAL POST
${existingText}

Return exactly one piece.`;
  }

  if (mode === 'variation') {
    return `You are the senior content writer inside Auto Social.

${businessBlock(business)}

${settings}

Write exactly ${count} genuinely different variations of the post below.

${VOICE_RULES}

Each variation must use a different hook, angle or structure. They must all carry the same core message without adding facts: never invent claims, prices, dates, offers or statistics that are not in the original.

ORIGINAL POST
${existingText}`;
  }

  return `You are the senior content writer inside Auto Social, an autonomous social media system.

${businessBlock(business)}

${settings}

BRIEF FROM THE OWNER
${brief}

Write exactly ${count} distinct posts for this brief.

${VOICE_RULES}

Each post must take a different angle. Never repeat an idea, hook or structure across the set.`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const businessId = body.business_id;
    const mode = MODES.includes(body.mode) ? body.mode : 'create';
    const platform = PLATFORMS.includes(body.platform) ? body.platform : 'instagram';
    const format = FORMATS.includes(body.format) ? body.format : 'post';
    const count = Math.min(Math.max(Number(body.count) || 3, 1), 7);
    const brief = String(body.brief || '').trim();
    const existingText = String(body.existing_text || '').trim();

    if (!businessId) return Response.json({ error: 'Select a business first.' }, { status: 400 });
    if (mode === 'create' && !brief) return Response.json({ error: 'Describe what you want the posts to be about.' }, { status: 400 });
    if (mode !== 'create' && !existingText) return Response.json({ error: 'Paste the post you want rewritten.' }, { status: 400 });

    // RLS-scoped: a business the caller cannot read will not resolve.
    const business = await base44.entities.Business.get(businessId).catch(() => null);
    if (!business) return Response.json({ error: 'That business is not available to you.' }, { status: 403 });

    // Content Studio used to generate without touching the daily ledger, which is
    // how the budget cap was bypassed. It now checks and records like every other caller.
    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) return Response.json({ error: budget.message }, { status: budget.status });

    // What the discovery scan proved for this business. Both reads are optional —
    // with nothing on file, generation behaves exactly as it did before.
    const [seoPage, rulePage] = await Promise.all([
      base44.entities.SeoProfile.filter({ business_id: business.id }, { limit: 1 }).catch(() => ({ items: [] })),
      base44.entities.BenchmarkRule.filter({ business_id: business.id, active: true }, { sort: '-priority', limit: 6 }).catch(() => ({ items: [] })),
    ]);
    const discovery = groundingBlock((seoPage.items || [])[0] || null, rulePage.items || [], platform);

    // What the owner saved as proven. Absent means generation is unchanged.
    const [hookPage, scriptPage, recipePage] = await Promise.all([
      base44.entities.LibraryItem.filter({ business_id: business.id, kind: 'hook' }, { sort: '-score', limit: 5 }).catch(() => ({ items: [] })),
      base44.entities.LibraryItem.filter({ business_id: business.id, kind: 'script' }, { sort: '-score', limit: 4 }).catch(() => ({ items: [] })),
      base44.entities.LibraryItem
        .filter({ business_id: business.id, kind: { $in: ['editing_recipe', 'visual_template'] } }, { sort: '-score', limit: 5 })
        .catch(() => ({ items: [] })),
    ]);
    const savedPatterns = [...(hookPage.items || []), ...(scriptPage.items || []), ...(recipePage.items || [])];
    const library = libraryBlock({
      hooks: hookPage.items || [],
      scripts: scriptPage.items || [],
      recipes: recipePage.items || [],
    });

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt: buildPrompt({ mode, business, platform, format, tone: body.tone, count, brief, existingText, discovery, library }),
      schema: PIECE_SCHEMA,
      maxTokens: 4000,
      temperature: mode === 'create' ? 0.85 : 0.7
    });

    await recordAiUsage(base44, user, meta);

    const pieces = (Array.isArray(data?.pieces) ? data.pieces : []).filter((p) => p && String(p.caption || '').trim());
    if (!pieces.length) return Response.json({ error: 'The AI returned no usable content. Try again.' }, { status: 502 });

    const records = pieces.slice(0, count).map((piece) => ({
      business_id: business.id,
      platform,
      format,
      source: mode,
      brief: mode === 'create' ? brief : existingText,
      tone: body.tone || business.tone || '',
      audience: business.target_audience || '',
      title: piece.title || '',
      hook: piece.hook || '',
      caption: piece.caption,
      hashtags: piece.hashtags || '',
      call_to_action: piece.call_to_action || '',
      image_prompt: piece.image_prompt || '',
      status: 'draft',
      ai_provider: meta.provider,
      ai_model: meta.model
    }));

    const drafts = await base44.entities.ContentDraft.bulkCreate(records);

    // The patterns that were handed to the writer get credited, so the library
    // shows what actually earns its place.
    if (savedPatterns.length) {
      await base44.entities.LibraryItem
        .bulkUpdate(savedPatterns.map((item) => ({ id: item.id, times_used: (Number(item.times_used) || 0) + 1 })))
        .catch(() => {});
    }

    return Response.json({
      created: records.length,
      drafts: Array.isArray(drafts) ? drafts : [],
      meta
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}