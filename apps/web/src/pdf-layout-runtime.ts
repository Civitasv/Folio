import type {LayoutObservation} from '@folio/core';
import type {PDFPageProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';

/** An installed recognizer is injected explicitly. Folio never fetches a model automatically. */
export interface LocalLayoutRecognizer{
 readonly modelId:string;
 recognize(pixels:ImageData,signal?:AbortSignal):Promise<LayoutObservation[]>;
}
/** Layout pixels are bounded and ephemeral; the immutable original PDF is never sent away. */
export async function detectLocalPageLayout(page:PDFPageProxy,recognizer:LocalLayoutRecognizer,signal?:AbortSignal):Promise<LayoutObservation[]>{
 if(signal?.aborted)throw new Error('PDF processing cancelled.');
 const dimensions=page.getViewport({scale:1});
 const scale=Math.min(1.5,1100/Math.max(dimensions.width,dimensions.height));
 const viewport=page.getViewport({scale});
 if(!Number.isFinite(scale)||scale<=0||!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||
  viewport.width<=0||viewport.height<=0)throw new Error('Invalid local PDF page dimensions.');
 const canvas=document.createElement('canvas');
 canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 const context=canvas.getContext('2d',{willReadFrequently:true});
 try{
  if(!context)throw new Error('Local layout canvas unavailable.');
  const task=page.render({canvas,canvasContext:context,viewport,annotationMode:0});
  const abort=()=>task.cancel();
  signal?.addEventListener('abort',abort,{once:true});
  try{
   await task.promise;
   if(signal?.aborted)throw new Error('PDF processing cancelled.');
   const pixels=context.getImageData(0,0,canvas.width,canvas.height);
   const result=await recognizer.recognize(pixels,signal);
   if(signal?.aborted)throw new Error('PDF processing cancelled.');
   return result;
  }finally{signal?.removeEventListener('abort',abort);}
 }finally{canvas.width=0;canvas.height=0;}
}
