import React from 'react';
import { normalizeDoi, safePublicHttps, type DocumentSummary, type DoiMetadata } from '@folio/core';
import { unresolvedReference, type DoiPlatform } from '@folio/platform';

export function DoiPanel({platform,referenceId,onSaved,onImported}:{
  platform:DoiPlatform; referenceId?:string;
  onSaved:(doc:DocumentSummary)=>Promise<void>;
  onImported:(doc:DocumentSummary)=>Promise<void>;
}) {
  const [input,setInput]=React.useState('');
  const [preview,setPreview]=React.useState<DoiMetadata|null>(null);
  const [linked,setLinked]=React.useState<string|undefined>();
  const [error,setError]=React.useState('');
  const [notice,setNotice]=React.useState('');
  const [busy,setBusy]=React.useState<'lookup'|'download'|null>(null);
  const controller=React.useRef<AbortController|null>(null);
  React.useEffect(()=>{
    let live=true;
    controller.current?.abort();controller.current=null;
    setPreview(null);setLinked(undefined);setError('');setNotice('');
    if(referenceId) void platform.readReference(referenceId).then(value=>{
      if(live){setPreview(value.metadata);setLinked(value.linkedDocumentId);setInput(value.metadata.doi);}
    }).catch(()=>{if(live)setError('Unable to load local DOI reference.');});
    return ()=>{live=false;controller.current?.abort();controller.current=null;};
  },[platform,referenceId]);
  async function lookup(){
    setError('');setNotice('');setPreview(null);
    try{normalizeDoi(input);}catch{setError('Invalid DOI.');return;}
    const pending=new AbortController();controller.current=pending;setBusy('lookup');
    const timeout=window.setTimeout(()=>pending.abort(),12000);
    try {
      const result=await platform.resolveDoi(input,pending.signal);
      if(pending.signal.aborted) throw new Error('cancelled');
      setPreview(result);
    } catch {
      if(controller.current===pending) setError(pending.signal.aborted?'DOI lookup cancelled or timed out.':'DOI lookup failed. Retry or save this DOI without verified metadata.');
    } finally {window.clearTimeout(timeout);if(controller.current===pending){controller.current=null;setBusy(null);}}
  }
  async function save(metadata:DoiMetadata) {
    setError('');setNotice('');
    try {
      const doc=await platform.saveReference(metadata);
      await onSaved(doc);
      setNotice('Reference saved locally.');
    } catch {setError('Unable to save local reference.');}
  }
  async function saveUnresolved(){
    try {await save(unresolvedReference(input));} catch {setError('Invalid DOI.');}
  }
  async function importPdf(metadata:DoiMetadata){
    const pending=new AbortController();controller.current=pending;setBusy('download');setError('');setNotice('');
    const timeout=window.setTimeout(()=>pending.abort(),30000);
    try {
      const ref=await platform.saveReference(metadata);
      await onSaved(ref);
      const pdf=await platform.importOpenPdf(ref.id,pending.signal);
      if(pending.signal.aborted) throw new Error('cancelled');
      await onImported(pdf);
      setLinked(pdf.id);
      setNotice('Open-access PDF imported locally.');
    } catch {
      if(controller.current===pending) setError(pending.signal.aborted?'PDF import cancelled or timed out.':
        'PDF import failed (source unavailable, CORS, format or local storage). Open the source and import the file manually.');
    } finally {window.clearTimeout(timeout);controller.current=null;setBusy(null);}
  }
  const source=preview&&safePublicHttps(preview.landingUrl);
  const oaLanding=preview&&safePublicHttps(preview.oa?.landingUrl);
  const oaPdf=preview&&safePublicHttps(preview.oa?.pdfUrl);
  return <section aria-label="DOI acquisition">
    <h2>{referenceId?'Saved DOI reference':'Find by DOI'}</h2>
    {!referenceId&&<form onSubmit={event=>{event.preventDefault();void lookup();}}>
      <label> DOI <input aria-label="DOI" value={input} disabled={busy!==null} onChange={event=>setInput(event.target.value)}
        placeholder="10.1000/xyz123 or https://doi.org/…"/></label>
      <button disabled={busy!==null} type="submit">Resolve DOI</button>
    </form>}
    <p>Lookup sends this DOI to Crossref, DataCite and (when metadata resolves) OpenAlex only after you select Resolve. No Folio server is involved.</p>
    {busy&&<p role="status">{busy==='lookup'?'Resolving DOI…':'Importing open-access PDF…'} <button onClick={()=>controller.current!.abort()}>Cancel request</button></p>}
    {error&&<p role="alert">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {!preview&&error&&!referenceId&&<button onClick={()=>void saveUnresolved()}>Save DOI only (unverified)</button>}
    {preview&&<article aria-label="DOI metadata">
      <h3>{preview.title}</h3>
      <p>DOI: {preview.doi} · Source: {preview.source}</p>
      <p>{preview.creators.join(', ') || 'Authors unavailable'}</p>
      <p>{[preview.containerTitle,preview.publisher,preview.year,preview.language].filter(Boolean).join(' · ')}</p>
      {source&&<p><a href={source} target="_blank" rel="noopener noreferrer">Open DOI / publisher page</a></p>}
      {preview.oa&&<p>Open-access discovery: {preview.oa.source}{preview.oa.license?' · Reported license: '+preview.oa.license:''}
        {oaLanding&&<> · <a href={oaLanding} target="_blank" rel="noopener noreferrer">Open-access source</a></>}
        {oaPdf&&<> · <a href={oaPdf} target="_blank" rel="noopener noreferrer">Open reported OA PDF</a></>}
      </p>}
      {!preview.oa&&<p>No verified open-access full-text link found. This reference can still be saved locally.</p>}
      {linked&&<p>Imported PDF: {linked}</p>}
      <button disabled={busy!==null} onClick={()=>void save(preview)}>Save metadata-only reference</button>
      {oaPdf&&<button disabled={busy!==null} onClick={()=>void importPdf(preview)}>Import open-access PDF</button>}
    </article>}
  </section>;
}
