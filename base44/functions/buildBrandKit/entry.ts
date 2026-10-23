import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveBusiness, checkAiBudget, recordAiUsage } from '../../shared/access.ts';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { researchWebsite } from '../../shared/website.ts';
import { gridSchema, cleanGrid, paletteLine, renderImage, drawTile } from '../../shared/profileStudio.ts';

// The faceless brand factory. One call produces a complete brand: the name and
// handle that go on the profile, the bio and link, the palette, the recurring
// themes, a profile picture and banner in that palette, and the first nine posts
// that make the account look established on day one. Run it as often as you like
// — every run is a separate brand.

const SYSTEM = `You build faceless social brands: accounts that publish without showing a face and are run by a business to advertise it.

Rules you never break:
- The brand must be believable as a real publisher in its niche, and specific enough that one sentence describes every post it will ever make.
- The name is a publisher name a person would type: two or three words, no keyword stuffing, no trademark of another company, no "official".
- The handle is short, typed the way the name sounds, and written with the leading @.
- The bio states the niche, what a follower gets, and one call to action, inside the platform limit. It carries this one emoji at most: none is better.
- The palette is four hex codes that work as a dark editorial brand: a deep base colour, one bright accent, and two neutrals.
- The nine grid tiles are the account's first nine posts, in the order they are posted. Tile 1 carries the sharpest hook. Every tile is faceless, publishable on its own, and matches the palette. Visual prompts describe one image each with no faces, no real logos and no words baked into the image. Hashtags stay in the hashtags field and never appear inside a caption.
- Never suggest imitating or tagging another company's brand, and never invent awards, numbers or client names.
Return one valid JSON object matching the schema exactly, with nothing around it.`;

const BRAND_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    handle: { type: 'string' },
    handle_alternates: { type: 'array', items: { type: 'string' } },
    niche: { type: 'string' },
    audience: { type: 'string' },
    voice: { type: 'string' },
    tagline: { type: 'string' },
    bio: { type: 'string' },
    palette: { type: 'array', items: { type: 'string' } },
    content_pillars: { type: 'array', items: { type: 'string' } },
    avatar_prompt: { type: 'string' },
    banner_prompt: { type: 'string' },
    grid_plan: gridSchema,
    ad_use: { type: 'string' },
  },
  required: ['name', 'handle', 'niche', 'bio', 'palette', 'content_pillars', 'avatar_prompt', 'banner_prompt', 'grid_plan'],
};

function clampText(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf(' '));
  return (stop > limit * 0.6 ? cut.slice(0, stop) : cut).trim();
}

function clampLines(value, limit, max) {
  return (Array.isArray(value) ? value : [])
    .map((line) => clampText(line, limit))
    .filter(Boolean)
    .slice(0, max);
}

function normalizeHandle(value, fallback) {
  const raw = String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._]/g, '');
  const text = raw || String(fallback || '').replace(/[^A-Za-z0-9]/g, '');
  return text ? `@${text.slice(0, 28)}` : '';
}

function brandPrompt({ business, niche, site, palette }) {
  const sections = [
    `Create one new faceless social brand that ${business.name} will run to advertise itself.`,
    `BUSINESS IT ADVERTISES\n${[
      `Business name: ${business.name}`,
      business.industry && `Industry: ${business.industry}`,
      business.services && `Services: ${business.services}`,
      business.target_audience && `Who it serves: ${business.target_audience}`,
      business.service_area && `Service area: ${business.service_area}`,
      business.differentiators && `What sets it apart: ${business.differentiators}`,
    ]
      .filter(Boolean)
      .join('\n')}`,
  ];

  if (niche) sections.push(`THE NICHE THIS BRAND PUBLISHES ABOUT\n${niche}`);
  else sections.push('THE NICHE\nChoose the narrowest profitable subject this business can own, not its industry name.');

  if (palette) sections.push(`COLOUR DIRECTION TO FOLLOW\n${palette}`);
  if (site?.ok) sections.push(`WHAT THEIR WEBSITE SAYS\n${String(site.text).slice(0, 1500)}`);

  sections.push(
    'WRITE\nAll the fields in the schema. The bio fits 150 characters. The nine tiles are the first nine posts. ad_use explains in two sentences how to run paid ads from this brand so it advertises the business without naming it as a personal profile.'
  );

  return sections.join('\n\n');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'run');

    if (action === 'render_tile') {
      const kit = await base44.entities.BrandKit.get(String(body.brand_kit_id || '')).catch(() => null);
      if (!kit) return Response.json({ error: 'That brand is not available to you.' }, { status: 404 });

      const next = await drawTile({
        base44,
        plan: kit.grid_plan,
        slot: Number(body.slot) || 1,
        referenceUrl: kit.avatar_url || kit.banner_url || '',
      });
      if (!next) return Response.json({ error: 'That tile could not be drawn.' }, { status: 502 });

      await base44.entities.BrandKit.update(kit.id, { grid_plan: next });
      return Response.json({ grid_plan: next });
    }

    const resolved = await resolveBusiness(base44, body.business_id);
    if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });
    const business = resolved.business;

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) return Response.json({ error: budget.message }, { status: budget.status });

    const niche = clampText(body.niche, 240);
    const palette = clampText(body.palette, 120);
    const site = business.website
      ? await researchWebsite(business.website)
      : { ok: false, reason: 'No website address is saved for this business.' };

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt: brandPrompt({ business, niche, site, palette }),
      schema: BRAND_SCHEMA,
      system: SYSTEM,
      maxTokens: 6000,
    });
    await recordAiUsage(base44, user, meta);

    const name = clampText(data.name, 40);
    if (!name) return Response.json({ error: 'The brand builder did not return a name. Try again.' }, { status: 502 });

    const colors = clampLines(data.palette, 12, 4);
    const [avatarUrl, bannerUrl] = await Promise.all([
      renderImage(base44, { prompt: data.avatar_prompt, aspect: '1:1' }).catch(() => ''),
      renderImage(base44, { prompt: data.banner_prompt, aspect: '16:9' }).catch(() => ''),
    ]);

    const kit = await base44.entities.BrandKit.create({
      business_id: business.id,
      name,
      handle: normalizeHandle(data.handle, name),
      handle_alternates: (Array.isArray(data.handle_alternates) ? data.handle_alternates : [])
        .map((handle) => normalizeHandle(handle, ''))
        .filter((handle) => handle && handle !== normalizeHandle(data.handle, name))
        .slice(0, 3),
      niche: clampText(data.niche, 160),
      audience: clampText(data.audience, 200),
      voice: clampText(data.voice, 200),
      tagline: clampText(data.tagline, 90),
      bio: clampText(data.bio, 150),
      link: String(business.website || '').trim(),
      palette: colors,
      content_pillars: clampLines(data.content_pillars, 90, 4),
      avatar_prompt: clampText(data.avatar_prompt, 600),
      banner_prompt: clampText(data.banner_prompt, 600),
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      grid_plan: cleanGrid(data.grid_plan),
      ad_use: clampText(data.ad_use, 500),
      faceless: true,
      status: 'ready',
      engine: meta.provider,
      model: meta.model,
      generated_at: new Date().toISOString(),
    });

    return Response.json({ kit, palette: paletteLine(colors) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}