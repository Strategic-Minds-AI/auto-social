// The discovery engine.
//
// Two halves of one job. First it reads the business's own website, because that is
// the only place its real services, wording and service area come from. Then it reads
// what is already winning in the business's category — the measured trend signals the
// radar collected — and distils those winners into rules the rest of the app can
// follow. Output: an SEO and hashtag plan, and a benchmark playbook.
//
// Both are handed back to content generation through groundingBlock(), so the plan
// changes what gets written instead of sitting in a record.

export const PLATFORM_TAG_LIMITS = {
  instagram: '8 to 15 tags',
  facebook: '2 to 3 tags',
  linkedin: '3 to 5 tags',
  x: '1 to 2 tags',
  tiktok: '4 to 6 tags',
  youtube: '3 to 5 tags in the description',
  google_business: 'no tags, use the business categories instead',
};

// The tagging law. Reach comes from being found, not from hanging off someone else's
// audience: a post that tags unrelated pages is read as spam by the platform and by
// the reader, and it is the fastest way to get an account's reach cut.
export const TAGGING_LAW = `TAGGING LAW (never break these):
- Tags go on YOUR OWN posts only. Never tag another page, brand or account on a post simply to borrow its audience; platforms read that as spam and cut reach, and it is the reason accounts get limited.
- Build the ladder: broad tags to say what the topic is, niche tags to say who it is for, a location tag when the business serves a place, one or two tags of the business's own name, and partner tags ONLY for people it genuinely works with.
- Every tag must be something real people search. Never invent brand tags, never use engagement-bait tags (follow for follow, like4like, comment for comment), and never repeat one tag in five spellings.
- Use exact phrases a buyer would type, and the same phrase as a tag and as a keyword, so the post and the site are using one vocabulary.`;

export const DISCOVERY_SCHEMA = {
  type: 'object',
  properties: {
    seo: {
      type: 'object',
      properties: {
        site_summary: { type: 'string' },
        search_notes: { type: 'string' },
        keywords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              intent: { type: 'string' },
              priority: { type: 'number' },
              why: { type: 'string' },
            },
            required: ['term'],
          },
        },
        hashtags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tag: { type: 'string' },
              tier: { type: 'string' },
              platform: { type: 'string' },
              why: { type: 'string' },
            },
            required: ['tag'],
          },
        },
        tag_plan: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kind: { type: 'string' },
              label: { type: 'string' },
              guidance: { type: 'string' },
            },
            required: ['label', 'guidance'],
          },
        },
        meta_suggestions: { type: 'array', items: { type: 'string' } },
      },
      required: ['keywords', 'hashtags', 'tag_plan', 'meta_suggestions'],
    },
    benchmarks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          technique: { type: 'string' },
          hook_pattern: { type: 'string' },
          format: { type: 'string' },
          why_it_works: { type: 'string' },
          priority: { type: 'number' },
          evidence_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['label', 'technique'],
      },
    },
  },
  required: ['seo', 'benchmarks'],
};

// The schema travels to the gateway as plain text — the request asks for a bare JSON
// object, not a schema-enforced one — so a small model needs the required keys spelled
// out where instructions carry the most weight. An omitted list is the failure mode
// this exists to prevent.
export const DISCOVERY_SYSTEM = `You are the discovery engine of a social media system. You reply with one valid JSON object and nothing else: no markdown, no commentary.

The object has exactly these top-level keys, and every one of them must be present:
{
  "seo": {
    "site_summary": "string",
    "search_notes": "string",
    "keywords": [{ "term": "string", "intent": "informational|commercial|local|navigational", "priority": 0-100, "why": "string" }],
    "hashtags": [{ "tag": "#string", "tier": "broad|niche|local|brand|partner", "platform": "string", "why": "string" }],
    "tag_plan": [{ "kind": "own_brand|hashtag|location|partner|collab", "label": "string", "guidance": "string" }],
    "meta_suggestions": ["string"]
  },
  "benchmarks": [{ "label": "string", "technique": "string", "hook_pattern": "string", "format": "string", "why_it_works": "string", "priority": 0-100, "evidence_ids": ["signal id"] }]
}

Minimum counts, which are not optional: at least 15 keywords, at least 20 hashtags across the tiers including one brand tag built from the business's own name, at least 3 tag_plan entries, at least 2 meta_suggestions, and 4 to 6 benchmarks. Never return an empty array for keywords or hashtags: if you are unsure, write the best specific phrases you can justify from the business details.`;

function businessBlock(business) {
  return `BUSINESS
Name: ${business.name}
Industry: ${business.industry || 'not specified'}
What it sells: ${business.services || business.description || 'not specified'}
Where it serves: ${business.service_area || 'not specified'}
Different from competitors because: ${business.differentiators || 'not specified'}
Audience: ${business.target_audience || 'not specified'}
Goal: ${business.primary_goal || 'not specified'}
Tone: ${business.tone || 'professional'}
Platforms it posts on: ${(business.primary_platforms || []).join(', ') || 'not chosen yet'}`;
}

