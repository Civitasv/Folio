import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {parseLocalPdf,ensurePromiseTry,PdfParseFailure,pdfFailureMessage} from './pdf-extract';
const destroy=vi.fn(async()=>{}),cleanup=vi.fn(),cancelRender=vi.fn(),render=vi.fn(()=>({promise:Promise.resolve(),cancel:cancelRender}));
let numPages=1,items:unknown[]=[{str:'First source line',fontName:'f',transform:[1,0,0,20,100,700],width:160}];
let failRead=false,failGraphics=false;
const getPage=vi.fn(async()=>({
 getViewport:()=>({width:600,height:800,transform:[1,0,0,1,0,0]}),
 getTextContent:async()=>{if(failRead)throw Error('read failed');return {items,styles:{f:{ascent:.8}}};},
 getOperatorList:async()=>{if(failGraphics)throw Error('graphics unavailable');return {fnArray:[],argsArray:[]};},cleanup,render
}));
const task=()=>({promise:Promise.resolve({numPages,getPage}),destroy});
vi.mock('pdfjs-dist/legacy/build/pdf.mjs',()=>({
 GlobalWorkerOptions:{workerSrc:''},
 Util:{transform:(_viewport:unknown,t:unknown)=>t},
 AnnotationMode:{DISABLE:0},
 OPS:{save:1,restore:2,transform:3,paintImageXObject:4,paintInlineImageXObject:5},
 getDocument:vi.fn(()=>task())
}));
beforeEach(()=>{
 destroy.mockClear();cleanup.mockClear();render.mockClear();getPage.mockClear();
 numPages=1;items=[{str:'First source line',fontName:'f',transform:[1,0,0,20,100,700],width:160}];failRead=false;failGraphics=false;
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({} as CanvasRenderingContext2D);
 vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/png;base64,AA==');
});
afterEach(()=>vi.restoreAllMocks());
it('extracts on-device page spans and produces a provenance-linked IR',async()=>{
 const pdf=await parseLocalPdf('sha256:id',new Uint8Array([37,80,68,70]));
 expect(pdf.ir.documentId).toBe('sha256:id');
 expect(pdf.ir.blocks[0].text).toBe('First source line');
 expect(pdf.ir.blocks[0].page).toBe(1);
 expect(pdf.ir.blocks[0].rect.x).toBeCloseTo(1/6);
 expect(await pdf.pageImage(1)).toBe('data:image/png;base64,AA==');
 expect(render).toHaveBeenCalledOnce();
 await pdf.destroy();await pdf.destroy();expect(destroy).toHaveBeenCalledOnce();
 await expect(pdf.pageImage(1)).rejects.toThrow('Original page unavailable.');
});
it('keeps missing text honest and rejects invalid fidelity page requests',async()=>{
 items=[{str:' ',fontName:'f',transform:[1,0,0,20,100,700],width:160}, {str:'',fontName:'f',transform:[1,0,0,20,100,700],width:160}];
 const p=await parseLocalPdf('id',new Uint8Array([37,80,68,70]));
 expect(p.ir.blocks).toHaveLength(0);
 expect(p.ir.warnings[0]).toContain('no selectable text');
 await expect(p.pageImage(0)).rejects.toThrow('Original page unavailable.');
 await expect(p.pageImage(1.3)).rejects.toThrow('Original page unavailable.');
 await expect(p.pageImage(2)).rejects.toThrow('Original page unavailable.');
 await p.destroy();
});
it('reports explicit cancellation and parsing failures',async()=>{
 const ctrl=new AbortController();ctrl.abort();
 await expect(parseLocalPdf('id',new Uint8Array(1),ctrl.signal)).rejects.toThrow('PDF processing cancelled.');
 failRead=true;
 await expect(parseLocalPdf('id',new Uint8Array(1))).rejects.toThrow('read failed');
});
it('fails clearly when native canvas is unavailable',async()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 const pdf=await parseLocalPdf('id',new Uint8Array(1));
 await expect(pdf.pageImage(1)).rejects.toThrow('Canvas rendering unavailable.');
 await pdf.destroy();
});


