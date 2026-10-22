// Auto Social — weekly content plan.
// Deployed to Supabase Edge Functions as `auto-social-plan`; an independent
// copy of the planning engine that lived on Base44, reading and writing the
// auto_social_* tables in this Supabase project.
// Called by the `auto-social-weekly-plan` cron job every Monday, or on demand
// with the service-role key in the Authorization header.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AI_KEY = Deno.env.get('AI_API_KEY') ?? '';
const AI_BASE = (Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
const AI_MODEL = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';

const DAY_MS = 86400000;
const ALLOWED_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x'];
const ALLOWED_FORMATS = ['post', 'story', 'reel', 'image'];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const toDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) =>
  toDate(new Date(new Date(`${day}T00:00:00Z`).getTime() + n * DAY_MS));

// A weekly run plans a whole Monday-to-Sunday week rather than a rolling window
// starting today, so the owner always sees one complete week.
function weekStartFor(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, (8 - dow) % 7);
}

function buildPrompt(
  business: any,
  days: number,
  total: number,
  platforms: string[],
  discovery: any,
  topics: any[],
) {
  const research = discovery
    ? `MARKET RESEARCH (already completed for this business)
Positioning: ${discovery.positioning || 'not specified'}
What customers ask about: ${(discovery.questions_people_ask || []).join(' | ') || 'not specified'}
Things worth talking about: ${(discovery.talking_points || []).join(' | ') || 'not specified'}`
    : 'MARKET RESEARCH: not run yet. Work from the business details alone.';

  const topicList = topics.length
    ? `TOPICS THIS AUDIENCE SEARCHES FOR (ranked, most wanted first)
${topics.map((t, i) => `${i + 1}. ${t.topic} [${t.category || 'industry'}, ${t.momentum || 'steady'}]`).join('\n')}`
    : 'TOPICS: none researched yet.';

  return `You are the planning engine of Auto Social, an autonomous social media system.
Plan the next ${days} days of content for this business.

BUSINESS
Name: ${business.name}
Industry: ${business.industry || 'not specified'}
Description: ${business.description || 'not specified'}
Services: ${business.services || 'not specified'}
Service area: ${business.service_area || 'not specified'}
What makes them different: ${business.differentiators || 'not specified'}
Main goal: ${business.primary_goal || 'not specified'}
Target audience: ${business.target_audience || 'not specified'}
Brand tone: ${business.tone || 'professional'}
Website: ${business.website || 'not specified'}

${research}

${topicList}

REQUIREMENTS
- Produce exactly ${total} posts spread across the ${days} day window using day_offset 0 to ${days - 1}. At most 3 posts may share the same day_offset.
- Use only these platforms: ${platforms.join(', ')}. Spread them sensibly.
- Use 3 to 5 distinct content pillars and label each post with its pillar, for example Education, Social Proof, Behind the Scenes, Offer, Story, Tips.
- Vary the format between post, story, reel and image. Any video idea must use the reel format and include a video_script.
- Never repeat a caption idea, hook or angle.
- Captions must be specific to this business rather than generic advice: 2 to 4 short lines in the brand tone, ending with a clear call to action.
- Give every post a scroll-stopping hook, 8 to 12 relevant hashtags, and a detailed image_prompt describing a photorealistic on-brand image (subject, setting, lighting, mood, no text in the image).
- For roughly one third of the posts also write a variant_b_caption: the same idea with a genuinely different hook and angle, so the two versions can be A/B tested.
- scheduled_time must be a realistic local posting time between 07:00 and 20:00.
- At least two thirds of the posts must be built on one of the ranked topics above, and every post must repeat the exact topic text it came from in its "topic" field. Leave "topic" empty only for a post that is not topic-led.
- Also write a short strategy paragraph explaining the mix you chose.

Return JSON only, shaped as {"strategy": string, "posts": [{"day_offset": number, "platform": string, "format": string, "scheduled_time": string, "pillar": string, "title": string, "hook": string, "caption": string, "hashtags": string, "call_to_action": string, "image_prompt": string, "topic": string, "video_script": string, "variant_b_caption": string}]}`;
}

