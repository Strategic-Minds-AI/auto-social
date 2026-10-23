import { X1_LAYOUTS } from './x1LayoutCatalog.js';
export const TEMPLATE_INDUSTRIES = [["Epoxy & Decorative Concrete","Service","epoxy","SurfaceCraft","Garage, commercial, and decorative concrete coatings","Request an estimate","See project options","Explore durable surface possibilities","From residential garages to commercial spaces, discover a coating approach for your project.",44,["Before & After","Finish Options","Our Process","Request an Estimate"]],["Plumbing","Service","plumbing","Flowline","Residential and commercial plumbing","Request service","Explore services","Plumbing solutions that fit your property","Explore repairs, installation, and maintenance options with a clear next step.",203,["Services","Common Questions","Service Areas","Contact"]],["Heating & Cooling","Service","hvac","ClimateCore","HVAC installation and service","Book a consultation","Explore systems","Comfort starts with the right system","Compare heating, ventilation, and cooling options for your home or facility.",197,["Heating & Cooling","Maintenance","Our Approach","Book"]],["Roofing","Service","roofing","SummitRoof","Roof replacement, repair, and inspection","Schedule an inspection","See roofing options","A clearer path to your roofing project","Understand roof materials, service options, and what comes next.",17,["Roofing Systems","Project Gallery","Process","Inspection Request"]],["Landscape Design","Service","landscape","Terrain Studio","Outdoor design, planting, and hardscapes","Plan a consultation","View projects","Your outdoor space, thoughtfully planned","Explore planting, hardscape, and outdoor living concepts for your property.",142,["Portfolio","Services","Design Process","Let's Talk"]],["Home Remodeling","Service","remodeling","Form & Frame","Kitchen, bath, and whole-home renovation","Discuss a project","Browse projects","Make room for what matters","See practical remodeling approaches and start planning your next space.",26,["Renovation Types","Portfolio","Process","Project Inquiry"]],["Dental Clinic","Service","dental","Brightway Dental","Family and cosmetic dental services","Request an appointment","Meet the team","Care that begins with a conversation","Discover available dental services and information for your next visit.",184,["Dental Services","Patient Info","Meet the Team","Appointments"]],["Real Estate Agency","Service","real-estate","OpenKey Properties","Residential buying, selling, and property listings","Explore listings","Talk to an agent","Find your next place to belong","Browse property options and connect with a local real estate professional.",214,["Properties","Neighborhoods","Buying & Selling","Contact"]],["Legal Services","Service","legal","Counsel Point","Law firm and consultation services","Request a consultation","Explore practice areas","Know your options before your next step","Review general practice areas and find the right way to ask about your situation.",236,["Practice Areas","Our Approach","FAQs","Consultation"]],["Digital Marketing Agency","Service","agency","Northstar Growth","Web design, campaigns, analytics, and creative strategy","Discuss your goals","View work","Marketing built around clear goals","Explore creative services, campaign planning, and measurable workflows.",275,["Capabilities","Portfolio","Process","Strategy Call"]],["Skincare Products","Product","skincare","Kind Ritual","Gentle skincare and daily care products","Shop the collection","Explore ingredients","Simple rituals, considered formulas","Discover products and find a routine that suits your preferences.",336,["Bestsellers","Collections","Ingredients","FAQs"]],["Specialty Coffee","Product","coffee","Field & Roast","Coffee beans, brewing accessories, and subscriptions","Shop coffee","Explore brewing","Your next cup starts here","Find beans and brewing essentials for the way you like coffee.",25,["Shop Coffee","Find Your Roast","Brew Guides","Subscription"]],["Apparel & Streetwear","Product","apparel","Threadworks","Everyday apparel, collections, and lookbooks","Shop the drop","View the lookbook","Wear what moves with you","Explore styles, seasonal pieces, and curated collections.",350,["New Arrivals","Collections","Lookbook","Size Guide"]],["Fine Jewelry","Product","jewelry","Arc & Aura","Fine jewelry, gifts, and accessories","Explore jewelry","View the edit","Pieces for moments that matter","Browse thoughtful jewelry selections and discover the details.",39,["Collection","Materials","Gift Guide","Care"]],["Furniture & Interiors","Product","furniture","Oak & Form","Furniture, home accents, and room inspiration","Shop furniture","Browse rooms","Create space for your life","Explore furnishings and finishing touches for practical, personal rooms.",31,["Shop by Room","Featured Pieces","Materials","Delivery Info"]],["Pet Products","Product","pets","Pawsome Goods","Pet accessories, care, and enrichment products","Shop pet essentials","Browse categories","Good things for their everyday","Find pet accessories and essentials built around daily routines.",169,["Shop by Pet","Categories","Care Tips","FAQs"]],["Outdoor & Fitness Gear","Product","outdoor","Trail Mode","Outdoor equipment, travel kits, and accessories","Shop gear","Explore the kits","Get ready for what is next","Browse gear and compare options for your next outing.",157,["Shop Gear","Equipment Guide","Featured Products","Shipping"]],["Home Fragrance","Product","fragrance","Scent House","Candles, diffusers, and scents for the home","Discover fragrances","Browse collections","Find your home's signature scent","Explore scent profiles and products designed for everyday spaces.",296,["Scent Notes","Collections","Gift Sets","Care"]],["Electronics & Accessories","Product","electronics","Signal Supply","Everyday electronics and tech accessories","Browse products","Compare options","Make your setup work for you","Compare categories and practical accessories for home or work.",213,["Shop Devices","Compare Features","How It Works","Support"]],["Natural Food Products","Product","food","Good Harvest","Packaged foods, pantry products, and subscriptions","Shop the pantry","Explore ingredients","Discover everyday pantry favorites","Browse ingredients, flavors, and pantry essentials that fit your kitchen.",91,["Pantry Collection","Ingredients","Recipes","Subscriptions"]]];
export const TEMPLATE_STYLES = [["Obsidian Luxe","luxe","#0B1020","#182238","#F8FAFC","#CAD2DC","#334155",76,58,"serif","luxury"],["Editorial Linen","editorial","#FCF8F2","#FFFFFF","#192231","#3C4656","#D6D9DD",60,34,"serif","minimal"],["Botanical Calm","nature","#F4F7F1","#FFFFFF","#203A32","#365B50","#D3E0D6",58,31,"sans","natural"],["Electric Atelier","electric","#0C1027","#1C2444","#FAFAFF","#CFD5EF","#394366",92,66,"display","bold"],["Crisp Corporate","corporate","#F2F7FC","#FFFFFF","#142638","#355367","#D3E2EC",74,31,"sans","professional"]];

