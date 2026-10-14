import React from 'react';
import { createRoot } from 'react-dom/client';
import { preflightPdf } from '@folio/core';
import { browserPlatform } from '@folio/platform';

type Entry = { id: string; title: string; progress: number };
function App() {
  const [documents, setDocuments] = React.useState<Entry[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  React.useEffect(() => { void browserPlatform.listDocuments().then(setDocuments).catch(() => setError('Unable to open the local library.')); }, []);
  React.useEffect(() => {
    let objectUrl: string | null = null;
    let disposed = false;
    if (active) void browserPlatform.readPdf(active).then(bytes => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
      setUrl(objectUrl);
    }).catch(() => setError('Unable to open this PDF.'));
    else setUrl(null);
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [active]);
  async function importFile(file: File) {
    setError('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const check = preflightPdf(bytes);
      if (!check.ok) { setError('PDF import rejected: ' + check.error); return; }
      const doc = await browserPlatform.importPdf(file.name, bytes);
      setDocuments(await browserPlatform.listDocuments());
      setPage(Math.max(1, Math.round(doc.progress)));
      setActive(doc.id);
    } catch { setError('PDF import failed. Check available browser storage.'); }
  }
  async function open(doc: Entry) { setPage(Math.max(1, Math.round(doc.progress))); setError(''); setUrl(null); setActive(doc.id); }
  async function savePage(value: number) {
    if (!active) return;
    const next = Math.max(1, Math.floor(value) || 1);
    setPage(next);
    try { await browserPlatform.setProgress(active, next); setDocuments(await browserPlatform.listDocuments()); }
    catch { setError('Could not save reading position.'); }
  }
  return <main style={{maxWidth:960,margin:'64px auto',padding:24,fontFamily:'Georgia,serif',color:'#1f1f1f'}}>
    <h1 style={{fontSize:56,marginBottom:0}}>Folio.</h1><p style={{color:'#9c7a5b'}}>A quieter way to read.</p>
    <label>Import local PDF <input aria-label="Import PDF" type="file" accept=".pdf,application/pdf" onChange={e => { const file=e.target.files?.[0]; if(file) void importFile(file); e.target.value=''; }}/></label>
    {error && <p role="alert">{error}</p>}
    <hr style={{border:'none',borderTop:'1px solid #ddd',margin:'40px 0'}}/>
    <h2>My Library</h2>{documents.length ? <ul>{documents.map(doc => <li key={doc.id}><button onClick={() => void open(doc)}>{doc.title}</button> — saved position {doc.progress}</li>)}</ul> : <p>Your library is empty. Import a PDF to begin.</p>}
    {active && <section aria-label="PDF reader"><h2>Reading</h2><button onClick={() => setActive(null)}>Close</button><label> Saved page <input type="number" min="1" value={page} onChange={e => void savePage(Number(e.target.value))}/></label>{url ? <iframe title="PDF document" src={url+'#page='+page} style={{width:'100%',height:'75vh',border:'1px solid #ddd'}}/> : <p>Loading local PDF…</p>}<p>Browser preview uses the browser's built-in PDF viewer. Page position is manually saved; PDF.js navigation and native SQLite follow in subsequent slices.</p></section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
