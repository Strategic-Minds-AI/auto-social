import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta, sumMeta } from '../../shared/aiClient.ts';
import { fetchTrendingSearches } from '../../shared/trends.ts';
import { fetchIndustryNews } from '../../shared/news.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';

// Demand radar. Reads what is genuinely winning in an industry from the sources
// that are open to us — the public most-popular video chart, Google's public
// trending-search feed and live news coverage from named outlets — adds the business's own published numbers, then has the
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

// Named so the analyst knows what it is looking at: a chart-topper the platform is
// pushing is weaker evidence than a video the industry's own audience rewarded.
const SOURCE_TOKENS = {
  youtube_topic_search: 'top-performing video about this industry',
  youtube_most_popular: 'chart-topping video',
  google_trends_rising: 'rising search',
  google_news_latest: 'live news story',
  own_channel: "the owner's own published post",
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

async function youtubeToken(base44) {
  try {
    const connection = await base44.asServiceRole.connectors.getConnection('youtube');
    return connection?.accessToken || '';
  } catch {
    return '';
  }
}

// Fallback chart picker: the charts whose titles share words with the industry.
// Only used when the model's own pick fails, so a scan still reads something
// relevant for any industry rather than settling on an arbitrary chart.
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'our', 'you',
  'are', 'a', 'an', 'of', 'in', 'on', 'to', 'by', 'or', 'at', 'as',
]);

function closestCharts(categories, industry) {
  const wanted =
    String(industry || '')
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) || [];
  const scored = categories.map((category) => {
    const title = String(category.title).toLowerCase().match(/[a-z0-9]+/g) || [];
    return { id: category.id, hits: title.filter((word) => wanted.includes(word)).length };
  });
  const matched = scored.filter((row) => row.hits > 0).sort((a, b) => b.hits - a.hits);
  return (matched.length ? matched : scored).slice(0, 2).map((row) => row.id);
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
  const ids = chosen.length ? chosen : closestCharts(categories, industry);
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

