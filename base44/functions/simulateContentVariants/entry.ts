import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta, sumMeta } from '../../shared/aiClient.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';

// Angle simulator. Takes one topic and writes several genuinely different versions
// of it, then ranks them against real evidence: the live market signals the radar
// gathered (with their measured numbers) and the owner's own published results.
// Every version carries a predicted score, the reason behind it and the risk that
// would sink it, so the pick is argued rather than guessed. Runs on the owner's own
// gateway, so a simulation never spends Base44 integration credits.

const MAX_VARIANTS = 5;
const DEFAULT_VARIANTS = 4;
const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube'];
const FORMATS = ['post', 'story', 'reel', 'short_video', 'image'];

const SOURCE_LABELS = {
  youtube_topic_search: 'Top video for this industry',
  youtube_most_popular: 'Chart-topping video',
  google_trends_rising: 'Rising search',
  google_news_latest: 'Live news coverage',
  own_channel: 'Your own published post',
};

const SIMULATION_SCHEMA = {
  type: 'object',
  properties: {
    rubric: { type: 'string' },
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          angle: { type: 'string' },
          hook: { type: 'string' },
          caption: { type: 'string' },
          call_to_action: { type: 'string' },
          hashtags: { type: 'string' },
          predicted_score: { type: 'number' },
          predicted_engagement_rate: { type: 'number' },
          why_it_will_win: { type: 'string' },
          based_on: { type: 'string' },
          risks: { type: 'string' },
          pattern_tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['label', 'hook', 'caption', 'predicted_score'],
      },
    },
  },
  required: ['variants'],
};

function text(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit);
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(Math.max(Math.round(number), 0), 100);
}

function clampRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(Math.round(number * 100) / 100, 0), 100);
}

function describeSignal(row) {
  const numbers =
    row.kind === 'search'
      ? `about ${row.approx_searches || 'unknown'} searches`
      : row.kind === 'article'
        ? `published ${row.published_at ? row.published_at.slice(0, 10) : 'recently'} by ${row.creator || 'an unnamed outlet'}`
        : `${row.views || 0} views, ${row.likes || 0} likes, ${row.comments || 0} comments, ${row.engagement_rate || 0}% engagement`;
  const shape = [row.hook_type ? `hook: ${row.hook_type}` : '', row.tags?.length ? `patterns: ${row.tags.join(', ')}` : '']
    .filter(Boolean)
    .join(' | ');
  return `[${SOURCE_LABELS[row.source] || row.source}] "${row.title}"${row.creator && row.kind !== 'article' ? ` by ${row.creator}` : ''} — ${numbers}${shape ? ` | ${shape}` : ''}${row.why_it_works ? `\n   why it worked: ${row.why_it_works}` : ''}`;
}

