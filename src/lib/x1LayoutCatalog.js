// Canonical pattern IDs and metadata reproduced from the user's local
// X1_Universal_Website_SIP_v1.0.0.zip /patterns/pattern-catalog.json.
// Asset slots are suggested Creative Studio slots, not assertions about source dimensions.
export const X1_LAYOUT_SOURCE = {
  version: '1.0.0',
  filename: 'X1_Universal_Website_SIP_v1.0.0.zip',
  catalog: 'patterns/pattern-catalog.json',
  root: 'C:\\_Strategic_Minds_AI_OS\\78_WEBSITE LAYOUTS'
};
export const X1_LAYOUTS = [
  { id:'split-screen',name:'Split-Screen',visual:'Text and CTA beside large illustration/photo',idealFor:['services','professional','local'],recommendedGoal:'leads',hero:'split',modules:['trust','service-grid','process','faq','contact'],slots:['Main photo – 1200×1400','Trust imagery – 1200×630'] },
  { id:'centered-hero',name:'Centered Hero',visual:'Central headline plus dashboard/product surface',idealFor:['saas','corporate','technology'],recommendedGoal:'signups',hero:'centered',modules:['product-panel','service-grid','process','faq','contact'],slots:['Product screenshot – 1600×900','Secondary features – 1200×900'] },
  { id:'fullscreen-hero',name:'Full-Screen Hero',visual:'Immersive full-bleed background with overlay copy',idealFor:['luxury','hospitality','real-estate'],recommendedGoal:'bookings',hero:'fullscreen',modules:['trust','service-grid','process','faq','contact'],slots:['Hero – 1920×1080','Trust photos – 1200×800'] },
  { id:'bento-grid',name:'Bento Grid',visual:'Mixed-size rectangular feature blocks',idealFor:['saas','technology','agency'],recommendedGoal:'signups',hero:'bento',modules:['bento','process','faq','contact'],slots:['Feature tile – 1200×900','Small tile – 600×600'] },
  { id:'card-grid',name:'Card-Based Grid',visual:'Repeatable card collections',idealFor:['ecommerce','directory','services'],recommendedGoal:'sales',hero:'catalog',modules:['service-tiles','process','faq','contact'],slots:['Product/service – 1200×1200','Detail – 1200×900'] },
  { id:'storytelling',name:'Single-Column Storytelling',visual:'Sequential narrative problem/solution/proof/action',idealFor:['landing-pages','services','personal'],recommendedGoal:'leads',hero:'story',modules:['problem-solution','service-grid','process','faq','contact'],slots:['Narrative visual – 1600×900','Proof – 1200×800'] },
  { id:'z-pattern',name:'Z-Pattern',visual:'Alternating text/media sections',idealFor:['campaigns','startup','services'],recommendedGoal:'leads',hero:'alternating',modules:['alternating','faq','contact'],slots:['Side visual – 1200×900','Section visual – 1200×900'] },
  { id:'f-pattern-sidebar',name:'F-Pattern / Sidebar',visual:'Scannable contents sidebar beside educational copy',idealFor:['blogs','docs','education'],recommendedGoal:'authority',hero:'content',modules:['sidebar-resources','faq','contact'],slots:['Article lead – 1600×900','Resource thumbnail – 800×800'] },
  { id:'magazine-editorial',name:'Magazine / Editorial',visual:'Featured story beside article hierarchy',idealFor:['media','publishing','authority'],recommendedGoal:'authority',hero:'editorial',modules:['editorial-cards','faq','contact'],slots:['Editorial hero – 1600×1000','Article card – 1200×800'] },
  { id:'asymmetrical-masonry',name:'Asymmetrical / Masonry',visual:'Variable-size portfolio content with dramatic whitespace',idealFor:['agency','creative','luxury'],recommendedGoal:'leads',hero:'asymmetric',modules:['masonry-gallery','process','faq','contact'],slots:['Portrait tile – 1080×1350','Landscape tile – 1600×900'] }
];
export const X1_LAYOUT_MIXING_RULES = [
  'Choose one dominant homepage hero pattern, then compose section patterns freely.',
  'Prefer one strong primary conversion action across the page.',
  'Keep shared spacing, typography, color, keyboard focus, and responsive breakpoints consistent.',
  'Keep content and SEO factual; do not manufacture reviews, credentials, awards or ratings.',
  'Use stable layout IDs in manifests, version-controlled briefs, and test receipts.'
];
