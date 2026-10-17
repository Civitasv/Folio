import React from 'react';
import { MAX_PDF_BYTES, preflightPdf, type ReaderPlatform, type DocumentSummary, type TranslationProvider } from '@folio/core';
import { universalPlatform, type EpubReaderPlatform, type DoiPlatform, type TranslationPlatform } from '@folio/platform';
import { DoiPanel } from './doi-panel';
import { EpubReader } from './epub-reader';
import { TranslationPanel } from './translation-panel';
import {WorkspaceShell, WorkspaceToolbar, SidebarItem, Surface} from '@folio/ui';

export function App({ platform = universalPlatform,translationProvider }: { platform?: ReaderPlatform & Partial<EpubReaderPlatform> & Partial<DoiPlatform> & Partial<TranslationPlatform>;translationProvider?:TranslationProvider }) {
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [active, setActive] = React.useState<DocumentSummary | null>(null);
  const [reader, setReader] = React.useState<{ id: string; url: string } | null>(null);
  const [page, setPage] = React.useState('1');
  const [query, setQuery] = React.useState('');
  const [kindFilter,setKindFilter] = React.useState<'all'|'pdf'|'epub'|'reference'>('all');
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState(false);
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
      if (active?.id === doc.id) { setActive(null); setReader(null); }
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
  return <WorkspaceShell navigation={<div className="folio-navigation-content">
      <div className="folio-brand"><h1>Folio<span>.</span></h1><p>A quieter way to read.</p></div>
      <nav aria-label="Library filters" className="folio-library-filters">
        <SidebarItem active={kindFilter==='all'} label="All items" onClick={()=>{setKindFilter('all');setActive(null);}}/>
        <SidebarItem active={kindFilter==='pdf'} label="PDF" onClick={()=>{setKindFilter('pdf');setActive(null);}}/>
        <SidebarItem active={kindFilter==='epub'} label="EPUB" onClick={()=>{setKindFilter('epub');setActive(null);}}/>
        <SidebarItem active={kindFilter==='reference'} label="DOI references" onClick={()=>{setKindFilter('reference');setActive(null);}}/>
      </nav>
      <p className="folio-nav-footnote">Your documents stay on this device.</p>
    </div>} inspector={<div className="folio-inspector-content">
      {active && active.kind!=='reference' ? <Surface title="Document information">
        <p className="folio-inspector-summary">Selected · {active.title}</p>
        <dl className="folio-metadata"><dt>Format</dt><dd>{active.kind==='epub'?'EPUB':'PDF'}</dd>
          <dt>Reading position</dt><dd>{active.progress}</dd></dl>
        <p className="folio-inspector-note">Reader-specific translation tools remain alongside the existing reader until D01c.</p>
      </Surface> : doiPanel}
    </div>}>
    <main className="folio-content">
    <WorkspaceToolbar title={active ? 'Reading workspace' : 'Library workspace'} actions={<span className="folio-local-state">Local-first</span>}/>
    <section className="folio-import" aria-label="Import PDF" onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void importFile(file);
    }}>
      <label>Import local PDF or EPUB <input aria-label="Import PDF file" type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" disabled={busy}
        onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value=''; }}/></label>
      <p>Or drop a PDF or EPUB here. Files remain in this browser's local storage (up to 100 MiB per file).</p>
    </section>
    {busy && <p role="status">Importing locally…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}

    <section className="folio-library-list" aria-label="My Library"><h2>My Library</h2><label className="folio-search-label">Search titles <input aria-label="Search titles" value={query} onChange={event => setQuery(event.target.value)}/></label>
    {filtered.length ? <ul className="folio-document-list">{filtered.map(doc => <li className="folio-document-row" key={doc.id}>
      <button onClick={() => open(doc)}>{doc.title}</button> — {doc.kind==='reference' ? 'DOI reference' : doc.kind==='epub' ? 'EPUB chapter '+doc.progress : 'saved page '+doc.progress}{doc.creators?.length ? ' — '+doc.creators.join(', ') : ''}
      <button aria-label={'Delete '+doc.title} onClick={() => void remove(doc)}>Delete</button>
    </li>)}</ul> : <p>{query ? 'No matching documents.' : 'Your library is empty. Import a PDF to begin.'}</p>}</section>
    {active && (active.kind==='reference' ? <section aria-label="Reference selected"><button onClick={() => setActive(null)}>Close reference</button></section> : active.kind==='epub' && platform.importEpub && platform.readEpub && platform.setEpubLocation && platform.setEpubPreferences ? <section aria-label="EPUB book"><h2>Reading: {active.title}</h2><button onClick={() => setActive(null)}>Close</button><EpubReader doc={active} platform={platform as EpubReaderPlatform} onRefresh={async () => setDocuments(await platform.listDocuments())}
        translationPlatform={platform.getLanguages&&platform.setLanguages&&platform.findTranslation&&platform.saveManualTranslation&&platform.translate&&platform.deleteTranslations ? platform as TranslationPlatform:undefined} translationProvider={translationProvider}/></section> : <section aria-label="PDF reader"><h2>Reading: {active.title}</h2>
      <button onClick={() => setActive(null)}>Close</button>
      <label> Page <input aria-label="Saved page" inputMode="numeric" type="number" min="1" step="1" value={page}
        onChange={event => setPage(event.target.value)}/></label>
      <button onClick={() => void savePage(active)}>Save page</button>
      {reader?.id === active.id ? <iframe title="PDF document" src={reader.url+'#page='+active.progress}
        style={{width:'100%',height:'75vh',border:'1px solid #ddd'}}/> : <p>Loading local PDF…</p>}
      <p>Browser preview uses the browser PDF viewer; save the page manually. Native reader and automatic tracking follow in later slices.</p>
      {platform.getLanguages&&platform.setLanguages&&platform.findTranslation&&platform.saveManualTranslation&&platform.translate&&platform.deleteTranslations&&
        <TranslationPanel doc={active} platform={platform as TranslationPlatform} provider={translationProvider}/>}
    </section>)}
  </main></WorkspaceShell>;
}
