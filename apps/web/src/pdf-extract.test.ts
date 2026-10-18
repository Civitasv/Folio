import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {parseLocalPdf,ensurePromiseTry} from './pdf-extract';
const destroy=vi.fn(async()=>{}),cleanup=vi.fn(),render=vi.fn(()=>({promise:Promise.resolve()}));
let numPages=1,items:unknown[]=[{str:'First source line',fontName:'f',transform:[1,0,0,20,100,700],width:160}];
let failRead=false;
const getPage=vi.fn(async()=>({
 getViewport:()=>({width:600,height:800,transform:[1,0,0,1,0,0]}),
 getTextContent:async()=>{if(failRead)throw Error('read failed');return {items,styles:{f:{ascent:.8}}};},
 getOperatorList:async()=>({fnArray:[],argsArray:[]}),cleanup,render
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
 numPages=1;items=[{str:'First source line',fontName:'f',transform:[1,0,0,20,100,700],width:160}];failRead=false;
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
 render.mockImplementationOnce(()=>({promise:Promise.reject(new Error('raster failure'))}));
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
 render.mockImplementationOnce(()=>({promise:Promise.reject(new Error('region failed'))}));
 await expect(p.regionImage(1,rect)).rejects.toThrow('region failed');
 expect(cleanup).toHaveBeenCalled();
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValueOnce(null);
 await expect(p.regionImage(1,rect)).rejects.toThrow('Canvas rendering unavailable.');
 await p.destroy();
});
