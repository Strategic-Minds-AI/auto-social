// Pure planning and benchmark logic for the video factory. Deliberately free of
// SDK and npm imports so both pipeline stages share exactly one definition of
// what a video should be and what counts as good enough.

export const RESOLUTION = '720p';
export const BENCHMARK_VERSION = 'v1';
export const BENCHMARK_TARGET = 75;
export const SAFETY_FLOOR = 8;

export const BENCHMARK_CRITERIA = [
  {
    key: 'brand_fit',
    label: 'Brand fit',
    max: 20,
    guide: 'Matches the brand tone, audience and palette described in the brief.',
  },
  {
    key: 'hook_strength',
    label: 'Hook strength',
    max: 20,
    guide: 'The opening seconds give a viewer a reason to keep watching.',
  },
  {
    key: 'clarity',
    label: 'Clarity',
    max: 20,
    guide: 'One clear idea that still lands with the sound off.',
  },
  {
    key: 'platform_fit',
    label: 'Platform fit',
    max: 15,
    guide: 'Pacing, framing and length suit the platform and format it posts to.',
  },
  {
    key: 'caption_alignment',
    label: 'Caption alignment',
    max: 15,
    guide: 'The video and the caption tell the same story and share one call to action.',
  },
  {
    key: 'safety',
    label: 'Safety and compliance',
    max: 10,
    guide: 'No misleading claims, no unlicensed marks, nothing a platform would refuse.',
  },
];

export const RUBRIC_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          score: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['key', 'score', 'note'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['scores', 'summary'],
};

/** Vertical for anything built for stories and reels, square for the feed. */
export function aspectRatioFor(platform, format) {
  if (format === 'reel' || format === 'story' || format === 'short_video') return '9:16';
  if (platform === 'tiktok' || platform === 'youtube') return '9:16';
  return '1:1';
}

// The cheapest model that still supports the framing we asked for: Veo 3.1 Lite
// for vertical clips, Seedance 2 Mini for square ones, which it alone can frame
// at a sensible price.
export function modelFor(aspectRatio) {
  return aspectRatio === '9:16' ? 'veo_3_1_lite' : 'seedance_2_mini';
}

export function secondsFor() {
  return 6;
}

export function buildVideoPrompt(post, business) {
  const lines = [
    `Produce a ${secondsFor(post.format)}-second marketing video for ${business?.name || 'this business'}.`,
    business?.industry ? `Industry: ${business.industry}.` : '',
    business?.target_audience ? `Made for: ${business.target_audience}.` : '',
    business?.tone ? `Tone: ${business.tone}.` : '',
    business?.brand_colors ? `Brand palette: ${business.brand_colors}.` : '',
    post.hook ? `Open with this hook: "${post.hook}".` : '',
    post.video_script ? `Shot by shot: ${post.video_script}` : '',
    post.caption ? `The story it supports: ${post.caption}` : '',
    post.call_to_action ? `Close on this call to action: "${post.call_to_action}".` : '',
    post.image_prompt ? `Visual direction: ${post.image_prompt}` : '',
    'Photorealistic footage or clean brand-styled motion, natural light, steady camera.',
    'No on-screen text, no burned-in captions, no logos and no watermarks.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Hash of the plan fields a video was built from, so edits to the plan surface later. */
export function sourceHash(post) {
  const source = [post.hook, post.caption, post.call_to_action, post.video_script, post.image_prompt, post.format, post.platform]
    .map((value) => String(value == null ? '' : value))
    .join('|');

  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/** Mechanical checks that do not need a model to answer. */
export function buildTests({ post, prompt }) {
  const missing = [
    post.hook && !prompt.includes(post.hook) ? 'hook' : null,
    post.caption && !prompt.includes(post.caption) ? 'caption' : null,
    post.call_to_action && !prompt.includes(post.call_to_action) ? 'call to action' : null,
  ].filter(Boolean);

  const inactive = ['cancelled', 'failed'].includes(post.status);

  return [
    {
      name: 'content_injected',
      status: missing.length ? 'fail' : 'pass',
      detail: missing.length
        ? `The brief went out without the ${missing.join(', ')}.`
        : 'The hook, caption and call to action all reached the brief.',
    },
    {
      name: 'post_active',
      status: inactive ? 'fail' : 'pass',
      detail: inactive ? 'The source post was cancelled or failed, so this video is no longer needed.' : 'The source post is still active.',
    },
  ];
}

/** Clamp whatever the model returned onto the published rubric. */
export function normalizeScores(raw) {
  const byKey = new Map((Array.isArray(raw) ? raw : []).map((entry) => [String(entry?.key || ''), entry]));

  return BENCHMARK_CRITERIA.map((criterion) => {
    const found = byKey.get(criterion.key);
    const value = Number(found?.score);
    return {
      key: criterion.key,
      label: criterion.label,
      score: Number.isFinite(value) ? Math.min(Math.max(value, 0), criterion.max) : 0,
      max: criterion.max,
      note: String(found?.note || '').slice(0, 300),
    };
  });
}

export function evaluateBenchmark(scores, tests) {
  const total = scores.reduce((sum, entry) => sum + entry.score, 0);
  const safety = scores.find((entry) => entry.key === 'safety')?.score ?? 0;
  const failed = tests.filter((test) => test.status === 'fail').length;

  return {
    total,
    safety_ok: safety >= SAFETY_FLOOR,
    failed_tests: failed,
    passed: total >= BENCHMARK_TARGET && safety >= SAFETY_FLOOR && failed === 0,
  };
}