import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { fetchTrendingSearches } from '../../shared/trends.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';

// Demand radar. Reads what is genuinely winning in an industry from the sources
// that are open to us — the public most-popular video chart and Google's public
// trending-search feed — adds the business's own published numbers, then has the
// model name the pattern behind each winner: the hook, why it worked, and whether
// it can be made without a face on camera. Everything lands on TrendSignal so the
// screen reads instantly next time. All AI work runs on the owner's own gateway,
// so a scan never spends Base44 integration credits.

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const MAX_PER_CATEGORY = 20;
const MAX_SIGNALS = 24;
const YOUTUBE_NOT_CONNECTED =
  'No chart winners this run: that channel is not connected yet. Connect it and scan again.';

const CHART_SCHEMA = {
  type: 'object',
  properties: {
    ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['ids'],
};

const PATTERN_SCHEMA = {
  type: 'object',
  properties: {
    signals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          score: { type: 'number' },
          hook_type: { type: 'string' },
          hook_text: { type: 'string' },
          why_it_works: { type: 'string' },
          takeaways: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          visual_style: { type: 'string' },
          audio_style: { type: 'string' },
          faceless_friendly: { type: 'boolean' },
        },
        required: ['index'],
      },
    },
  },
  required: ['signals'],
};

function parseDuration(value) {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ''));
  if (!match) return 0;
  const [, days, hours, minutes, seconds] = match;
  return (
    (Number(days) || 0) * 86400 +
    (Number(hours) || 0) * 3600 +
    (Number(minutes) || 0) * 60 +
    (Number(seconds) || 0)
  );
}

// The feed reports traffic as text such as "200K+" or "1,000,000+".
function parseTraffic(value) {
  const text = String(value || '').replace(/[,\s+]/g, '').toUpperCase();
  const match = /^([\d.]+)(K|M|B)?$/.exec(text);
  if (!match) return 0;
  const scale = match[2] === 'B' ? 1e9 : match[2] === 'M' ? 1e6 : match[2] === 'K' ? 1e3 : 1;
  return Math.round(Number(match[1]) * scale);
}

function engagementRate({ views = 0, likes = 0, comments = 0 }) {
  if (!views) return 0;
  return Math.round(((likes + comments) / views) * 10000) / 100;
}

function shapeFromSeconds(seconds) {
  if (!seconds) return 'video';
  if (seconds <= 180) return 'short_video';
  if (seconds <= 600) return 'mid_video';
  return 'long_video';
}

function fallbackScore(item) {
  if (item.kind === 'search') return Math.min(100, 40 + Math.round((item.approx_searches || 0) / 1000));
  return Math.min(100, Math.round((item.engagement_rate || 0) * 4));
}

function clampScore(value, item) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallbackScore(item);
  return Math.min(Math.max(Math.round(number), 0), 100);
}

function sumMeta(list) {
  return list.reduce(
    (acc, meta) => ({
      provider: meta?.provider || acc.provider,
      model: meta?.model || acc.model,
      total_tokens: acc.total_tokens + (Number(meta?.total_tokens) || 0),
    }),
    { provider: '', model: '', total_tokens: 0 }
  );
}

async function youtubeToken(base44) {
  try {
    const connection = await base44.asServiceRole.connectors.getConnection('youtube');
    return connection?.accessToken || '';
  } catch {
    return '';
  }
}

