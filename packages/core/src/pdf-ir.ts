/** Source data is immutable; a layout/presentation change never changes its identity. */
export type PdfBlockKind = 'title'|'heading'|'paragraph'|'caption'|'reference'|'unknown';
export interface PdfRect { x:number;y:number;width:number;height:number }
export interface PdfTextSpan { text:string;rect:PdfRect;fontSize:number }
export interface PdfPageInput { page:number;spans:PdfTextSpan[];width:number;height:number }
export interface PdfBlock { id:string;kind:PdfBlockKind;page:number;text:string;rect:PdfRect;confidence:number }
export interface PdfDocumentIR {version:1;documentId:string;pages:number;blocks:PdfBlock[];warnings:string[]}
export interface ReadingPair { block:PdfBlock;target?:string;status:'ready'|'missing' }
export type ReadingMode = 'parallel'|'interleaved';
export function readingPairs(ir:PdfDocumentIR, translations:ReadonlyMap<string,string>):ReadingPair[]{
 return ir.blocks.map(block=>{
  const target=translations.get(block.id);
  return target?.trim()?{block,target,status:'ready'}:{block,status:'missing'};
 });
}
interface Line { text:string;rect:PdfRect;fontSize:number }
function union(a:PdfRect,b:PdfRect):PdfRect{
 const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
 return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};
}
function lines(spans:PdfTextSpan[]):Line[]{
 const ordered=[...spans].filter(s=>s.text.trim()&&s.rect.width>0&&s.rect.height>0)
  .sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x);
 const result:Line[]=[];
 for(const s of ordered){
  const line=result.find(l=>Math.abs(l.rect.y-s.rect.y)<=Math.min(l.rect.height,s.rect.height)*.35 && Math.abs(l.fontSize-s.fontSize)<Math.max(.006,l.fontSize*.23) &&
   s.rect.x<=l.rect.x+l.rect.width+.05&&l.rect.x<=s.rect.x+s.rect.width+.05);
  if(!line){result.push({text:s.text.trim(),rect:{...s.rect},fontSize:s.fontSize});continue;}
  const before=s.rect.x<line.rect.x;
  line.text=before?s.text.trim()+' '+line.text:line.text+' '+s.text.trim();
  line.rect=union(line.rect,s.rect);
 }
 return result.sort((a,b)=>a.rect.y-b.rect.y||a.rect.x-b.rect.x);
}
function order(lines:Line[]):Line[]{
 const narrow=lines.filter(l=>l.rect.width<.56&&l.rect.x<.49||l.rect.width<.56&&l.rect.x>.49);
 const left=narrow.filter(l=>l.rect.x<.49),right=narrow.filter(l=>l.rect.x>.49);
 if(left.length<3||right.length<3)return lines;
 // Full-width title/heading regions split the column flow into independent bands.
 const wide=lines.filter(l=>l.rect.width>=.56||l.rect.x<.49&&l.rect.x+l.rect.width>.56)
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
 if(!text.trim())return 'unknown';
 return 'paragraph';
}
/** Pure conservative text reflow: unsupported scientific assets are flagged, never reconstructed by guessing. */
export function buildPdfIR(documentId:string,pages:PdfPageInput[]):PdfDocumentIR{
 const blocks:PdfBlock[]=[],warnings:string[]=[];
 for(const page of pages){
  const clean=page.spans.filter(s=>Number.isFinite(s.rect.x)&&Number.isFinite(s.rect.y)&&Number.isFinite(s.rect.width)&&Number.isFinite(s.rect.height)&&Number.isFinite(s.fontSize)&&s.rect.x>=0&&s.rect.y>=0&&s.rect.x+s.rect.width<=1.01&&s.rect.y+s.rect.height<=1.01);
  if(clean.length!==page.spans.length)warnings.push('Page '+page.page+': invalid source geometry skipped.');
  const all=order(lines(clean));
  if(!all.length){warnings.push('Page '+page.page+': no selectable text. Original page review required.');continue;}
  const heights=clean.map(s=>s.fontSize).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)]||1;
  let n=0;
  for(const line of all){
   const t=line.text.replace(/\s+/g,' ').trim();
   if(!t)continue;
   if(/^\d{1,4}$/.test(t)&&(line.rect.y<.06||line.rect.y>.92))continue;
   const kind=classify(t,line.fontSize,median,blocks.length===0);
   const last=blocks.at(-1);
   // Join close consecutive lines only when they belong to the same reading lane and have the same style.
   const compatible=last&&last.page===page.page&&last.kind==='paragraph'&&kind==='paragraph'&&
    Math.abs(last.rect.x-line.rect.x)<.08&&Math.abs(last.rect.width-line.rect.width)<.20&&
    line.rect.y>=last.rect.y&&line.rect.y-last.rect.y-last.rect.height<Math.max(.016,line.rect.height*.9);
   if(compatible){
    last.text+=(/[-‐]$/.test(last.text)?'':' ')+t;
    if(/[-‐]$/.test(last.text.slice(0,-t.length)))last.text=last.text.replace(/[-‐]\s(?=[A-Za-z])/,'');
    last.rect=union(last.rect,line.rect);
   }else{
    blocks.push({id:'p'+page.page+'-b'+(++n),kind,page:page.page,text:t,rect:line.rect,confidence:kind==='paragraph'?.8:.65});
   }
  }
  if(blocks.some(b=>b.page===page.page&&b.kind==='caption'))
   warnings.push('Page '+page.page+': review figure/table visuals against the original page; text extraction alone cannot reconstruct them.');
 }
 return {version:1,documentId,pages:pages.length?Math.max(...pages.map(p=>p.page)):0,blocks,warnings};
}
