import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { resolveBusiness, resolveCampaign, checkAiBudget, recordAiUsage } from '../../shared/access.ts';

// Every text-generation task that used to run on Base44's own AI credits now runs
// on the app's own AI gateway. Image and video generation are untouched.

const TASKS = ['business_analysis', 'campaign_strategies', 'campaign_content', 'video_prompt'];

const GOAL_LABELS = {
  brand_awareness: 'Brand Awareness',
  lead_generation: 'Lead Generation',
  sales_conversion: 'Sales Conversion',
  community_engagement: 'Community Engagement',
  product_launch: 'Product Launch',
  event_promotion: 'Event Promotion',
  customer_retention: 'Customer Retention',
};

const STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    strategies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          approach: { type: 'string' },
          tactics: { type: 'array', items: { type: 'string' } },
          outcome: { type: 'string' },
        },
        required: ['name', 'approach'],
      },
    },
  },
  required: ['strategies'],
};

const PIECE_SCHEMA = {
  type: 'object',
  properties: {
    pieces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          caption: { type: 'string' },
          hashtags: { type: 'string' },
          hook: { type: 'string' },
          image_prompt: { type: 'string' },
          video_script: { type: 'string' },
          call_to_action: { type: 'string' },
        },
        required: ['caption'],
      },
    },
  },
  required: ['pieces'],
};

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    analysis: { type: 'string' },
    pillars: { type: 'array', items: { type: 'string' } },
  },
  required: ['analysis'],
};

const PROMPT_SCHEMA = {
  type: 'object',
  properties: { prompt: { type: 'string' } },
  required: ['prompt'],
};

// Website research is real retrieval: the page is fetched server-side and its
// text is handed to the model as supplied context. The model itself has no
// internet access, so nothing here pretends otherwise.
const MAX_SITE_BYTES = 400000;
const SITE_TIMEOUT_MS = 12000;

function isFetchableUrl(raw) {
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 10 || a === 127 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) return null;
    }
    return url;
  } catch {
    return null;
  }
}

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToText(match[1]).slice(0, 200) : '';
}

async function researchWebsite(rawUrl) {
  const url = isFetchableUrl(rawUrl);
  if (!url) return { ok: false, reason: 'That website address could not be reached.' };

  try {
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'AutoSocialBot/1.0 (+marketing research)' },
      signal: AbortSignal.timeout(SITE_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!response.ok) return { ok: false, reason: `The website returned HTTP ${response.status}.` };

    const html = (await response.text()).slice(0, MAX_SITE_BYTES);
    const text = htmlToText(html).slice(0, 6000);
    if (text.length < 60) return { ok: false, reason: 'The website had no readable text to analyse.' };

    return { ok: true, url: url.toString(), title: extractTitle(html), text };
  } catch (error) {
    return { ok: false, reason: `The website could not be read (${error.message}).` };
  }
}

