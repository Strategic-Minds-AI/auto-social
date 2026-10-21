import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { researchWebsite } from '../../shared/website.ts';
import { checkAiBudget, recordAiUsage } from '../../shared/access.ts';

// Skip-trace stage. Builds an exhaustive dossier on the company, its industry,
// its services and what its customers actually ask, and stores it against the
// business. The website is fetched for real; everything else is the model's own
// knowledge and it is explicitly told not to invent facts.

const MAX_PER_RUN = 5;

const DISCOVERY_SCHEMA = {
  type: 'object',
  properties: {
    company_profile: { type: 'string' },
    website_summary: { type: 'string' },
    industry_overview: { type: 'string' },
    services: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          keywords: { type: 'string' },
        },
        required: ['name'],
      },
    },
    competitors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['name'],
      },
    },
    audience_insights: { type: 'string' },
    positioning: { type: 'string' },
    questions_people_ask: { type: 'array', items: { type: 'string' } },
    talking_points: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'company_profile',
    'industry_overview',
    'positioning',
    'audience_insights',
    'services',
    'questions_people_ask',
    'talking_points',
  ],
};

function buildPrompt(business, research) {
  const supplied = research.ok
    ? `WEBSITE CONTENT (retrieved from ${research.url} just now${research.title ? `, page title "${research.title}"` : ''})
${research.text}`
    : `No website content could be retrieved${research.reason ? ` (${research.reason})` : ''}. Work from the details above and from what you know about this industry. Do not claim to have read the website.`;

  return `You are a research analyst building an internal dossier on a business before any content is written for it.

BUSINESS
Name: ${business.name}
Industry: ${business.industry || 'not specified'}
Description: ${business.description || 'not specified'}
Services: ${business.services || 'not specified'}
Service area: ${business.service_area || 'not specified'}
What makes them different: ${business.differentiators || 'not specified'}
Website: ${business.website || 'not specified'}
Target audience: ${business.target_audience || 'not specified'}

${supplied}

Produce an exhaustive, plain-language dossier:
- company_profile: what this company actually is and sells, in 2 to 3 sentences.
- website_summary: what the website itself says, or an empty string when nothing was retrieved.
- industry_overview: how this industry works, what buyers compare before choosing, and what is changing in it, in 3 to 4 sentences.
- services: every service or product line you can identify, each with a one-line description and the exact words a customer would search with.
- competitors: 3 to 6 realistic competing options, each with a one-line note on how this business differs. Name a real company only when you are confident it trades in this market; otherwise describe the category of competitor without naming a firm.
- audience_insights: who buys this and what genuinely drives their decision, in 2 to 3 sentences.
- positioning: the sharpest honest angle this business can own.
- questions_people_ask: 8 to 12 questions real customers ask before buying in this industry, written the way they would phrase them.
- talking_points: 5 to 6 specific things this business should be talking about.

Keep every field short: no field longer than about 70 words.

Never invent awards, certifications, years in business, prices, review scores or staff numbers. Where a fact is missing, write what is missing instead of guessing.`;
}

async function researchOne(base44, business) {
  const research = business.website
    ? await researchWebsite(business.website)
    : { ok: false, reason: 'No website was provided.' };

  const { data, meta } = await generateJsonWithMeta(base44, {
    prompt: buildPrompt(business, research),
    schema: DISCOVERY_SCHEMA,
    // Long-form dossier: the gateway model reasons from the same ceiling, so a
    // tight limit silently drops the later sections.
    maxTokens: 12000,
    temperature: 0.5,
  });

  // A truncated response arrives as perfectly valid JSON with the later
  // sections simply missing. Store nothing rather than let it overwrite a
  // complete dossier with a half-empty one.
  if (
    !Array.isArray(data?.services) ||
    !data.services.length ||
    !Array.isArray(data?.questions_people_ask) ||
    !data.questions_people_ask.length
  ) {
    throw new Error('The AI returned an incomplete dossier. Run the skip trace again.');
  }

  const payload = {
    business_id: business.id,
    company_profile: data?.company_profile || '',
    website_summary: data?.website_summary || '',
    industry_overview: data?.industry_overview || '',
    services: Array.isArray(data?.services) ? data.services : [],
    competitors: Array.isArray(data?.competitors) ? data.competitors : [],
    audience_insights: data?.audience_insights || '',
    positioning: data?.positioning || '',
    questions_people_ask: Array.isArray(data?.questions_people_ask) ? data.questions_people_ask : [],
    talking_points: Array.isArray(data?.talking_points) ? data.talking_points : [],
    website_researched: research.ok,
    website_note: research.ok
      ? `Read the live page at ${research.url}`
      : research.reason || 'No website content was retrieved.',
    engine: meta?.provider || '',
    generated_at: new Date().toISOString(),
  };

  const existing = await base44.entities.BusinessDiscovery
    .filter({ business_id: business.id }, { limit: 1 })
    .then((page) => (page.items || [])[0] || null)
    .catch(() => null);

  const saved = existing
    ? await base44.entities.BusinessDiscovery.update(existing.id, payload)
    : await base44.entities.BusinessDiscovery.create(payload);

  return { discovery: saved, meta };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) return Response.json({ error: budget.message, usage: budget.usage }, { status: budget.status });

    const body = await req.json().catch(() => ({}));

    let businesses = [];
    if (body.business_id) {
      // RLS-scoped: a business the caller cannot read will not resolve.
      const business = await base44.entities.Business.get(body.business_id).catch(() => null);
      if (!business) return Response.json({ error: 'That business is not available to you.' }, { status: 403 });
      businesses = [business];
    } else {
      const page = await base44.entities.Business.list({ sort: '-created_date', limit: MAX_PER_RUN });
      businesses = page.items || [];
    }

    if (!businesses.length) {
      return Response.json({ error: 'Add a business first, then run its skip trace.' }, { status: 400 });
    }

    const results = [];
    for (const business of businesses) {
      try {
        const { discovery, meta } = await researchOne(base44, business);
        await recordAiUsage(base44, user, meta);
        results.push({
          business_id: business.id,
          name: business.name,
          website_researched: discovery.website_researched,
          website_note: discovery.website_note,
          discovery,
        });
      } catch (error) {
        results.push({ business_id: business.id, name: business.name, error: error.message });
      }
    }

    return Response.json({ researched: results.filter((r) => !r.error).length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}