// Ask the model which charts match the industry, then read each chart once.
async function fetchChart(base44, { accessToken, industry, region, metas }) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const categoryResponse = await fetch(
    `${YOUTUBE_API}/videoCategories?part=snippet&regionCode=${region}`,
    { headers, signal: AbortSignal.timeout(15000) }
  );
  if (!categoryResponse.ok) {
    return { items: [], note: `No chart winners this run: the chart returned HTTP ${categoryResponse.status}.` };
  }
  const categoryData = await categoryResponse.json();
  const categories = (categoryData.items || [])
    .filter((row) => row?.snippet?.assignable && row?.snippet?.title)
    .map((row) => ({ id: String(row.id), title: row.snippet.title }));
  if (!categories.length) {
    return { items: [], note: 'No chart winners this run: the chart had no categories for that market.' };
  }

  const { data, meta } = await generateJsonWithMeta(base44, {
    prompt: `You are choosing which video charts to read for a marketing scan.
Industry: ${industry}
Market: ${region}
Available charts: ${categories.map((category) => `${category.id} = ${category.title}`).join(' | ')}

Return the ids of up to 3 charts whose audience most closely matches the buyers of that industry. Only return ids from the list above.`,
    schema: CHART_SCHEMA,
    maxTokens: 400,
    temperature: 0.2,
  });
  metas.push(meta);

  const known = new Set(categories.map((category) => category.id));
  const chosen = (Array.isArray(data?.ids) ? data.ids : [])
    .map(String)
    .filter((id) => known.has(id))
    .slice(0, 3);
  const ids = chosen.length ? chosen : [categories[0].id];
  const titleById = new Map(categories.map((category) => [category.id, category.title]));

  const settled = await Promise.allSettled(
    ids.map((id) =>
      fetch(
        `${YOUTUBE_API}/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${region}&videoCategoryId=${id}&maxResults=${MAX_PER_CATEGORY}`,
        { headers, signal: AbortSignal.timeout(15000) }
      ).then((response) => (response.ok ? response.json() : null))
    )
  );

  const items = [];
  settled.forEach((result, position) => {
    if (result.status !== 'fulfilled' || !result.value) return;
    (result.value.items || []).forEach((video) => {
      const views = Number(video.statistics?.viewCount) || 0;
      const likes = Number(video.statistics?.likeCount) || 0;
      const comments = Number(video.statistics?.commentCount) || 0;
      const seconds = parseDuration(video.contentDetails?.duration);
      items.push({
        platform: 'youtube',
        source: 'youtube_most_popular',
        kind: 'video',
        title: String(video.snippet?.title || '').trim(),
        url: `https://www.youtube.com/watch?v=${video.id}`,
        creator: video.snippet?.channelTitle || '',
        published_at: video.snippet?.publishedAt || '',
        duration_seconds: seconds,
        format: shapeFromSeconds(seconds),
        category: titleById.get(ids[position]) || '',
        views,
        likes,
        comments,
        engagements: likes + comments,
        engagement_rate: engagementRate({ views, likes, comments }),
      });
    });
  });

  const usable = items.filter((item) => item.title && item.views > 0);
  return {
    items: usable,
    note: usable.length
      ? `Read ${usable.length} chart-topping videos from ${ids.map((id) => titleById.get(id)).join(', ')}.`
      : 'No chart winners this run: the chart came back empty for that market.',
  };
}

