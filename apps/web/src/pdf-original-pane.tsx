import React from 'react';
import {EventBus,PDFLinkService,PDFViewer} from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import type {ParsedPdf} from './pdf-extract';

/** Selectable original PDF pages, owned by Folio. No iframe, URL or second PDF parse. */
export function PdfOriginalPane({document,page=1,onPageChange,onError}:{
 document:NonNullable<ParsedPdf['originalDocument']>;page?:number;
 onPageChange?:(page:number)=>void;onError?:(reason:string)=>void;
}){
 const host=React.useRef<HTMLDivElement>(null),viewer=React.useRef<PDFViewer|null>(null);
 const change=React.useRef(onPageChange),error=React.useRef(onError);
 change.current=onPageChange;error.current=onError;
 React.useEffect(()=>{
  const container=host.current!;
  const area=window.document.createElement('div');
  area.className='pdfViewer';
  container.append(area);
  const bus=new EventBus();
  const links=new PDFLinkService({eventBus:bus,externalLinkTarget:2});
  const reader=new PDFViewer({container,viewer:area,eventBus:bus,linkService:links,
   textLayerMode:1,annotationMode:0,removePageBorders:true,maxCanvasPixels:4*1024*1024,maxCanvasDim:4096});
  viewer.current=reader;
  links.setViewer(reader);
  let live=true;
  const ready=()=>{
   reader.currentScaleValue='page-width';
   reader.currentPageNumber=Math.min(Math.max(1,Math.trunc(page)||1),document.numPages);
  };
  const changed=(event:{pageNumber:number})=>{if(live)change.current?.(event.pageNumber);};
  bus.on('pagesinit',ready);bus.on('pagechanging',changed);
  try{reader.setDocument(document);links.setDocument(document);}catch(cause){
   error.current?.(cause instanceof Error?cause.message:'Original PDF viewer unavailable.');
  }
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{
   if(live&&reader.pagesCount>0)reader.currentScaleValue='page-width';
  });
  observer?.observe(container);
  return ()=>{
   live=false;observer?.disconnect();
   bus.off('pagesinit',ready);bus.off('pagechanging',changed);
   // PDF.js accepts null to release pages; its TypeScript signature is narrower.
   reader.setDocument(null as never);links.setDocument(null);
   viewer.current=null;area.remove();
  };
 },[document]);
 React.useEffect(()=>{
  const v=viewer.current!;
  if(v.pagesCount)v.currentPageNumber=Math.min(Math.max(1,Math.trunc(page)||1),v.pagesCount);
 },[page,document]);
 return <div className="folio-original-pdf" ref={host} aria-label="Original PDF pages" role="region" tabIndex={0}/>;
}