it('supports explicit signal lifetime and uses a safe font-ascent fallback on malformed PDF fonts',async()=>{
 const ctrl=new AbortController();
 items=[{missing:'str'}, {str:'Fallback metrics',fontName:'missing',transform:[1,0,0,20,100,700],width:100}];
 const p=await parseLocalPdf('id',new Uint8Array(1),ctrl.signal);
 expect(p.ir.blocks).toHaveLength(1);
 expect(p.ir.blocks[0].text).toBe('Fallback metrics');
 await p.destroy();
 expect(destroy).toHaveBeenCalledOnce();
 ctrl.abort();expect(destroy).toHaveBeenCalledOnce();
});
it('aborts between pages and cleans up a failed signal-bound PDF task',async()=>{
 const ctrl=new AbortController();numPages=2;
 getPage.mockImplementationOnce(async()=>{
  ctrl.abort();
  return {getViewport:()=>({width:600,height:800,transform:[1,0,0,1,0,0]}),
   getTextContent:async()=>({items,styles:{f:{ascent:.8}}}),getOperatorList:async()=>({fnArray:[],argsArray:[]}),cleanup,render};
 });
 await expect(parseLocalPdf('id',new Uint8Array(1),ctrl.signal)).rejects.toThrow('PDF processing cancelled.');
 expect(destroy).toHaveBeenCalled();
 const other=new AbortController();failRead=true;
 await expect(parseLocalPdf('id',new Uint8Array(1),other.signal)).rejects.toThrow('read failed');
});
it('releases a source page after a failed canvas rasterization',async()=>{
 const p=await parseLocalPdf('id',new Uint8Array(1));
 render.mockImplementationOnce(()=>({promise:Promise.reject(new Error('raster failure')),cancel:cancelRender}));
 await expect(p.pageImage(1)).rejects.toThrow('raster failure');
 expect(cleanup).toHaveBeenCalled();
 await p.destroy();
});

it('provides Promise.try synchronous-call and rejection semantics only when missing',async()=>{
 const original=Object.getOwnPropertyDescriptor(Promise,'try');
 try{
  Object.defineProperty(Promise,'try',{configurable:true,writable:true,value:undefined});
  ensurePromiseTry();
  const impl=(Promise as PromiseConstructor & {try:<T>(fn:(n:number)=>T,n:number)=>Promise<Awaited<T>>}).try;
  expect(typeof impl).toBe('function');
  await expect(impl((n:number)=>n+1,4)).resolves.toBe(5);
  await expect(impl(()=>{throw new Error('sync failure');},0)).rejects.toThrow('sync failure');
  const first=(Promise as PromiseConstructor & {try:unknown}).try;
  ensurePromiseTry();
  expect((Promise as PromiseConstructor & {try:unknown}).try).toBe(first);
 }finally{
  if(original)Object.defineProperty(Promise,'try',original);
  else Reflect.deleteProperty(Promise,'try');
 }
});

it('renders an exact normalized media region from the source page and validates requested crop bounds',async()=>{
 const p=await parseLocalPdf('figure',new Uint8Array(1));
 const rect={x:.1,y:.2,width:.3,height:.4};
 expect(await p.regionImage(1,rect)).toBe('data:image/png;base64,AA==');
 expect(render).toHaveBeenCalledWith(expect.objectContaining({
  transform:expect.any(Array),
  annotationMode:0
 }));
 for(const invalid of [
  {x:-.1,y:.1,width:.3,height:.2},{x:0,y:0,width:0,height:.2},
  {x:.9,y:0,width:.3,height:.2},{x:0,y:0,width:NaN,height:.2}
 ])await expect(p.regionImage(1,invalid)).rejects.toThrow('Source image region unavailable.');
 await expect(p.regionImage(2,rect)).rejects.toThrow('Source image region unavailable.');
 await expect(p.regionImage(1.4,rect)).rejects.toThrow('Source image region unavailable.');
 await p.destroy();
 await expect(p.regionImage(1,rect)).rejects.toThrow('Source image region unavailable.');
});
it('cleans region-render canvas even when source rendering fails',async()=>{
 const p=await parseLocalPdf('figure',new Uint8Array(1));
 const rect={x:.1,y:.2,width:.3,height:.4};
 render.mockImplementationOnce(()=>({promise:Promise.reject(new Error('region failed')),cancel:cancelRender}));
 await expect(p.regionImage(1,rect)).rejects.toThrow('region failed');
 expect(cleanup).toHaveBeenCalled();
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValueOnce(null);
 await expect(p.regionImage(1,rect)).rejects.toThrow('Canvas rendering unavailable.');
 await p.destroy();
});

