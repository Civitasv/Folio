import {belongsToScientificRegion,scientificRegions,sourceMediaKind,scientificAssetId,type LayoutObservation} from './pdf-layout';
/** Source data is immutable; a layout/presentation change never changes its identity. */
export type PdfBlockKind = 'title'|'heading'|'paragraph'|'caption'|'reference'|'unknown'|'figure'|'chart'|'table'|'formula'|'algorithm';
export interface PdfRect { x:number;y:number;width:number;height:number }
export interface PdfTextSpan { text:string;rect:PdfRect;fontSize:number }
export interface PdfPageInput { page:number;spans:PdfTextSpan[];width:number;height:number;images?:PdfRect[];layoutRegions?:LayoutObservation[] }
export interface PdfBlock { id:string;kind:PdfBlockKind;page:number;text:string;rect:PdfRect;confidence:number;mediaRect?:PdfRect;sourceText?:string }
export interface PdfDocumentIR {version:1;documentId:string;pages:number;blocks:PdfBlock[];warnings:string[]}
export interface ReadingPair { block:PdfBlock;target?:string;status:'ready'|'missing'|'source-only' }
export type ReadingMode = 'parallel'|'interleaved';
export function readingPairs(ir:PdfDocumentIR, translations:ReadonlyMap<string,string>):ReadingPair[]{
 return ir.blocks.map(block=>{
  if(sourceMediaKind(block.kind))return {block,status:'source-only'};
  const target=translations.get(block.id);
  return target?.trim()?{block,target,status:'ready'}:{block,status:'missing'};
 });
}
interface Line { text:string;rect:PdfRect;fontSize:number }
function union(a:PdfRect,b:PdfRect):PdfRect{
 const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
 return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};
}
function overlapRect(a:PdfRect,b:PdfRect):number{
 const x=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
 const y=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 return x*y/(b.width*b.height);
}
function lines(spans:PdfTextSpan[]):Line[]{
 const ordered=[...spans].filter(s=>s.text.trim()&&s.rect.width>0&&s.rect.height>0)
  .sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x);
 const result:Line[]=[];
 for(const s of ordered){
  const line=result.find(l=>Math.abs(l.rect.y-s.rect.y)<=Math.min(l.rect.height,s.rect.height)*.35 && Math.abs(l.fontSize-s.fontSize)<Math.max(.006,l.fontSize*.23) &&
   s.rect.x<=l.rect.x+l.rect.width+.05&&l.rect.x<=s.rect.x+s.rect.width+.05);
  if(!line){result.push({text:s.text.trim(),rect:{...s.rect},fontSize:s.fontSize});continue;}
  // sorted input means every newly joined span lies after the preceding one.
  line.text+=' '+s.text.trim();
  line.rect=union(line.rect,s.rect);
 }
 return result.sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x);
}
function order(lines:Line[]):Line[]{
 const narrow=lines.filter(l=>l.rect.width<.56&&l.rect.x<.49||l.rect.width<.56&&l.rect.x>.49);
 const left=narrow.filter(l=>l.rect.x<.49),right=narrow.filter(l=>l.rect.x>.49);
 if(left.length<2||right.length<2)return lines;
 // Reflow each actual column within a continuous vertical band. A large vertical
 // gap can delimit a full-width float/caption even when its font footprint is narrow.
 const vertical=[...lines].sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x);
 const afterGap=new Set(vertical.filter((line,i)=>{
  if(i===0||line.rect.y-vertical[i-1].rect.y<=.12)return false;
  const before=vertical.slice(0,i);
  // A title-to-first-body gap is not a float boundary; require established
  // text in both columns before treating a later isolated region as a break.
  return before.filter(x=>x.rect.x<.49).length>=2&&before.filter(x=>x.rect.x>=.49).length>=2;
 }));
 const wide=lines.filter(l=>l.rect.width>=.56||l.rect.x<.49&&l.rect.x+l.rect.width>.56||afterGap.has(l))
  .sort((a,b)=>a.rect.y-b.rect.y);
 const result:Line[]=[],used=new Set<Line>();
 let start=-1;
 for(const boundary of [...wide,undefined]){
  const end=boundary?.rect.y??2;
  const band=lines.filter(x=>!used.has(x)&&x.rect.y>start&&x.rect.y<end&&x!==boundary);
  const lo=band.filter(x=>x.rect.x<.49).sort((a,b)=>a.rect.y-b.rect.y);
  const hi=band.filter(x=>x.rect.x>=.49).sort((a,b)=>a.rect.y-b.rect.y);
  for(const v of [...lo,...hi]){result.push(v);used.add(v);}
  if(boundary){result.push(boundary);used.add(boundary);start=boundary.rect.y;}
 }
 return [...result,...lines.filter(x=>!used.has(x))];
}
function classify(text:string,fontSize:number,median:number,first:boolean):PdfBlockKind{
 if(/^(?:fig(?:ure)?\.?|table)\s*\d+[.:\s]/i.test(text))return 'caption';
 if(/^references\s*$/i.test(text))return 'heading';
 if(first&&fontSize>median*1.38)return 'title';
 if(fontSize>median*1.14&&text.length<120)return 'heading';
 return 'paragraph';
}
/** Pure conservative text reflow: unsupported scientific assets are flagged, never reconstructed by guessing. */
export function buildPdfIR(documentId:string,pages:PdfPageInput[]):PdfDocumentIR{
 const blocks:PdfBlock[]=[],warnings:string[]=[];
 for(const page of pages){
  const clean=page.spans.filter(s=>Number.isFinite(s.rect.x)&&Number.isFinite(s.rect.y)&&Number.isFinite(s.rect.width)&&Number.isFinite(s.rect.height)&&Number.isFinite(s.fontSize)&&s.rect.x>=0&&s.rect.y>=0&&s.rect.x+s.rect.width<=1.01&&s.rect.y+s.rect.height<=1.01);
  if(clean.length!==page.spans.length)warnings.push('Page '+page.page+': invalid source geometry skipped.');
  const regions=scientificRegions(page.layoutRegions??[],clean);
  // A layout box can overlap its printed caption. Captions are real translatable
  // source text, not pixels to discard with a table/figure's interior labels.
  const prose=clean.filter(span=>/^(?:fig(?:ure)?\.?|table)\s*\d+[.:\s]/i.test(span.text)||!belongsToScientificRegion(span,regions));
  const all=order(lines(prose));
  if(!all.length)warnings.push('Page '+page.page+(regions.length?': no selectable prose text. Original page review required.':': no selectable text. Original page review required.'));
  const heights=prose.map(s=>s.fontSize).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)]||1;
  let n=0;
  for(const line of all){
   const t=line.text.replace(/\s+/g,' ').trim();
   if(/^\d{1,4}$/.test(t)&&(line.rect.y<.06||line.rect.y>.92))continue;
   const kind=classify(t,line.fontSize,median,blocks.length===0);
   const last=blocks.at(-1);
   // Join close consecutive lines only when they belong to the same reading lane and have the same style.
   const compatible=last&&last.page===page.page&&last.kind==='paragraph'&&kind==='paragraph'&&
    Math.abs(last.rect.x-line.rect.x)<.08&&Math.abs(last.rect.width-line.rect.width)<.20&&
    line.rect.y>=last.rect.y&&line.rect.y-last.rect.y-last.rect.height<Math.max(.016,line.rect.height*.9);
   const captionContinuation=last&&last.page===page.page&&last.kind==='caption'&&kind==='paragraph'&&
    Math.abs(last.rect.x-line.rect.x)<.04&&line.rect.y>=last.rect.y&&
    line.rect.y-last.rect.y-last.rect.height<.011;
   if(compatible||captionContinuation){
    last.text+=(/[-‐]$/.test(last.text)?'':' ')+t;
    if(/[-‐]$/.test(last.text.slice(0,-t.length)))last.text=last.text.replace(/[-‐]\s(?=[A-Za-z])/,'');
    last.rect=union(last.rect,line.rect);
   }else{
    blocks.push({id:'p'+page.page+'-b'+(++n),kind,page:page.page,text:t,rect:line.rect,confidence:kind==='paragraph'?.8:.65});
   }
  }
  // Associate *visible painted* image regions with the immediately preceding Figure
  // caption. A publisher logo without an explicit caption is not a science figure.
  // Crop regions are immutable source evidence; never translate embedded graph labels.
  const figures=blocks.filter(block=>block.page===page.page&&block.kind==='caption'&&/^fig(?:ure)?\.?\s*\d+/i.test(block.text));
  const grouped=new Map<string,PdfRect>();
  let unpaired=0;
  for(const image of page.images??[]){
   // A model-detected whole region replaces its bitmap-only fallback.
   if(regions.some(region=>region.kind==='figure'||region.kind==='chart'?overlapRect(region.rect,image)>.6:false))continue;
   // An uncaptained top-of-page branding image is not article evidence.
   if(image.y<.14&&!figures.length)continue;
   const candidate=figures.map(caption=>{
    const gap=image.y-(caption.rect.y+caption.rect.height);
    const overlap=Math.min(image.x+image.width,caption.rect.x+caption.rect.width)-Math.max(image.x,caption.rect.x);
    return {caption,gap,overlap};
   }).filter(x=>x.gap>=-.008&&x.gap<=.095&&x.overlap>.03)
    .sort((a,b)=>a.gap-b.gap)[0];
   if(!candidate){unpaired++;continue;}
   const prev=grouped.get(candidate.caption.id);
   grouped.set(candidate.caption.id,prev?union(prev,image):image);
  }
  if(unpaired)warnings.push('Page '+page.page+': '+unpaired+' unpaired embedded image region(s); inspect original page for non-captioned evidence or branding.');
  for(const caption of figures){
   const region=grouped.get(caption.id);
   if(!region)continue;
   const number=caption.text.match(/^fig(?:ure)?\.?\s*(\d+)/i)?.[1];
   const idx=blocks.indexOf(caption);
   blocks.splice(idx,0,{id:'p'+page.page+'-figure-'+number,kind:'figure',page:page.page,
    text:'',rect:region,mediaRect:region,confidence:.9});
  }
  for(const region of regions){
   const block:PdfBlock={id:scientificAssetId(page.page,region),kind:region.kind,page:page.page,
    text:'',rect:region.rect,mediaRect:region.rect,confidence:region.confidence,sourceText:region.sourceText};
   const captionPrefix=region.kind==='table'?/^table\s*\d+/i:region.kind==='figure'||region.kind==='chart'?/^fig(?:ure)?\.?\s*\d+/i:undefined;
   const caption=captionPrefix?blocks.filter(entry=>entry.page===page.page&&entry.kind==='caption'&&captionPrefix.test(entry.text))
    .sort((a,b)=>Math.abs(a.rect.y-region.rect.y)-Math.abs(b.rect.y-region.rect.y))[0]:undefined;
   if(caption&&Math.abs(caption.rect.y-region.rect.y)<.16){
    const index=blocks.indexOf(caption);
    blocks.splice(region.rect.y<caption.rect.y?index:index+1,0,block);
   }else{
    const index=blocks.findIndex(entry=>entry.page===page.page&&entry.rect.y>region.rect.y);
    blocks.splice(index<0?blocks.length:index,0,block);
   }
  }
  if(blocks.some(block=>block.page===page.page&&block.kind==='caption'&&/^table\s/i.test(block.text)&&!regions.some(region=>region.kind==='table')))
   warnings.push('Page '+page.page+': PDF table grid is not yet reconstructed; do not rely on flattened table cells. Check original-page evidence.');
 }
 if(pages.length)warnings.push('Conservative reflow: only verified scientific regions are shown as original-page assets. Unidentified table grids, vectors and equations still require original-page fidelity review.');
 return {version:1,documentId,pages:pages.length?Math.max(...pages.map(p=>p.page)):0,blocks,warnings};
}
