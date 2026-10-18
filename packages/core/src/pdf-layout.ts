import type {PdfRect,PdfTextSpan} from './pdf-ir';

/** Input from any *local* detector. A candidate is not authoritative source text. */
export type ScientificLabel='figure'|'chart'|'table'|'display_formula'|'algorithm'|'header_image'|'footer_image';
export type ScientificKind='figure'|'chart'|'table'|'formula'|'algorithm';
export interface LayoutObservation {
 label:ScientificLabel;rect:PdfRect;confidence:number;order:number;
}
export interface ScientificRegion {
 kind:ScientificKind;rect:PdfRect;confidence:number;order:number;sourceText:string;
}
export const sourceMediaKind=(kind:string):boolean=>
 kind==='figure'||kind==='chart'||kind==='table'||kind==='formula'||kind==='algorithm';

function area(rect:PdfRect):number{return rect.width*rect.height;}
function overlap(a:PdfRect,b:PdfRect):number{
 const width=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
 const height=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 return width*height;
}
function valid(rect:PdfRect):boolean{
 return [rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)&&rect.x>=0&&rect.y>=0&&
 rect.width>0&&rect.height>0&&rect.x+rect.width<=1.001&&rect.y+rect.height<=1.001;
}
const kind=(label:ScientificLabel):ScientificKind|undefined=>
 label==='header_image'||label==='footer_image'?undefined:label==='display_formula'?'formula':label;

/** A deterministic postprocessor; no OCR, inferred numeric values or copied app code. */
export function scientificRegions(observations:readonly LayoutObservation[],spans:readonly PdfTextSpan[]):ScientificRegion[]{
 const candidates=observations.filter(o=>kind(o.label)!==undefined&&valid(o.rect)&&
 Number.isFinite(o.confidence)&&o.confidence>=.5&&Number.isFinite(o.order))
 .sort((a,b)=>b.confidence-a.confidence||a.order-b.order);
 const kept:LayoutObservation[]=[];
 for(const candidate of candidates){
  const duplicate=kept.some(prior=>{
   const shared=overlap(prior.rect,candidate.rect);
   const total=area(prior.rect)+area(candidate.rect)-shared;
   return shared/total>(prior.label===candidate.label?.6:.98);
  });
  if(!duplicate)kept.push(candidate);
 }
 return kept.map(region=>({
  kind:kind(region.label)!,rect:{...region.rect},confidence:region.confidence,order:region.order,
  // Retained only for indexing/audit; visual regions are *never* translated as flat prose.
  sourceText:spans.filter(span=>valid(span.rect)&&overlap(region.rect,span.rect)/area(span.rect)>=.75)
   .map(span=>span.text).join(' ').trim()
 })).sort((a,b)=>a.order-b.order||a.rect.y-b.rect.y||a.rect.x-b.rect.x);
}
/** Avoid duplicating table grid/caption text as independent paragraphs in reflow. */
export function belongsToScientificRegion(span:PdfTextSpan,regions:readonly ScientificRegion[]):boolean{
 return valid(span.rect)&&regions.some(region=>overlap(span.rect,region.rect)/area(span.rect)>=.75);
}
/** Stable coordinate-based visual asset key; source bytes remain the authoritative identity. */
export function scientificAssetId(page:number,region:ScientificRegion):string{
 return 'p'+page+'-'+region.kind+'-'+Math.round(region.rect.x*10000)+'-'+Math.round(region.rect.y*10000)+
  '-'+Math.round(region.rect.width*10000)+'-'+Math.round(region.rect.height*10000);
}
