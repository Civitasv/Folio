import React from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import type {ParsedPdf} from './pdf-extract';
import {PdfOriginalPane} from './pdf-original-pane';
const mocks=vi.hoisted(()=>({
 buses:[] as Array<{on:ReturnType<typeof vi.fn>;off:ReturnType<typeof vi.fn>;emit:(name:string,event:unknown)=>void}>,
 viewers:[] as Array<{setDocument:ReturnType<typeof vi.fn>;pagesCount:number;currentScaleValue:string;currentPageNumber:number}>,
 links:[] as Array<{setViewer:ReturnType<typeof vi.fn>;setDocument:ReturnType<typeof vi.fn>}>,
 fail:false
}));
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
   if(mocks.fail&&doc)throw Error('Viewer initialization failed');
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
