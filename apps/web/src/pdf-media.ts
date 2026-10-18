import type {PdfRect} from '@folio/core';

/** PDF operators are PDF.js opcodes. All output is normalized, top-left source-page geometry. */
export interface ImagePaintCodes {save:number;restore:number;transform:number;
 paintImageXObject:number;paintInlineImageXObject:number;paintJpegXObject?:number}
export interface ImagePaintList {fnArray:readonly number[];argsArray:readonly unknown[][]}
type Matrix=[number,number,number,number,number,number];
const identity=():Matrix=>[1,0,0,1,0,0];
function mul(a:Matrix,b:Matrix):Matrix{
 return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}
function point(m:Matrix,x:number,y:number):[number,number]{
 return [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
}
/** Does not mistake the complete PDF page or header logo for an actual caption-linked figure. */
export function paintedImageRegions(list:ImagePaintList,codes:ImagePaintCodes,viewportTransform:Matrix,width:number,height:number):PdfRect[]{
 let ctm=identity();const stack:Matrix[]=[],results:PdfRect[]=[];
 for(let i=0;i<list.fnArray.length;i++){
  const op=list.fnArray[i];
  if(op===codes.save){stack.push([...ctm]);continue;}
  if(op===codes.restore){ctm=stack.pop()??identity();continue;}
  if(op===codes.transform){
   const raw=list.argsArray[i];
   if(raw.length===6&&raw.every(x=>typeof x==='number'&&Number.isFinite(x)))
    ctm=mul(ctm,raw as Matrix);
   continue;
  }
  if(op!==codes.paintImageXObject&&op!==codes.paintInlineImageXObject&&op!==codes.paintJpegXObject)continue;
  const m=mul(viewportTransform,ctm);
  const corners=[point(m,0,0),point(m,1,0),point(m,0,1),point(m,1,1)];
  const x0=Math.max(0,Math.min(...corners.map(x=>x[0]))/width);
  const y0=Math.max(0,Math.min(...corners.map(x=>x[1]))/height);
  const x1=Math.min(1,Math.max(...corners.map(x=>x[0]))/width);
  const y1=Math.min(1,Math.max(...corners.map(x=>x[1]))/height);
  if(x1-x0<.08||y1-y0<.06)continue;
  results.push({x:x0,y:y0,width:x1-x0,height:y1-y0});
 }
 return results;
}
