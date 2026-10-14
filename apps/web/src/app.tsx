import React from 'react';
import { MAX_PDF_BYTES, preflightPdf, type ReaderPlatform, type DocumentSummary } from '@folio/core';
import { browserPlatform } from '@folio/platform';

export function App({ platform = browserPlatform }: { platform?: ReaderPlatform }) {
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [active, setActive] = React.useState<DocumentSummary | null>(null);
  const [reader, setReader] = React.useState<{ id: string; url: string } | null>(null);
  const [page, setPage] = React.useState('1');
  const [query, setQuery] = React.useState('');
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
    if (!active) { setReader(null); return; }
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
  }, [active?.id, platform]);
  async function importFile(file: File) {
    setError(''); setNotice(''); setBusy(true);
    try {
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
    } catch { setError('PDF import failed. Check available browser storage.'); }
    finally { setBusy(false); }
  }
  function open(doc: DocumentSummary) {
    setError(''); setPage(String(doc.progress)); setActive(doc);
  }
  async function remove(doc: DocumentSummary) {
    if (!window.confirm('Delete this PDF and its saved reading position from Folio?')) return;
    try {
      await platform.deletePdf(doc.id);
      if (active?.id === doc.id) { setActive(null); setReader(null); }
      setDocuments(await platform.listDocuments());
      setNotice('PDF deleted from the local library.');
    } catch { setError('Unable to delete the local PDF.'); }
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
  const filtered = documents.filter(doc => doc.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <main style={{maxWidth:960,margin:'64px auto',padding:24,fontFamily:'Georgia,serif',color:'#1f1f1f'}}>
    <h1 style={{fontSize:56,marginBottom:0}}>Folio.</h1><p style={{color:'#9c7a5b'}}>A quieter way to read.</p>
    <section aria-label="Import PDF" onDragOver={event => event.preventDefault()} onDrop={event => {
      event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void importFile(file);
    }}>
      <label>Import local PDF <input aria-label="Import PDF file" type="file" accept=".pdf,application/pdf" disabled={busy}
        onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value=''; }}/></label>
      <p>Or drop a PDF here. Files remain in this browser's local storage (up to 100 MiB per file).</p>
    </section>
    {busy && <p role="status">Importing locally…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <hr style={{border:'none',borderTop:'1px solid #ddd',margin:'40px 0'}}/>
    <h2>My Library</h2><label>Search titles <input aria-label="Search titles" value={query} onChange={event => setQuery(event.target.value)}/></label>
    {filtered.length ? <ul>{filtered.map(doc => <li key={doc.id}>
      <button onClick={() => open(doc)}>{doc.title}</button> — saved page {doc.progress}
      <button aria-label={'Delete '+doc.title} onClick={() => void remove(doc)}>Delete</button>
    </li>)}</ul> : <p>{query ? 'No matching PDFs.' : 'Your library is empty. Import a PDF to begin.'}</p>}
    {active && <section aria-label="PDF reader"><h2>Reading: {active.title}</h2>
      <button onClick={() => setActive(null)}>Close</button>
      <label> Page <input aria-label="Saved page" inputMode="numeric" type="number" min="1" step="1" value={page}
        onChange={event => setPage(event.target.value)}/></label>
      <button onClick={() => void savePage(active)}>Save page</button>
      {reader?.id === active.id ? <iframe title="PDF document" src={reader.url+'#page='+active.progress}
        style={{width:'100%',height:'75vh',border:'1px solid #ddd'}}/> : <p>Loading local PDF…</p>}
      <p>Browser preview uses the browser PDF viewer; save the page manually. Native reader and automatic tracking follow in later slices.</p>
    </section>}
  </main>;
}
