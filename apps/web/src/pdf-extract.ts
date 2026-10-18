import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {buildPdfIR,type PdfDocumentIR,type PdfPageInput} from '@folio/core';

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
   pages.push({page:number,width:viewport.width,height:viewport.height,spans});
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
   async destroy(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);await task.destroy();}
  };
 }catch(e){signal?.removeEventListener('abort',abort);await task.destroy();throw e;}
}
