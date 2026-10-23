// The library holds what this business has learned works: hooks, scripts, visual
// recipes and editing methods. Generation reads it back in, so a pattern the owner
// saved genuinely steers the next piece of content instead of sitting in a list.

export const LIBRARY_KINDS = ['hook', 'script', 'visual_template', 'editing_recipe', 'edit_sheet'];

const clean = (value, limit) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);

function line(item, index) {
  const title = clean(item.title, 70) || `Pattern ${index + 1}`;
  const used = Number(item.times_used) > 0 ? ` (used ${Number(item.times_used)}x)` : '';
  const body = String(item.body || '').trim().slice(0, 400);
  return `- ${title}${used}: ${body}`;
}

/**
 * The saved patterns, written as instructions the writer can work from.
 * Returns '' when the library is empty, so generation is unchanged.
 */
export function libraryBlock({ hooks = [], scripts = [], recipes = [] } = {}) {
  const sections = [];

  if (hooks.length) sections.push(`Hooks this business has proven\n${hooks.map(line).join('\n')}`);
  if (scripts.length) sections.push(`Script shapes that work here\n${scripts.map(line).join('\n')}`);
  if (recipes.length) sections.push(`Visual and editing methods to follow\n${recipes.map(line).join('\n')}`);

  if (!sections.length) return '';

  return `SAVED PATTERNS FROM THIS BUSINESS LIBRARY
Borrow their shape, pacing and structure where they fit. Never copy another account's wording, and never claim a result that belongs to someone else.

${sections.join('\n\n')}`;
}

/** One beat per cut, written out as something you can follow while editing. */
export function formatShotList(beats = []) {
  let clock = 0;
  return (Array.isArray(beats) ? beats : [])
    .map((beat, index) => {
      const start = clock;
      const seconds = Math.max(Number(beat.seconds) || 0, 0);
      clock += seconds;
      const stamp = (value) => `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`;
      const lines = [
        `BEAT ${index + 1}  ${stamp(start)}–${stamp(clock)}  (${seconds}s)`,
        `Shot: ${clean(beat.shot, 300)}`,
        beat.on_screen_text ? `On screen: ${clean(beat.on_screen_text, 160)}` : '',
        beat.transition ? `Transition: ${clean(beat.transition, 120)}` : '',
        beat.audio ? `Audio: ${clean(beat.audio, 160)}` : '',
      ];
      return lines.filter(Boolean).join('\n');
    })
    .join('\n\n');
}