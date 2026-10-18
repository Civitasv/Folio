import React from 'react';
import { DEFAULT_LANGUAGE_PREFERENCES, LANGUAGE_OPTIONS, TRANSLATION_PROMPT_VERSION,readingPairs,sourceMediaKind,boundedReadingIR,
 type PdfBlock,type PdfDocumentIR,type ReadingMode,type DocumentSummary,type TranslationProvider,
 type LanguagePreferences,type TranslationIdentity} from '@folio/core';
import {browserReaderModeStore,browserReaderLayoutStore,type ReaderModeStore,type ReaderLayoutStore,type TranslationPlatform} from '@folio/platform';
import {parseLocalPdf,pdfFailureMessage,type ParsedPdf} from './pdf-extract';
import {PdfOriginalPane} from './pdf-original-pane';

type ReaderTranslationPlatform=Pick<TranslationPlatform,'getLanguages'|'setLanguages'|'findTranslation'|'saveManualTranslation'|'translate'>;
export function sourceIdentity(doc:DocumentSummary,block:PdfBlock,prefs:LanguagePreferences,provider?:TranslationProvider):TranslationIdentity{
 const parentIndex=Number(block.id.match(/-b(\d+)/)?.[1]??0);
 return {documentId:doc.id,source:prefs.source,target:prefs.target,providerId:provider?.id??'manual',
  model:provider?.model??'local-draft',promptVersion:TRANSLATION_PROMPT_VERSION,
  unit:{anchor:{kind:'pdf',page:block.page},unitIndex:block.chunkIndex===undefined?parentIndex:parentIndex*100000+block.chunkIndex+1,text:block.text}};
}
export function NativePdfReader({doc,bytes,platform,provider,onLocation,modeStore=browserReaderModeStore,layoutStore=browserReaderLayoutStore}:{doc:DocumentSummary;bytes:Uint8Array;
 platform?:ReaderTranslationPlatform;provider?:TranslationProvider;onLocation?:(page:number)=>void;modeStore?:ReaderModeStore;layoutStore?:ReaderLayoutStore}){
 const [parsed,setParsed]=React.useState<ParsedPdf>();
 const [firstPage,setFirstPage]=React.useState<PdfDocumentIR>();
 const [sourceDocument,setSourceDocument]=React.useState<NonNullable<ParsedPdf['originalDocument']>>();
 const [pageProgress,setPageProgress]=React.useState('');
 const [parseError,setParseError]=React.useState('');
 const [retryCount,setRetryCount]=React.useState(0);
 const [mode,setMode]=React.useState<ReadingMode>(()=>modeStore.read(doc.id));
 const [layout,setLayout]=React.useState(()=>layoutStore.read(doc.id));
 const [originalPage,setOriginalPage]=React.useState(doc.progress);
 const updateLayout=(ratio:number,swapped:boolean)=>{
  const next={ratio,swapped};setLayout(next);layoutStore.write(doc.id,next);
 };
 const selectMode=(next:ReadingMode)=>{setMode(next);modeStore.write(doc.id,next);};
 const [prefs,setPrefs]=React.useState<LanguagePreferences>(DEFAULT_LANGUAGE_PREFERENCES);
 const [ready,setReady]=React.useState(false);
 const [translations,setTranslations]=React.useState<Map<string,string>>(new Map());
 const [drafts,setDrafts]=React.useState<Record<string,string>>({});
 const [activeBlock,setActiveBlock]=React.useState('');
 const [selectedBlockId,setSelectedBlockId]=React.useState('');
 const [busy,setBusy]=React.useState('');
 const [error,setError]=React.useState('');
 const [review,setReview]=React.useState<{page:number;image:string}>();
 const [media,setMedia]=React.useState<Map<string,string>>(new Map());
 const controller=React.useRef<AbortController|null>(null);
 const generation=React.useRef(0);
 const source=React.useRef<HTMLDivElement>(null),target=React.useRef<HTMLDivElement>(null),feed=React.useRef<HTMLDivElement>(null);
 React.useEffect(()=>{
  let live=true,docRef:ParsedPdf|undefined;const ctrl=new AbortController();
  setParsed(undefined);setFirstPage(undefined);setSourceDocument(undefined);setPageProgress('');setParseError('');setTranslations(new Map());setMedia(new Map());setReview(undefined);setSelectedBlockId('');
  void parseLocalPdf(doc.id,bytes,ctrl.signal,undefined,
   opened=>{if(live)setSourceDocument(opened);},
   (page,total)=>{if(live)setPageProgress('Extracting page '+page+' / '+total+' locally…');},
   preview=>{if(live)setFirstPage(preview);}).then(result=>{
   docRef=result;
   if(live){setParsed(result);setPageProgress('');}else void result.destroy();
  }).catch(error=>{
   if(live){setSourceDocument(undefined);setPageProgress('');console.error('[Folio] local PDF extraction failed',error);setParseError(pdfFailureMessage(error));}
  });
  return ()=>{live=false;generation.current++;ctrl.abort();if(docRef)void docRef.destroy();controller.current?.abort();};
 },[doc.id,bytes,retryCount]);
 React.useEffect(()=>{
  let live=true;setReady(false);
  if(!platform){setReady(true);return;}
  void platform.getLanguages().then(p=>{if(live){setPrefs(p);setReady(true);}}).catch(()=>{if(live){setError('Cannot load saved language settings.');setReady(true);}});
  return ()=>{live=false;};
 },[platform,doc.id]);
 const ir=parsed?.ir??firstPage;
 const content=React.useMemo(()=>ir?boundedReadingIR(ir):undefined,[ir]);
 React.useEffect(()=>{
  if(!parsed||!ir)return;
  let live=true;setMedia(new Map());
  void Promise.all(ir.blocks.filter(block=>sourceMediaKind(block.kind)&&block.mediaRect).map(async block=>{
   try{return [block.id,await parsed.regionImage(block.page,block.mediaRect!)] as const;}
   catch{return undefined;}
  })).then(items=>{if(live)setMedia(new Map(items.filter((x):x is readonly [string,string]=>!!x)));});
  return ()=>{live=false;};
 },[parsed,ir]);
 React.useEffect(()=>{
  if(!ready||!content||!platform)return;
  let live=true;setTranslations(new Map());
  void Promise.all(content.blocks.map(async block=>{
   if(sourceMediaKind(block.kind))return undefined;
   const identity=sourceIdentity(doc,block,prefs,provider);
   try{
    const result=(await platform.findTranslation(identity))??(provider?await platform.findTranslation(sourceIdentity(doc,block,prefs)):undefined);
    return result?[block.id,result.translatedText] as const:undefined;
   }
   catch{return undefined;}
  })).then(items=>{if(live)setTranslations(new Map(items.filter((x):x is readonly [string,string]=>!!x)));});
  return ()=>{live=false;};
 },[ready,content,platform,doc.id,prefs.source,prefs.target,provider?.id,provider?.model]);
 const pairs=content?readingPairs(content,translations):[];
 const selectedBlock=content?.blocks.find(block=>block.id===selectedBlockId);
 const blockLabel=(block:PdfBlock)=>block.text.trim()||block.sourceText?.trim()||block.kind;
 const locate=(id:string)=>{
  const node=feed.current?.querySelector<HTMLElement>('[data-block-id="'+id+'"]');
  node?.scrollIntoView?.({behavior:'auto',block:'center'});
 };
 async function changeLanguage(value:string){
  const epoch=++generation.current;
  controller.current?.abort();setBusy('');setError('');
  try{
   const updated=await platform!.setLanguages({...prefs,target:value});
   if(generation.current===epoch)setPrefs(updated);
  }catch{if(generation.current===epoch)setError('Unable to save target language.');}
 }
 const submit=async(block:PdfBlock,kind:'manual'|'provider')=>{
  // Rendered actions already require a supported unit and configured adapter.
  if(kind==='provider'&&!window.confirm('Send only this original block to '+provider!.id+'? '+(provider!.dataFlow??'This provider may use a remote service.')))return;
  const ctrl=new AbortController(),epoch=generation.current;
  controller.current=ctrl;setBusy(block.id);setError('');
  try{
   const identity=sourceIdentity(doc,block,prefs,kind==='provider'?provider:undefined);
   const saved=kind==='provider'?await platform!.translate(identity,provider!,ctrl.signal):
    await platform!.saveManualTranslation(identity,drafts[block.id]);
   if(generation.current!==epoch)return;
   if(ctrl.signal.aborted){setError('Translation cancelled.');return;}
   setTranslations(old=>new Map(old).set(block.id,saved.translatedText));
  }catch{if(generation.current===epoch)setError(ctrl.signal.aborted?'Translation cancelled.':'Unable to save or generate this block translation.');}
  finally{if(controller.current===ctrl){controller.current=null;setBusy('');}}
 };
 const reviewPage=async(page:number)=>{
  setError('');
  if(!parsed){setOriginalPage(page);return;}
  try{const image=await parsed.pageImage(page);setReview({page,image});}
  catch{setError('Original page could not be rendered.');}
 };
 const blockView=(block:PdfBlock)=> <div className={'folio-native-block folio-native-'+block.kind} key={block.id} data-block-id={block.id}
  data-selected={selectedBlockId===block.id?'true':undefined}
  role="group" aria-label={'Source block '+blockLabel(block)}
  onFocus={()=>onLocation?.(block.page)}
  onClick={()=>{if(mode==='interleaved')focus(block,'source');}}
  onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();focus(block,'source');}}} tabIndex={0}>
  {sourceMediaKind(block.kind)?media.has(block.id)?<img className="folio-native-figure-image" src={media.get(block.id)} alt={'Original scientific '+block.kind+' '+block.id}/>:<p role="status">Original figure region is loading or unavailable. Inspect the original page.</p>:
   block.kind==='title'?<h2>{block.text}</h2>:block.kind==='heading'?<h3>{block.text}</h3>:<p>{block.text}</p>}
  <button className="folio-native-source-link" type="button" aria-label={'Review original page '+block.page+' for '+block.id}
   onClick={event=>{event.stopPropagation();void reviewPage(block.page);}}>p. {block.page} · Check source</button>
 </div>;
 const targetView=(block:PdfBlock,targetText?:string)=> sourceMediaKind(block.kind)?
  mode==='interleaved'?null:<div key={block.id} className="folio-native-target-block folio-native-media-copy" data-block-id={block.id} data-selected={selectedBlockId===block.id?'true':undefined}>
   {media.has(block.id)?<img className="folio-native-figure-image" src={media.get(block.id)} alt={'Unmodified scientific '+block.kind+' '+block.id}/>:<p role="status">Original figure region is loading or unavailable.</p>}
  </div>:
  <div key={block.id} className="folio-native-target-block" data-block-id={block.id} data-selected={selectedBlockId===block.id?'true':undefined}>
  {targetText?<p lang={prefs.target} dir="auto">{targetText}</p>:<div className="folio-native-missing">
   <span>{busy===block.id?'Translating…':'Not translated'}</span>
   {platform&&<details open={activeBlock===block.id} onToggle={e=>setActiveBlock(e.currentTarget.open?block.id:'')}>
    <summary>Translate this block</summary>
    <label>Write translation <textarea aria-label={'Local translation '+block.id} value={drafts[block.id]??''}
      onChange={e=>setDrafts(old=>({...old,[block.id]:e.target.value}))}/></label>
    <button type="button" disabled={busy!==''||!(drafts[block.id]??'').trim()} onClick={()=>void submit(block,'manual')}>Save local translation</button>
    {provider&&<button type="button" disabled={busy!==''} onClick={()=>void submit(block,'provider')}>Translate with {provider.id}</button>}
    {busy===block.id&&<button type="button" onClick={()=>controller.current?.abort()}>Cancel</button>}
   </details>}
  </div>}
 </div>;
 const focus=(block:PdfBlock,side:'source'|'target')=>{
  setSelectedBlockId(block.id);
  onLocation?.(block.page);
  if(side==='target')setOriginalPage(block.page);
  if(mode==='parallel'){
   const other=(side==='source'?target:source).current?.querySelector<HTMLElement>('[data-block-id="'+block.id+'"]');
   other?.scrollIntoView?.({block:'center'});
  }else locate(block.id);
 };
 return <section className="folio-native-reader" aria-label="Structured paper reader">
  <header className="folio-native-tools">
   <div role="group" aria-label="Reading layout">
    <button type="button" aria-pressed={mode==='parallel'} onClick={()=>selectMode('parallel')}>Parallel · 双栏</button>
    <button type="button" aria-pressed={mode==='interleaved'} onClick={()=>selectMode('interleaved')}>Interleaved · 单栏</button>
   </div>
   {platform&&<label>Target <select aria-label="Target language" value={prefs.target} onChange={e=>void changeLanguage(e.target.value)}>
    {LANGUAGE_OPTIONS.filter(x=>x.tag!=='auto').map(x=><option key={x.tag} value={x.tag}>{x.label}</option>)}
   </select></label>}
   <span className="folio-native-status">{parsed&&content?content.blocks.length+' source blocks · local':pageProgress||parseError||'Opening local PDF…'}</span>
   {selectedBlock&&<div role="status" aria-live="polite" className="folio-selected-block-status" title={blockLabel(selectedBlock)}>
    Selected · p. {selectedBlock.page} · {blockLabel(selectedBlock)}
    <button type="button" onClick={()=>{setOriginalPage(selectedBlock.page);void reviewPage(selectedBlock.page);}}>Check source</button>
   </div>}
   {mode==='parallel'&&<><label>Left pane width <input aria-label="Left pane width" type="range" min={30} max={70} step={5} value={layout.ratio}
    onChange={e=>updateLayout(Number(e.target.value),layout.swapped)}/><span>{layout.ratio}%</span></label>
    <button type="button" aria-label="Swap source and translation panes" onClick={()=>updateLayout(layout.ratio,!layout.swapped)}>Swap sides</button></>}
  </header>
  {error&&<p role="alert" className="folio-native-error">{error}</p>}
  {parseError?<div role="alert" className="folio-native-error"><p>{parseError}</p><button type="button" onClick={()=>setRetryCount(n=>n+1)}>Retry local PDF reading</button></div>:!ir&&!sourceDocument?<p role="status" className="folio-native-loading">Opening local PDF…</p>:
  <>{ir&&<div className="folio-native-warnings">{ir.warnings.map(w=><p key={w} role="status">{w}</p>)}</div>}
   {ir&&!pairs.length&&<div className="folio-native-empty"><p>No selectable text detected. Scanned documents need an explicit OCR engine.</p>
    <button type="button" onClick={()=>void reviewPage(1)}>Inspect original page</button></div>}
   {mode==='parallel'?<div className="folio-native-parallel" style={{gridTemplateColumns:`minmax(0,${layout.ratio}fr) minmax(0,${100-layout.ratio}fr)`}}>
    <div className="folio-native-column folio-native-original-column" style={{order:layout.swapped?2:1}} ref={source} role="region" aria-label="Original article"><div className="folio-native-column-title">ORIGINAL · PDF</div>
     {(sourceDocument??parsed?.originalDocument)?<PdfOriginalPane document={(sourceDocument??parsed!.originalDocument)!} page={originalPage}
      blocks={content?.blocks??[]} selectedBlockId={selectedBlockId} onSelectBlock={block=>focus(block,'source')} onPageChange={page=>{
      setOriginalPage(page);onLocation?.(page);
      const candidate=content?.blocks.find(block=>block.id===selectedBlockId&&block.page===page)??content?.blocks.find(block=>block.page===page&&block.text.trim());
      if(candidate)target.current?.querySelector<HTMLElement>('[data-block-id="'+candidate.id+'"]')?.scrollIntoView?.({block:'nearest'});
     }} onError={setError}/>:
      <article>{pairs.map(p=><div key={p.block.id} onClick={()=>focus(p.block,'source')}>{blockView(p.block)}</div>)}</article>}
    </div>
    <div className="folio-native-column" style={{order:layout.swapped?1:2}} ref={target} role="region" aria-label="Translated article"><div className="folio-native-column-title">TRANSLATION</div>
     {ir?<article>{!parsed&&<p role="status" className="folio-native-progress">First-page blocks ready · {pageProgress}</p>}{pairs.map(p=><div key={p.block.id} onClick={()=>focus(p.block,'target')}
       onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();focus(p.block,'target');}}}
       role="group" aria-label={'Translation block '+blockLabel(p.block)} tabIndex={0} data-selected={selectedBlockId===p.block.id?'true':undefined}>{targetView(p.block,p.target)}</div>)}</article>:
      <p role="status" className="folio-native-loading">{pageProgress||'Preparing the structured translation…'}</p>}
    </div>
   </div>:!ir?<p role="status" className="folio-native-loading">{pageProgress||'Preparing interleaved reading…'}</p>:
    <div className="folio-native-feed" ref={feed} role="region" aria-label="Interleaved article"><article>{pairs.map(p=><section key={p.block.id} className="folio-native-pair" data-selected={selectedBlockId===p.block.id?'true':undefined}>
     <span className="folio-native-pair-label">ORIGINAL</span>{blockView(p.block)}
     <span className="folio-native-pair-label">TRANSLATION</span>{targetView(p.block,p.target)}
    </section>)}</article></div>}
  </>}
  {review&&<div role="dialog" aria-modal="true" aria-label={'Original PDF page '+review.page} className="folio-native-review">
   <div><strong>Original PDF · page {review.page}</strong><button type="button" onClick={()=>setReview(undefined)}>Close original page</button></div>
   <img alt={'Unmodified PDF page '+review.page} src={review.image}/>
  </div>}
 </section>;
}
