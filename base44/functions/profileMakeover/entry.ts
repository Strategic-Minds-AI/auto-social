import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveBusiness, checkAiBudget, recordAiUsage } from '../../shared/access.ts';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { researchWebsite } from '../../shared/website.ts';
import { instagramProfileDetail } from '../../shared/instagram.ts';
import { pageProfile, pageTokenFor } from '../../shared/facebook.ts';
import { gridSchema, cleanGrid, paletteLine, renderImage, drawTile } from '../../shared/profileStudio.ts';

// One account at a time: read what the profile actually says today, score it the
// way a first-time visitor judges it, then write the name, bio, link, highlight
// rail and first nine posts, and design the profile picture and banner.
//
// A brand kit can be handed in instead: the account then adopts that brand's
// identity and artwork, and only the copy is written fresh for this account.

const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook Page', youtube: 'YouTube channel' };

// Platform ceilings, enforced here so a written bio always fits.
const LIMITS = {
  instagram: { name: 30, bio: 150, highlight_label: 18, highlights: 5, posts: 'a nine-tile grid and up to five highlights' },
  facebook: { name: 75, bio: 255, highlight_label: 30, highlights: 4, posts: 'pinned posts and up to four featured sections' },
  youtube: { name: 60, bio: 1000, highlight_label: 40, highlights: 6, posts: 'a trailer, playlists and up to six channel links' },
};

const SCORE_RUBRIC = [
  { key: 'name', label: 'Name & search words', match: 'name' },
  { key: 'bio', label: 'Bio clarity', match: 'bio' },
  { key: 'link', label: 'Link & funnel', match: 'link' },
  { key: 'visuals', label: 'Visual identity', match: 'visual' },
  { key: 'content', label: 'Content signal', match: 'content' },
];

const SYSTEM = `You are a profile strategist who turns a business account into one a stranger understands and follows in three seconds.

Rules you never break:
- Every claim comes from the supplied facts, the live profile read, or the website text. Never invent awards, client names, numbers, guarantees or years in business.
- The name field is a search field, not a title: lead with what the account does and who it is for, in the words a buyer would type.
- The bio says who this is for, what they get, and what to do next. One clear call to action. No emoji storms: at most one, only where the tone suits it.
- The link is fixed to the URL supplied. Never suggest a different destination and never invent one.
- The nine grid tiles tell one promise in order. Tile 1 carries the sharpest hook. Every tile stands on its own, is faceless, and is publishable as written.
- Visual prompts describe one image each: no faces, no real logos, no words baked into the image, and the given palette is the dominant colour story.
- Score honestly. A profile that a stranger cannot act on scores low.
Return one valid JSON object matching the schema exactly, with nothing around it.`;

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