it('preserves extracted text when inspecting PDF graphics fails',async()=>{
 failGraphics=true;
 const result=await parseLocalPdf('original:one',new Uint8Array(1));
 expect(result.ir.blocks.map(block=>block.text)).toContain('First source line');
 expect(result.ir.warnings).toContain('Page 1: graphics inspection unavailable; verify figures using the original page.');
 await result.destroy();
});
it('retains readable later pages when an earlier text layer cannot be decoded',async()=>{
 numPages=2;
 getPage.mockImplementationOnce(async()=>({
  getViewport:()=>({width:600,height:800,transform:[1,0,0,1,0,0]}),
  getTextContent:async()=>{throw Error('broken first text layer');},
  getOperatorList:async()=>({fnArray:[],argsArray:[]}),cleanup,render
 }));
 const result=await parseLocalPdf('original:two',new Uint8Array(1));
 expect(result.ir.blocks.map(block=>block.page)).toEqual([2]);
 expect(result.ir.warnings).toContain('Page 1: text extraction failed; source-page review remains available.');
 await result.destroy();
});
it('reports a meaningful stage when every text layer fails and retains original error after destroy failure',async()=>{
 failRead=true;
 destroy.mockRejectedValueOnce(new Error('destroy failed'));
 await expect(parseLocalPdf('original:all',new Uint8Array(1))).rejects.toThrow('Extracting text from all pages: read failed');
});
it('classifies and bounds local PDF diagnostics without exposing document bytes',()=>{
 const issue=new PdfParseFailure('Opening document',new Error('Worker not loaded'));
 expect(issue.name).toBe('PdfParseFailure');
 expect(pdfFailureMessage(issue)).toContain('Opening document: Worker not loaded');
 expect(pdfFailureMessage('load failure')).toContain('load failure');
 expect(pdfFailureMessage({cause:'unknown'})).toContain('Unknown PDF engine error');
 expect(pdfFailureMessage(new Error('x'.repeat(900))).length).toBeLessThan(460);
 expect(new PdfParseFailure('Reading page 2',undefined).message).toContain('Unknown PDF engine error');
});

it('formats string and empty native PDF failures without losing stage provenance',()=>{
 expect(new PdfParseFailure('Opening document','native worker failed').message).toContain('native worker failed');
 expect(new PdfParseFailure('Opening document','  ').message).toContain('Unknown PDF engine error');
});
it('cancels immediately when user aborts inside an in-flight page text request',async()=>{
 const ctrl=new AbortController();
 getPage.mockImplementationOnce(async()=>({
  getViewport:()=>({width:600,height:800,transform:[1,0,0,1,0,0]}),
  getTextContent:async()=>{ctrl.abort();throw Error('interrupted text');},
  getOperatorList:async()=>({fnArray:[],argsArray:[]}),cleanup,render
 }));
 await expect(parseLocalPdf('cancel:text',new Uint8Array(1),ctrl.signal)).rejects.toThrow('PDF processing cancelled.');
 expect(cleanup).toHaveBeenCalled();
});
it('cancels immediately when user aborts during graphics processing',async()=>{
 const ctrl=new AbortController();
 getPage.mockImplementationOnce(async()=>({
  getViewport:()=>({width:600,height:800,transform:[1,0,0,1,0,0]}),
  getTextContent:async()=>({items,styles:{f:{ascent:.8}}}),
  getOperatorList:async()=>{ctrl.abort();throw Error('interrupted graphics');},cleanup,render
 }));
 await expect(parseLocalPdf('cancel:graphics',new Uint8Array(1),ctrl.signal)).rejects.toThrow('PDF processing cancelled.');
 expect(cleanup).toHaveBeenCalled();
});
it('reports an all-page failure even when an engine rejects without a cause',async()=>{
 getPage.mockImplementationOnce(async()=>({
  getViewport:()=>({width:600,height:800,transform:[1,0,0,1,0,0]}),
  getTextContent:async()=>Promise.reject(undefined),
  getOperatorList:async()=>({fnArray:[],argsArray:[]}),cleanup,render
 }));
 await expect(parseLocalPdf('invalid:error',new Uint8Array(1))).rejects.toThrow('No page text could be read');
});