function signalLine(signal) {
  const metrics = [
    signal.views ? `${signal.views} views` : null,
    signal.engagements ? `${signal.engagements} engagements` : null,
    signal.engagement_rate ? `${signal.engagement_rate}% engagement` : null,
    signal.approx_searches ? `${signal.approx_searches} approx searches` : null,
    signal.momentum ? `momentum ${signal.momentum}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return [
    `[${signal.id}] ${signal.platform || 'unknown'} · ${signal.source || 'unknown'} · ${signal.title}`,
    metrics ? `    measured: ${metrics} · score ${signal.score ?? 'n/a'}` : `    measured: score ${signal.score ?? 'n/a'}`,
    signal.hook_type || signal.hook_text ? `    hook: ${signal.hook_type || ''}${signal.hook_text ? ` — "${signal.hook_text}"` : ''}` : null,
    signal.format ? `    shape: ${signal.format}` : null,
    signal.why_it_works ? `    why it works: ${signal.why_it_works}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildDiscoveryPrompt({ business, site, signals, metrics, dossier, platform }) {
  const siteBlock = site?.ok
    ? `THE BUSINESS'S LIVE WEBSITE (fetched during this scan)
Title: ${site.title || 'no title found'}
Text as published: ${site.text}`
    : `THE BUSINESS'S WEBSITE COULD NOT BE READ
Reason: ${site?.reason || 'no website address is on file'}. Build the plan from the business details above and say so in website_note language, but never claim to have read the site.`;

  const signalBlock = signals.length
    ? signals.map(signalLine).join('\n\n')
    : 'NO MEASURED CATEGORY SIGNALS ARE ON FILE YET. Say so honestly in the benchmark technique notes and keep the rules about hooks and format general.';

  const metricBlock = metrics.length
    ? metrics
        .map(
          (metric) =>
            `- ${metric.topic || metric.pillar || 'untitled post'} · ${metric.platform}: ${metric.views || 0} views, ${metric.engagements || 0} engagements${metric.followers ? `, ${metric.followers} followers` : ''}`
        )
        .join('\n')
    : 'none measured yet';

  return `You are the discovery engine inside Auto Social, a social media system for business owners. You do two jobs in one pass: work out how this business gets found, and work out what the content winning in its category actually does.

${businessBlock(business)}

${dossier ? `DOSSIER ON THIS BUSINESS (research already done)\nPositioning: ${dossier.positioning || 'n/a'}\nAudience: ${dossier.audience_insights || 'n/a'}\nQuestions customers ask: ${(dossier.questions_people_ask || []).join('; ') || 'n/a'}` : ''}

${siteBlock}

WHAT IS WINNING IN THIS CATEGORY RIGHT NOW (measured pieces the radar collected — use these as evidence, never invent others)
${signalBlock}

THE BUSINESS'S OWN MEASURED POSTS
${metricBlock}

${TAGGING_LAW}

JOB 1 — THE SEO AND TAG PLAN
- keywords: 15 to 25 phrases real buyers type when they are looking for exactly what this business sells. Each needs its intent (informational, commercial, local or navigational), a priority from 0 to 100, and one line saying why it is worth owning. Prefer specific phrases over single words, and cover the service area when the business has one.
- hashtags: 20 to 30 tags in one ladder, each tagged with its tier (broad, niche, local, brand or partner) and the platform it belongs on. Always include at least one brand tag built from the business's own name, and one location tag for each place it serves when a service area is on file. Platform limits: ${Object.entries(PLATFORM_TAG_LIMITS).map(([key, value]) => `${key} ${value}`).join(' · ')}.
- tag_plan: 3 to 5 short entries explaining the tagging habit for this business — the brand tag it should own, where the location tag goes, how partner tags are earned.
- meta_suggestions: 2 to 4 page title or meta description lines for the website itself, each under 160 characters.
- search_notes: what you noticed about how this business is found, and the one gap worth closing first.
Every key in this job must be present in your answer, even as an empty list. An omitted key is read downstream as a failure, so never drop one.

JOB 2 — THE BENCHMARK PLAYBOOK
Distil the measured winners into 4 to 6 rules. Each rule states a technique the app can follow, the hook pattern worth copying, the shape of the content, and why it works. Every rule must cite the ids of the signals it came from in evidence_ids — use only ids that appear above, and never cite a signal you were not given.
- technique: concrete steps, not a description. If the winner is "Step-by-step AI automation guide", the technique is the structure that made it win.
- hook_pattern: a reusable opening formula, rewritten for this business's subject matter.
- priority: 0 to 100, how strongly it should steer generation.
${platform ? `\nThe owner is working on ${platform} right now; weight the rules and the keyword intent toward it.` : ''}

Return JSON with seo and benchmarks. Be specific to this business: no advice that could apply to any company.`;
}

/**
 * What generation is handed before it writes: the tags that are proven for this
 * business and the patterns that are measured to work in its category.
 * Returns an empty string when there is nothing on file, so generation is unchanged.
 */
export function groundingBlock(profile, rules, platform) {
  const parts = [];

  if (rules && rules.length) {
    parts.push(
      `PROVEN PATTERNS IN THIS CATEGORY (measured, not guessed — build on these)\n${rules
        .map((rule) => `- ${rule.label}: ${rule.technique}${rule.hook_pattern ? ` | hook: ${rule.hook_pattern}` : ''}`)
        .join('\n')}`
    );
  }

  if (profile) {
    if (profile.keywords && profile.keywords.length) {
      const keywords = profile.keywords
        .slice()
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, 10)
        .map((keyword) => keyword.term)
        .join(', ');
      parts.push(`KEYWORDS TO WORK IN NATURALLY (never keyword-stuffed)\n${keywords}`);
    }

    const tags = (profile.hashtags || []).filter((item) => !platform || !item.platform || item.platform === platform);
    if (tags.length) {
      parts.push(
        `PROVEN TAGS FOR THIS BUSINESS (use these, do not invent new ones)\n${tags.map((item) => `${item.tag} (${item.tier})`).join(', ')}`
      );
    }
  }

  return parts.join('\n\n');
}