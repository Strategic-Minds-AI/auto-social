import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CREATIVE_WEBSITE_TEMPLATES, CREATIVE_TEMPLATE_COUNTS, contrastRatio } from '../src/lib/creativeWebsiteTemplateLibrary.js';
import { exportTemplatePackJson, renderWebsiteTemplateHtml } from '../src/lib/creativeWebsiteTemplateExporter.js';

const root = process.cwd();
const output = path.join(root,'public','template-packs');
const staging = path.join(root,'.templatepack-build','X1_100_Original_Website_Designs');
fs.mkdirSync(path.join(staging,'websites'),{recursive:true});
fs.mkdirSync(output,{recursive:true});

const templates=CREATIVE_WEBSITE_TEMPLATES;
if (templates.length!==100 || CREATIVE_TEMPLATE_COUNTS.services!==50 || CREATIVE_TEMPLATE_COUNTS.products!==50) throw Error('Template count mismatch');
const ids=new Set(templates.map(t=>t.id));
const colors=new Set(templates.map(t=>t.palette.accent+'|'+t.palette.background));
if (ids.size!==100 || colors.size!==100) throw Error('Duplicate template id or palette');
const layoutCounts=Object.groupBy?Object.groupBy(templates,t=>t.layoutId):templates.reduce((a,t)=>((a[t.layoutId]??=[]).push(t),a),{});
if(Object.keys(layoutCounts).length!==10 || Object.values(layoutCounts).some(v=>v.length!==10))throw Error('Layout distribution not balanced');
for(const t of templates) {
 const contrast=contrastRatio(t.palette.accent,t.palette.accentText);
 if(contrast<4.5 || contrastRatio(t.palette.background,t.palette.text)<4.5)throw Error('Contrast failure '+t.id);
 const markup=renderWebsiteTemplateHtml(t);
 if(!markup.includes('<!doctype html>') || !markup.includes('@media(max-width:840px)') || !markup.includes('mailto:hello@example.invalid'))throw Error('HTML missing required scaffold '+t.id);
 fs.writeFileSync(path.join(staging,'websites',t.id+'.html'),markup);
}
fs.writeFileSync(path.join(staging,'X1_100_Original_Website_Templates.json'),exportTemplatePackJson());
fs.writeFileSync(path.join(staging,'README.md'),[
'# X1 Original Website Template Library v2.0.0',
'100 responsive standalone HTML demos + editable JSON design specifications.',
'50 service businesses and 50 product businesses.',
'10 source X1 Universal Website SIP layout patterns × 10 distributed industry/style applications each.',
'Each design features its own palette and sample content. Preview not proven live production-ready.',
'Design source: original X1 layouts and high-level public Webflow, Framer and Shopify patterns.',
'No proprietary site code, commercial template downloads, or third-party artwork is included.',
'Before publishing: replace example.invalid mailto links, revise placeholder imagery and business copy, configure real sales/contact functionality, verify permissions, accessibility, load times, and legal compliance.',
'The HTML designs are static examples; ecommerce checkout, scheduling, payment handling and a CMS require separate integration.'
].join('\n')+'\n');
fs.copyFileSync(path.join(staging,'X1_100_Original_Website_Templates.json'),path.join(output,'X1-100-Website-Templates-v2.json'));
const archive=path.join(output,'X1-100-Website-Templates-v2.zip');
const psQuote=(value)=>"'"+String(value).replaceAll("'","''")+"'";
const result=process.platform==='win32'
 ? spawnSync('powershell.exe',['-NoProfile','-Command','Compress-Archive -Path '+psQuote(path.join(staging,'*'))+' -DestinationPath '+psQuote(archive)+' -Force'],{cwd:root,encoding:'utf8'})
 : spawnSync('python3',['-m','zipfile','-c',archive,path.relative(root,staging)],{cwd:root,encoding:'utf8'});
if(result.status!==0)throw Error('zip failed: '+result.stderr);
fs.rmSync(path.join(root,'.templatepack-build'),{recursive:true,force:true});
const report={templates:100,products:50,services:50,layoutPatterns:10,uniquePalettes:colors.size,files:templates.length,zipBytes:fs.statSync(archive).size,zipLocation:path.relative(root,archive)};
console.log(JSON.stringify(report));
