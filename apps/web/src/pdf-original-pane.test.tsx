import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import type {ParsedPdf} from './pdf-extract';
import {PdfOriginalPane} from './pdf-original-pane';
const mocks=vi.hoisted(()=>({
 buses:[] as Array<{on:ReturnType<typeof vi.fn>;off:ReturnType<typeof vi.fn>;emit:(name:string,event:unknown)=>void}>,
 viewers:[] as Array<{setDocument:ReturnType<typeof vi.fn>;pagesCount:number;currentScaleValue:string;currentPageNumber:number}>,
 links:[] as Array<{setViewer:ReturnType<typeof vi.fn>;setDocument:ReturnType<typeof vi.fn>}>,
 fail:false as boolean|'string'
}));
vi.mock('pdfjs-dist',()=>({AnnotationMode:{ENABLE:1}}));
vi.mock('pdfjs-dist/web/pdf_viewer.mjs',()=>({
 EventBus:class{
  listeners=new Map<string,Array<(v:unknown)=>void>>();
  on=vi.fn((name:string,listener:(v:unknown)=>void)=>{
   this.listeners.set(name,[...(this.listeners.get(name)??[]),listener]);
  });
  off=vi.fn((name:string,listener:(v:unknown)=>void)=>{
   this.listeners.set(name,(this.listeners.get(name)??[]).filter(x=>x!==listener));
  });
  emit=(name:string,event:unknown)=>this.listeners.get(name)?.forEach(fn=>fn(event));
  constructor(){mocks.buses.push(this);}
 },
 PDFLinkService:class{
  setViewer=vi.fn();setDocument=vi.fn();
  constructor(){mocks.links.push(this);}
 },
 PDFViewer:class{
  currentScaleValue='';currentPageNumber=1;pagesCount=3;
  setDocument=vi.fn((doc:unknown)=>{
   if(mocks.fail&&doc)throw mocks.fail==='string'?'viewer thrown string':Error('Viewer initialization failed');
  });
  constructor(){mocks.viewers.push(this);}
 }
}));
const pdf={numPages:3} as NonNullable<ParsedPdf['originalDocument']>;
beforeEach(()=>{mocks.buses.length=0;mocks.viewers.length=0;mocks.links.length=0;mocks.fail=false;});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('mounts PDF.js viewer with selectable original-page host and reuses source proxy',()=>{
 const location=vi.fn();
 const v=render(<PdfOriginalPane document={pdf} page={2} onPageChange={location}/>);
 const source=screen.getByRole('region',{name:'Original PDF pages'});
 expect(source.querySelector('.pdfViewer')).toBeTruthy();
 expect(mocks.viewers[0].setDocument).toHaveBeenCalledWith(pdf);
 expect(mocks.links[0].setViewer).toHaveBeenCalledWith(mocks.viewers[0]);
 expect(mocks.links[0].setDocument).toHaveBeenCalledWith(pdf);
 mocks.buses[0].emit('pagesinit',{});
 expect(mocks.viewers[0].currentScaleValue).toBe('page-width');
 expect(mocks.viewers[0].currentPageNumber).toBe(2);
 mocks.buses[0].emit('pagechanging',{pageNumber:3});
 expect(location).toHaveBeenCalledWith(3);
 v.rerender(<PdfOriginalPane document={pdf} page={1} onPageChange={location}/>);
 expect(mocks.viewers).toHaveLength(1);
 expect(mocks.viewers[0].currentPageNumber).toBe(1);
 v.unmount();
 expect(mocks.viewers[0].setDocument).toHaveBeenLastCalledWith(null);
 expect(mocks.links[0].setDocument).toHaveBeenLastCalledWith(null);
 expect(mocks.buses[0].off).toHaveBeenCalledTimes(2);
 expect(source.querySelector('.pdfViewer')).toBeNull();
});
it('bounds source page and ignores post-unmount viewer events',()=>{
 const fn=vi.fn(),v=render(<PdfOriginalPane document={pdf} page={99} onPageChange={fn}/>);
 mocks.buses[0].emit('pagesinit',{});
 expect(mocks.viewers[0].currentPageNumber).toBe(3);
 v.rerender(<PdfOriginalPane document={pdf} page={-1} onPageChange={fn}/>);
 expect(mocks.viewers[0].currentPageNumber).toBe(1);
 v.unmount();
 mocks.buses[0].emit('pagechanging',{pageNumber:2});
 expect(fn).not.toHaveBeenCalled();
});
it('reports PDF.js initialization errors without losing the local source',()=>{
 mocks.fail=true;const error=vi.fn(),v=render(<PdfOriginalPane document={pdf} onError={error}/>);
 expect(error).toHaveBeenCalledWith('Viewer initialization failed');
 v.unmount();
});
it('supports resize-based fit to original page width when observer exists',()=>{
 const observe=vi.fn(),disconnect=vi.fn();let update!:()=>void;
 vi.stubGlobal('ResizeObserver',class{
  constructor(callback:()=>void){update=callback;}
  observe=observe;disconnect=disconnect;
 });
 const v=render(<PdfOriginalPane document={pdf}/>);
 expect(observe).toHaveBeenCalledOnce();
 update();
 expect(mocks.viewers[0].currentScaleValue).toBe('page-width');
 v.unmount();
 expect(disconnect).toHaveBeenCalledOnce();
});

