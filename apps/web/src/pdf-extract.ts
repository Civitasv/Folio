import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import {buildPdfIR,type PdfDocumentIR,type PdfPageInput,type PdfRect,type PdfTextSpan} from '@folio/core';
import {paintedImageRegions} from './pdf-media';
import {detectLocalPageLayout,type LocalLayoutRecognizer} from './pdf-layout-runtime';
import {createConservativeGridRecognizer} from './pdf-grid-detector';

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
 /** Same live local PDF.js document: original viewer and reflow share source bytes. */
 originalDocument?:pdfjs.PDFDocumentProxy;
 /** Exact original-page fidelity check, not a default embedded PDF viewer. */
 pageImage(pageNumber:number):Promise<string>;
 regionImage(pageNumber:number,rect:PdfRect):Promise<string>;
 destroy():Promise<void>;
}

/** Error details are local-only. Never log PDF bytes or upload a document for diagnosis. */
export class PdfParseFailure extends Error{
 constructor(readonly stage:string, cause:unknown){
  const detail=cause instanceof Error?cause.message:typeof cause==='string'?cause:'Unknown PDF engine error';
  super(stage+': '+(detail.trim().slice(0,320)||'Unknown PDF engine error'));
  this.name='PdfParseFailure';
 }
}
export function pdfFailureMessage(error:unknown):string{
 const detail=error instanceof Error?error.message:typeof error==='string'?error:'Unknown PDF engine error';
 return 'Unable to rebuild this PDF. '+detail.slice(0,380)+'. The original file remains stored locally.';
}
export async function parseLocalPdf(id:string,bytes:Uint8Array,signal?:AbortSignal,recognizer?:LocalLayoutRecognizer,
 onOpened?:(document:pdfjs.PDFDocumentProxy)=>void,onProgress?:(page:number,total:number)=>void):Promise<ParsedPdf>{
 if(signal?.aborted)throw new Error('PDF processing cancelled.');
 ensurePromiseTry();
 let task:ReturnType<typeof pdfjs.getDocument>|undefined;
 let stage='Opening document';
 const abort=()=>{if(task)void task.destroy().catch(()=>{});};
 try{
  task=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
  signal?.addEventListener('abort',abort,{once:true});
  const pdf=await task.promise;
  if(signal?.aborted)throw new Error('PDF processing cancelled.');
  // The PDF is already usable before its expensive full-document text/graphics pass.
  // Let the original-page view mount and paint without waiting for reflow.
  if(onOpened){onOpened(pdf);await new Promise<void>(resolve=>setTimeout(resolve,0));}
  const pages:PdfPageInput[]=[];
  const recoverable:string[]=[];
  let failedTextPages=0;
  let firstTextError:unknown;
  for(let number=1;number<=pdf.numPages;number++){
   onProgress?.(number,pdf.numPages);
   if(signal?.aborted)throw new Error('PDF processing cancelled.');
   stage='Reading page '+number;
   const page=await pdf.getPage(number);
   try{
    const viewport=page.getViewport({scale:1});
    let spans:PdfTextSpan[]=[];
    try{
     stage='Extracting text from page '+number;
     const content=await page.getTextContent();
     spans=content.items.flatMap(item=>{
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
    }catch(error){
     if(signal?.aborted)throw error;
     firstTextError??=error;
     failedTextPages++;
     recoverable.push('Page '+number+': text extraction failed; source-page review remains available.');
    }
    let images:PdfRect[]=[];
    try{
     stage='Inspecting graphics on page '+number;
     const list=await page.getOperatorList();
     images=paintedImageRegions(list,pdfjs.OPS,viewport.transform as [number,number,number,number,number,number],viewport.width,viewport.height);
    }catch(error){
     if(signal?.aborted)throw error;
     // Graphics association is optional. The already extracted article text
     // must remain readable if a complex image or vector operator fails.
     recoverable.push('Page '+number+': graphics inspection unavailable; verify figures using the original page.');
    }
    const captions=spans.filter(span=>/^table\s*\d+[.:\s]/i.test(span.text)).map(span=>span.rect);
    const activeRecognizer=recognizer??(captions.length?createConservativeGridRecognizer(captions):undefined);
    let layoutRegions:Awaited<ReturnType<typeof detectLocalPageLayout>>|undefined;
    if(activeRecognizer){
     try{
      stage='Detecting local layout on page '+number;
      layoutRegions=await detectLocalPageLayout(page,activeRecognizer,signal);
     }catch(error){
      if(signal?.aborted)throw error;
      recoverable.push('Page '+number+': local layout detection unavailable; fallback source reading retained.');
     }
    }
    pages.push({page:number,width:viewport.width,height:viewport.height,spans,images,layoutRegions});
   }finally{page.cleanup();}
  }
  if(pdf.numPages>0&&failedTextPages===pdf.numPages){
   stage='Extracting text from all pages';
   throw firstTextError??new Error('No page text could be read');
  }
  stage='Reconstructing article';
  const ir=buildPdfIR(id,pages);
  ir.warnings.push(...recoverable);
  let disposed=false;
  return {ir,originalDocument:pdf,
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
   async destroy(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);await task!.destroy();}
  };

 }catch(error){
  signal?.removeEventListener('abort',abort);
  if(task)try{await task.destroy();}catch{/* preserve the original parsing error */}
  if(signal?.aborted)throw new Error('PDF processing cancelled.');
  throw new PdfParseFailure(stage,error);
 }
}
