import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { htmlToText } from '../../shared/website.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';

// Search-demand stage. Pulls what is actually trending in the owner's region from
// Google's public trending feed, hands that to the model alongside the industry
// and services, and ranks the twenty topics this business should be posting about.
// The feed is free and needs no key; if it cannot be reached the ranking is still
// produced from the industry and services alone, and the run says so.

const TRENDS_FEED = 'https://trends.google.com/trending/rss?geo=';
const MAX_PER_RUN = 5;
const TOPIC_COUNT = 20;

const TOPIC_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          category: { type: 'string' },
          interest: { type: 'number' },
          momentum: { type: 'string' },
          keywords: { type: 'string' },
        },
        required: ['topic'],
      },
    },
  },
  required: ['topics'],
};

const CATEGORIES = ['service', 'industry', 'question', 'seasonal', 'local'];
const MOMENTUM = ['rising', 'steady', 'declining'];

async function fetchTrendingSearches(geo) {
  try {
    const response = await fetch(`${TRENDS_FEED}${encodeURIComponent(geo)}`, {
      headers: { 'User-Agent': 'AutoSocialBot/1.0 (+marketing research)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { ok: false, reason: `Google Trends returned HTTP ${response.status}.` };

    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
    const entries = items
      .map((block) => {
        const title = block.match(/<title>([\s\S]*?)<\/title>/i);
        const traffic = block.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i);
        if (!title) return null;
        return {
          title: htmlToText(title[1]).slice(0, 120),
          traffic: traffic ? htmlToText(traffic[1]) : '',
        };
      })
      .filter((entry) => entry && entry.title);

    if (!entries.length) return { ok: false, reason: 'The Google Trends feed had no entries for that region.' };
    return { ok: true, entries: entries.slice(0, 25) };
  } catch (error) {
    return { ok: false, reason: `Google Trends could not be reached (${error.message}).` };
  }
}

function buildPrompt(business, discovery, trends, geo) {
  const serviceLines = (discovery?.services || []).map((s) => s.name).filter(Boolean).join(', ');
  const questions = (discovery?.questions_people_ask || []).join(' | ');

  const live = trends.ok
    ? `LIVE GOOGLE TRENDS for ${geo} right now
${trends.entries.map((e) => `- ${e.title}${e.traffic ? ` (${e.traffic})` : ''}`).join('\n')}`
    : `No live Google Trends feed was available${trends.reason ? ` (${trends.reason})` : ''}. Rank the topics from what you know about this industry and its buyers, and do not claim they came from live trend data.`;

  return `You are the search-demand analyst inside Auto Social. Rank the topics this business should be posting about.

BUSINESS
Name: ${business.name}
Industry: ${business.industry || 'not specified'}
Description: ${business.description || 'not specified'}
Services: ${business.services || 'not specified'}
Service area: ${business.service_area || 'not specified'}
Target audience: ${business.target_audience || 'not specified'}

RESEARCH ALREADY ON FILE
Services identified: ${serviceLines || 'not listed'}
Positioning: ${discovery?.positioning || 'not established'}
Questions customers ask: ${questions || 'not listed'}

${live}

Produce exactly ${TOPIC_COUNT} topics, ordered from most to least valuable for this business.
For each one give:
- topic: the subject as a person would search for it or talk about it, not a keyword string
- category: one of service, industry, question, seasonal, local
- interest: 0 to 100 for how much demand you judge there is
- momentum: rising, steady or declining
- keywords: the 3 to 6 search phrases behind it, comma separated

At least 6 must be phrased as a question a customer would ask. At least 3 must be specific to the service area. Never pad the list with rewording of the same idea.`;
}

async function researchOne(base44, business, geo) {
  const discovery = await base44.entities.BusinessDiscovery
    .filter({ business_id: business.id }, { limit: 1 })
    .then((page) => (page.items || [])[0] || null)
    .catch(() => null);

  const trends = await fetchTrendingSearches(geo);

  const { data, meta } = await generateJsonWithMeta(base44, {
    prompt: buildPrompt(business, discovery, trends, geo),
    schema: TOPIC_SCHEMA,
    // A ranked list of twenty topics is long-form output, and these gateway
    // models spend part of the ceiling reasoning: too low and the list comes
    // back empty rather than short.
    maxTokens: 8000,
    temperature: 0.6,
  });

  const topics = (Array.isArray(data?.topics) ? data.topics : []).filter((t) => t && String(t.topic || '').trim());
  if (!topics.length) throw new Error('The AI returned no usable topics. Run it again.');

  const records = topics.slice(0, TOPIC_COUNT).map((topic, index) => ({
    business_id: business.id,
    topic: String(topic.topic).trim(),
    category: CATEGORIES.includes(topic.category) ? topic.category : 'industry',
    interest: Math.min(Math.max(Number(topic.interest) || 0, 0), 100),
    momentum: MOMENTUM.includes(topic.momentum) ? topic.momentum : 'steady',
    keywords: topic.keywords || '',
    source: trends.ok ? `google_trends:${geo}` : 'industry research',
    rank: index + 1,
    used: false,
  }));

  // One ranked list per business, so a refresh replaces the previous one.
  await base44.entities.TrendTopic.deleteMany({ business_id: business.id });
  const saved = records.length ? await base44.entities.TrendTopic.bulkCreate(records) : [];

  return {
    topics: Array.isArray(saved) ? saved : [],
    used_live_trends: trends.ok,
    trend_note: trends.ok
      ? `Live Google Trends feed for ${geo}, ${trends.entries.length} trending searches read.`
      : trends.reason || 'No live trend data was available.',
    meta,
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });

    const body = await req.json().catch(() => ({}));
    const geo = String(body.geo || 'US').trim().toUpperCase().slice(0, 4) || 'US';

    let businesses = [];
    if (body.business_id) {
      const business = await base44.entities.Business.get(body.business_id).catch(() => null);
      if (!business) return Response.json({ error: 'That business is not available to you.' }, { status: 403 });
      businesses = [business];
    } else {
      const page = await base44.entities.Business.list({ sort: '-created_date', limit: MAX_PER_RUN });
      businesses = page.items || [];
    }

    if (!businesses.length) {
      return Response.json({ error: 'Add a business first, then research its topics.' }, { status: 400 });
    }

    const results = [];
    for (const business of businesses) {
      try {
        const outcome = await researchOne(base44, business, geo);
        await recordAiUsage(base44, user, outcome.meta);
        results.push({
          business_id: business.id,
          name: business.name,
          topic_count: outcome.topics.length,
          used_live_trends: outcome.used_live_trends,
          trend_note: outcome.trend_note,
          topics: outcome.topics,
        });
      } catch (error) {
        results.push({ business_id: business.id, name: business.name, error: error.message });
      }
    }

    return Response.json({ researched: results.filter((r) => !r.error).length, geo, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}