async function askAi(prompt: string) {
  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: 'You are a social media planning engine. Reply with JSON only.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 12000,
    }),
  });
  if (!res.ok) throw new Error(`AI request failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('AI returned no JSON');
  return JSON.parse(text.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== SERVICE_KEY) return json({ error: 'Unauthorized' }, 401);
  if (!AI_KEY) return json({ error: 'AI_API_KEY is not set in this Supabase project' }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const postsPerWeek = Math.min(Math.max(Number(body.posts_per_week) || 5, 1), 14);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    let query = supabase.from('auto_social_businesses').select('*');
    if (body.business_id) query = query.eq('id', body.business_id);
    const { data: businesses, error } = await query;
    if (error) throw new Error(error.message);
    if (!businesses?.length) return json({ created: 0, note: 'No business profiles yet.' });

    const weekStart = weekStartFor(toDate(new Date()));
    const created: string[] = [];
    const skipped: string[] = [];
    const strategy: string[] = [];

    for (const business of businesses as any[]) {
      // A week that already has posts is left alone, so running the weekly job
      // twice never doubles the content.
      const { data: existing } = await supabase
        .from('auto_social_scheduled_posts')
        .select('id')
        .eq('business_id', business.id)
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', addDays(weekStart, 6))
        .limit(1);
      if (existing?.length) {
        skipped.push(business.name);
        continue;
      }

      const { data: discoveryRows } = await supabase
        .from('auto_social_business_discoveries')
        .select('*')
        .eq('business_id', business.id)
        .limit(1);

      const { data: topics } = await supabase
        .from('auto_social_trend_topics')
        .select('*')
        .eq('business_id', business.id)
        .order('rank', { ascending: true })
        .limit(25);

      const preferred = Array.isArray(business.primary_platforms)
        ? business.primary_platforms.filter((p: string) => ALLOWED_PLATFORMS.includes(p))
        : [];
      const platforms = preferred.length ? preferred : ALLOWED_PLATFORMS;

      const plan = await askAi(
        buildPrompt(business, 7, Math.round(postsPerWeek), platforms, discoveryRows?.[0] ?? null, topics ?? []),
      );
      if (plan?.strategy) strategy.push(`${business.name}: ${plan.strategy}`);

      const rows = (Array.isArray(plan?.posts) ? plan.posts : [])
        .filter((p: any) => p && p.caption)
        .map((p: any) => {
          const offset = Math.min(Math.max(Number(p.day_offset) || 0, 0), 6);
          const format = ALLOWED_FORMATS.includes(p.format) ? p.format : 'post';
          const platform = ALLOWED_PLATFORMS.includes(p.platform) ? p.platform : platforms[0];
          return {
            id: crypto.randomUUID(),
            created_by_id: business.created_by_id ?? null,
            business_id: business.id,
            platform,
            format,
            scheduled_date: addDays(weekStart, offset),
            scheduled_time: p.scheduled_time || '09:00',
            timezone: 'America/New_York',
            pillar: p.pillar || '',
            trend_topic: p.topic || '',
            title: p.title || '',
            hook: p.hook || '',
            caption: p.caption,
            hashtags: p.hashtags || '',
            call_to_action: p.call_to_action || '',
            image_prompt: p.image_prompt || '',
            video_script: format === 'reel' ? p.video_script || '' : '',
            variant_b_caption: p.variant_b_caption || '',
            ab_test: Boolean(p.variant_b_caption),
            ab_result: 'pending',
            status: 'planned',
          };
        });

      if (!rows.length) continue;

      const { error: insertError } = await supabase.from('auto_social_scheduled_posts').insert(rows);
      if (insertError) throw new Error(insertError.message);
      created.push(`${business.name}: ${rows.length}`);

      // Record which researched topics this plan used, so the topic list stays
      // a live picture of what is still uncovered.
      const used = new Set(rows.map((r: any) => String(r.trend_topic)).filter(Boolean));
      const usedIds = (topics ?? [])
        .filter((t: any) => used.has(String(t.topic)) && !t.used)
        .map((t: any) => t.id);
      if (usedIds.length) {
        await supabase.from('auto_social_trend_topics').update({ used: true }).in('id', usedIds);
      }
    }

    return json({ week_start: weekStart, created, skipped, strategy: strategy.join('\n\n'), model: AI_MODEL });
  } catch (error) {
    return json({ error: String((error as Error)?.message ?? error) }, 500);
  }
});