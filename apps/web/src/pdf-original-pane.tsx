import React from 'react';
import * as pdfjs from 'pdfjs-dist';
import {EventBus,PDFLinkService,PDFViewer} from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import type {PdfBlock} from '@folio/core';
import {pickPdfBlockAtPoint} from './pdf-block-hit';
import type {ParsedPdf} from './pdf-extract';

/** Native selectable pages and source-block hit targets share the same source geometry. */
export function PdfOriginalPane({document,page=1,blocks=[],selectedBlockId='',onSelectBlock,onPageChange,onError}:{
 document:NonNullable<ParsedPdf['originalDocument']>;page?:number;
 blocks?:readonly PdfBlock[];selectedBlockId?:string;onSelectBlock?:(block:PdfBlock)=>void;
 onPageChange?:(page:number)=>void;onError?:(reason:string)=>void;
}){
 const host=React.useRef<HTMLDivElement>(null),viewer=React.useRef<PDFViewer|null>(null);
 const change=React.useRef(onPageChange),error=React.useRef(onError),select=React.useRef(onSelectBlock);
 const sourceBlocks=React.useRef(blocks),selected=React.useRef(selectedBlockId);
 const hovered=React.useRef(''),paint=React.useRef<()=>void>(()=>{});
 change.current=onPageChange;error.current=onError;select.current=onSelectBlock;
 sourceBlocks.current=blocks;selected.current=selectedBlockId;
 const pointerBlock=(target:EventTarget|null,clientX:number,clientY:number):PdfBlock|undefined=>{
  if(!(target instanceof Element))return undefined;
  const pageElement=target.closest<HTMLElement>('.page[data-page-number]');
  if(!pageElement||!host.current?.contains(pageElement))return undefined;
  const bounds=pageElement.getBoundingClientRect();
  if(bounds.width<=0||bounds.height<=0)return undefined;
  return pickPdfBlockAtPoint(sourceBlocks.current,Number(pageElement.dataset.pageNumber),
   (clientX-bounds.left)/bounds.width,(clientY-bounds.top)/bounds.height);
 };
 const choose=(e:React.MouseEvent<HTMLDivElement>)=>{
  // Preserve PDF.js' text layer: dragging to select words must never select a block.
  const selection=window.getSelection();
  if(selection&&!selection.isCollapsed&&host.current?.contains(selection.anchorNode))return;
  const block=pointerBlock(e.target,e.clientX,e.clientY);
  if(block)select.current?.(block);
 };
 const hover=(e:React.MouseEvent<HTMLDivElement>)=>{
  const id=pointerBlock(e.target,e.clientX,e.clientY)?.id??'';
  if(hovered.current!==id){hovered.current=id;paint.current();}
 };
 React.useEffect(()=>{
  const container=host.current!;
  const area=window.document.createElement('div');
  area.className='pdfViewer';
  container.append(area);
  const bus=new EventBus();
  const links=new PDFLinkService({eventBus:bus,externalLinkTarget:2});
  const reader=new PDFViewer({container,viewer:area,eventBus:bus,linkService:links,
   textLayerMode:1,annotationMode:pdfjs.AnnotationMode.ENABLE,removePageBorders:true,maxCanvasPixels:4*1024*1024,maxCanvasDim:4096});
  viewer.current=reader;
  links.setViewer(reader);
  let live=true;
  const paintBlocks=()=>{
   if(!live)return;
   for(const pageElement of area.querySelectorAll<HTMLElement>('.page[data-page-number]')){
    const number=Number(pageElement.dataset.pageNumber);
    let layer=pageElement.querySelector<HTMLElement>('.folio-pdf-block-regions');
    if(!layer){layer=window.document.createElement('div');layer.className='folio-pdf-block-regions';
     layer.setAttribute('aria-hidden','true');pageElement.append(layer);}
    layer.replaceChildren();
    for(const block of sourceBlocks.current.filter(b=>b.page===number)){
     const {x,y,width,height}=block.rect;
     if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)continue;
     const region=window.document.createElement('span');
     region.className='folio-pdf-block-region';
     region.dataset.blockId=block.id;
     region.style.left=(x*100)+'%';region.style.top=(y*100)+'%';
     region.style.width=(width*100)+'%';region.style.height=(height*100)+'%';
     if(block.id===selected.current)region.dataset.selected='true';
     if(block.id===hovered.current)region.dataset.hovered='true';
     layer.append(region);
    }
   }
  };
  paint.current=paintBlocks;
  const ready=()=>{
   reader.currentScaleValue='page-width';
   reader.currentPageNumber=Math.min(Math.max(1,Math.trunc(page)||1),document.numPages);
   paintBlocks();
  };
  const changed=(event:{pageNumber:number})=>{if(live)change.current?.(event.pageNumber);};
  bus.on('pagesinit',ready);bus.on('pagechanging',changed);bus.on('pagerendered',paintBlocks);
  try{reader.setDocument(document);links.setDocument(document);}catch(cause){
   error.current?.(cause instanceof Error?cause.message:'Original PDF viewer unavailable.');
  }
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(()=>{
   if(live&&reader.pagesCount>0)reader.currentScaleValue='page-width';
  });
  observer?.observe(container);
  return ()=>{
   live=false;observer?.disconnect();
   bus.off('pagesinit',ready);bus.off('pagechanging',changed);bus.off('pagerendered',paintBlocks);
   paint.current=()=>{};hovered.current='';
   reader.setDocument(null as never);links.setDocument(null);
   viewer.current=null;area.remove();
  };
 },[document]);
 React.useEffect(()=>{paint.current();},[blocks,selectedBlockId]);
 React.useEffect(()=>{
  const v=viewer.current!;
  if(v.pagesCount)v.currentPageNumber=Math.min(Math.max(1,Math.trunc(page)||1),v.pagesCount);
 },[page,document]);
 return <div className="folio-original-pdf-shell"><div className="folio-original-pdf" ref={host}
  aria-label="Original PDF pages" role="region" tabIndex={0}
  onClick={choose} onMouseMove={hover} onMouseLeave={()=>{hovered.current='';paint.current();}}/></div>;
}
