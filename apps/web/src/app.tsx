import React from 'react';
import { MAX_PDF_BYTES, preflightPdf, type ReaderPlatform, type DocumentSummary, type TranslationProvider } from '@folio/core';
import { universalPlatform, type EpubReaderPlatform, type DoiPlatform, type TranslationPlatform } from '@folio/platform';
import { DoiPanel } from './doi-panel';
import { EpubReader } from './epub-reader';
import { TranslationPanel } from './translation-panel';
import {WorkspaceShell, WorkspaceToolbar, SidebarItem, Surface} from '@folio/ui';

export function App({ platform = universalPlatform,translationProvider,onOpenSettings }: { platform?: ReaderPlatform & Partial<EpubReaderPlatform> & Partial<DoiPlatform> & Partial<TranslationPlatform>;translationProvider?:TranslationProvider;onOpenSettings?:()=>void }) {
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [active, setActive] = React.useState<DocumentSummary | null>(null);
  const [reader, setReader] = React.useState<{ id: string; url: string } | null>(null);
  const [page, setPage] = React.useState('1');
  const [query, setQuery] = React.useState('');
  const [kindFilter,setKindFilter] = React.useState<'all'|'pdf'|'epub'|'reference'>('all');
  const [translationHost,setTranslationHost] = React.useState<HTMLElement|null>(null);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [navigationOpen,setNavigationOpen] = React.useState(true);
  const [inspectorOpen,setInspectorOpen] = React.useState(true);
  React.useEffect(() => {
    let mounted = true;
    void platform.listDocuments().then(items => { if (mounted) setDocuments(items); })
      .catch(() => { if (mounted) setError('Unable to open the local library.'); });
    return () => { mounted = false; };
  }, [platform]);
  React.useEffect(() => {
    if (!active || active.kind === 'epub' || active.kind === 'reference') { setReader(null); return; }
    let disposed = false;
    let objectUrl: string | undefined;
    setReader(null);
    void platform.readPdf(active.id).then(bytes => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      setReader({ id: active.id, url: objectUrl });
    }).catch(() => { if (!disposed) setError('Unable to open this PDF.'); });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [active?.id, active?.kind, platform]);
  async function importFile(file: File) {
    setError(''); setNotice(''); setBusy(true);
    const epub = /\.epub$/i.test(file.name) || file.type === 'application/epub+zip';
    try {
      if (epub) {
        if (file.size > MAX_PDF_BYTES) { setError('EPUB import rejected: too_large'); return; }
        if (!platform.importEpub) { setError('EPUB import is unavailable on this platform.'); return; }
        const data = new Uint8Array(await file.arrayBuffer());
        const doc = await platform.importEpub(file.name, data);
        const duplicate = documents.some(item => item.id === doc.id);
        setDocuments(await platform.listDocuments());
        setActive(doc);
        setNotice(duplicate ? 'This EPUB is already in your library.' : 'EPUB imported locally.');
        return;
      }
      if (file.size > MAX_PDF_BYTES) { setError('PDF import rejected: too_large'); return; }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const check = preflightPdf(bytes);
      if (!check.ok) { setError('PDF import rejected: ' + check.error); return; }
      const doc = await platform.importPdf(file.name, bytes);
      const duplicate = documents.some(item => item.id === doc.id);
      setDocuments(await platform.listDocuments());
      setPage(String(doc.progress));
      setActive(doc);
      setNotice(duplicate ? 'This PDF is already in your library.' : 'PDF imported locally.');
    } catch { setError(epub ? 'EPUB import failed. The file may be invalid, unsupported or exceed local storage.' : 'PDF import failed. Check available browser storage.'); }
    finally { setBusy(false); }
  }
  function open(doc: DocumentSummary) {
    setError(''); setPage(String(doc.progress)); setActive(doc);
  }
  async function remove(doc: DocumentSummary) {
    if (!window.confirm('Delete this document and its saved reading position from Folio?')) return;
    try {
      await platform.deletePdf(doc.id);
      if(platform.deleteTranslations)await platform.deleteTranslations(doc.id);
      if (active?.id === doc.id) { returnToLibrary(); setReader(null); }
      setDocuments(await platform.listDocuments());
      setNotice(doc.kind === 'reference' ? 'DOI reference deleted from the local library.' : doc.kind === 'epub' ? 'EPUB deleted from the local library.' : 'PDF deleted from the local library.');
    } catch { setError('Unable to delete the local document.'); }
  }
  async function savePage(doc: DocumentSummary) {
    const value = Number(page);
    if (!Number.isSafeInteger(value) || value < 1) { setError('Enter a valid page number (1 or greater).'); return; }
    try {
      await platform.setProgress(doc.id, value);
      setActive({ ...doc, progress: value });
      setDocuments(await platform.listDocuments());
      setError(''); setNotice('Reading position saved.');
    } catch { setError('Could not save reading position.'); }
  }
  const filtered = documents.filter(doc => (
    (kindFilter === 'all' || (kindFilter === 'pdf' ? doc.kind !== 'epub' && doc.kind !== 'reference' : doc.kind === kindFilter)) &&
    (doc.title + ' ' + (doc.creators??[]).join(' ') + ' ' + (doc.doi??'')).toLocaleLowerCase().includes(query.toLocaleLowerCase())
  ));
  const hasDoi=platform.resolveDoi && platform.saveReference && platform.readReference && platform.importOpenPdf;
  const doiPanel=hasDoi && <DoiPanel
      key={active?.kind==='reference' ? active.id : 'new'} platform={platform as DoiPlatform} referenceId={active?.kind==='reference' ? active.id : undefined}
      onSaved={async () => { setDocuments(await platform.listDocuments()); }}
      onImported={async doc => { setDocuments(await platform.listDocuments()); setActive(doc); setPage(String(doc.progress)); }}/>;
  function returnToLibrary(){setActive(null);setNavigationOpen(true);setInspectorOpen(true);}
  function pickFile(event:React.ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];
    if(file)void importFile(file);
    event.target.value='';
  }
  const picker=<input aria-label="Import PDF file" type="file" accept=".pdf,.epub,application/pdf,application/epub+zip"
    disabled={busy} onChange={pickFile}/>;
  function libraryList(compact:boolean){
    return <section className={compact?'folio-library-list folio-library-list--compact':'folio-library-list'} aria-label="My Library">
      {!compact&&<div className="folio-section-heading"><div><p className="folio-eyebrow">ON THIS DEVICE</p><h2>My Library</h2></div>
        <span className="folio-count">{documents.length} {documents.length===1?'item':'items'}</span></div>}
      {compact&&<h2 className="folio-nav-section-heading">Your library</h2>}
      <label className="folio-search-label">Search titles <input aria-label="Search titles" placeholder="Find a paper…" value={query}
        onChange={event=>setQuery(event.target.value)}/></label>
      {filtered.length?<ul className="folio-document-list">{filtered.map(doc=><li className="folio-document-row" key={doc.id}>
        <span className="folio-document-kind">{doc.kind==='reference'?'DOI':doc.kind==='epub'?'EPUB':'PDF'}</span>
        <div className="folio-document-detail"><button className={active?.id===doc.id?'is-current':''} onClick={()=>open(doc)}>{doc.title}</button>
          <span>{doc.kind==='reference'?'Metadata only':doc.kind==='epub'?'EPUB chapter '+doc.progress:'saved page '+doc.progress}
            {doc.creators?.length?' · '+doc.creators.join(', '):''}</span></div>
        <button className="folio-delete" aria-label={'Delete '+doc.title} onClick={()=>void remove(doc)}>Delete</button>
      </li>)}</ul>:<p className="folio-empty-list">{query?'No matching documents.':'Your library is empty. Import a PDF to begin.'}</p>}
    </section>;
  }
  if(active && active.kind!=='reference' && active.kind!=='epub') return <div className="folio-app folio-app--pdf-focus">
    <header className="folio-focus-header">
      <button className="folio-focus-back" type="button" aria-label="Back to library" onClick={returnToLibrary}>← Library</button>
      <h1 title={active.title}>{active.title}</h1>
      <span className="folio-focus-local">Local-first</span>
      <details className="folio-focus-more"><summary>More</summary><div>
        <label>Add a document {picker}</label>
        <button type="button" aria-label={'Delete '+active.title} onClick={()=>void remove(active)}>Delete document</button>
      </div></details>
      {onOpenSettings&&<button className="folio-settings-trigger" type="button" onClick={event=>{event.currentTarget.focus();onOpenSettings();}}>Settings</button>}
    </header>
    {(busy||error||notice)&&<div className="folio-focus-feedback">
      {busy&&<p role="status">Importing locally…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    </div>}
    <main className="folio-pdf-focus" aria-label="PDF reader">
      <section className="folio-focus-source" aria-label="Original PDF">
        <div className="folio-focus-pane-heading"><strong>Original PDF</strong><div>
          <label>Page <input aria-label="Saved page" inputMode="numeric" type="number" min="1" step="1" value={page}
            onChange={event=>setPage(event.target.value)}/></label>
          <button type="button" onClick={()=>void savePage(active)}>Save page</button>
        </div></div>
        {reader?.id===active.id?<iframe title="PDF document" src={reader.url+'#page='+active.progress}/>:
          <p className="folio-focus-placeholder">Loading local PDF…</p>}
      </section>
      <section className="folio-focus-target" aria-label="Target translation pane">
        {platform.getLanguages&&platform.setLanguages&&platform.findTranslation&&platform.saveManualTranslation&&platform.translate&&platform.deleteTranslations?
          <TranslationPanel doc={active} platform={platform as TranslationPlatform} provider={translationProvider} layout="target-pane"/>:
          <div className="folio-focus-placeholder"><h2>Translation unavailable</h2><p>This platform does not provide a translation store. The original PDF remains readable.</p></div>}
      </section>
    </main>
  </div>;

  return <div className={'folio-app'+(active?' folio-app--reading':'')+(!navigationOpen?' navigation-collapsed':'')+(!inspectorOpen?' inspector-collapsed':'')}>
    <WorkspaceShell navigation={<div className="folio-navigation-content">
      <div className="folio-brand"><h1>Folio<span>.</span></h1><p>Read deeper. Think further.</p></div>
      {active&&<button className="folio-navigation-back" aria-label="Back to library" type="button" onClick={returnToLibrary}>← Back to library</button>}
      <nav aria-label="Library filters" className="folio-library-filters">
        <SidebarItem active={kindFilter==='all'} label="All items" onClick={()=>{setKindFilter('all');returnToLibrary();}}/>
        <SidebarItem active={kindFilter==='pdf'} label="PDF" onClick={()=>{setKindFilter('pdf');returnToLibrary();}}/>
        <SidebarItem active={kindFilter==='epub'} label="EPUB" onClick={()=>{setKindFilter('epub');returnToLibrary();}}/>
        <SidebarItem active={kindFilter==='reference'} label="DOI references" onClick={()=>{setKindFilter('reference');returnToLibrary();}}/>
      </nav>
      {active&&libraryList(true)}
      <p className="folio-nav-footnote">A private reading space. Your documents stay on this device.</p>
    </div>} inspector={<div className="folio-inspector-content">
      {active&&active.kind!=='reference'?<Surface title="Document information">
        <p className="folio-inspector-summary">Selected · {active.title}</p>
        <dl className="folio-metadata"><dt>Format</dt><dd>{active.kind==='epub'?'EPUB':'PDF'}</dd>
          <dt>Reading position</dt><dd>{active.progress}</dd></dl>
      </Surface>:active?.kind==='reference'?doiPanel:<div className="folio-inspector-intro">
        <p className="folio-eyebrow">YOUR READING SPACE</p><h2>Focus on what matters.</h2>
        <p>Open a document to read. Context and translation tools appear alongside the source, only when available.</p>
        <p>Local files remain on this device.</p></div>}
      {active?.kind==='epub'&&<div className="folio-translation-slot" ref={setTranslationHost}/>}

    </div>}>
    <main className={active?'folio-content has-active-reader':'folio-content'}>
      <WorkspaceToolbar title={active?'Reading workspace':'Library'} actions={<>
        {active&&<button className="folio-chrome-action" type="button" onClick={()=>setNavigationOpen(value=>!value)}
          aria-expanded={navigationOpen}>{navigationOpen?'Hide library':'Show library'}</button>}
        {active&&<button className="folio-chrome-action" type="button" onClick={()=>setInspectorOpen(value=>!value)}
          aria-expanded={inspectorOpen}>{inspectorOpen?'Hide details':'Show details'}</button>}
        <span className="folio-local-state">Local-first</span>
        {onOpenSettings&&<button className="folio-settings-trigger" type="button"
          onClick={event=>{event.currentTarget.focus();onOpenSettings();}}>Settings</button>}</>}/>
      {busy&&<p className="folio-feedback" role="status">Importing locally…</p>}
      {error&&<p className="folio-feedback folio-error" role="alert">{error}</p>}
      {notice&&<p className="folio-feedback" role="status">{notice}</p>}
      {active?.kind==='reference'?<section className="folio-reference-selection folio-reader" aria-label="Reference selected">
        <div className="folio-reader-heading"><div><p className="folio-eyebrow">SAVED REFERENCE</p><h2>{active.title}</h2>
          <p>Metadata only. Import an open-access PDF explicitly to begin full-text reading.</p></div>
          <button type="button" onClick={returnToLibrary}>Close reference</button></div>
      </section>:active?.kind==='epub'&&platform.importEpub&&platform.readEpub&&platform.setEpubLocation&&platform.setEpubPreferences?
        <section className="folio-epub-book folio-reader" aria-label="EPUB book">
          <div className="folio-reader-heading"><div><p className="folio-eyebrow">EPUB · LOCAL DOCUMENT</p><h2>Reading: {active.title}</h2></div>
            <div className="folio-reader-actions"><button onClick={returnToLibrary}>Close</button>
              <label className="folio-inline-import">Add a document {picker}</label></div></div>
          <EpubReader doc={active} platform={platform as EpubReaderPlatform}
            onRefresh={async()=>setDocuments(await platform.listDocuments())}
            translationPlatform={platform.getLanguages&&platform.setLanguages&&platform.findTranslation&&platform.saveManualTranslation&&platform.translate&&platform.deleteTranslations?platform as TranslationPlatform:undefined}
            translationProvider={translationProvider} translationHost={translationHost}/>
        </section>:

        <div className="folio-library-home">
          <header className="folio-library-hero"><p className="folio-eyebrow">YOUR READING WORKSPACE</p>
            <h2>Make room for understanding.</h2>
            <p>Bring in a paper, return to where you left off, and keep your reading on your device.</p></header>
          <section className="folio-import" aria-label="Import PDF" onDragOver={event=>event.preventDefault()}
            onDrop={event=>{event.preventDefault();const file=event.dataTransfer.files[0];if(file)void importFile(file);}}>
            <div><h3>Add a document</h3><p>PDF and EPUB · stored locally · up to 100 MiB per file</p></div>
            <label>Import local PDF or EPUB {picker}</label>
            <p>Or drop a PDF or EPUB here. Files remain in this browser's local storage (up to 100 MiB per file).</p>
          </section>
          {libraryList(false)}
          {doiPanel&&<section id="folio-doi" className="folio-doi-acquisition">{doiPanel}</section>}
        </div>}
    </main>
  </WorkspaceShell></div>;
}