it('integrates expressly installed local region predictions as source-only scientific crops',async()=>{
 const context={getImageData:vi.fn(()=>({data:new Uint8ClampedArray(4),width:1,height:1}))};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
 const detector={modelId:'signed-local-test-model',recognize:vi.fn(async()=>[{
  label:'table' as const,rect:{x:.1,y:.3,width:.65,height:.22},confidence:.94,order:1
 }])};
 const parsed=await parseLocalPdf('science:one',new Uint8Array(1),undefined,detector);
 expect(detector.recognize).toHaveBeenCalledOnce();
 expect(parsed.ir.blocks.some(b=>b.kind==='table'&&b.mediaRect?.width===.65)).toBe(true);
 await parsed.destroy();
});
it('retains source reading after an installed local recognizer fails',async()=>{
 const context={getImageData:vi.fn(()=>({data:new Uint8ClampedArray(4),width:1,height:1}))};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
 const detector={modelId:'absent',recognize:vi.fn(async()=>{throw Error('model unavailable');})};
 const parsed=await parseLocalPdf('science:fallback',new Uint8Array(1),undefined,detector);
 expect(parsed.ir.blocks[0].text).toBe('First source line');
 expect(parsed.ir.warnings).toContain('Page 1: local layout detection unavailable; fallback source reading retained.');
 await parsed.destroy();
});
it('does not swallow explicit cancellation during local detector inference',async()=>{
 const controller=new AbortController();
 const context={getImageData:vi.fn(()=>({data:new Uint8ClampedArray(4),width:1,height:1}))};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
 const detector={modelId:'local',recognize:vi.fn(async()=>{controller.abort();throw Error('stopped locally');})};
 await expect(parseLocalPdf('science:abort',new Uint8Array(1),controller.signal,detector)).rejects.toThrow('PDF processing cancelled.');
});

it('preserves a real vector grid as one original-region table asset when caption evidence exists',async()=>{
 const width=600,height=800,data=new Uint8ClampedArray(width*height*4);data.fill(255);
 const ink=(x:number,y:number)=>{const pos=(y*width+x)*4;data[pos]=0;data[pos+1]=0;data[pos+2]=0;};
 for(const y of [120,140,160,180])for(let x=80;x<=450;x++)ink(x,y);
 for(const x of [80,240,450])for(let y=120;y<=180;y++)ink(x,y);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({
  getImageData:()=>({width,height,data})
 } as unknown as CanvasRenderingContext2D);
 items=[{str:'Table 7. Duration of disease',fontName:'f',transform:[1,0,0,20,70,105],width:240}];
 const p=await parseLocalPdf('table-with-grid',new Uint8Array(1));
 expect(p.ir.blocks.some(block=>block.kind==='table'&&block.mediaRect!.width>.5)).toBe(true);
 expect(p.ir.blocks.some(block=>block.kind==='caption'&&block.text.startsWith('Table 7'))).toBe(true);
 expect(p.ir.warnings.some(w=>w.includes('PDF table grid is not yet reconstructed'))).toBe(false);
 await p.destroy();
});
it('retains printed table caption when grid evidence is insufficient rather than guessing scientific cells',async()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({
  getImageData:()=>({width:600,height:800,data:new Uint8ClampedArray(600*800*4)})
 } as unknown as CanvasRenderingContext2D);
 items=[{str:'Table 4. Measured values',fontName:'f',transform:[1,0,0,20,70,105],width:240}];
 const p=await parseLocalPdf('table-without-grid',new Uint8Array(1));
 expect(p.ir.blocks.some(block=>block.kind==='table')).toBe(false);
 expect(p.ir.blocks.some(block=>block.kind==='caption')).toBe(true);
 expect(p.ir.warnings.some(w=>w.includes('PDF table grid'))).toBe(true);
 await p.destroy();
});