// Videos genuinely about this industry, ordered by views over the last month. The
// category chart shows what the platform is pushing that day; this shows what the
// industry's own audience is rewarding, which is what a content plan should copy.
async function fetchTopicVideos({ accessToken, industry, region }) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    order: 'viewCount',
    maxResults: '20',
    regionCode: region,
    q: industry.slice(0, 90),
    publishedAfter: new Date(Date.now() - 30 * 86400000).toISOString(),
  });

  const searchResponse = await fetch(`${YOUTUBE_API}/search?${params.toString()}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!searchResponse.ok) {
    return { items: [], note: `No industry videos this run: the search returned HTTP ${searchResponse.status}.` };
  }
  const searchData = await searchResponse.json();
  const found = (searchData.items || [])
    .map((row) => ({
      id: row?.id?.videoId,
      title: String(row?.snippet?.title || '').trim(),
      channel: row?.snippet?.channelTitle || '',
      published_at: row?.snippet?.publishedAt || '',
    }))
    .filter((row) => row.id && row.title);
  if (!found.length) return { items: [], note: 'No industry videos this run: the search came back empty.' };

  const unique = [...new Map(found.map((row) => [row.id, row])).values()];
  const statsResponse = await fetch(
    `${YOUTUBE_API}/videos?part=statistics,contentDetails&id=${unique.map((row) => row.id).join(',')}`,
    { headers, signal: AbortSignal.timeout(15000) }
  );
  if (!statsResponse.ok) {
    return { items: [], note: `No industry videos this run: the statistics read returned HTTP ${statsResponse.status}.` };
  }
  const statsData = await statsResponse.json();
  const statsById = new Map((statsData.items || []).map((row) => [row.id, row]));

  const items = unique.map((row) => {
    const stats = statsById.get(row.id);
    const views = Number(stats?.statistics?.viewCount) || 0;
    const likes = Number(stats?.statistics?.likeCount) || 0;
    const comments = Number(stats?.statistics?.commentCount) || 0;
    const seconds = parseDuration(stats?.contentDetails?.duration);
    return {
      platform: 'youtube',
      source: 'youtube_topic_search',
      kind: 'video',
      title: row.title,
      url: `https://www.youtube.com/watch?v=${row.id}`,
      creator: row.channel,
      published_at: row.published_at,
      duration_seconds: seconds,
      format: shapeFromSeconds(seconds),
      category: 'industry top videos',
      views,
      likes,
      comments,
      engagements: likes + comments,
      engagement_rate: engagementRate({ views, likes, comments }),
    };
  });

  const usable = items.filter((item) => item.title && item.views > 0).sort((a, b) => b.views - a.views);
  return {
    items: usable,
    note: usable.length
      ? `Found ${usable.length} top-performing videos posted about this industry in the last 30 days.`
      : 'No industry videos this run: nothing recent ranked for that topic.',
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
        SOURCE_TOKENS[item.source] || item.source,
        item.category || '',
        item.duration_seconds ? `${item.duration_seconds}s` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      const numbers =
        item.kind === 'search'
          ? `approx searches ${item.approx_searches || 'unknown'}`
          : item.kind === 'article'
            ? `published ${item.published_at ? item.published_at.slice(0, 10) : 'recently'} by ${item.creator || 'an unnamed outlet'}`
            : `views ${item.views}, likes ${item.likes}, comments ${item.comments}, engagement rate ${item.engagement_rate}%`;
      return `${shape}
Title: ${item.title}
By: ${item.creator || 'unknown'} | ${numbers}`;
    })
    .join('\n\n');

  return `You are the demand analyst inside a social media platform. Below is what is currently winning in the ${industry} market (${region}), plus any rising searches and the owner's own best-performing posts.

${businessLines}

The items are of four kinds: video (a chart-topping video), search (a rising search), article (live news coverage from a named outlet) and post (the owner's own published post with measured numbers).

For every item, explain the pattern so the owner can make the same kind of content without copying it:
- index: the item's index, exactly as given
- score: 0 to 100 for how strong a template this is to learn from. Judge mainly on how well it fits this industry and on its engagement rate, never on raw view count alone. A chart-topping video from an unrelated genre, or a market-wide search that does not touch this industry, is weak evidence however big its numbers look: score those below 40, and score anything clearly unrelated below 20. The strongest evidence is a top-performing video about this industry, live coverage of it, or the owner's own measured post, and those should carry the highest scores
- hook_type: 2 to 4 words naming the opening device, for example curiosity gap, shock stat, how-to promise, before-and-after, myth correction
- hook_text: that opening rewritten as one fresh line this industry's business could actually say. Never reuse their wording
- why_it_works: 1 to 2 sentences on the psychology that made it land
- takeaways: 2 to 3 short, concrete things to do in the next post
- tags: 3 to 6 short pattern labels such as fast-cut, voiceover, text-overlay, single-take, b-roll
- visual_style and audio_style: brief descriptions of how it looks and sounds
- faceless_friendly: true when this could be made with no person on camera — stock footage, product shots, screen capture, text over b-roll

For article items, hook_type is the angle of the story rather than a content format, hook_text is one line this business could post about it today, and takeaways are ways to join that conversation.

Cover every index. Never invent numbers or claim data you were not given.

ITEMS
${lines}`;
}

