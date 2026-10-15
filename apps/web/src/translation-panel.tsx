import React from 'react';
import {DEFAULT_LANGUAGE_PREFERENCES,LANGUAGE_OPTIONS,TRANSLATION_PROMPT_VERSION,
 type ContentUnit,type DocumentSummary,type LanguagePreferences,type TranslationEntry,type TranslationIdentity,type TranslationProvider}
 from '@folio/core';
import type {TranslationPlatform} from '@folio/platform';
export function TranslationPanel({doc,units,platform,provider}:{doc:DocumentSummary;units?:ContentUnit[];platform:TranslationPlatform;provider?:TranslationProvider}){
 const [prefs,setPrefs]=React.useState<LanguagePreferences>(DEFAULT_LANGUAGE_PREFERENCES);
 const [ready,setReady]=React.useState(false);
 const [unitIndex,setUnitIndex]=React.useState(0);
 const [excerpt,setExcerpt]=React.useState('');
 const [draft,setDraft]=React.useState('');
 const [customSource,setCustomSource]=React.useState('');
 const [customTarget,setCustomTarget]=React.useState('');
 const [mode,setMode]=React.useState<'manual'|'provider'>('manual');
 const [entry,setEntry]=React.useState<TranslationEntry|undefined>();
 const [error,setError]=React.useState('');
 const [notice,setNotice]=React.useState('');
 const [busy,setBusy]=React.useState(false);
 const controller=React.useRef<AbortController|null>(null);
 React.useEffect(()=>{
  let live=true;setReady(false);setError('');setEntry(undefined);
  void platform.getLanguages().then(value=>{if(live){setPrefs(value);setReady(true);}}).catch(()=>{
   if(live)setError('Cannot load translation preferences.');
  });
  return ()=>{live=false;controller.current?.abort();};
 },[platform,doc.id]);
 const unit=units ? units[unitIndex] : {anchor:{kind:'pdf' as const,page:doc.progress},unitIndex:0,text:excerpt};
 const useProvider=mode==='provider' && provider!==undefined;
 const identity:TranslationIdentity|undefined=unit?{
  documentId:doc.id,unit,source:prefs.source,target:prefs.target,
  providerId:useProvider?provider.id:'manual',
  model:useProvider?provider.model:'local-draft',
  promptVersion:TRANSLATION_PROMPT_VERSION
 }:undefined;
 React.useEffect(()=>{
  let live=true;setEntry(undefined);setDraft('');setNotice('');
  if(ready&&identity&&unit.text.trim()) void platform.findTranslation(identity).then(value=>{
   if(live){setEntry(value);setDraft(value?.translatedText??'');}
  }).catch(()=>{if(live)setError('Cannot read local translation cache.');});
  return ()=>{live=false;};
 },[platform,ready,doc.id,unit?.anchor.kind,unit?.anchor.kind==='pdf'?unit.anchor.page:unit?.anchor.spineIndex,
  unit?.unitIndex,unit?.text,prefs.source,prefs.target,mode,provider?.id,provider?.model]);
 async function update(next:LanguagePreferences){
  setError('');
  try{const result=await platform.setLanguages(next);setPrefs(result);}
  catch{setError('Invalid language preferences or local storage unavailable.');}
 }
 async function saveManual(selected:TranslationIdentity){
  setBusy(true);setError('');setNotice('');
  try{const saved=await platform.saveManualTranslation(selected,draft);setEntry(saved);setNotice('Local translation draft saved.');}
  catch{setError('Unable to save translation (check text, language or storage).');}
  finally{setBusy(false);}
 }
 async function translate(selected:TranslationIdentity,activeProvider:TranslationProvider){
  if(!window.confirm('Send only the displayed excerpt to the selected provider? The provider may use a remote service.'))return;
  const pending=new AbortController();controller.current=pending;setBusy(true);setError('');setNotice('');
  try{
   const result=await platform.translate(selected,activeProvider,pending.signal);
   if(!pending.signal.aborted){setEntry(result);setNotice('Provider translation saved locally.');}
  }catch{setError(pending.signal.aborted?'Translation cancelled.':'Provider translation failed. Retry or use a local draft.');}
  finally{controller.current=null;setBusy(false);}
 }
 return <section aria-label="Translation">
  <h3>Translation · {doc.title}</h3>
  {!ready&&<p>Loading translation settings…</p>}
  {ready&&<>
   <div>
    <label>Source language <select aria-label="Source language" value={prefs.source} disabled={busy}
      onChange={e=>void update({...prefs,source:e.target.value})}>
      {LANGUAGE_OPTIONS.map(lang=><option key={lang.tag} value={lang.tag}>{lang.label}</option>)}
      {!LANGUAGE_OPTIONS.some(lang=>lang.tag===prefs.source)&&<option value={prefs.source}>{prefs.source}</option>}</select></label>
    <label>Custom source language <input aria-label="Custom source language" value={customSource} placeholder="e.g. pt-BR" onChange={e=>setCustomSource(e.target.value)}/></label>
    <button disabled={!customSource.trim()||busy} onClick={()=>void update({...prefs,source:customSource.trim()})}>Use source language</button>
    <label>Target language <select aria-label="Target language" value={prefs.target} disabled={busy}
      onChange={e=>void update({...prefs,target:e.target.value})}>
      {LANGUAGE_OPTIONS.filter(x=>x.tag!=='auto').map(lang=><option key={lang.tag} value={lang.tag}>{lang.label}</option>)}
      {prefs.recentTargets.filter(tag=>!LANGUAGE_OPTIONS.some(lang=>lang.tag===tag)).map(tag=><option key={tag} value={tag}>{tag} (recent)</option>)}</select></label>
    <label>Custom target language <input aria-label="Custom target language" value={customTarget} placeholder="e.g. ko-KR" onChange={e=>setCustomTarget(e.target.value)}/></label>
    <button disabled={!customTarget.trim()||busy} onClick={()=>void update({...prefs,target:customTarget.trim()})}>Use target language</button>
    <label>View <select aria-label="Translation view" value={prefs.view} onChange={e=>void update({...prefs,view:e.target.value as LanguagePreferences['view']})}>
      <option value="original">Original only</option><option value="bilingual">Bilingual</option><option value="translation">Translation only</option>
    </select></label>
   </div>
   {units?<label>Content unit <select aria-label="Content unit" value={unitIndex} onChange={e=>setUnitIndex(Number(e.target.value))}>
    {units.map((u,i)=><option key={u.unitIndex} value={i}>{u.text.slice(0,70)}</option>)}</select></label>:
    <label>PDF excerpt (manual paste; PDF text extraction is not implemented) <textarea aria-label="PDF excerpt"
      value={excerpt} onChange={e=>setExcerpt(e.target.value)} maxLength={4000}/></label>}
   {unit&&<>
    <p>Only the displayed excerpt is eligible for translation. No entire-book upload or background request.</p>
    {provider&&<label>Method <select aria-label="Translation method" value={mode} onChange={e=>setMode(e.target.value as 'manual'|'provider')}>
      <option value="manual">Local manual draft</option><option value="provider">{provider.id} / {provider.model}</option>
    </select></label>}
    {!provider&&<p>AI provider unavailable in this preview. API and CLI adapters follow in F01e/F01f; manual drafts stay on-device.</p>}
    {(prefs.view!=='translation')&&<div><strong>Original</strong><p data-testid="translation-original">{unit.text}</p></div>}
    {(prefs.view!=='original')&&<div><strong>{entry?.provenance==='provider'?'Provider translation':'Local draft / cached translation'}</strong>
      <p data-testid="translation-result">{entry?.translatedText??'No cached translation for this exact text and settings.'}</p></div>}
    {!useProvider?<><label>Write translated text locally <textarea aria-label="Manual translation" value={draft}
      disabled={busy} onChange={e=>setDraft(e.target.value)} maxLength={16000}/></label>
      <button disabled={busy||!unit.text.trim()||!draft.trim()} onClick={()=>void saveManual(identity!)}>Save local translation</button></>:
      <button disabled={busy||!unit.text.trim()} onClick={()=>void translate(identity!,provider!)}>Translate displayed excerpt</button>}
    {busy&&<button onClick={()=>controller.current?.abort()}>Cancel translation</button>}
   </>}
  </>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