it('defaults an invalid zero page to one and skips page update until the viewer owns pages',()=>{
 const v=render(<PdfOriginalPane document={pdf} page={0}/>);
 mocks.buses[0].emit('pagesinit',{});
 expect(mocks.viewers[0].currentPageNumber).toBe(1);
 mocks.viewers[0].pagesCount=0;
 v.rerender(<PdfOriginalPane document={pdf} page={2}/>);
 expect(mocks.viewers[0].currentPageNumber).toBe(1);
 v.unmount();
});
it('normalizes non-Error PDF.js initialization failures for the user',()=>{
 mocks.fail='string';const onError=vi.fn();
 const v=render(<PdfOriginalPane document={pdf} onError={onError}/>);
 expect(onError).toHaveBeenCalledWith('Original PDF viewer unavailable.');
 v.unmount();
});

it('picks the source block from original PDF page coordinates and highlights the same ID',()=>{
 const a={id:'p1-b1',page:1,kind:'paragraph' as const,text:'Source paragraph',confidence:.9,rect:{x:.1,y:.2,width:.5,height:.07}};
 const choose=vi.fn();
 const view=render(<PdfOriginalPane document={pdf} page={1} blocks={[a]} onSelectBlock={choose}/>);
 const host=screen.getByRole('region',{name:'Original PDF pages'}),area=host.querySelector('.pdfViewer')!;
 const page=document.createElement('div');page.className='page';page.dataset.pageNumber='1';area.append(page);
 vi.spyOn(page,'getBoundingClientRect').mockReturnValue({left:50,top:100,width:600,height:800,right:650,bottom:900,x:50,y:100,toJSON:()=>({})});
 mocks.buses[0].emit('pagerendered',{pageNumber:1});
 expect(page.querySelector('.folio-pdf-block-region')?.getAttribute('data-block-id')).toBe('p1-b1');
 fireEvent.mouseMove(page,{clientX:170,clientY:285});
 expect(page.querySelector('[data-hovered=true]')).toBeTruthy();
 fireEvent.click(page,{clientX:170,clientY:285});
 expect(choose).toHaveBeenCalledWith(a);
 view.rerender(<PdfOriginalPane document={pdf} blocks={[a]} selectedBlockId="p1-b1" onSelectBlock={choose}/>);
 expect(page.querySelector('[data-selected=true]')).toBeTruthy();
 expect(page.querySelector('.folio-pdf-block-regions')?.getAttribute('aria-hidden')).toBe('true');
 fireEvent.mouseLeave(host);
 expect(page.querySelector('[data-hovered=true]')).toBeNull();
 view.unmount();
});
it('keeps text dragging/copy selection native, and ignores unrecognized page clicks',()=>{
 const a={id:'p1-b1',page:1,kind:'paragraph' as const,text:'Source paragraph',confidence:.9,rect:{x:.1,y:.2,width:.5,height:.07}};
 const choose=vi.fn(),view=render(<PdfOriginalPane document={pdf} blocks={[a]} onSelectBlock={choose}/>);
 const host=screen.getByRole('region',{name:'Original PDF pages'}),area=host.querySelector('.pdfViewer')!;
 const page=document.createElement('div');page.className='page';page.dataset.pageNumber='1';area.append(page);
 vi.spyOn(page,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:500,height:500,right:500,bottom:500,x:0,y:0,toJSON:()=>({})});
 const selection=vi.spyOn(window,'getSelection').mockReturnValue({isCollapsed:false,anchorNode:page} as Selection);
 fireEvent.click(page,{clientX:100,clientY:110});expect(choose).not.toHaveBeenCalled();
 selection.mockReturnValue(null);
 fireEvent.click(page,{clientX:400,clientY:400});expect(choose).not.toHaveBeenCalled();
 page.dataset.pageNumber='2';
 fireEvent.click(page,{clientX:100,clientY:110});expect(choose).not.toHaveBeenCalled();
 view.unmount();
});
it('repaints block marks when rendered source pages arrive late, without reinitializing PDFViewer',()=>{
 const a={id:'p2-b1',page:2,kind:'caption' as const,text:'Figure 1',confidence:.9,rect:{x:.1,y:.2,width:.5,height:.07}};
 const view=render(<PdfOriginalPane document={pdf} blocks={[a]} selectedBlockId={a.id}/>);
 const host=screen.getByRole('region',{name:'Original PDF pages'}),page=document.createElement('div');
 page.className='page';page.dataset.pageNumber='2';host.querySelector('.pdfViewer')!.append(page);
 mocks.buses[0].emit('pagesinit',{});
 expect(page.querySelector('[data-selected=true]')?.getAttribute('data-block-id')).toBe('p2-b1');
 view.rerender(<PdfOriginalPane document={pdf} blocks={[]} selectedBlockId=""/>);
 expect(page.querySelectorAll('.folio-pdf-block-region')).toHaveLength(0);
 expect(mocks.viewers).toHaveLength(1);
 view.unmount();
});