export const TEMPLATE_BENCHMARKS = [
 { label:'Webflow most-liked ecommerce',url:'https://webflow.com/made-in-webflow/e-commerce',method:'Community likes and publicly visible structural patterns; no code copied'},
 { label:'Framer marketplace / agency',url:'https://www.framer.com/marketplace/templates/categories/agency/',method:'Marketplace category, styles and conversion patterns; no purchased themes copied'},
 { label:'Framer marketplace / ecommerce',url:'https://www.framer.com/marketplace/templates/categories/ecommerce/',method:'Product-focused section taxonomy and visual hierarchy; no code copied'},
 { label:'Shopify theme conversion comparison',url:'https://shopthemedetector.com/blog/best-shopify-themes-for-conversion/',method:'High-level product discovery and purchase-funnel patterns; benchmark context, not a claim of equal measured results'}
];
function toHex(h,s,l){
 h=((h%360)+360)%360; const sN=s/100,lN=l/100; const a=sN*Math.min(lN,1-lN);
 const f=n=>{const k=(n+h/30)%12;return lN-a*Math.max(-1,Math.min(k-3,9-k,1));};
 const cv=n=>Math.round(f(n)*255).toString(16).padStart(2,'0');
 return '#'+cv(0)+cv(8)+cv(4);
}
function luminance(hex){
 const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
 .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;
}
export function contrastRatio(a,b) {
 const x=luminance(a), y=luminance(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
const kindPrefix={Service:'svc',Product:'prd'};
function makeTemplate(industry,i,style,j){
 const [industryName,kind,slug,brand,focus,cta,cta2,headline,subtitle,hue,sections]=industry;
 const [styleName,styleId,bg,surface,text,muted,border,sat,light,font,designLanguage]=style;
 const accent=toHex((hue+j*13)%360,sat,light);
 const accentText=contrastRatio(accent,'#FFFFFF')>=4.5?'#FFFFFF':'#101728';
 const accentAlt=toHex((hue+34+j*11)%360,j===3?75:55,j===0?59:42);
 const layout=X1_LAYOUTS[(i*3+j*2)%X1_LAYOUTS.length];
 const slots=layout.slots.map((slot,k)=>({id:slug+'-'+k,label:slot,purpose:k===0?'hero':'support',ratio:k===0?'16:9':'1:1'}));
 const goal=kind==='Product'?'product_discovery':layout.recommendedGoal;
 return {
  id:kindPrefix[kind]+'-'+slug+'-'+styleId+'-v1',
  version:'1.0.0',
  name:brand+' · '+styleName,
  businessType:kind, industry:industryName,
  industryKey:slug, style:styleName, styleId, designLanguage,
  layoutId:layout.id, layoutName:layout.name, recommendedGoal:goal,
  audience:kind==='Product'?'Online shoppers comparing '+focus.toLowerCase():'Prospective clients exploring '+focus.toLowerCase(),
  focus, useCases:kind==='Product'?['online store','product launch','category landing page']:['service homepage','consultation funnel','lead generation'],
  palette:{background:bg,surface,text,muted,border,accent,accentAlt,accentText},
  typography:{heading:font==='serif'?'Georgia, serif':font==='display'?'Arial Black, Arial, sans-serif':'Arial, Helvetica, sans-serif',body:'Arial, Helvetica, sans-serif'},
  styling:{density:j===1?'airy':j===3?'expressive':'balanced',radius:j===0?6:j===3?22:12,shadow:j===0?'deep':'soft',navigation:'sticky',heroLayout:layout.id},
  hero:{eyebrow:industryName,headline,subtitle,primaryCta:cta,secondaryCta:cta2},
  sections:[...new Set(['Hero',...sections,...layout.modules.map(s=>s.replaceAll('-',' ')),'Contact / action'])].slice(0,10),
  imageSlots:slots,
  contentRules:{facts:'Use only verified business claims and authorized product information',reviews:'Placeholders only until verified',visuals:'Use licensed/owned images, never a third-party site screenshot as source artwork'},
  qualityGates:['Mobile-first and keyboard navigation','Readable foreground/background contrast','Specific audience and primary CTA','No fabricated claims or trust badges','Responsive image framing','Optimize hero and product images'],
  benchmarkCategories:['Awwwards visual hierarchy','Webflow category and gallery patterns','Framer marketplace template styles','Shopify commerce best practices'],
  provenance:'Original X1 combinatorial design using authorized X1 SIP layout concepts and observed public design-pattern benchmarks; no third-party template code or artwork reproduced.'
 };
}
export const CREATIVE_WEBSITE_TEMPLATES = TEMPLATE_INDUSTRIES.flatMap((industry,i)=>
 TEMPLATE_STYLES.map((style,j)=>makeTemplate(industry,i,style,j)));
export const CREATIVE_TEMPLATE_COUNTS = {
 additional:CREATIVE_WEBSITE_TEMPLATES.length,
 services:CREATIVE_WEBSITE_TEMPLATES.filter(t=>t.businessType==='Service').length,
 products:CREATIVE_WEBSITE_TEMPLATES.filter(t=>t.businessType==='Product').length,
 styles:TEMPLATE_STYLES.length,
 sourceLayouts:X1_LAYOUTS.length
};
export function filterWebsiteTemplates({query='',businessType='All',style='All',layoutId='All'}={}){
 const term=String(query||'').trim().toLowerCase();
 return CREATIVE_WEBSITE_TEMPLATES.filter(t=>
  (businessType==='All'||t.businessType===businessType) &&
  (style==='All'||t.styleId===style) &&
  (layoutId==='All'||t.layoutId===layoutId) &&
  (!term||[t.name,t.industry,t.style,t.layoutName,t.focus,t.hero.headline].join(' ').toLowerCase().includes(term))
 );
}
