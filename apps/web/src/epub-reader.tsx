import React from 'react';
import { chapterCfi,epubContentUnits, type DocumentSummary, type EpubTocItem, type TranslationProvider } from '@folio/core';
import type { EpubReaderPlatform, EpubTheme, SavedEpub, TranslationPlatform } from '@folio/platform';

import {TranslationPanel} from './translation-panel';
const themes: Record<EpubTheme,{background:string;color:string}> = {
  light:{background:'#fff',color:'#202020'},
  sepia:{background:'#f6efe0',color:'#493c29'},
  dark:{background:'#222',color:'#f3f0e9'}
};
/** Publisher HTML is already allowlist-sanitized in core; sandbox forbids scripts and remote resources. */
export function EpubReader({doc,platform,onRefresh,translationPlatform,translationProvider}:{doc:DocumentSummary;platform:EpubReaderPlatform;onRefresh:()=>Promise<void>;translationPlatform?:TranslationPlatform;translationProvider?:TranslationProvider}) {
  const [saved,setSaved] = React.useState<SavedEpub|null>(null);
  const [error,setError] = React.useState('');
  const [busy,setBusy] = React.useState(false);
  React.useEffect(()=>{
    let live=true;
    setSaved(null);setError('');
    void platform.readEpub(doc.id).then(book=>{if(live)setSaved(book);}).catch(()=>{if(live)setError('Unable to open EPUB.');});
    return ()=>{live=false;};
  },[doc.id,platform]);
  async function navigate(current: SavedEpub,index:number) {
    setBusy(true);setError('');
    try{
      const anchor={kind:'epub' as const,spineIndex:index,cfi:chapterCfi(index)};
      await platform.setEpubLocation(doc.id,anchor);
      setSaved({...current,anchor});
      await onRefresh();
    }catch{setError('Unable to save EPUB reading position.');}
    finally{setBusy(false);}
  }
  async function prefs(current:SavedEpub,fontSize:number,theme:EpubTheme){
    setBusy(true);setError('');
    try{
      const preferences={fontSize,theme};
      await platform.setEpubPreferences(doc.id,preferences);
      setSaved({...current,preferences});
    }catch{setError('Unable to save reader appearance.');}
    finally{setBusy(false);}
  }
  if(!saved)return <section aria-label="EPUB reader">{error ? <p role="alert">{error}</p> : <p>Loading EPUB…</p>}</section>;
  const current=saved;
  const chapters=current.book.chapters;
  const index=saved.anchor.spineIndex;
  const chapter=saved.book.chapters[index];
  const style=themes[saved.preferences.theme];
  const html='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data:; style-src &#39;unsafe-inline&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;"><style>html{background:'+style.background+';color:'+style.color+';font-family:Georgia,serif;font-size:'+saved.preferences.fontSize+'px;line-height:1.7}body{max-width:45em;margin:2em auto;padding:0 1em}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>'+chapter.html+'</body></html>';
  function tocButtons(items:EpubTocItem[]):React.ReactNode {
    return items.map((item,i)=>{
      const dest=chapters.findIndex(part=>part.href===item.href);
      return <li key={item.href+item.label+i}>{dest>=0?<button disabled={busy} onClick={()=>void navigate(current,dest)}>{item.label}</button>:<span>{item.label}</span>}
        {item.children.length>0&&<ul>{tocButtons(item.children)}</ul>}</li>;
    });
  }
  return <section aria-label="EPUB reader">
    <h3>{saved.book.metadata.title || doc.title}</h3>
    <p>{saved.book.metadata.creators.join(', ')}</p>
    <nav aria-label="EPUB chapters"><button disabled={busy||index===0} onClick={()=>void navigate(current,index-1)}>Previous chapter</button>
      <span> Chapter {index+1} of {saved.book.chapters.length} </span>
      <button disabled={busy||index===saved.book.chapters.length-1} onClick={()=>void navigate(current,index+1)}>Next chapter</button></nav>
    <div><label>Font size <input aria-label="EPUB font size" type="range" min="14" max="26" step="1" disabled={busy}
      value={saved.preferences.fontSize} onChange={event=>void prefs(current,Number(event.target.value),saved.preferences.theme)}/></label>
      <label> Theme <select aria-label="EPUB theme" disabled={busy} value={saved.preferences.theme}
        onChange={event=>void prefs(current,saved.preferences.fontSize,event.target.value as EpubTheme)}>
        <option value="light">Light</option><option value="sepia">Sepia</option><option value="dark">Dark</option></select></label></div>
    {error&&<p role="alert">{error}</p>}
    <iframe title="EPUB chapter" sandbox="" referrerPolicy="no-referrer" srcDoc={html}
      style={{width:'100%',height:'70vh',border:'1px solid #ddd'}} />
    {translationPlatform&&<TranslationPanel key={index} doc={doc} units={epubContentUnits(chapter.html,index,saved.anchor.cfi)} platform={translationPlatform} provider={translationProvider}/>}
    <details><summary>Table of contents</summary>
      <ul>{saved.book.metadata.toc.length?tocButtons(saved.book.metadata.toc):saved.book.chapters.map((part,i)=><li key={part.id}>
        <button disabled={busy} onClick={()=>void navigate(current,i)}>Chapter {i+1}</button></li>)}</ul></details>
    <p>Reading position is saved locally by chapter; publication scripts, styles and remote resources are disabled.</p>
  </section>;
}