function buildPrompt({ business, discovery, topic, platform, format, wanted, signals, metrics }) {
  const signalsBlock = signals.length
    ? signals.map((row) => `- ${describeSignal(row)}`).join('\n')
    : '- No market signals are on file for this industry yet.';

  const metricsBlock = metrics.length
    ? metrics
        .map(
          (row) =>
            `- ${text(row.caption_excerpt || row.topic || row.pillar || 'A post', 120)} · ${row.platform || 'facebook'} · ${row.views || 0} views · ${row.engagements || 0} engagements`
        )
        .join('\n')
    : '- The owner has no measured posts yet.';

  const positioning = [discovery?.positioning, discovery?.audience_insights].filter(Boolean).join(' ');
  const talkingPoints = Array.isArray(discovery?.talking_points) ? discovery.talking_points.slice(0, 6).join('; ') : '';

  return `You are the simulation engine inside a social media platform. You test competing versions of one piece of content against real evidence, then say which version is most likely to earn engagement and growth, and exactly why.

THE BUSINESS
Name: ${business.name}
What it does: ${text(business.description, 400) || 'not stated'}
Services: ${text(business.services, 400) || 'not stated'}
Audience: ${text(business.target_audience, 200) || 'not stated'}
Brand tone: ${text(business.tone, 60) || 'professional'}
Goal for its content: ${text(business.primary_goal, 200) || 'engagement and growth'}
${positioning ? `Positioning: ${text(positioning, 400)}` : ''}
${talkingPoints ? `Worth talking about: ${talkingPoints}` : ''}

THE CONTENT BEING TESTED
Topic: ${topic}
Channel: ${platform} | Format: ${format}

REAL EVIDENCE — WHAT IS WINNING IN THIS MARKET (each line is a measured or published item)
${signalsBlock}

THE OWNER'S OWN MEASURED RESULTS
${metricsBlock}

Write ${wanted} genuinely different versions of this content. Each version must use a different psychological device — for example curiosity gap, myth correction, proof by numbers, contrarian take, before-and-after, question hook, or a short list. Never two versions of the same idea.

For each version return:
- label: 2 to 4 words naming the angle
- angle: the psychological device it uses
- hook: the opening line exactly as it would be posted
- caption: the complete caption, ready to publish
- call_to_action: the closing ask
- hashtags: 4 to 8 relevant tags, comma separated
- predicted_score: 0 to 100 for how likely this is to earn engagement for this business, judged against the evidence above
- predicted_engagement_rate: a rough percentage of viewers you expect to engage, anchored on the closest comparable measured item
- why_it_will_win: 1 to 2 sentences tying the prediction to specific evidence above
- based_on: which evidence item it borrows its pattern from, quoted by its title
- risks: what would make it underperform
- pattern_tags: 3 to 6 short labels such as text-overlay, fast-cut, single-image, carousel, voiceover

Also return rubric: one sentence naming what the ranking is based on.

Rules: never invent a measured number and never describe a prediction as a measured result. Write in this business's own voice and tone. No emojis unless the brand tone is playful.`;
}

function rankVariants(raw, wanted) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : [])
    .map((row, index) => ({
      label: text(row?.label, 60) || `Angle ${index + 1}`,
      angle: text(row?.angle, 120),
      hook: text(row?.hook, 300),
      caption: text(row?.caption, 2200),
      call_to_action: text(row?.call_to_action, 200),
      hashtags: text(row?.hashtags, 300),
      predicted_score: clampScore(row?.predicted_score),
      predicted_engagement_rate: clampRate(row?.predicted_engagement_rate),
      why_it_will_win: text(row?.why_it_will_win, 600),
      based_on: text(row?.based_on, 200),
      risks: text(row?.risks, 400),
      pattern_tags: Array.isArray(row?.pattern_tags) ? row.pattern_tags.slice(0, 6).map((tag) => text(tag, 30)) : [],
    }))
    .filter((row) => row.hook && row.caption)
    .filter((row) => {
      const key = (row.angle || row.label).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.predicted_score - a.predicted_score)
    .slice(0, wanted);
}

// Evidence is weighted by how close it is to the business: a video the industry's
// own audience rewarded, live coverage of the industry, or the owner's own measured
// post says far more than a chart-topper from an unrelated genre.
const SOURCE_WEIGHT = {
  youtube_topic_search: 4,
  own_channel: 3,
  google_news_latest: 3,
  google_trends_rising: 2,
  youtube_most_popular: 1,
};

function rankSignals(rows) {
  return rows
    .slice()
    .sort(
      (a, b) =>
        (SOURCE_WEIGHT[b.source] || 0) - (SOURCE_WEIGHT[a.source] || 0) || (b.score || 0) - (a.score || 0)
    );
}

