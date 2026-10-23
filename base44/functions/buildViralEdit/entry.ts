import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolveBusiness, checkAiBudget, recordAiUsage } from '../../shared/access.ts';
import { generateJsonWithMeta } from '../../shared/aiClient.ts';
import { formatShotList } from '../../shared/library.ts';

// The viral editor: turns a hook, the words and an editing method from the
// library into a timed edit sheet — one beat per cut, with what is on screen,
// the words burned on the frame, the transition and the audio cue. The canvas in
// the app is this sheet, and it can be reordered and rewritten afterwards.

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube'];
const FORMATS = ['reel', 'short_video', 'story', 'post', 'image'];
const MIN_BEATS = 3;
const MAX_BEATS = 14;

const EDIT_SCHEMA = {
  type: 'object',
  properties: {
    style_notes: { type: 'string' },
    beats: {
      type: 'array',
      description: 'One entry per cut, in the order it is watched',
      items: {
        type: 'object',
        properties: {
          seconds: { type: 'number' },
          shot: { type: 'string' },
          on_screen_text: { type: 'string' },
          transition: { type: 'string' },
          audio: { type: 'string' },
        },
        required: ['seconds', 'shot', 'on_screen_text', 'transition', 'audio'],
      },
    },
  },
  required: ['beats', 'style_notes'],
};

const SYSTEM = `You are a short-form video editor who plans cuts so an amateur can shoot them and an editor can follow them frame by frame.

Rules you never break:
- Beat 1 is the hook and it is on screen within two seconds. If the hook line is longer than that, cut it into two beats.
- Keep beats short: one to four seconds each, never more. Change something on screen at every beat.
- Every shot must be shootable by one person with a phone plus stock footage, and must work with no face in it.
- on_screen_text is the exact words burned onto the frame: two to seven words, no hashtags, no emoji, never a full sentence.
- transition says what carries the viewer into the next beat, as an edit instruction.
- audio describes feel, tempo and where the beat drops. Never name a specific song or artist.
- Never invent a claim, number, price or result. Use only what the brief gives you.
Return one valid JSON object matching the schema exactly, with nothing around it.`;

function buildPrompt({ business, platform, format, hook, script, recipe, seconds }) {
  return `Plan the edit for one ${format} on ${platform}, about ${seconds} seconds long.

BUSINESS
Name: ${business.name}
Industry: ${business.industry || 'not specified'}
Audience: ${business.target_audience || 'not specified'}
Tone: ${business.tone || 'professional'}

HOOK (this is beat 1)
${hook}

WORDS BEING DELIVERED
${script || 'No script supplied. Build the beats around the hook and a clear call to action.'}

EDITING METHOD TO FOLLOW${recipe ? '' : ' (none chosen — use the sharpest convention for this platform)'}
${recipe || ''}

Write the beats so the piece lands in ${seconds} seconds, keep the words on screen readable in the time they are up, and finish on a call to action. Then write style_notes: how the whole piece should feel — pacing, colour grade, caption style, sound level and the one thing that must not be done.`;
}

function clampBeats(beats) {
  return (Array.isArray(beats) ? beats : [])
    .map((beat, index) => {
      const seconds = Math.min(Math.max(Math.round((Number(beat?.seconds) || 2) * 2) / 2, 0.5), 12);
      const shot = String(beat?.shot || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      if (!shot) return null;
      return {
        id: `beat-${index + 1}`,
        seconds,
        shot,
        on_screen_text: String(beat?.on_screen_text || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        transition: String(beat?.transition || '').replace(/\s+/g, ' ').trim().slice(0, 120),
        audio: String(beat?.audio || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_BEATS);
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const resolved = await resolveBusiness(base44, body.business_id);
    if (!resolved.ok) return Response.json({ error: resolved.message }, { status: resolved.status });
    const business = resolved.business;

    const hook = String(body.hook || '').trim().slice(0, 300);
    if (!hook) return Response.json({ error: 'Choose or write the hook the edit opens on.' }, { status: 400 });

    const platform = PLATFORMS.includes(body.platform) ? body.platform : 'instagram';
    const format = FORMATS.includes(body.format) ? body.format : 'reel';
    const seconds = Math.min(Math.max(Number(body.seconds) || 30, 10), 180);
    const script = String(body.script || '').trim().slice(0, 3000);
    const recipe = String(body.recipe || '').trim().slice(0, 1500);

    const budget = await checkAiBudget(base44, user);
    if (!budget.ok) return Response.json({ error: budget.message }, { status: budget.status });

    const { data, meta } = await generateJsonWithMeta(base44, {
      prompt: buildPrompt({ business, platform, format, hook, script, recipe, seconds }),
      schema: EDIT_SCHEMA,
      system: SYSTEM,
      maxTokens: 3500,
      temperature: 0.7,
    });
    await recordAiUsage(base44, user, meta);

    const beats = clampBeats(data?.beats);
    if (beats.length < MIN_BEATS) {
      return Response.json({ error: 'The editor returned too few beats. Try again with a longer target.' }, { status: 502 });
    }

    const total = beats.reduce((sum, beat) => sum + beat.seconds, 0);

    const edit = await base44.entities.ViralEdit.create({
      business_id: business.id,
      title: String(body.title || '').trim().slice(0, 120) || `${hook.slice(0, 60)} — ${format}`,
      platform,
      format,
      hook,
      script,
      recipe_label: String(body.recipe_label || '').trim().slice(0, 120),
      recipe_note: recipe,
      target_seconds: seconds,
      total_seconds: Math.round(total * 10) / 10,
      beats,
      style_notes: String(data?.style_notes || '').trim().slice(0, 1200),
      engine: meta.provider,
      model: meta.model,
      generated_at: new Date().toISOString(),
    });

    return Response.json({ edit, shotList: formatShotList(beats) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}