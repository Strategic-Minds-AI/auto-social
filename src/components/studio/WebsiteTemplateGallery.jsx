import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X1_LAYOUTS } from '@/lib/x1LayoutCatalog';
import {
 CREATIVE_WEBSITE_TEMPLATES, CREATIVE_TEMPLATE_COUNTS, filterWebsiteTemplates,
 TEMPLATE_STYLES, TEMPLATE_BENCHMARKS, contrastRatio
} from '@/lib/creativeWebsiteTemplateLibrary';
import {
 buildTemplateCreativeBrief, exportTemplatePackJson, renderWebsiteTemplateHtml
} from '@/lib/creativeWebsiteTemplateExporter';
import { Search, Download, Copy, Monitor, Smartphone, LayoutTemplate, Layers3, Check, FileCode2 } from 'lucide-react';

function downloadFile(text, fileName, type) {
 const blob = new Blob([text], { type });
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement('a');
 anchor.href=url;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),4000);
}
function PreviewCard({t,onClick,active}) {
 const {palette:p} = t;
 return <button type="button" onClick={onClick} aria-pressed={active}
  className={'text-left rounded-xl overflow-hidden bg-card border transition-colors hover:border-primary/70 ' + (active?'border-primary ring-1 ring-primary':'border-border')}>
  <div className="aspect-[1.55] relative p-3" style={{background:p.background,color:p.text}}>
   <div className="flex items-center justify-between gap-1 mb-3">
    <span className="font-bold text-[9px] tracking-tight truncate">{t.name.split(' · ')[0]}</span>
    <span className="text-[7px] rounded-full py-1 px-2" style={{border:'1px solid '+p.border}}>Menu</span>
   </div>
   <div className={'grid gap-2 items-center h-[calc(100%-25px)] ' +(t.layoutId==='centered-hero'||t.layoutId==='fullscreen-hero'||t.layoutId==='storytelling'?'grid-cols-1 text-center':'grid-cols-2')}>
    <div><div className="h-1 w-10 rounded-full mb-2" style={{background:p.accent}} />
     <p className="text-[9px] font-bold leading-tight" style={{fontFamily:t.typography.heading}}>{t.hero.headline}</p>
     <span className="inline-block text-[7px] rounded px-1.5 py-1 mt-2" style={{background:p.accent,color:p.accentText}}>{t.hero.primaryCta}</span>
    </div>
    <div className="rounded-lg relative overflow-hidden h-[80%] min-h-[48px]" style={{background:'linear-gradient(130deg,'+p.surface+','+p.accentAlt+')',border:'1px solid '+p.border}}>
     <div className="absolute w-12 h-12 rounded-full -right-2 top-2 opacity-70" style={{background:p.accent}} />
     <div className="absolute w-14 h-3 rounded -left-1 bottom-3 opacity-70" style={{background:p.surface}} />
    </div>
   </div>
  </div>
  <div className="px-3 py-3 space-y-2">
   <p className="text-sm font-semibold truncate">{t.name}</p>
   <div className="flex justify-between gap-2 text-[11px] text-muted-foreground"><span className="truncate">{t.industry}</span><span>{t.layoutName}</span></div>
   <div className="flex items-center gap-1">{['background','surface','accent','accentAlt','text'].map(k=><span key={k} title={k+': '+p[k]} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{background:p[k]}} />)}</div>
  </div>
 </button>;
}

