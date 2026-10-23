import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';
import { researchWebsite } from '../../shared/website.ts';
import { DISCOVERY_SCHEMA, DISCOVERY_SYSTEM, buildDiscoveryPrompt } from '../../shared/discovery.ts';

// The discovery scan: read the business's own website, read what is already winning in
// its category, and write two records the rest of the app acts on — an SEO and hashtag
// plan, and a benchmark playbook distilled from the measured winners.

const MAX_SIGNALS = 12;
const MAX_KEYWORDS = 25;
const MAX_HASHTAGS = 32;
const MAX_RULES = 6;

// A thin answer is not an answer. Below these floors the scan asks again, and if it
// stays thin it changes nothing rather than overwriting what a good run already wrote.
const MIN_KEYWORDS = 10;
const MIN_HASHTAGS = 15;

const TIERS = ['broad', 'niche', 'local', 'brand', 'partner'];
const INTENTS = ['informational', 'commercial', 'local', 'navigational'];
const TAG_KINDS = ['own_brand', 'hashtag', 'location', 'partner', 'collab'];

const KEYWORD_KEYS = ['keywords', 'search_terms', 'keyword_list', 'seo_keywords', 'keywords_to_own'];
const HASHTAG_KEYS = ['hashtags', 'tags', 'tag_ladder', 'hashtag_ladder', 'hashtags_by_tier', 'tag_sets'];
const RULE_KEYS = ['benchmarks', 'rules', 'playbook', 'patterns', 'benchmark_rules'];
const TAG_PLAN_KEYS = ['tag_plan', 'tagging_plan', 'tags_plan', 'tagging'];
const META_KEYS = ['meta_suggestions', 'meta_titles', 'page_titles', 'meta_descriptions'];

const flatten = (items) => items.flatMap((item) => (Array.isArray(item) ? flatten(item) : [item]));

