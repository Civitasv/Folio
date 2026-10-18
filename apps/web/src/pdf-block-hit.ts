import type {PdfBlock,PdfRect} from '@folio/core';

const valid=(r:PdfRect)=>[r.x,r.y,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0;
/** Hit-test canonical normalized source geometry. Never derive block identity from rendered text. */
export function pickPdfBlockAtPoint(blocks:readonly PdfBlock[],page:number,x:number,y:number):PdfBlock|undefined{
 if(!Number.isInteger(page)||page<1||!Number.isFinite(x)||!Number.isFinite(y)||
  x<0||x>1||y<0||y>1)return undefined;
 const hits=blocks.filter(b=>{
  if(b.page!==page||!valid(b.rect))return false;
  const r=b.rect,pad=.012;
  return x>=r.x-pad&&x<=r.x+r.width+pad&&y>=r.y-pad&&y<=r.y+r.height+pad;
 });
 // An exact containment beats a nearby padded hit; prefer the most specific region
 // when a scientific float overlaps a text block.
 return hits.sort((a,b)=>{
  const exact=(r:PdfRect)=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;
  if(exact(a.rect)!==exact(b.rect))return exact(a.rect)?-1:1;
  return a.rect.width*a.rect.height-b.rect.width*b.rect.height||
   b.confidence-a.confidence||a.id.localeCompare(b.id);
 })[0];
}
