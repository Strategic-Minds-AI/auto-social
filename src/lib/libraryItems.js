// Shared vocabulary between the library page, the radar that fills it, and the
// viral editor canvas: what a pattern is, and how one comes off a demand signal.

export const KINDS = [
  { value: 'hook', label: 'Hooks' },
  { value: 'script', label: 'Scripts' },
  { value: 'visual_template', label: 'Visual templates' },
  { value: 'editing_recipe', label: 'Editing methods' },
  { value: 'edit_sheet', label: 'Edit sheets' },
];

export const KIND_LABEL = {
  hook: 'Hook',
  script: 'Script',
  visual_template: 'Visual template',
  editing_recipe: 'Editing method',
  edit_sheet: 'Edit sheet',
};

export const SOURCE_LABEL = {
  manual: 'Added by me',
  radar: 'Demand Radar',
  benchmark: 'Discovery',
  studio: 'Content Studio',
  viral_editor: 'Viral Editor',
};

export const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube'];

const trim = (value, limit) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);

/**
 * Everything worth keeping from one demand signal: the hook that stopped the
 * scroll, the look of the piece, and the editing method behind it.
 */
export function fromSignal(signal, businessId) {
  const base = {
    business_id: businessId,
    source: 'radar',
    source_label: trim(signal.title, 160),
    source_url: signal.url || '',
    score: Math.round(Number(signal.score) || 0),
    tags: Array.isArray(signal.tags) ? signal.tags.slice(0, 8) : [],
    platform: PLATFORMS.includes(signal.platform) ? signal.platform : '',
    format: signal.format || '',
  };

  const items = [];

  if (signal.hook_text) {
    items.push({
      ...base,
      kind: 'hook',
      title: signal.hook_type ? `${signal.hook_type} hook` : 'Winning hook',
      body: trim(signal.hook_text, 400),
      notes: trim(signal.why_it_works, 400),
    });
  }

  if (signal.visual_style) {
    items.push({
      ...base,
      kind: 'visual_template',
      title: `${signal.format ? signal.format.replace(/_/g, ' ') : 'Video'} look`,
      body: trim(signal.visual_style, 600),
      notes: (Array.isArray(signal.takeaways) ? signal.takeaways : []).map((item) => trim(item, 140)).join(' · '),
    });
  }

  const edit = [
    signal.audio_style ? `Audio: ${trim(signal.audio_style, 200)}` : '',
    signal.format ? `Shape: ${trim(signal.format, 60)}` : '',
    base.tags.length ? `Techniques: ${base.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (edit) {
    items.push({
      ...base,
      kind: 'editing_recipe',
      title: `${base.tags[0] || 'Winning'} editing method`,
      body: edit,
      notes: trim(signal.why_it_works, 400),
    });
  }

  return items;
}

/** One row of the top-styles summary, kept as a template the writer can follow. */
export function fromStyle(row, businessId, platform) {
  const body = [
    `${row.value} appears in ${row.count} of the pieces winning in this niche, averaging ${Math.round(row.score)}/100.`,
    row.kind === 'editing_recipe'
      ? `Build every piece this way: match the pacing, cuts and sound of ${row.value}.`
      : `Make this the house style: ${row.value}.`,
  ].join('\n');

  return {
    business_id: businessId,
    kind: row.kind,
    title: `${row.value} — ${row.label.toLowerCase()}`,
    body,
    tags: [row.value],
    platform: platform || '',
    source: 'radar',
    source_label: `Demand Radar · ${row.label}`,
    notes: 'Read from the top performers in this niche.',
    score: Math.round(row.score),
  };
}

export function stamp(seconds) {
  const total = Math.max(Math.round(Number(seconds) || 0), 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Where each beat starts, once the plan is read in order. */
export function beatStarts(beats = []) {
  let clock = 0;
  return beats.map((beat) => {
    const start = clock;
    clock += Number(beat.seconds) || 0;
    return start;
  });
}

export function newBeat() {
  return {
    id: `beat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    seconds: 2,
    shot: '',
    on_screen_text: '',
    transition: '',
    audio: '',
  };
}

/** The canvas as text, so an editor can work from it without the app open. */
export function formatShotList(beats = []) {
  const starts = beatStarts(beats);
  let clock = 0;
  return beats
    .map((beat, index) => {
      const start = starts[index];
      clock = start + (Number(beat.seconds) || 0);
      return [
        `BEAT ${index + 1}  ${stamp(start)}\u2013${stamp(clock)}  (${Number(beat.seconds) || 0}s)`,
        `Shot: ${trim(beat.shot, 300)}`,
        beat.on_screen_text ? `On screen: ${trim(beat.on_screen_text, 160)}` : '',
        beat.transition ? `Transition: ${trim(beat.transition, 120)}` : '',
        beat.audio ? `Audio: ${trim(beat.audio, 160)}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}