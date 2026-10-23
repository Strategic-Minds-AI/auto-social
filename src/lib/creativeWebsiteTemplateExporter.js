import { CREATIVE_WEBSITE_TEMPLATES } from './creativeWebsiteTemplateLibrary.js';

function esc(value) {
 return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
const kebab = s => String(s).replace(/[^a-z0-9-]/gi,'-');
export function buildTemplateCreativeBrief(template) {
 const t=template;
 return [
  'Build an original mobile-first conversion website concept. Do not copy any existing commercial theme, brand, design assets, or website code.',
  'Industry: '+t.industry+'. Business type: '+t.businessType+'. Sample project name: '+t.name+'.',
  'Use X1 pattern '+t.layoutName+' ('+t.layoutId+'). Design style: '+t.style+'. Audience: '+t.audience+'. Goal: '+t.recommendedGoal+'.',
  'Brand palette: background '+t.palette.background+', surface '+t.palette.surface+', text '+t.palette.text+', accent '+t.palette.accent+', secondary accent '+t.palette.accentAlt+', border '+t.palette.border+'.',
  'Typography: heading '+t.typography.heading+'; body '+t.typography.body+'.',
  'Hero example: '+t.hero.headline+'. Supporting idea: '+t.hero.subtitle+'. Primary CTA: '+t.hero.primaryCta+'. Secondary CTA: '+t.hero.secondaryCta+'.',
  'Page sections: '+t.sections.join(' → ')+'.',
  'Media slots: '+t.imageSlots.map(s=>s.label).join('; ')+'.',
  'Requirements: accessible contrast, responsive layouts, keyboard-friendly controls, evidence-based claims only, real product and service details supplied by owner, no fake testimonials or reviews. Provide image creative briefs and editable page sections.'
 ].join('\n');
}
export function exportTemplatePackJson(templates=CREATIVE_WEBSITE_TEMPLATES) {
 return JSON.stringify({schema:'x1_website_template_pack_v2',version:'2.0.0',
  createdBy:'Strategic Minds AI — AUTO SOCIAL Creative Asset Studio',
  provenance:'100 original configurable blueprints developed from X1 source layout patterns and public market conventions; not copies of third-party code or images',
  templateCount:templates.length,templates},null,2);
}
export function renderWebsiteTemplateHtml(t) {
 const p=t.palette;
 const styleName=kebab(t.styleId);
 const modules=t.sections.filter(x=>x!=='Hero'&&x!=='Contact / action');
 const cardHtml=modules.slice(0,6).map((name,idx)=>'<article class="feature"><span class="feature-number">0'+(idx+1)+'</span><h3>'+esc(name)+'</h3><p>Explore '+esc(name.toLowerCase())+' for '+esc(t.industry.toLowerCase())+'. Replace this sample text with verified business details.</p></article>').join('');
 const assets=t.imageSlots.map((slot,idx)=>'<div class="asset asset-'+idx+'"><span class="asset-icon" aria-hidden="true">✧</span><strong>'+esc(slot.purpose==='hero'?'Hero visual':'Media slot '+(idx+1))+'</strong><small>'+esc(slot.label)+'</small></div>').join('');
 const heading=esc(t.hero.headline),brand=esc(t.name.split(' · ')[0]),cta=esc(t.hero.primaryCta);
 const font=esc(t.typography.heading),family=esc(t.typography.body);
 const css=[
 ':root{--bg:'+p.background+';--surface:'+p.surface+';--text:'+p.text+';--muted:'+p.muted+';--accent:'+p.accent+';--accent-2:'+p.accentAlt+';--accent-text:'+p.accentText+';--border:'+p.border+'}',
 '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:'+family+';line-height:1.5}',
 'a{color:inherit;text-decoration:none}a:focus-visible{outline:3px solid var(--accent);outline-offset:3px}',
 'header{display:flex;align-items:center;justify-content:space-between;padding:22px max(5vw,24px);border-bottom:1px solid var(--border);gap:18px}',
 '.brand{font-family:'+font+';font-size:clamp(18px,2vw,26px);font-weight:700;letter-spacing:-.04em}',
 '.nav-links{display:flex;gap:20px;align-items:center;font-size:14px}main{max-width:1400px;margin:auto}',
 '.eyebrow{text-transform:uppercase;font-size:11px;font-weight:800;letter-spacing:.2em;color:var(--accent)}',
 '.hero{padding:clamp(46px,7vw,95px) 5vw;display:grid;grid-template-columns:1fr 1fr;gap:6%;align-items:center;min-height:540px}',
 '.hero h1{font-family:'+font+';font-size:clamp(37px,5.8vw,78px);letter-spacing:-.055em;line-height:1.04;margin:18px 0}',
 '.hero .sub{font-size:clamp(15px,1.6vw,20px);color:var(--muted);max-width:560px}',
 '.actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:28px}',
 '.button{padding:13px 21px;background:var(--accent);color:var(--accent-text);border-radius:10px;font-weight:800;display:inline-block}',
 '.button.secondary{background:transparent;color:var(--text);border:1px solid var(--border)}',
 '.art-grid{display:grid;grid-template-columns:1.3fr .7fr;gap:10px;aspect-ratio:1.3}',
 '.asset{border-radius:20px;background:radial-gradient(circle at 15% 25%,var(--accent),transparent 50%),linear-gradient(125deg,var(--surface),var(--accent-2));display:flex;align-items:flex-start;justify-content:flex-end;flex-direction:column;padding:22px;border:1px solid var(--border);min-width:0;overflow:hidden}',
 '.asset-icon{font-size:50px;line-height:1.1;opacity:.72;color:var(--text)}.asset strong{font-size:15px}.asset small{font-size:11px;opacity:.8}',
 '.asset-0{grid-row:span 2}.asset-1,.asset-2{filter:saturate(.85)}',
 'section.content{padding:70px 5vw;border-top:1px solid var(--border)}',
 '.section-kicker{color:var(--accent);font-size:12px;font-weight:bold;letter-spacing:.18em;text-transform:uppercase}',
 '.content h2,.footer-cta h2{font-family:'+font+';font-size:clamp(26px,4vw,48px);letter-spacing:-.045em;margin:10px 0 25px}',
 '.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}',
 '.feature{padding:26px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}',
 '.feature-number{font-size:12px;color:var(--accent)}.feature h3{font-size:20px;margin:20px 0 9px}.feature p{color:var(--muted);font-size:14px}',
 '.footer-cta{padding:70px 5vw;background:var(--surface);border-top:1px solid var(--border);text-align:center}',
 '.disclaimer{font-size:11px;opacity:.75;margin-top:25px}',
 '.hero.layout-centered-hero,.hero.layout-fullscreen-hero{display:flex;flex-direction:column;text-align:center;justify-content:center}',
 '.hero.layout-centered-hero .sub,.hero.layout-fullscreen-hero .sub{margin-inline:auto}',
 '.hero.layout-centered-hero .actions,.hero.layout-fullscreen-hero .actions{justify-content:center}',
 '.hero.layout-centered-hero .art-grid,.hero.layout-fullscreen-hero .art-grid{max-width:800px;width:100%;aspect-ratio:2.6}',
 '.hero.layout-fullscreen-hero{min-height:670px;background:radial-gradient(circle at 50% 20%,var(--surface),transparent 60%)}',
 '.hero.layout-bento-grid .art-grid{grid-template-columns:1fr 1fr;aspect-ratio:1.18}',
 '.hero.layout-card-grid .art-grid{grid-template-columns:1fr 1fr 1fr;aspect-ratio:1.4}',
 '.hero.layout-card-grid .asset-0{grid-row:span 1}',
 '.hero.layout-storytelling{grid-template-columns:1fr;max-width:950px;margin:auto;text-align:center}',
 '.hero.layout-storytelling .sub{margin:auto}.hero.layout-storytelling .actions{justify-content:center}',
 '.hero.layout-z-pattern .art-grid{order:-1}',
 '.hero.layout-f-pattern-sidebar{grid-template-columns:1fr 2fr}',
 '.hero.layout-magazine-editorial{grid-template-columns:1.4fr 1fr}.hero.layout-magazine-editorial h1{font-size:clamp(38px,6vw,90px)}',
 '.hero.layout-asymmetrical-masonry .art-grid{transform:rotate(-2deg);grid-template-columns:2fr 1fr}',
 '@media(max-width:840px){header{padding:18px 20px}.nav-links a:not(.button){display:none}.hero{grid-template-columns:1fr!important;gap:30px;padding:52px 22px;min-height:0}',
 '.hero.layout-z-pattern .art-grid{order:0}.hero.layout-storytelling,.hero.layout-centered-hero,.hero.layout-fullscreen-hero{text-align:left}',
 '.hero.layout-storytelling .sub,.hero.layout-centered-hero .sub,.hero.layout-fullscreen-hero .sub{margin:0}',
 '.hero.layout-storytelling .actions,.hero.layout-centered-hero .actions,.hero.layout-fullscreen-hero .actions{justify-content:flex-start}',
 '.hero .art-grid{width:100%!important;transform:none!important;aspect-ratio:1.5!important}',
 'section.content,.footer-cta{padding:48px 22px}.cards{grid-template-columns:1fr}.hero h1{font-size:clamp(38px,9vw,60px)}}',
 '@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}'
 ].join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
  +'<meta name="description" content="'+esc(t.hero.subtitle)+'"><title>'+esc(t.name)+' — Original X1 Concept</title>'
  +'<style>'+css+'</style></head><body class="'+styleName+'">'
  +'<header><a href="#" class="brand">'+brand+'</a><nav class="nav-links" aria-label="Main navigation"><a href="#explore">Explore</a><a href="#contact">Contact</a><a href="#contact" class="button">'+cta+'</a></nav></header>'
  +'<main><section class="hero layout-'+esc(t.layoutId)+'"><div class="hero-copy"><span class="eyebrow">'+esc(t.hero.eyebrow)+'</span><h1>'+heading+'</h1><p class="sub">'+esc(t.hero.subtitle)+'</p>'
  +'<div class="actions"><a class="button" href="#contact">'+cta+'</a><a class="button secondary" href="#explore">'+esc(t.hero.secondaryCta)+'</a></div></div>'
  +'<div class="art-grid" role="img" aria-label="Stylized placeholders for original owned or licensed media">'+assets+'</div></section>'
  +'<section class="content" id="explore"><span class="section-kicker">Explore</span><h2>'+esc(t.focus)+'</h2><div class="cards">'+cardHtml+'</div></section>'
  +'<section id="contact" class="footer-cta"><span class="section-kicker">Next step</span><h2>Ready to explore your options?</h2><a class="button" href="mailto:hello@example.invalid?subject='+encodeURIComponent(t.industry)+'">'+cta+'</a>'
  +'<p class="disclaimer">Design preview only · Replace placeholder email, text, visuals and claims before publishing.</p></section></main></body></html>';
}