function businessFacts(business) {
  return [
    `Business name: ${business.name}`,
    business.industry && `Industry: ${business.industry}`,
    business.description && `What it does: ${business.description}`,
    business.services && `Services or products: ${business.services}`,
    business.target_audience && `Who it serves: ${business.target_audience}`,
    business.service_area && `Service area: ${business.service_area}`,
    business.differentiators && `What sets it apart: ${business.differentiators}`,
    business.primary_goal && `What the owner wants content to achieve: ${business.primary_goal}`,
    business.tone && `Preferred tone: ${business.tone}`,
    business.brand_colors && `Existing brand colours: ${business.brand_colors}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function liveSnapshot(platform, live) {
  if (!live.ok) {
    return `The live profile could not be read (${live.note}). Score what can be judged from the platform rules alone and say plainly in the notes which part could not be checked.`;
  }
  return [
    `Platform: ${PLATFORM_LABEL[platform]}`,
    live.handle && `Adressed as: ${live.handle}`,
    `Current name field: "${live.name || '(empty)'}"`,
    `Current bio or description: "${live.bio || '(empty)'}"`,
    live.link ? `Current link: ${live.link}` : 'Current link: none visible on the profile',
    live.followers !== null && live.followers !== undefined ? `Followers: ${live.followers}` : null,
    live.posts_count !== null && live.posts_count !== undefined ? `Published items: ${live.posts_count}` : null,
    `Profile picture on file: ${live.picture_url ? 'yes' : 'no'}; banner on file: ${live.banner_url ? 'yes' : 'no'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function auditPrompt({ business, platform, live, site, kit, link }) {
  const limits = LIMITS[platform];
  const sections = [
    `Review and rebuild the ${PLATFORM_LABEL[platform]} profile for this business.`,
    `BUSINESS FACTS\n${businessFacts(business)}`,
  ];

  if (site?.ok) {
    sections.push(
      `WHAT THEIR OWN WEBSITE SAYS (${site.url})${site.title ? `\nTitle: ${site.title}` : ''}\n${String(site.text).slice(0, 2500)}`
    );
  } else if (business.website) {
    sections.push(`Their website ${business.website} could not be read (${site?.reason || 'not reachable'}).`);
  }

  sections.push(`WHAT THE PROFILE SAYS TODAY\n${liveSnapshot(platform, live)}`);

  if (kit) {
    sections.push(
      `THIS ACCOUNT IS BEING REBRANDED\nIt adopts this brand exactly: name "${kit.name}", handle "${kit.handle}", voice "${kit.voice || ''}", niche "${kit.niche || ''}", bio "${kit.bio || ''}", palette ${paletteLine(kit.palette)}.\nWrite the profile copy that puts this brand onto this account, keeping the account's platform fit.`
    );
  }

  sections.push(
    `PLATFORM CONSTRAINTS\nName field at most ${limits.name} characters. Bio at most ${limits.bio} characters. The account shows ${limits.posts}.`,
    `THE LINK\nEvery call to action points at ${link || 'no link is saved for this business yet'} — use exactly that URL, and if no link exists say so instead of inventing one.`,
    `SCORING\nReturn exactly five score entries in this order, each out of 20, each with one concrete sentence of evidence from the read above: Name & search words, Bio clarity, Link & funnel, Visual identity, Content signal.`,
    `WRITE\nnew_name, new_bio, and ${limits.highlights} or fewer highlights that the account should pin or feature, each with the title and what belongs inside it. Then pinned_plan, three ad_angles this account can advertise on, a checklist of the exact edits to make in order, and a nine-tile grid_plan where every tile has a hook, a visual_prompt and a short caption. Keep every hashtag in the hashtags field and never inside the caption.`
  );

  return sections.join('\n\n');
}

async function readYouTube(base44) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('youtube');
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings,statistics&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20000) }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `YouTube request failed (HTTP ${response.status})`);
  }
  const item = payload?.items?.[0];
  if (!item) throw new Error('the connected account has no channel');

  const custom = String(item.snippet?.customUrl || '');
  return {
    handle: custom || String(item.snippet?.title || ''),
    name: String(item.snippet?.title || ''),
    bio: String(item.snippet?.description || ''),
    link: custom ? `https://www.youtube.com/${custom}` : '',
    followers: Number(item.statistics?.subscriberCount || 0),
    posts_count: Number(item.statistics?.videoCount || 0),
    picture_url: String(item.snippet?.thumbnails?.high?.url || ''),
    banner_url: String(item.brandingSettings?.image?.bannerExternalUrl || ''),
  };
}

async function readLiveProfile(base44, platform, account) {
  try {
    if (platform === 'instagram') {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('instagram');
      const detail = await instagramProfileDetail(accessToken);
      return {
        ok: true,
        note: `Read @${detail.username} from Instagram.`,
        handle: detail.username ? `@${detail.username}` : '',
        name: detail.name,
        bio: detail.biography,
        link: detail.website,
        followers: detail.followers,
        posts_count: detail.media_count,
        picture_url: detail.picture_url,
        banner_url: '',
      };
    }

    if (platform === 'facebook') {
      if (!account?.external_id) throw new Error('no Page is linked to this business');
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('facebook_pages');
      const pageToken = await pageTokenFor(account.external_id, accessToken);
      const page = await pageProfile(account.external_id, pageToken);
      return {
        ok: true,
        note: `Read ${page.name || 'the Page'} from Facebook.`,
        handle: page.name || account.name || '',
        name: page.name || '',
        bio: page.about || page.description || '',
        link: page.website || '',
        followers: page.followers,
        posts_count: null,
        picture_url: page.picture_url,
        banner_url: page.cover_url,
      };
    }

    if (platform === 'youtube') {
      const channel = await readYouTube(base44);
      return {
        ok: true,
        note: `Read ${channel.name || 'the channel'} from YouTube.`,
        handle: channel.handle,
        name: channel.name,
        bio: channel.bio,
        link: channel.link,
        followers: channel.followers,
        posts_count: channel.posts_count,
        picture_url: channel.picture_url,
        banner_url: channel.banner_url,
      };
    }

    return { ok: false, note: `${platform} cannot be read` };
  } catch (error) {
    return { ok: false, note: `${PLATFORM_LABEL[platform]} could not be read: ${error.message}` };
  }
}

