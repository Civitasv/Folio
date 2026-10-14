import React from 'react';
import { chapterCfi, type DocumentSummary, type EpubTocItem } from '@folio/core';
import type { EpubReaderPlatform, EpubTheme, SavedEpub } from '@folio/platform';

const themes: Record<EpubTheme,{background:string;color:string}> = {
  light:{background:'#fff',color:'#202020'},
  sepia:{background:'#f6efe0',color:'#493c29'},
  dark:{background:'#222',color:'#f3f0e9'}
};
/** Publisher HTML is already allowlist-sanitized in core; sandbox forbids scripts and remote resources. */
export function EpubReader({doc,platform,onRefresh}:{doc:DocumentSummary;platform:EpubReaderPlatform;onRefresh:()=>Promise<void>}) {
  const [saved,setSaved] = React.useState<SavedEpub|null>(null);
  const [error,setError] = React.useState('');
  const [busy,setBusy] = React.useState(false);
  React.useEffect(()=>{
    let live=true;
    setSaved(null);setError('');
    void platform.readEpub(doc.id).then(book=>{if(live)setSaved(book);}).catch(()=>{if(live)setError('Unable to open EPUB.');});
    return ()=>{live=false;};
  },[doc.id,platform]);
  async function navigate(index:number) {
    if(!saved || index<0 || index>=saved.book.chapters.length)return;
    setBusy(true);setError('');
    try{
      const anchor={kind:'epub' as const,spineIndex:index,cfi:chapterCfi(index)};
      await platform.setEpubLocation(doc.id,anchor);
      setSaved({...saved,anchor});
      await onRefresh();
    }catch{setError('Unable to save EPUB reading position.');}
    finally{setBusy(false);}
  }
  async function prefs(fontSize:number,theme:EpubTheme){
    if(!saved)return;
    setBusy(true);setError('');
    try{
      const preferences={fontSize,theme};
      await platform.setEpubPreferences(doc.id,preferences);
      setSaved({...saved,preferences});
    }catch{setError('Unable to save reader appearance.');}
    finally{setBusy(false);}
  }
  if(!saved)return <section aria-label="EPUB reader">{error ? <p role="alert">{error}</p> : <p>Loading EPUB…</p>}</section>;
  const chapters=saved.book.chapters;
  const index=saved.anchor.spineIndex;
  const chapter=saved.book.chapters[index];
  const style=themes[saved.preferences.theme];
  const html='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data:; style-src &#39;unsafe-inline&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;"><style>html{background:'+style.background+';color:'+style.color+';font-family:Georgia,serif;font-size:'+saved.preferences.fontSize+'px;line-height:1.7}body{max-width:45em;margin:2em auto;padding:0 1em}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>'+chapter.html+'</body></html>';
  function tocButtons(items:EpubTocItem[]):React.ReactNode {
    return items.map((item,i)=>{
      const dest=chapters.findIndex(part=>part.href===item.href);
      return <li key={item.href+item.label+i}>{dest>=0?<button disabled={busy} onClick={()=>void navigate(dest)}>{item.label}</button>:<span>{item.label}</span>}
        {item.children.length>0&&<ul>{tocButtons(item.children)}</ul>}</li>;
    });
  }
  return <section aria-label="EPUB reader">
    <h3>{saved.book.metadata.title || doc.title}</h3>
    <p>{saved.book.metadata.creators.join(', ')}</p>
    <nav aria-label="EPUB chapters"><button disabled={busy||index===0} onClick={()=>void navigate(index-1)}>Previous chapter</button>
      <span> Chapter {index+1} of {saved.book.chapters.length} </span>
      <button disabled={busy||index===saved.book.chapters.length-1} onClick={()=>void navigate(index+1)}>Next chapter</button></nav>
    <div><label>Font size <input aria-label="EPUB font size" type="range" min="14" max="26" step="1" disabled={busy}
      value={saved.preferences.fontSize} onChange={event=>void prefs(Number(event.target.value),saved.preferences.theme)}/></label>
      <label> Theme <select aria-label="EPUB theme" disabled={busy} value={saved.preferences.theme}
        onChange={event=>void prefs(saved.preferences.fontSize,event.target.value as EpubTheme)}>
        <option value="light">Light</option><option value="sepia">Sepia</option><option value="dark">Dark</option></select></label></div>
    {error&&<p role="alert">{error}</p>}
    <iframe title="EPUB chapter" sandbox="" referrerPolicy="no-referrer" srcDoc={html}
      style={{width:'100%',height:'70vh',border:'1px solid #ddd'}} />
    <details><summary>Table of contents</summary>
      <ul>{saved.book.metadata.toc.length?tocButtons(saved.book.metadata.toc):saved.book.chapters.map((part,i)=><li key={part.id}>
        <button disabled={busy} onClick={()=>void navigate(i)}>Chapter {i+1}</button></li>)}</ul></details>
    <p>Reading position is saved locally by chapter; publication scripts, styles and remote resources are disabled.</p>
  </section>;
}