// A small model returns a list in whichever shape it feels like: an array of objects, an
// array of strings, one object keyed by platform, or a single delimited string. Every one
// of those is read, because a scan that only works when the model behaves is not a feature.
function asList(value, mode) {
  if (Array.isArray(value)) return flatten(value);
  if (value && typeof value === 'object') return flatten(Object.values(value));
  if (typeof value !== 'string' || !value.trim()) return [];
  if (mode === 'hashtags') {
    const tags = value.match(/#[^\s#,;]+/g);
    if (tags && tags.length) return tags;
  }
  return value
    .split(mode === 'keywords' ? /[\n,;|]+/ : /[\n;]+|,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function pick(source, keys, mode) {
  for (const key of keys) {
    const found = asList(source?.[key], mode);
    if (found.length) return found;
  }
  return [];
}

// Last resort: pull every hashtag out of the payload wherever the model decided to put it.
function hashtagsAnywhere(node, depth = 0, found = []) {
  if (!node || depth > 4 || found.length > 40) return found;
  if (typeof node === 'string') {
    (node.match(/#[^\s#,;]+/g) || []).forEach((tag) => found.push(tag));
    return found;
  }
  if (Array.isArray(node)) {
    node.forEach((item) => hashtagsAnywhere(item, depth + 1, found));
    return found;
  }
  if (typeof node === 'object') {
    Object.values(node).forEach((value) => hashtagsAnywhere(value, depth + 1, found));
  }
  return found;
}

const asObject = (entry, key) => (typeof entry === 'string' ? { [key]: entry } : entry || {});

// A model fills a field it does not want to write with a placeholder rather than
// leaving it out, so placeholders are dropped instead of being shown as a heading.
const isJunk = (value) =>
  !String(value || '').trim() || /^\(?(none|n\/?a|null|unknown|undefined|-)\)?$/i.test(String(value).trim());

function readDiscovery(data) {
  // The plan is usually nested under "seo"; a flat answer is read just the same.
  const seo = data?.seo && typeof data.seo === 'object' ? data.seo : data || {};
  const sources = [seo, data || {}];

  const rawKeywords = sources.map((source) => pick(source, KEYWORD_KEYS, 'keywords')).find((list) => list.length) || [];
  const namedTags = sources.map((source) => pick(source, HASHTAG_KEYS, 'hashtags')).find((list) => list.length) || [];
  const rawTags = namedTags.length ? namedTags : hashtagsAnywhere(seo);

  const keywords = rawKeywords
    .map((keyword) => asObject(keyword, 'term'))
    .filter((keyword) => String(keyword.term || '').trim())
    .slice(0, MAX_KEYWORDS)
    .map((keyword) => ({
      term: String(keyword.term).trim(),
      intent: INTENTS.includes(keyword.intent) ? keyword.intent : 'commercial',
      priority: Math.max(0, Math.min(100, Number(keyword.priority) || 50)),
      why: String(keyword.why || '').trim(),
    }));

  const seenTags = new Set();
  const hashtags = rawTags
    .map((item) => asObject(item, 'tag'))
    .map((item) => {
      const tag = String(item.tag || '').trim();
      return { ...item, tag: tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '')}` };
    })
    .filter((item) => {
      // A ladder that lists the same tag six times is not a ladder.
      const key = item.tag.toLowerCase();
      if (item.tag === '#' || seenTags.has(key)) return false;
      seenTags.add(key);
      return true;
    })
    .slice(0, MAX_HASHTAGS)
    .map((item) => ({
      tag: item.tag,
      tier: TIERS.includes(item.tier) ? item.tier : 'niche',
      platform: String(item.platform || '').trim(),
      why: String(item.why || '').trim(),
    }));

  const rulesFor = (source) => pick(source, RULE_KEYS, 'list');
  const rawRules = rulesFor(seo).length ? rulesFor(seo) : rulesFor(data || {});

  const planFor = (source, keys) => pick(source, keys, 'list');
  const tagPlanRaw = planFor(seo, TAG_PLAN_KEYS).length ? planFor(seo, TAG_PLAN_KEYS) : planFor(data || {}, TAG_PLAN_KEYS);
  const metaRaw = planFor(seo, META_KEYS).length ? planFor(seo, META_KEYS) : planFor(data || {}, META_KEYS);

  return { seo, keywords, hashtags, rawRules, tagPlanRaw, metaRaw };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const businessId = String(body.business_id || '').trim();
    if (!businessId) return Response.json({ error: 'Choose a business first.' }, { status: 400 });

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) {
      return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });
    }

    // RLS-scoped: a business the caller cannot read will not resolve.
    const business = await base44.entities.Business.get(businessId).catch(() => null);
    if (!business) return Response.json({ error: 'That business is not available to you.' }, { status: 403 });

    // The site, the measured winners, the owner's own numbers and the existing dossier
    // are four independent reads.
    const [site, signalPage, metricPage, dossierPage] = await Promise.all([
      business.website
        ? researchWebsite(business.website)
        : Promise.resolve({ ok: false, reason: 'No website address is saved for this business.' }),
      base44.entities.TrendSignal.filter({}, { sort: '-score', limit: MAX_SIGNALS }).catch(() => ({ items: [] })),
      base44.entities.PostMetric.filter({ business_id: business.id }, { sort: '-metric_date', limit: 25 }).catch(() => ({ items: [] })),
      base44.entities.BusinessDiscovery.filter({ business_id: business.id }, { limit: 1 }).catch(() => ({ items: [] })),
    ]);

    const signals = signalPage.items || [];
    const metrics = metricPage.items || [];
    const dossier = (dossierPage.items || [])[0] || null;

    const prompt = buildDiscoveryPrompt({ business, site, signals, metrics, dossier, platform: body.platform });

    // A thin or oddly shaped answer is normal with a small model. The ask is repeated
    // once, naming what fell short, and nothing is written until it clears the floors.
    let seo = {};
    let keywords = [];
    let hashtags = [];
    let rawRules = [];
    let tagPlanRaw = [];
    let metaRaw = [];
    let meta = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const result = await generateJsonWithMeta(base44, {
        prompt:
          attempt === 1
            ? prompt
            : `${prompt}\n\nIMPORTANT: your previous answer was unusable — it returned ${keywords.length} keywords and ${hashtags.length} hashtags. Return every key, with at least 15 keywords and at least 20 hashtags, every hashtag carrying its tier.`,
        schema: DISCOVERY_SCHEMA,
        system: DISCOVERY_SYSTEM,
        maxTokens: 4000,
        temperature: attempt === 1 ? 0.6 : 0.35,
      });

      meta = result.meta;
      const read = readDiscovery(result.data);
      seo = read.seo;
      keywords = read.keywords;
      hashtags = read.hashtags;
      rawRules = read.rawRules;
      tagPlanRaw = read.tagPlanRaw;
      metaRaw = read.metaRaw;
      if (keywords.length >= MIN_KEYWORDS && hashtags.length >= MIN_HASHTAGS) break;
    }

    await recordAiUsage(base44, user, meta);

    if (keywords.length < MIN_KEYWORDS || hashtags.length < MIN_HASHTAGS) {
      return Response.json(
        {
          error: `The scan came back too thin twice (${keywords.length} keywords, ${hashtags.length} tags) so nothing was changed. Run it again — and add the website address if it is missing.`,
        },
        { status: 502 }
      );
    }

    const now = new Date().toISOString();
    const profileFields = {
      business_id: business.id,
      website_url: business.website || '',
      site_title: site.ok ? site.title || '' : '',
      site_summary: String(seo.site_summary || '').trim(),
      website_read: Boolean(site.ok),
      website_note: site.ok ? `Read ${site.url}` : site.reason || 'The website was not read.',
      keywords,
      hashtags,
      tag_plan: tagPlanRaw
        .map((entry) => asObject(entry, 'guidance'))
        .map((entry) => {
          // When the model sends the rule as a bare sentence, that sentence is the guidance.
          const guidance = isJunk(entry.guidance) ? entry.label : entry.guidance;
          return {
            kind: TAG_KINDS.includes(entry.kind) ? entry.kind : 'hashtag',
            label: isJunk(entry.label) || entry.label === guidance ? 'How to tag' : String(entry.label).trim(),
            guidance: String(guidance || '').trim(),
          };
        })
        .filter((entry) => !isJunk(entry.guidance))
        .slice(0, 6),
      meta_suggestions: metaRaw
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .slice(0, 4),
      search_notes: String(seo.search_notes || '').trim(),
      platform: String(body.platform || ''),
      engine: meta ? meta.provider : '',
      model: meta ? meta.model : '',
      generated_at: now,
    };

    const existing = await base44.entities.SeoProfile.filter({ business_id: business.id }, { limit: 1 }).catch(() => ({ items: [] }));
    const current = (existing.items || [])[0];
    const profile = current
      ? await base44.entities.SeoProfile.update(current.id, profileFields)
      : await base44.entities.SeoProfile.create(profileFields);

    // Rules cite the signals they came from, so every claim can be checked against a
    // real, measured piece.
    const signalById = new Map(signals.map((signal) => [String(signal.id), signal]));
    const ruleRecords = rawRules
      .map((rule) => asObject(rule, 'technique'))
      .filter((rule) => String(rule.technique || '').trim())
      .slice(0, MAX_RULES)
      .map((rule) => {
        const cited = asList(rule.evidence_ids, 'list')
          .map((id) => signalById.get(String(id).trim()))
          .filter(Boolean)
          .map((signal) => ({
            title: signal.title || '',
            url: signal.url || '',
            platform: signal.platform || '',
            metric: [
              signal.views ? `${signal.views} views` : null,
              signal.engagement_rate ? `${signal.engagement_rate}% engagement` : null,
              signal.score != null ? `score ${signal.score}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
            source: signal.source || '',
          }));

        return {
          business_id: business.id,
          industry: business.industry || '',
          label: String(rule.label || 'Winning pattern').trim(),
          technique: String(rule.technique).trim(),
          hook_pattern: String(rule.hook_pattern || '').trim(),
          format: String(rule.format || '').trim(),
          why_it_works: String(rule.why_it_works || '').trim(),
          evidence: cited,
          priority: Math.max(0, Math.min(100, Number(rule.priority) || 50)),
          active: true,
          used_count: 0,
          engine: meta ? meta.provider : '',
          generated_at: now,
        };
      });

    // The playbook is replaced only by a better one. A run that distilled no rules must
    // never wipe the rules the last good run produced.
    let rules = [];
    if (ruleRecords.length) {
      await base44.entities.BenchmarkRule.deleteMany({ business_id: business.id }).catch(() => null);
      rules = await base44.entities.BenchmarkRule.bulkCreate(ruleRecords);
    } else {
      const kept = await base44.entities.BenchmarkRule
        .filter({ business_id: business.id }, { sort: '-priority', limit: MAX_RULES })
        .catch(() => ({ items: [] }));
      rules = kept.items || [];
    }

    return Response.json({
      profile,
      rules: Array.isArray(rules) ? rules : [],
      counts: {
        keywords: keywords.length,
        hashtags: hashtags.length,
        rules: rules.length,
        signalsUsed: signals.length,
        ownMetricsUsed: metrics.length,
      },
      website: { read: Boolean(site.ok), note: profileFields.website_note },
      meta,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}