// One industry scan: gather the live sources, have the analyst name the pattern
// behind each winner, then replace that industry's saved list. Shared by the
// on-demand scan and the scheduled run, so both read the market identically.
async function scanIndustry({ base44, industry, region, business, ownerId, user }) {
    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) {
      return {
        ok: false,
        status: budget.status,
        error: budget.message,
        usage: budget.usage,
        notes: [],
        counts: null,
        signals: [],
      };
    }

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
          url: `https://trends.google.com/trending?geo=${region}`,
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

    // Live coverage of the industry itself — the one source that works for any
    // niche, in any market, and names the outlet behind every headline.
    const news = await fetchIndustryNews({ query: industry, region, limit: 10 });
    if (news.ok) {
      news.entries.forEach((entry) => {
        gathered.push({
          platform: 'google_news',
          source: 'google_news_latest',
          kind: 'article',
          title: entry.title,
          url: entry.url,
          creator: entry.publisher,
          published_at: entry.published_at,
          category: 'news',
          momentum: 'steady',
          views: 0,
          likes: 0,
          comments: 0,
          engagements: 0,
          engagement_rate: 0,
        });
      });
      notes.push(`Read ${news.entries.length} pieces of live coverage about this industry from named outlets.`);
    } else {
      notes.push(`No live coverage this run: ${news.reason}`);
    }

    const accessToken = await youtubeToken(base44);
    if (!accessToken) {
      notes.push(YOUTUBE_NOT_CONNECTED);
    } else {
      const chart = await fetchChart(base44, { accessToken, industry, region, metas });
      gathered.push(...chart.items);
      notes.push(chart.note);

      const topicVideos = await fetchTopicVideos({ accessToken, industry, region });
      gathered.push(...topicVideos.items);
      notes.push(topicVideos.note);
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
    const byViews = (a, b) => (b.views || 0) - (a.views || 0);
    const ownItems = gathered.filter((item) => item.source === 'own_channel').slice(0, 3);
    const topicItems = gathered.filter((item) => item.source === 'youtube_topic_search').sort(byViews).slice(0, 9);
    const chartItems = gathered.filter((item) => item.source === 'youtube_most_popular').sort(byViews).slice(0, 5);
    const spikeItems = gathered.filter((item) => item.source === 'google_trends_rising').slice(0, 4);
    const newsItems = gathered.filter((item) => item.source === 'google_news_latest').slice(0, 3);
    const ordered = [...ownItems, ...topicItems, ...chartItems, ...spikeItems, ...newsItems].slice(0, MAX_SIGNALS);

    const counts = {
      topic: ordered.filter((item) => item.source === 'youtube_topic_search').length,
      chart: ordered.filter((item) => item.source === 'youtube_most_popular').length,
      spikes: ordered.filter((item) => item.source === 'google_trends_rising').length,
      news: ordered.filter((item) => item.source === 'google_news_latest').length,
      own: ordered.filter((item) => item.source === 'own_channel').length,
    };

    if (!ordered.length) {
      return { ok: true, notes, counts, provider: '', signals: [] };
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
        owner_id: ownerId,
        region,
        platform: item.platform,
        source: item.source,
        kind: item.kind,
        title: item.title,
        url: item.url || '',
        creator: item.creator || '',
        published_at: item.published_at || '',
        duration_seconds: item.duration_seconds || 0,
        format: item.format || (item.kind === 'search' || item.kind === 'article' ? item.kind : 'post'),
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
    await base44.entities.TrendSignal.deleteMany({ niche_key: nicheKey, owner_id: ownerId });
    const saved = await base44.entities.TrendSignal.bulkCreate(records);

    await recordAiUsage(base44, user, sumMeta(metas));

    return {
      ok: true,
      notes,
      counts,
      provider: sumMeta(metas).provider,
      signals: Array.isArray(saved) ? saved : [],
    };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const region = String(body.region || 'US').trim().toUpperCase().slice(0, 4) || 'US';

    // The scheduled run: one read per business, so the radar is already fresh when
    // the owner opens it. Admin-only, and every business is reported separately so
    // one industry failing never hides the rest.
    if (body.scan_all === true) {
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

      const all = await base44.asServiceRole.entities.Business.list('-created_date', 200).catch(() => []);
      const targets = (all || []).filter((entry) => String(entry.industry || '').trim());
      const results = [];

      for (const business of targets) {
        const industry = String(business.industry).trim().slice(0, 80);
        try {
          const outcome = await scanIndustry({
            base44,
            industry,
            region,
            business,
            ownerId: business.created_by_id || user.id,
            user,
          });
          results.push({
            business_id: business.id,
            business_name: business.name,
            industry,
            ok: outcome.ok,
            error: outcome.error || null,
            signals: (outcome.signals || []).length,
            notes: outcome.notes || [],
          });
          // Out of AI budget for today: stop rather than report the same wall
          // once for every remaining business.
          if (outcome.status === 429) break;
        } catch (error) {
          results.push({
            business_id: business.id,
            business_name: business.name,
            industry,
            ok: false,
            error: error.message,
            signals: 0,
            notes: [],
          });
        }
      }

      return Response.json({
        scan_all: true,
        region,
        scanned_at: new Date().toISOString(),
        businesses: results.length,
        results,
      });
    }

    const industry = String(body.industry || '').trim().slice(0, 80);
    if (!industry) return Response.json({ error: 'Name the industry you want read.' }, { status: 400 });

    const business = body.business_id
      ? await base44.entities.Business.get(String(body.business_id)).catch(() => null)
      : null;

    const outcome = await scanIndustry({ base44, industry, region, business, ownerId: user.id, user });
    if (!outcome.ok) {
      return Response.json({ error: outcome.error, usage: outcome.usage }, { status: outcome.status || 500 });
    }

    return Response.json({
      industry,
      region,
      notes: outcome.notes,
      counts: outcome.counts,
      provider: outcome.provider,
      signals: outcome.signals,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}