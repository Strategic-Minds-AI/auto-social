// X1 Creative Asset Studio — defaults are editable/importable, not substitutes
// for the user's existing Universal Website Layout package.
export const CATEGORIES = ['Project Photos', 'Before & After', 'Product', 'Brand', 'People', 'Facilities', 'Educational', 'Testimonials', 'Social', 'Unsorted'];

export const EXPORT_PRESETS = [
  { id: 'instagram_portrait', name: 'Instagram portrait', width: 1080, height: 1350, type: 'image' },
  { id: 'instagram_square', name: 'Instagram square', width: 1080, height: 1080, type: 'image' },
  { id: 'instagram_story', name: 'Instagram Story', width: 1080, height: 1920, type: 'image' },
  { id: 'instagram_reel', name: 'Instagram Reel', width: 1080, height: 1920, type: 'video' },
  { id: 'facebook_feed', name: 'Facebook landscape', width: 1200, height: 630, type: 'image' },
  { id: 'facebook_story', name: 'Facebook Story', width: 1080, height: 1920, type: 'image' },
  { id: 'youtube_thumbnail', name: 'YouTube thumbnail', width: 1280, height: 720, type: 'image' },
  { id: 'youtube_short', name: 'YouTube Short', width: 1080, height: 1920, type: 'video' },
  { id: 'tiktok_vertical', name: 'TikTok vertical', width: 1080, height: 1920, type: 'video' },
  { id: 'linkedin_post', name: 'LinkedIn square', width: 1200, height: 1200, type: 'image' },
  { id: 'x_post', name: 'X landscape', width: 1600, height: 900, type: 'image' },
  { id: 'website_hero', name: 'Website hero', width: 1920, height: 1080, type: 'image' },
  { id: 'website_banner', name: 'Website banner', width: 1600, height: 600, type: 'image' },
  { id: 'flyer_print', name: 'Flyer 8.5 x 11 / 300 dpi', width: 2550, height: 3300, type: 'image' }
];
// Website layout positions are asset slot presets; not full website generators.
export const LAYOUTS = [
  { id: 'conversion_hero', name: 'Conversion hero', slots: ['hero 1920×1080','trust 1200×630','CTA 1200×630'] },
  { id: 'split_screen', name: 'Split screen', slots: ['visual 1200×1400','support 800×800'] },
  { id: 'bento_grid', name: 'Bento grid', slots: ['feature 1200×900','tile 600×600','tile 600×600'] },
  { id: 'editorial', name: 'Editorial', slots: ['cover 1600×1000','article 1200×800'] },
  { id: 'visual_portfolio', name: 'Visual portfolio', slots: ['gallery 1200×1200','detail 1600×900'] },
  { id: 'cinematic', name: 'Cinematic landing', slots: ['fullscreen 1920×1080','portrait 1080×1920'] },
  { id: 'local_service', name: 'Local-service funnel', slots: ['before-after 1600×900','trust 800×800'] },
  { id: 'product_catalog', name: 'Product catalog', slots: ['product 1200×1200','detail 1200×1200'] },
  { id: 'education', name: 'Education / webinar', slots: ['presenter 1280×720','lesson 1200×900'] },
  { id: 'multi_step_funnel', name: 'Multi-step funnel', slots: ['offer 1200×900','social proof 800×800'] }
];
export function suggestFromFilename(name) {
 const filename = String(name || '').toLowerCase();
 const rules = [
  [/before.{0,4}after|transformation|ba[_ -]|b[_ -]a/, 'Before & After'],
  [/logo|brand|identity|watermark/, 'Brand'],
  [/product|sku|coating|kit|bottle|bucket|packag/, 'Product'],
  [/review|testimonial|rating/, 'Testimonials'],
  [/team|crew|employee|staff|portrait|headshot/, 'People'],
  [/warehouse|facility|industrial|factory/, 'Facilities'],
  [/howto|tutorial|training|lesson|guide/, 'Educational'],
  [/reel|tiktok|shorts|instagram|social/, 'Social'],
  [/floor|epoxy|garage|installation|jobsite|project/, 'Project Photos']
 ];
 const category = rules.find(([pattern]) => pattern.test(filename))?.[1] || 'Unsorted';
 const tags = filename.replace(/\.[^.]+$/, '').split(/[^a-z0-9]+/).filter(token => token.length > 2).slice(0, 8);
 return { category, tags, classification_method: 'filename_rules',
  classification_confidence: category === 'Unsorted' ? 0 : 0.35,
  classification_note: 'Filename-based suggestion only. No image/video pixel analysis performed.' };
}