function businessBlock(b) {
  return `BUSINESS
Name: ${b.name}
Industry: ${b.industry || 'not specified'}
Description: ${b.description || 'not specified'}
Target audience: ${b.target_audience || 'not specified'}
Brand tone: ${b.tone || 'professional'}
Website: ${b.website || 'not specified'}
Brand colours: ${b.brand_colors || 'not specified'}`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const task = TASKS.includes(body.task) ? body.task : null;
    if (!task) {
      return Response.json({ error: 'Unsupported AI task requested.' }, { status: 400 });
    }

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) {
      return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });
    }

    let prompt;
    let schema;
    let maxTokens = 3000;
    let temperature = 0.7;
    let business = null;
    let campaign = null;
    let research = null;

    if (task === 'business_analysis') {
      const draft = {
        name: String(body.name || '').trim(),
        description: String(body.description || '').trim(),
        website: String(body.website || '').trim(),
        industry: String(body.industry || '').trim(),
        target_audience: String(body.target_audience || '').trim(),
        tone: body.tone || 'professional',
        brand_colors: String(body.brand_colors || '').trim(),
      };
      if (!draft.name || !draft.description) {
        return Response.json({ error: 'Add a business name and description first.' }, { status: 400 });
      }

      research = draft.website ? await researchWebsite(draft.website) : { ok: false, reason: 'No website was provided.' };

      const supplied = research.ok
        ? `WEBSITE CONTENT (retrieved from ${research.url} just now${research.title ? `, page title "${research.title}"` : ''})
${research.text}`
        : `No website content could be retrieved${research.reason ? ` (${research.reason})` : ''}. Base this analysis on the details above only. Do not claim to have reviewed the website.`;

      prompt = `You are a senior social media marketing strategist writing an internal marketing profile.

${businessBlock(draft)}

${supplied}

Write a practical marketing profile with these sections, using plain text headings and no markdown symbols:
1. Positioning summary
2. Target audience insights
3. Value propositions for social media
4. Recommended content pillars
5. Competitive angles to highlight
6. Brand voice guidelines

Ground every claim in the details and website content provided. Never invent awards, statistics, certifications, years in business, prices or reviews that were not supplied. Where information is missing, say what is missing rather than guessing.`;
      schema = ANALYSIS_SCHEMA;
      maxTokens = 3000;
    }

    if (task === 'campaign_strategies') {
      const resolved = await resolveBusiness(base44, body.business_id);
      if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });
      business = resolved.business;

      const goal = GOAL_LABELS[body.goal] || body.goal;
      const platforms = Array.isArray(body.platforms) ? body.platforms.join(', ') : 'not specified';

      prompt = `You are a senior social media strategist. Recommend exactly 3 genuinely different strategies for this business and goal.

${businessBlock(business)}

Campaign goal: ${goal}
Platforms: ${platforms}

For each strategy give: a short name, a core approach in 1 to 2 sentences, 3 concrete tactics, and the expected outcome.

Each strategy must take a different approach — not the same idea with different wording. Be specific to this business and industry; never write advice that could apply to any company. Never invent facts, prices or statistics.`;
      schema = STRATEGY_SCHEMA;
      maxTokens = 2500;
    }

    if (task === 'campaign_content') {
      const resolved = await resolveCampaign(base44, body.campaign_id);
      if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });
      campaign = resolved.campaign;
      business = resolved.business;

      const platform = String(body.platform || 'facebook');
      const type = String(body.type || 'post');
      const count = Math.min(Math.max(Number(body.count) || 3, 1), 6);

      prompt = `You are a world-class social media content creator writing for ${platform}.

${businessBlock(business)}

Campaign: ${campaign.name}
Campaign goal: ${GOAL_LABELS[campaign.goal] || campaign.goal || 'not specified'}
Strategy: ${campaign.strategy || 'not specified'}
Strategy details: ${campaign.strategy_details || 'not specified'}

Write exactly ${count} distinct ${type} content pieces.

For each piece provide:
- title: a short internal title
- caption: a platform-native caption, 2 to 4 short lines, at most 3 emojis, ending with a clear call to action
- hashtags: 8 to 15 relevant tags in one string, each starting with #
- hook: one scroll-stopping opening line under 12 words
- image_prompt: a photorealistic visual brief covering subject, setting, lighting, mood and brand colours. Describe the scene only and never put text or lettering in the image.
- video_script: for reel, story or short_video, a 30 to 60 second script with [visual] and [text overlay] markers; otherwise an empty string
- call_to_action: one short imperative line

Each piece must take a different angle. Never invent claims, prices, dates, offers, statistics or testimonials that were not supplied.`;
      schema = PIECE_SCHEMA;
      maxTokens = 4000;
      temperature = 0.85;
    }

    if (task === 'video_prompt') {
      const resolved = await resolveBusiness(base44, body.business_id);
      if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });
      business = resolved.business;

      const script = String(body.script || '').trim();
      if (!script) return Response.json({ error: 'This piece has no video script to convert.' }, { status: 400 });

      prompt = `You convert a video script into one detailed cinematic video-generation prompt.

Rules:
- Describe only visuals: subject, action, setting, camera movement, lighting, mood, style
- No narration and no dialogue
- Absolutely no on-screen text, titles, subtitles or captions — video generators render text badly
- Two to four rich sentences
- Platform: ${business ? body.platform || 'social' : 'social'}; brand tone: ${business?.tone || 'professional'}
- Brand colours: ${business?.brand_colors || 'modern palette'}

Script:
${script}

Return the video prompt only.`;
      schema = PROMPT_SCHEMA;
      maxTokens = 1200;
      temperature = 0.6;
    }

    const { data, meta } = await generateJsonWithMeta(base44, { prompt, schema, maxTokens, temperature });

    await recordAiUsage(base44, user, meta);

    if (task === 'business_analysis') {
      return Response.json({
        analysis: String(data?.analysis || '').trim(),
        pillars: Array.isArray(data?.pillars) ? data.pillars : [],
        website_researched: research.ok,
        website_note: research.ok
          ? `Read the live page at ${research.url}`
          : research.reason || 'No website content was retrieved.',
        meta,
      });
    }

    if (task === 'campaign_strategies') {
      const strategies = (Array.isArray(data?.strategies) ? data.strategies : []).filter((s) => s && s.name);
      if (!strategies.length) return Response.json({ error: 'The AI returned no usable strategies. Try again.' }, { status: 502 });
      return Response.json({ strategies, meta });
    }

    if (task === 'campaign_content') {
      const pieces = (Array.isArray(data?.pieces) ? data.pieces : []).filter((p) => p && String(p.caption || '').trim());
      if (!pieces.length) return Response.json({ error: 'The AI returned no usable content. Try again.' }, { status: 502 });

      const records = pieces.slice(0, Math.min(Math.max(Number(body.count) || 3, 1), 6)).map((piece) => ({
        campaign_id: campaign.id,
        business_id: campaign.business_id,
        platform: String(body.platform || 'facebook'),
        type: String(body.type || 'post'),
        title: piece.title || '',
        caption: piece.caption,
        hashtags: piece.hashtags || '',
        hook: piece.hook || '',
        image_prompt: piece.image_prompt || '',
        video_script: piece.video_script || '',
        call_to_action: piece.call_to_action || '',
        status: 'draft',
      }));

      const saved = await base44.entities.ContentPiece.bulkCreate(records);
      return Response.json({
        created: records.length,
        pieces: Array.isArray(saved) ? saved : [],
        meta,
      });
    }

    const promptText = String(data?.prompt || '').trim();
    if (!promptText) return Response.json({ error: 'The AI returned no usable prompt. Try again.' }, { status: 502 });
    return Response.json({ prompt: promptText, meta });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}