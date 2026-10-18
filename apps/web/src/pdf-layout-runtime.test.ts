import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {PDFPageProxy} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {detectLocalPageLayout,type LocalLayoutRecognizer} from './pdf-layout-runtime';
const cancel=vi.fn(),render=vi.fn((_options:unknown)=>({promise:Promise.resolve(),cancel}));
const view=vi.fn(({scale}:{scale:number})=>({width:600*scale,height:800*scale}));
const page={getViewport:view,render} as unknown as PDFPageProxy;
const read=vi.fn(()=>({data:new Uint8ClampedArray(4),width:1,height:1}));
const recognize=vi.fn(async()=>[{label:'table' as const,rect:{x:.1,y:.1,width:.6,height:.4},confidence:.92,order:1}]);
const engine:LocalLayoutRecognizer={modelId:'locally-verified-layout-model',recognize};
beforeEach(()=>{
 cancel.mockClear();render.mockClear();view.mockClear();recognize.mockClear();read.mockClear();
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({getImageData:read} as unknown as CanvasRenderingContext2D);
});
afterEach(()=>vi.restoreAllMocks());
it('provides bounded ephemeral page pixels only to the user-supplied local recognizer',async()=>{
 const result=await detectLocalPageLayout(page,engine);
 expect(result[0].label).toBe('table');
 expect(view).toHaveBeenCalledWith({scale:1});
 expect(view.mock.calls[1][0].scale).toBeCloseTo(1.375);
 expect(read).toHaveBeenCalledWith(0,0,825,1100);
 expect(recognize).toHaveBeenCalledOnce();
 expect(render).toHaveBeenCalledWith(expect.objectContaining({annotationMode:0}));
 const canvas=(render.mock.calls[0][0] as {canvas:HTMLCanvasElement}).canvas;
 expect(canvas.width).toBe(0);expect(canvas.height).toBe(0);
});
it('cancels before rasterization if requested',async()=>{
 const controller=new AbortController();controller.abort();
 await expect(detectLocalPageLayout(page,engine,controller.signal)).rejects.toThrow('PDF processing cancelled.');
 expect(render).not.toHaveBeenCalled();expect(recognize).not.toHaveBeenCalled();
});
it('rejects invalid source page dimensions without allocating an inference buffer',async()=>{
 const bad={getViewport:vi.fn(()=>({width:Infinity,height:800}))} as unknown as PDFPageProxy;
 await expect(detectLocalPageLayout(bad,engine)).rejects.toThrow('Invalid local PDF page dimensions.');
});
it('gives a diagnosable error for inaccessible canvas and always releases allocated dimensions',async()=>{
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValueOnce(null);
 await expect(detectLocalPageLayout(page,engine)).rejects.toThrow('Local layout canvas unavailable.');
 expect(recognize).not.toHaveBeenCalled();
});
it('retains a render failure and propagates a detector failure without retrying remotely',async()=>{
 render.mockImplementationOnce(()=>({promise:Promise.reject(new Error('PDF paint failed')),cancel}));
 await expect(detectLocalPageLayout(page,engine)).rejects.toThrow('PDF paint failed');
 recognize.mockRejectedValueOnce(new Error('local model absent'));
 await expect(detectLocalPageLayout(page,engine)).rejects.toThrow('local model absent');
 expect(recognize).toHaveBeenCalledOnce();
});
it('cancels an in-flight local render and propagates a cancellation after inference',async()=>{
 const controller=new AbortController();
 render.mockImplementationOnce(()=>({promise:(async()=>{controller.abort();return;})(),cancel}));
 await expect(detectLocalPageLayout(page,engine,controller.signal)).rejects.toThrow('PDF processing cancelled.');
 expect(cancel).toHaveBeenCalledOnce();
 const next=new AbortController();
 recognize.mockImplementationOnce(async()=>{next.abort();return [];});
 await expect(detectLocalPageLayout(page,engine,next.signal)).rejects.toThrow('PDF processing cancelled.');
});