function pickScore(rows, dimension, index) {
  const match = rows.find((row) => String(row?.label || '').toLowerCase().includes(dimension.match));
  return match || rows[index] || {};
}

function normalizeScores(data) {
  const rows = Array.isArray(data?.scores) ? data.scores : [];
  return SCORE_RUBRIC.map((dimension, index) => {
    const row = pickScore(rows, dimension, index);
    return {
      key: dimension.key,
      label: dimension.label,
      score: Math.min(Math.max(Math.round(Number(row.score) || 0), 0), 20),
      max: 20,
      note: clampText(row.note, 200),
    };
  });
}

const AUDIT_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      description: 'Five entries, in the order given, each out of 20',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          score: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['label', 'score', 'note'],
      },
    },
    fixes: { type: 'array', items: { type: 'string' } },
    new_name: { type: 'string' },
    new_bio: { type: 'string' },
    new_highlights: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, guidance: { type: 'string' } },
        required: ['label', 'guidance'],
      },
    },
    pinned_plan: { type: 'string' },
    avatar_prompt: { type: 'string' },
    banner_prompt: { type: 'string' },
    grid_plan: gridSchema,
    ad_angles: { type: 'array', items: { type: 'string' } },
    checklist: { type: 'array', items: { type: 'string' } },
  },
  required: ['scores', 'fixes', 'new_name', 'new_bio', 'avatar_prompt', 'banner_prompt', 'grid_plan'],
};