function evidenceRows(signals, metrics) {
  const fromSignals = signals.slice(0, 6).map((row) => ({
    label: SOURCE_LABELS[row.source] || row.source,
    detail: `${row.title}${row.creator && row.kind !== 'article' ? ` — ${row.creator}` : ''}`.slice(0, 200),
    metric:
      row.kind === 'search'
        ? `about ${row.approx_searches || 0} searches`
        : row.kind === 'article'
          ? `published ${row.published_at ? row.published_at.slice(0, 10) : 'recently'}`
          : `${row.views || 0} views · ${row.likes || 0} likes · ${row.engagement_rate || 0}% engagement`,
    url: row.url || '',
  }));
  const fromMetrics = metrics.slice(0, 3).map((row) => ({
    label: 'Your own measured post',
    detail: text(row.caption_excerpt || row.topic || row.pillar || 'Your post', 200),
    metric: `${row.views || 0} views · ${row.engagements || 0} engagements`,
    url: row.permalink_url || '',
  }));
  return [...fromSignals, ...fromMetrics];
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const businessId = text(body.business_id, 60);
    const topic = text(body.topic, 200);
    if (!businessId) return Response.json({ error: 'Choose a business first.' }, { status: 400 });
    if (!topic) return Response.json({ error: 'Say what the content should be about.' }, { status: 400 });

    const platform = PLATFORMS.includes(text(body.platform, 20)) ? text(body.platform, 20) : 'instagram';
    const format = FORMATS.includes(text(body.format, 20)) ? text(body.format, 20) : 'post';
    const wanted = Math.min(Math.max(Number(body.variants) || DEFAULT_VARIANTS, 3), MAX_VARIANTS);

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) {
      return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });
    }

    const business = await base44.entities.Business.get(businessId).catch(() => null);
    if (!business) return Response.json({ error: 'That business was not found.' }, { status: 404 });

    const [signalPage, metricPage, discoveryPage] = await Promise.all([
      base44.entities.TrendSignal.filter({ owner_id: user.id }, { sort: '-score', limit: 40 }).catch(() => ({ items: [] })),
      base44.entities.PostMetric
        .filter({ business_id: businessId, scope: 'post' }, { sort: '-engagements', limit: 10 })
        .catch(() => ({ items: [] })),
      base44.entities.BusinessDiscovery
        .filter({ business_id: businessId }, { sort: '-created_date', limit: 1 })
        .catch(() => ({ items: [] })),
    ]);

    // Prefer the read taken for this business; otherwise the one taken for its industry.
    const allSignals = signalPage.items || [];
    const nicheKey = text(business.industry, 80).toLowerCase().replace(/\s+/g, ' ');
    const forBusiness = allSignals.filter((row) => row.business_id === businessId);
    const forIndustry = nicheKey ? allSignals.filter((row) => row.niche_key === nicheKey) : [];
    const signals = rankSignals(forBusiness.length ? forBusiness : forIndustry).slice(0, 14);

    const metrics = (metricPage.items || []).filter((row) => (row.views || 0) + (row.engagements || 0) > 0);
    const discovery = (discoveryPage.items || [])[0] || null;

    if (!signals.length && !metrics.length) {
      return Response.json(
        {
          error:
            'There is no evidence to judge against yet. Scan this industry on the Demand Radar first, so the simulation has real numbers to work from.',
        },
        { status: 400 }
      );
    }

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt: buildPrompt({ business, discovery, topic, platform, format, wanted, signals, metrics }),
      schema: SIMULATION_SCHEMA,
      maxTokens: 6000,
      temperature: 0.7,
    });

    const variants = rankVariants(data?.variants, wanted);
    if (!variants.length) {
      return Response.json(
        { error: 'The simulation came back empty. Try again, or give it a narrower topic.' },
        { status: 500 }
      );
    }

    const winner = variants[0];
    const record = await base44.entities.ContentSimulation.create({
      business_id: businessId,
      owner_id: user.id,
      topic,
      platform,
      format,
      goal: text(business.primary_goal, 200),
      audience: text(business.target_audience, 200),
      tone: text(business.tone, 60),
      evidence: evidenceRows(signals, metrics),
      variants,
      ranking: variants.map((row) => ({ label: row.label, score: row.predicted_score })),
      winner_label: winner.label,
      winner_score: winner.predicted_score,
      winner_hook: winner.hook,
      rubric: text(data?.rubric, 400),
      signal_count: signals.length,
      metric_count: metrics.length,
      engine: meta?.provider || '',
      model: meta?.model || '',
    });

    await recordAiUsage(base44, user, sumMeta([meta]));

    return Response.json({ simulation: record });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}