function buildPatternPrompt({ industry, region, business, items }) {
  const businessLines = business
    ? `The owner's business: ${business.name}${business.industry ? ` (${business.industry})` : ''}.`
    : 'No single business was chosen, so treat this as a general read of the industry.';

  const lines = items
    .map((item, position) => {
      const shape = [
        `index ${position + 1}`,
        item.kind,
        item.category || '',
        item.duration_seconds ? `${item.duration_seconds}s` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      const numbers =
        item.kind === 'search'
          ? `approx searches ${item.approx_searches || 'unknown'}`
          : `views ${item.views}, likes ${item.likes}, comments ${item.comments}, engagement rate ${item.engagement_rate}%`;
      return `${shape}
Title: ${item.title}
By: ${item.creator || 'unknown'} | ${numbers}`;
    })
    .join('\n\n');

  return `You are the demand analyst inside a social media platform. Below is what is currently winning in the ${industry} market (${region}), plus any rising searches and the owner's own best-performing posts.

${businessLines}

For every item, explain the pattern so the owner can make the same kind of content without copying it:
- index: the item's index, exactly as given
- score: 0 to 100 for how strong a template this is to learn from. Judge on engagement rate and how well it fits the industry, never on raw view count alone
- hook_type: 2 to 4 words naming the opening device, for example curiosity gap, shock stat, how-to promise, before-and-after, myth correction
- hook_text: that opening rewritten as one fresh line this industry's business could actually say. Never reuse their wording
- why_it_works: 1 to 2 sentences on the psychology that made it land
- takeaways: 2 to 3 short, concrete things to do in the next post
- tags: 3 to 6 short pattern labels such as fast-cut, voiceover, text-overlay, single-take, b-roll
- visual_style and audio_style: brief descriptions of how it looks and sounds
- faceless_friendly: true when this could be made with no person on camera — stock footage, product shots, screen capture, text over b-roll

Cover every index. Never invent numbers or claim data you were not given.

ITEMS
${lines}`;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const industry = String(body.industry || '').trim().slice(0, 80);
    const region = String(body.region || 'US').trim().toUpperCase().slice(0, 4) || 'US';
    if (!industry) return Response.json({ error: 'Name the industry you want read.' }, { status: 400 });

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) {
      return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });
    }

    const business = body.business_id
      ? await base44.entities.Business.get(String(body.business_id)).catch(() => null)
      : null;

    const notes = [];
    const gathered = [];
    const metas = [];

    const trends = await fetchTrendingSearches(region);
    if (trends.ok) {
      trends.entries.forEach((entry) => {
        gathered.push({
          platform: 'google_trends',
          source: 'google_trends_rising',
          kind: 'search',
          title: entry.title,
          keyword: entry.title,
          momentum: 'rising',
          approx_searches: parseTraffic(entry.traffic),
          url: '',
          creator: '',
          views: 0,
          likes: 0,
          comments: 0,
          engagements: 0,
          engagement_rate: 0,
        });
      });
      notes.push(`Read ${trends.entries.length} rising searches for ${region} from Google's public trending feed.`);
    } else {
      notes.push(`No search spikes this run: ${trends.reason}`);
    }

    const accessToken = await youtubeToken(base44);
    if (!accessToken) {
      notes.push(YOUTUBE_NOT_CONNECTED);
    } else {
      const chart = await fetchChart(base44, { accessToken, industry, region, metas });
      gathered.push(...chart.items);
      notes.push(chart.note);
    }

    if (business?.id) {
      const ownPage = await base44.entities.PostMetric
        .filter({ business_id: business.id, scope: 'post' }, { sort: '-engagements', limit: 10 })
        .catch(() => ({ items: [] }));
      const own = (ownPage.items || []).filter((row) => (row.views || 0) + (row.engagements || 0) > 0);
      own.forEach((row) => {
        gathered.push({
          platform: row.platform || 'facebook',
          source: 'own_channel',
          kind: 'post',
          title: row.caption_excerpt || 'Your post',
          url: row.permalink_url || '',
          creator: business.name,
          published_at: row.posted_at || '',
          category: row.topic || row.pillar || '',
          views: row.views || 0,
          likes: row.reactions || 0,
          comments: 0,
          engagements: row.engagements || 0,
          engagement_rate: row.views ? Math.round(((row.engagements || 0) / row.views) * 10000) / 100 : 0,
        });
      });
      notes.push(
        own.length
          ? `${own.length} of your own posts with recorded numbers are in this list.`
          : 'Your own posts have no views or engagement recorded yet, so they are not in this list yet.'
      );
    }

    // Fixed share per source, so a big chart can never crowd out the search spikes
    // or the owner's own numbers — every scan reads all three.
    const ownItems = gathered.filter((item) => item.source === 'own_channel').slice(0, 3);
    const chartItems = gathered
      .filter((item) => item.source === 'youtube_most_popular')
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 15);
    const spikeItems = gathered.filter((item) => item.source === 'google_trends_rising').slice(0, 6);
    const ordered = [...ownItems, ...chartItems, ...spikeItems].slice(0, MAX_SIGNALS);

    const counts = {
      chart: ordered.filter((item) => item.source === 'youtube_most_popular').length,
      spikes: ordered.filter((item) => item.source === 'google_trends_rising').length,
      own: ordered.filter((item) => item.source === 'own_channel').length,
    };

    if (!ordered.length) {
      return Response.json({ industry, region, notes, counts, signals: [] });
    }

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt: buildPatternPrompt({ industry, region, business, items: ordered }),
      schema: PATTERN_SCHEMA,
      maxTokens: 9000,
      temperature: 0.4,
    });
    metas.push(meta);

    const analysis = new Map(
      (Array.isArray(data?.signals) ? data.signals : [])
        .filter((row) => row && Number.isFinite(Number(row.index)))
        .map((row) => [Number(row.index), row])
    );

    const now = new Date().toISOString();
    const nicheKey = industry.toLowerCase().replace(/\s+/g, ' ');
    const records = ordered.map((item, position) => {
      const extra = analysis.get(position + 1) || {};
      return {
        industry,
        niche_key: nicheKey,
        business_id: business?.id || '',
        owner_id: user.id,
        region,
        platform: item.platform,
        source: item.source,
        kind: item.kind,
        title: item.title,
        url: item.url || '',
        creator: item.creator || '',
        published_at: item.published_at || '',
        duration_seconds: item.duration_seconds || 0,
        format: item.format || (item.kind === 'search' ? 'search' : 'post'),
        category: item.category || '',
        keyword: item.keyword || '',
        momentum: item.momentum || 'steady',
        approx_searches: item.approx_searches || 0,
        views: item.views || 0,
        likes: item.likes || 0,
        comments: item.comments || 0,
        shares: item.shares || 0,
        engagements: item.engagements || 0,
        engagement_rate: item.engagement_rate || 0,
        score: clampScore(extra.score, item),
        hook_type: extra.hook_type || '',
        hook_text: extra.hook_text || '',
        why_it_works: extra.why_it_works || '',
        takeaways: Array.isArray(extra.takeaways) ? extra.takeaways.slice(0, 4).map(String) : [],
        tags: Array.isArray(extra.tags) ? extra.tags.slice(0, 6).map(String) : [],
        visual_style: extra.visual_style || '',
        audio_style: extra.audio_style || '',
        faceless_friendly: Boolean(extra.faceless_friendly),
        captured_at: now,
      };
    });

    // One list per industry, so rescanning replaces the previous read.
    await base44.entities.TrendSignal.deleteMany({ niche_key: nicheKey, owner_id: user.id });
    const saved = await base44.entities.TrendSignal.bulkCreate(records);

    await recordAiUsage(base44, user, sumMeta(metas));

    return Response.json({
      industry,
      region,
      notes,
      counts,
      provider: sumMeta(metas).provider,
      signals: Array.isArray(saved) ? saved : [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}