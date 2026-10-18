import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import {buildPdfIR,type PdfDocumentIR,type PdfPageInput,type PdfRect} from '@folio/core';
import {paintedImageRegions} from './pdf-media';

// PDF.js 6 uses Promise.try during fake-worker setup. Older desktop WebViews and
// Node 22 do not guarantee it; provide the standard synchronous-call semantics.
export function ensurePromiseTry():void{
 const ctor=Promise as PromiseConstructor & {try?: (...args:unknown[])=>Promise<unknown>};
 if(ctor.try)return;
 Object.defineProperty(Promise,'try',{configurable:true,writable:true,value:
  (fn:(...args:unknown[])=>unknown,...args:unknown[])=>new Promise((resolve,reject)=>{
   try{resolve(fn(...args));}catch(error){reject(error);}
  })
 });
}
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
export interface ParsedPdf {
 ir:PdfDocumentIR;
 /** Exact original-page fidelity check, not a default embedded PDF viewer. */
 pageImage(pageNumber:number):Promise<string>;
 regionImage(pageNumber:number,rect:PdfRect):Promise<string>;
 destroy():Promise<void>;
}
export async function parseLocalPdf(id:string,bytes:Uint8Array,signal?:AbortSignal):Promise<ParsedPdf>{
 if(signal?.aborted)throw new Error('PDF processing cancelled.');
 ensurePromiseTry();
 const task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
 const abort=()=>{void task.destroy();};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  const pdf=await task.promise;
  const pages:PdfPageInput[]=[];
  for(let number=1;number<=pdf.numPages;number++){
   if(signal?.aborted)throw new Error('PDF processing cancelled.');
   const page=await pdf.getPage(number),viewport=page.getViewport({scale:1});
   const content=await page.getTextContent();
   const spans=content.items.flatMap(item=>{
    if(!('str' in item)||!item.str.trim())return [];
    const transform=pdfjs.Util.transform(viewport.transform,item.transform);
    const height=Math.hypot(transform[2],transform[3]);
    const font=content.styles[item.fontName];
    const ascent=font&&Number.isFinite(font.ascent)&&font.ascent>0?font.ascent:.8;
    return [{text:item.str,fontSize:height/viewport.height,rect:{
     x:transform[4]/viewport.width,y:(transform[5]-height*ascent)/viewport.height,
     width:Math.abs(item.width)/viewport.width,height:height/viewport.height
    }}];
   });
   const list=await page.getOperatorList();
   const images=paintedImageRegions(list,pdfjs.OPS,viewport.transform as [number,number,number,number,number,number],viewport.width,viewport.height);
   pages.push({page:number,width:viewport.width,height:viewport.height,spans,images});
   page.cleanup();
  }
  const ir=buildPdfIR(id,pages);
  let disposed=false;
  return {ir,
   async pageImage(number){
    if(disposed||number<1||!Number.isInteger(number)||number>pdf.numPages)throw new Error('Original page unavailable.');
    const page=await pdf.getPage(number);
    const canvas=document.createElement('canvas');
    try{
     const normal=page.getViewport({scale:1});
     const viewport=page.getViewport({scale:Math.min(1.65,2200/Math.max(normal.width,normal.height))});
     canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
     const ctx=canvas.getContext('2d');
     if(!ctx)throw new Error('Canvas rendering unavailable.');
     await page.render({canvas,canvasContext:ctx,viewport,annotationMode:pdfjs.AnnotationMode.DISABLE}).promise;
     return canvas.toDataURL('image/png');
    }finally{canvas.width=0;canvas.height=0;page.cleanup();}
   },
   async regionImage(number,rect){
    if(disposed||number<1||!Number.isInteger(number)||number>pdf.numPages||
      ![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite)||
      rect.x<0||rect.y<0||rect.width<=0||rect.height<=0||
      rect.x+rect.width>1.001||rect.y+rect.height>1.001)throw new Error('Source image region unavailable.');
    const page=await pdf.getPage(number),normal=page.getViewport({scale:1});
    const scale=Math.min(2.5,1800/Math.max(normal.width*rect.width,normal.height*rect.height));
    const canvas=document.createElement('canvas');
    const x=rect.x*normal.width,y=rect.y*normal.height;
    try{
     canvas.width=Math.ceil(normal.width*rect.width*scale);canvas.height=Math.ceil(normal.height*rect.height*scale);
     const ctx=canvas.getContext('2d');
     if(!ctx)throw new Error('Canvas rendering unavailable.');
     const viewport=page.getViewport({scale});
     // Only canvas pixels are cropped. PDF.js still renders the untouched page
     // using the same PDF source and includes vector/overlay content in this region.
     await page.render({canvas,canvasContext:ctx,viewport,transform:[1,0,0,1,-x*scale,-y*scale],
      annotationMode:pdfjs.AnnotationMode.DISABLE}).promise;
     return canvas.toDataURL('image/png');
    }finally{canvas.width=0;canvas.height=0;page.cleanup();}
   },
   async destroy(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);await task.destroy();}
  };
 }catch(e){signal?.removeEventListener('abort',abort);await task.destroy();throw e;}
}