async function listTargets(base44, businessId) {
  const resolved = await resolveBusiness(base44, businessId);
  if (!resolved.ok) return { targets: [] };

  const accounts = await base44.entities.SocialAccount
    .filter({ business_id: resolved.business.id }, { limit: 50 })
    .catch(() => ({ items: [] }));

  const targets = (accounts?.items || [])
    .filter((account) => PLATFORM_LABEL[account.platform])
    .map((account) => ({
      key: `${account.platform}:${account.id}`,
      platform: account.platform,
      account_id: account.id,
      label: account.name || PLATFORM_LABEL[account.platform],
      status: account.status || '',
    }));

  try {
    const channel = await readYouTube(base44);
    targets.push({
      key: 'youtube',
      platform: 'youtube',
      account_id: '',
      label: channel.name ? `${channel.name} (YouTube)` : 'YouTube channel',
      status: 'connected',
    });
  } catch {
    // YouTube is not connected: no channel to review.
  }

  return { targets };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'run');

    if (action === 'targets') {
      return Response.json(await listTargets(base44, body.business_id));
    }

    if (action === 'render_tile') {
      const makeover = await base44.entities.ProfileMakeover.get(String(body.makeover_id || '')).catch(() => null);
      if (!makeover) return Response.json({ error: 'That review is not available to you.' }, { status: 404 });

      const next = await drawTile({
        base44,
        plan: makeover.grid_plan,
        slot: Number(body.slot) || 1,
        referenceUrl: makeover.avatar_url || makeover.banner_url || '',
      });
      if (!next) return Response.json({ error: 'That tile could not be drawn.' }, { status: 502 });

      await base44.entities.ProfileMakeover.update(makeover.id, { grid_plan: next });
      return Response.json({ grid_plan: next });
    }

    const resolved = await resolveBusiness(base44, body.business_id);
    if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });
    const business = resolved.business;

    const platform = String(body.platform || '');
    if (!PLATFORM_LABEL[platform]) return Response.json({ error: 'Choose an account to review.' }, { status: 400 });

    let account = null;
    if (body.account_id) {
      account = await base44.entities.SocialAccount.get(String(body.account_id)).catch(() => null);
      if (!account) return Response.json({ error: 'That account is not available to you.' }, { status: 404 });
      if (account.business_id !== business.id) {
        return Response.json({ error: 'That account belongs to another business.' }, { status: 403 });
      }
    }

    let kit = null;
    if (body.brand_kit_id) {
      kit = await base44.entities.BrandKit.get(String(body.brand_kit_id)).catch(() => null);
      if (!kit) return Response.json({ error: 'That brand is not available to you.' }, { status: 404 });
      if (kit.business_id !== business.id) {
        return Response.json({ error: 'That brand belongs to another business.' }, { status: 403 });
      }
    }

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) return Response.json({ error: budget.message }, { status: budget.status });

    const live = await readLiveProfile(base44, platform, account);
    const site = business.website
      ? await researchWebsite(business.website)
      : { ok: false, reason: 'No website address is saved for this business.' };
    const link = String(business.website || '').trim();

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt: auditPrompt({ business, platform, live, site, kit, link }),
      schema: AUDIT_SCHEMA,
      system: SYSTEM,
      maxTokens: 6000,
    });
    await recordAiUsage(base44, user, meta);

    const limits = LIMITS[platform];
    const scores = normalizeScores(data);
    const scoreTotal = scores.reduce((sum, item) => sum + item.score, 0);
    const grade = scoreTotal >= 85 ? 'A' : scoreTotal >= 70 ? 'B' : scoreTotal >= 55 ? 'C' : 'D';

    // A rebrand adopts the brand's own artwork and grid; a first-time review has
    // its own drawn.
    let avatarUrl = kit?.avatar_url || '';
    let bannerUrl = kit?.banner_url || '';
    let gridPlan = kit?.grid_plan?.length ? cleanGrid(kit.grid_plan) : cleanGrid(data.grid_plan);
    let assetNote = '';

    if (!kit && (data.avatar_prompt || data.banner_prompt)) {
      const [avatar, banner] = await Promise.all([
        renderImage(base44, { prompt: data.avatar_prompt, aspect: '1:1' }).catch(() => ''),
        renderImage(base44, { prompt: data.banner_prompt, aspect: '16:9' }).catch(() => ''),
      ]);
      avatarUrl = avatar;
      bannerUrl = banner;
      if (!avatar && !banner) assetNote = 'The visuals could not be drawn this time. Run the review again to redraw them.';
    }

    const makeover = await base44.entities.ProfileMakeover.create({
      business_id: business.id,
      brand_kit_id: kit?.id || '',
      platform,
      account_id: account?.id || '',
      handle: live.handle || account?.name || '',
      read_ok: live.ok,
      read_note: [live.note, assetNote].filter(Boolean).join(' '),
      followers: live.followers ?? null,
      posts_count: live.posts_count ?? null,
      current_name: clampText(live.name, 300),
      current_bio: clampText(live.bio, 600),
      current_link: clampText(live.link, 200),
      score_total: scoreTotal,
      grade,
      scores,
      fixes: clampLines(data.fixes, 200, 6),
      new_name: clampText(data.new_name, limits.name),
      new_bio: clampText(data.new_bio, limits.bio),
      new_link: link,
      new_highlights: (Array.isArray(data.new_highlights) ? data.new_highlights : [])
        .map((item) => ({
          label: clampText(item?.label, limits.highlight_label),
          guidance: clampText(item?.guidance, 160),
        }))
        .filter((item) => item.label)
        .slice(0, limits.highlights),
      pinned_plan: clampText(data.pinned_plan, 400),
      avatar_prompt: clampText(data.avatar_prompt, 600),
      banner_prompt: clampText(data.banner_prompt, 600),
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
      grid_plan: gridPlan,
      ad_angles: clampLines(data.ad_angles, 160, 4),
      checklist: clampLines(data.checklist, 180, 8),
      engine: meta.provider,
      model: meta.model,
      generated_at: new Date().toISOString(),
    });

    return Response.json({ makeover, read_ok: live.ok, note: live.note });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}