export default function WebsiteTemplateGallery({onPrepareAssets,onUsePrompt}) {
 const [query,setQuery] = useState('');
 const [kind,setKind] = useState('All');
 const [style,setStyle] = useState('All');
 const [layout,setLayout] = useState('All');
 const [current,setCurrent] = useState(CREATIVE_WEBSITE_TEMPLATES[0].id);
 const [device,setDevice] = useState('desktop');
 const [notice,setNotice] = useState('');
 const filtered=useMemo(()=>filterWebsiteTemplates({query,businessType:kind,style,layoutId:layout}),[query,kind,style,layout]);
 const selected=CREATIVE_WEBSITE_TEMPLATES.find(t=>t.id===current)||CREATIVE_WEBSITE_TEMPLATES[0];
 const doc=useMemo(()=>renderWebsiteTemplateHtml(selected),[selected]);
 const copy = async (content,label)=>{
  try {await navigator.clipboard.writeText(content);setNotice(label+' copied.');}
  catch {setNotice('Clipboard unavailable. Download the template instead.');}
 };
 const fileName='x1-'+selected.id;
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="font-semibold text-xl">100 original industry website templates</h2>
    <p className="text-sm text-muted-foreground mt-1">{CREATIVE_TEMPLATE_COUNTS.services} service • {CREATIVE_TEMPLATE_COUNTS.products} product • {X1_LAYOUTS.length} canonical X1 layout patterns • 5 design styles</p>
   </div>
   <Button onClick={()=>downloadFile(exportTemplatePackJson(),'X1-100-Website-Templates-v2.json','application/json')} variant="outline" className="gap-2">
    <Download className="w-4 h-4" />Export full 100-template pack
   </Button>
  </div>
  <p className="text-xs text-muted-foreground">Benchmark-informed original designs; these are not copies of third-party templates or independently ranked top-100 winners. Preview content and imagery are placeholders until replaced with owned assets.</p>
  <div className="flex flex-wrap gap-2">
   <div className="flex-1 min-w-[195px] flex items-center border border-border rounded-lg bg-card px-2"><Search className="w-4 h-4 text-muted-foreground" /><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search industry or template" className="bg-transparent text-sm outline-none p-2 w-full" aria-label="Search templates" /></div>
   <select aria-label="Business type" value={kind} onChange={e=>setKind(e.target.value)} className="border rounded-lg bg-card p-2 text-sm"><option>All</option><option>Service</option><option>Product</option></select>
   <select aria-label="Design style" value={style} onChange={e=>setStyle(e.target.value)} className="border rounded-lg bg-card p-2 text-sm"><option value="All">All styles</option>{TEMPLATE_STYLES.map(s=><option key={s[1]} value={s[1]}>{s[0]}</option>)}</select>
   <select aria-label="Layout type" value={layout} onChange={e=>setLayout(e.target.value)} className="border rounded-lg bg-card p-2 text-sm"><option value="All">All layouts</option>{X1_LAYOUTS.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
  </div>
  <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(330px,1fr)] gap-5 items-start">
   <div>
    <p className="text-xs text-muted-foreground mb-3">Showing {filtered.length} of {CREATIVE_TEMPLATE_COUNTS.additional} templates</p>
    {filtered.length === 0 ? <div className="p-8 text-center rounded-xl border border-dashed">No matches. Try different filters.</div>:
     <div className="grid sm:grid-cols-2 gap-3 max-h-[860px] overflow-y-auto pr-1">{filtered.map(t=>
      <PreviewCard key={t.id} t={t} active={selected.id===t.id} onClick={()=>{setCurrent(t.id);setNotice('');}} />
     )}</div>}
   </div>
   <aside className="rounded-xl border border-border bg-card p-4 space-y-4 lg:sticky lg:top-3">
    <div className="flex items-start justify-between gap-3">
     <div><p className="text-xs text-primary font-bold uppercase tracking-wider">Selected design</p>
      <h3 className="text-lg font-semibold mt-1">{selected.name}</h3><p className="text-xs text-muted-foreground">{selected.industry} • {selected.layoutName}</p>
     </div><LayoutTemplate className="w-5 h-5 text-primary shrink-0"/>
    </div>
    <div className="flex items-center justify-between gap-2">
     <span className="text-xs text-muted-foreground">Live HTML preview — sample content</span>
     <div className="flex rounded-lg border border-border p-1 gap-1">
      <button aria-label="Desktop preview" title="Desktop" onClick={()=>setDevice('desktop')} className={'p-1.5 rounded '+(device==='desktop'?'bg-primary/15 text-primary':'')}><Monitor className="w-4 h-4"/></button>
      <button aria-label="Mobile preview" title="Mobile" onClick={()=>setDevice('mobile')} className={'p-1.5 rounded '+(device==='mobile'?'bg-primary/15 text-primary':'')}><Smartphone className="w-4 h-4"/></button>
     </div>
    </div>
    <div className="bg-background border border-border rounded-lg overflow-auto flex justify-center p-2">
     <iframe title={'Preview for '+selected.name} sandbox="" srcDoc={doc}
      className="border border-border rounded bg-white transition-all"
      style={{width:device==='mobile'?'350px':'100%',maxWidth:'100%',height:'430px'}} />
    </div>
    <div className="flex flex-wrap gap-2 items-center">{Object.entries(selected.palette).filter(([key])=>['background','surface','accent','accentAlt','text'].includes(key)).map(([key,color])=>
     <button key={key} type="button" title={key+' '+color+' — copy color'} onClick={()=>copy(color,key+' color')}
      className="flex items-center gap-1.5 px-2 py-1 rounded border border-border text-[11px]">
      <span className="w-3 h-3 rounded" style={{background:color}} />{color}</button>
     )}
    </div>
    <p className="text-xs text-muted-foreground">Text/background contrast: {contrastRatio(selected.palette.text,selected.palette.background).toFixed(1)}:1 • CTA contrast: {contrastRatio(selected.palette.accent,selected.palette.accentText).toFixed(1)}:1</p>
    <div className="space-y-1">
     <p className="text-xs font-semibold">Conversion modules</p>
     <p className="text-xs text-muted-foreground">{selected.sections.join(' → ')}</p>
     <p className="text-xs font-semibold pt-2">Image slots</p>
     <p className="text-xs text-muted-foreground">{selected.imageSlots.map(s=>s.label).join(' · ')}</p>
    </div>
    <div className="grid sm:grid-cols-2 gap-2">
     <Button onClick={()=>downloadFile(doc,fileName+'.html','text/html')} size="sm" className="gap-2"><FileCode2 className="w-4 h-4"/>Download HTML</Button>
     <Button onClick={()=>downloadFile(JSON.stringify(selected,null,2),fileName+'.json','application/json')} size="sm" variant="outline" className="gap-2"><Download className="w-4 h-4"/>Download JSON</Button>
     <Button onClick={()=>copy(buildTemplateCreativeBrief(selected),'Creative brief')} size="sm" variant="outline" className="gap-2"><Copy className="w-4 h-4"/>Copy builder brief</Button>
     <Button onClick={()=>onUsePrompt?.(selected)} size="sm" variant="outline" className="gap-2"><Layers3 className="w-4 h-4"/>Use in AI Studio</Button>
     <Button onClick={()=>onPrepareAssets?.(selected)} size="sm" variant="outline" className="sm:col-span-2">Prepare imagery for this layout</Button>
    </div>
    {notice && <p role="status" className="flex gap-1 text-xs text-primary"><Check className="w-3.5 h-3.5"/>{notice}</p>}
   </aside>
  </div>
  <div className="rounded-lg border border-border p-3">
   <p className="text-xs font-semibold">Pattern research sources (design principles only)</p>
   <div className="flex gap-x-5 gap-y-1 flex-wrap mt-2">
    {TEMPLATE_BENCHMARKS.map(s=><a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline" key={s.url}>{s.label}</a>)}
   </div>
  </div>
 </div>;
}
