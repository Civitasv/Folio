import type {PdfRect,LayoutObservation} from '@folio/core';
import type {LocalLayoutRecognizer} from './pdf-layout-runtime';

/** Conservative, offline fallback: requires both table-caption geometry and visible grid rules. */
export function findSourceTableGrids(pixels:ImageData,captions:readonly PdfRect[]):LayoutObservation[]{
 const {width:w,height:h,data}=pixels;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<40||h<40||
  data.length<w*h*4||!captions.length)return [];
 const ink=(x:number,y:number)=>{
  const pos=(y*w+x)*4;
  return data[pos+3]>=128&&data[pos]+data[pos+1]+data[pos+2]<450;
 };
 const rows:{y:number,x0:number,x1:number}[]=[];
 for(let y=0;y<h;y++){
  let start=-1,bestStart=0,bestEnd=0;
  for(let x=0;x<=w;x++){
   if(x<w&&ink(x,y)){if(start<0)start=x;}
   else if(start>=0){
    if(x-start>bestEnd-bestStart){bestStart=start;bestEnd=x;}
    start=-1;
   }
  }
  if(bestEnd-bestStart>=w*.22){
   const previous=rows.at(-1);
   if(previous&&y-previous.y<=2&&Math.min(bestEnd,previous.x1)-Math.max(bestStart,previous.x0)>w*.15){
    previous.x0=Math.min(previous.x0,bestStart);previous.x1=Math.max(previous.x1,bestEnd);
   }else rows.push({y,x0:bestStart,x1:bestEnd});
  }
 }
 const results:LayoutObservation[]=[];
 const ordered=[...captions].filter(c=>[c.x,c.y,c.width,c.height].every(Number.isFinite)&&c.x>=0&&c.y>=0&&c.width>0&&c.height>0&&c.x+c.width<=1.001&&c.y+c.height<=1.001)
  .sort((a,b)=>a.y-b.y);
 for(let i=0;i<ordered.length;i++){
  const cap=ordered[i],from=Math.ceil((cap.y+cap.height)*h);
  const to=Math.min(h-1,Math.floor(Math.min(cap.y+.55,ordered[i+1]?.y??1)*h));
  const eligible=rows.filter(row=>row.y>=from&&row.y<=to&&
   Math.min(row.x1,(cap.x+cap.width)*w)-Math.max(row.x0,cap.x*w)>Math.max(w*.04,cap.width*w*.20));
  const group:typeof eligible=[];
  for(const row of eligible){
   if(group.length&&row.y-group.at(-1)!.y>h*.15)break;
   group.push(row);
  }
  if(group.length<3)continue;
  const y0=group[0].y,y1=group.at(-1)!.y;
  if(y1-y0<h*.025)continue;
  const x0=Math.min(...group.map(row=>row.x0)),x1=Math.max(...group.map(row=>row.x1));
  const vertical:number[]=[];
  for(let x=x0;x<x1;x++){
   let run=0,longest=0;
   for(let y=y0;y<=y1;y++){
    run=ink(x,y)?run+1:0;longest=Math.max(longest,run);
   }
   if(longest>=(y1-y0)*.55&&vertical.every(previous=>x-previous>w*.025))vertical.push(x);
  }
  if(vertical.length<2||vertical.at(-1)!-vertical[0]<w*.12)continue;
  const pad=2;
  const left=Math.max(0,x0-pad),top=Math.max(0,y0-pad);
  const right=Math.min(w,x1+pad),bottom=Math.min(h,y1+pad+1);
  results.push({label:'table',rect:{x:left/w,y:top/h,width:(right-left)/w,height:(bottom-top)/h},
   confidence:.72,order:cap.y*1000});
 }
 return results;
}
export function createConservativeGridRecognizer(captions:readonly PdfRect[]):LocalLayoutRecognizer{
 return {modelId:'folio-local-grid-v1',recognize:async pixels=>findSourceTableGrids(pixels,captions)};
}
