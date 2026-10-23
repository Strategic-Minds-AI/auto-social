import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CREATIVE_WEBSITE_TEMPLATES,CREATIVE_TEMPLATE_COUNTS,filterWebsiteTemplates,contrastRatio } from '../src/lib/creativeWebsiteTemplateLibrary.js';
import { exportTemplatePackJson,renderWebsiteTemplateHtml,buildTemplateCreativeBrief } from '../src/lib/creativeWebsiteTemplateExporter.js';
import {X1_LAYOUTS} from '../src/lib/x1LayoutCatalog.js';

const items=CREATIVE_WEBSITE_TEMPLATES;
test('100 original templates in 50/50 product-service balance',()=>{
 assert.equal(items.length,100);
 assert.equal(CREATIVE_TEMPLATE_COUNTS.services,50);
 assert.equal(CREATIVE_TEMPLATE_COUNTS.products,50);
 assert.equal(new Set(items.map(t=>t.id)).size,100);
 assert.equal(new Set(items.map(t=>t.name)).size,100);
 assert.equal(new Set(items.map(t=>t.palette.background+'-'+t.palette.accent)).size,100);
});
test('Every source X1 layout gets 10 template designs',()=>{
 assert.equal(X1_LAYOUTS.length,10);
 for(const layout of X1_LAYOUTS)assert.equal(items.filter(t=>t.layoutId===layout.id).length,10,layout.id);
});
test('Every business gets 5 styles and each style spans 20 industries',()=>{
 for(const kind of ['Service','Product']){
  const keys=new Set(items.filter(t=>t.businessType===kind).map(t=>t.industryKey));
  assert.equal(keys.size,10);
  for(const key of keys)assert.equal(items.filter(t=>t.industryKey===key).length,5);
 }
 for(const style of new Set(items.map(t=>t.styleId)))assert.equal(items.filter(t=>t.styleId===style).length,20);
});
test('All 100 palettes pass primary text and CTA contrast >=4.5:1',()=>{
 for(const t of items) {
  assert.ok(contrastRatio(t.palette.text,t.palette.background)>=4.5,t.id+' body contrast');
  assert.ok(contrastRatio(t.palette.accentText,t.palette.accent)>=4.5,t.id+' button contrast');
  for(const k of ['accent','background','surface','text','muted','border','accentText','accentAlt'])assert.match(t.palette[k],/^#[0-9a-fA-F]{6}$/,t.id+' '+k);
 }
});
test('Metadata: layouts, CTA, industry, sample sections and rights notice',()=>{
 for(const t of items) {
  assert.ok(t.hero.headline.length>12,t.id);
  assert.ok(t.hero.primaryCta.length>4,t.id);
  assert.ok(t.sections.length>=6,t.id);
  assert.ok(t.imageSlots.length>=2,t.id);
  assert.ok(t.provenance.includes('no third-party'),t.id);
 }
});
test('Filter by business style, layout, niche text',()=>{
 assert.equal(filterWebsiteTemplates({businessType:'Product'}).length,50);
 assert.equal(filterWebsiteTemplates({businessType:'Service'}).length,50);
 assert.equal(filterWebsiteTemplates({style:'luxe'}).length,20);
 assert.equal(filterWebsiteTemplates({layoutId:'split-screen'}).length,10);
 assert.equal(filterWebsiteTemplates({query:'skincare'}).length,5);
 assert.equal(filterWebsiteTemplates({query:'does not exist'}).length,0);
});
test('All 100 export to safe, responsive standalone HTML demos',()=>{
 for(const t of items){
  const html=renderWebsiteTemplateHtml(t);
  assert.match(html,/^<!doctype html>/i,t.id);
  assert.ok(html.includes('name="viewport"'),t.id);
  assert.ok(html.includes('@media(max-width:840px)'),t.id);
  assert.ok(html.includes('prefers-reduced-motion'),t.id);
  assert.ok(html.includes('aria-label="Main navigation"'),t.id);
  assert.ok(html.includes('example.invalid'),t.id);
  assert.ok(!html.includes('<script'),t.id);
  assert.ok(html.includes('class="hero layout-'+t.layoutId+'"'),t.id);
  assert.ok(buildTemplateCreativeBrief(t).includes(t.layoutId),t.id);
 }
});
test('JSON pack roundtrip has 100 stable ids',()=>{
 const pack=JSON.parse(exportTemplatePackJson());
 assert.equal(pack.templateCount,100);
 assert.deepEqual(pack.templates.map(t=>t.id),items.map(t=>t.id));
});
test('Static package outputs exist after pack generation',()=>{
 assert.ok(fs.existsSync('public/template-packs/X1-100-Website-Templates-v2.zip'));
 assert.ok(fs.statSync('public/template-packs/X1-100-Website-Templates-v2.zip').size>100000);
 assert.equal(JSON.parse(fs.readFileSync('public/template-packs/X1-100-Website-Templates-v2.json','utf8')).templateCount,100);
});
