import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { generateJson, aiProviderHost } from '../../shared/aiClient.ts';

const ALLOWED_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x'];
const ALLOWED_FORMATS = ['post', 'story', 'reel', 'image'];

function toDateString(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

function buildPrompt(business, days, totalPosts, platforms) {
  return `You are the planning engine of Auto Social, an autonomous social media system.
Plan the next ${days} days of content for this business.

BUSINESS
Name: ${business.name}
Industry: ${business.industry || 'not specified'}
Description: ${business.description || 'not specified'}
Target audience: ${business.target_audience || 'not specified'}
Brand tone: ${business.tone || 'professional'}
Website: ${business.website || 'not specified'}

REQUIREMENTS
- Produce exactly ${totalPosts} posts spread across the ${days} day window using day_offset 0 to ${days - 1}. At most 3 posts may share the same day_offset.
- Use only these platforms: ${platforms.join(', ')}. Spread them sensibly.
- Use 3 to 5 distinct content pillars and label each post with its pillar, for example Education, Social Proof, Behind the Scenes, Offer, Story, Tips.
- Vary the format between post, story, reel and image. Any video idea must use the reel format and include a video_script.
- Never repeat a caption idea, hook or angle.
- Captions must be specific to this business rather than generic advice: 2 to 4 short lines in the brand tone, ending with a clear call to action.
- Give every post a scroll-stopping hook, 8 to 12 relevant hashtags, and a detailed image_prompt describing a photorealistic on-brand image (subject, setting, lighting, mood, no text in the image).
- For roughly one third of the posts also write a variant_b_caption: the same idea with a genuinely different hook and angle, so the two versions can be A/B tested.
- scheduled_time must be a realistic local posting time between 07:00 and 20:00.
- Also write a short strategy paragraph explaining the mix you chose.

Return JSON only.`;
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    strategy: { type: 'string' },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day_offset: { type: 'number' },
          platform: { type: 'string' },
          format: { type: 'string' },
          scheduled_time: { type: 'string' },
          pillar: { type: 'string' },
          title: { type: 'string' },
          hook: { type: 'string' },
          caption: { type: 'string' },
          hashtags: { type: 'string' },
          call_to_action: { type: 'string' },
          image_prompt: { type: 'string' },
          video_script: { type: 'string' },
          variant_b_caption: { type: 'string' }
        },
        required: ['day_offset', 'platform', 'caption']
      }
    }
  },
  required: ['posts']
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const isAutoRun = !body.business_id;

    const days = Math.min(Math.max(Number(body.days) || 30, 7), 60);
    const postsPerWeek = Math.min(Math.max(Number(body.posts_per_week) || 5, 1), 14);
    const requested = (Array.isArray(body.platforms) ? body.platforms : []).filter((p) => ALLOWED_PLATFORMS.includes(p));
    const platforms = requested.length ? requested : ALLOWED_PLATFORMS;
    const totalPosts = Math.min(Math.max(Math.round((days / 7) * postsPerWeek), 4), 60);

    const today = toDateString(new Date());

    let businesses = [];
    if (isAutoRun) {
      const page = await base44.entities.Business.list({ sort: '-created_date', limit: 5 });
      businesses = page.items || [];
    } else {
      const business = await base44.entities.Business.get(body.business_id);
      if (business) businesses = [business];
    }

    if (!businesses.length) {
      return Response.json({ error: 'Add a business profile first, then generate its plan.' }, { status: 400 });
    }

    let created = 0;
    const skipped = [];
    const strategy = [];

    for (const business of businesses) {
      let startDate = body.start_date || addDays(today, 1);

      if (isAutoRun) {
        const page = await base44.entities.ScheduledPost.filter(
          { business_id: business.id, status: { $in: ['planned', 'scheduled'] } },
          { sort: '-scheduled_date', limit: 1 }
        );
        const last = (page.items || [])[0]?.scheduled_date;
        if (last && last >= addDays(today, 14)) {
          skipped.push(business.name);
          continue;
        }
        startDate = last ? addDays(last, 1) : addDays(today, 1);
      }

      const plan = await generateJson(base44, {
        prompt: buildPrompt(business, days, totalPosts, platforms),
        schema: PLAN_SCHEMA
      });

      const planned = Array.isArray(plan?.posts) ? plan.posts : [];
      if (plan?.strategy) strategy.push(`${business.name}: ${plan.strategy}`);

      const records = planned
        .filter((p) => p && p.caption)
        .map((p) => {
          const offset = Math.min(Math.max(Number(p.day_offset) || 0, 0), days - 1);
          const format = ALLOWED_FORMATS.includes(p.format) ? p.format : 'post';
          const platform = ALLOWED_PLATFORMS.includes(p.platform) ? p.platform : platforms[0];
          return {
            business_id: business.id,
            platform,
            format,
            scheduled_date: addDays(startDate, offset),
            scheduled_time: p.scheduled_time || '09:00',
            pillar: p.pillar || '',
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
            status: 'planned'
          };
        });

      if (records.length) {
        await base44.entities.ScheduledPost.bulkCreate(records);
        created += records.length;
      }
    }

    return Response.json({
      created,
      businesses: businesses.map((b) => b.name),
      skipped,
      strategy: strategy.join('\n\n'),
      provider: aiProviderHost()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}