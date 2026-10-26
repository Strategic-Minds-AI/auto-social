// Shared identity machinery for the profile makeover and the faceless brand
// factory. Both write the same nine-tile grid plan and render the same asset
// pair through the image gateway, so every brand the app produces looks like a
// deliberate company instead of a set of unrelated images.

import { renderMediaImage } from './mediaClient.ts';

export const GRID_SLOTS = 9;

export const gridSchema = {
  type: 'array',
  description: 'Exactly nine tiles, slots 1 to 9, in the order they are posted',
  items: {
    type: 'object',
    properties: {
      slot: { type: 'number' },
      hook: { type: 'string' },
      visual_prompt: { type: 'string' },
      caption: { type: 'string' },
      hashtags: { type: 'string' },
    },
    required: ['slot', 'hook', 'visual_prompt'],
  },
};

const isJunk = (value) =>
  !String(value || '').trim() || /^\(?(none|n\/?a|null|undefined|-)\)?$/i.test(String(value).trim());

/** Nine clean tiles in slot order, with the model's placeholders dropped. */
export function cleanGrid(plan) {
  const rows = (Array.isArray(plan) ? plan : []).map((item) =>
    typeof item === 'string' ? { hook: item } : item || {}
  );

  const bySlot = new Map();
  rows.forEach((row, index) => {
    const raw = Number(row.slot);
    const slot = Number.isFinite(raw) ? Math.min(Math.max(Math.round(raw), 1), GRID_SLOTS) : index + 1;
    const hook = String(row.hook || '').trim();
    const visual = String(row.visual_prompt || '').trim();
    if (isJunk(hook) && isJunk(visual)) return;
    if (bySlot.has(slot)) return;
    bySlot.set(slot, {
      slot,
      // Whichever of the two the model wrote can stand in for the other.
      hook: isJunk(hook) ? visual.slice(0, 90) : hook,
      visual_prompt: isJunk(visual) ? hook : visual,
      caption: String(row.caption || '').trim(),
      hashtags: String(row.hashtags || '').trim(),
      image_url: String(row.image_url || '').trim(),
    });
  });

  return Array.from(bySlot.values())
    .sort((a, b) => a.slot - b.slot)
    .slice(0, GRID_SLOTS);
}

export function paletteLine(palette, fallback = 'near-black, electric blue, silver') {
  const colors = (Array.isArray(palette) ? palette : [])
    .map((color) => String(color || '').trim())
    .filter(Boolean)
    .slice(0, 5);
  return colors.length ? colors.join(', ') : fallback;
}

/**
 * One image through the gateway, stored and returned as a URL.
 * Called from a backend function with the service-role client.
 */
export async function renderImage(_base44, { prompt, aspect = '1:1', referenceUrl = '' }) {
  const text = String(prompt || '').trim();
  if (!text) return '';

  // Rendered on the owner's own media provider. Base44's image engine is never
  // called, so no platform credits are spent.
  return renderMediaImage({
    prompt: text,
    aspect,
    referenceUrls: referenceUrl ? [referenceUrl] : [],
  });
}

/**
 * Draw one tile of a plan, matched to the brand's own artwork so the nine posts
 * read as one grid. Returns the plan with that tile's image filled in.
 */
export async function drawTile({ base44, plan, slot, referenceUrl = '' }) {
  const tiles = cleanGrid(plan);
  const tile = tiles.find((item) => item.slot === slot);
  if (!tile) return null;

  const url = await renderImage(base44, {
    prompt: tile.visual_prompt,
    aspect: '1:1',
    referenceUrl,
  });
  if (!url) return null;

  return tiles.map((item) => (item.slot === slot ? { ...item, image_url: url } : item));
}