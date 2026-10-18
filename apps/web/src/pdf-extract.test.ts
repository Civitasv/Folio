import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {parseLocalPdf} from './pdf-extract';
const destroy=vi.fn(async()=>{}),cleanup=vi.fn(),render=vi.fn(()=>({promise:Promise.resolve()}));
let numPages=1,items:unknown[]=[{str:'First source line',fontName:'f',transform:[1,0,0,20,100,700],width:160}];
let failRead=false;
const getPage=vi.fn(async()=>({
 getViewport:()=>({width:600,height:800,transform:[1,0,0,1,0,0]}),
 getTextContent:async()=>{if(failRead)throw Error('read failed');return {items,styles:{f:{ascent:.8}}};},
 cleanup,render
}));
const task=()=>({promise:Promise.resolve({numPages,getPage}),destroy});
vi.mock('pdfjs-dist',()=>({
 GlobalWorkerOptions:{workerSrc:''},
 Util:{transform:(_viewport:unknown,t:unknown)=>t},
 AnnotationMode:{DISABLE:0},
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
