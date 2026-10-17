import React from 'react';
import type {TranslationProvider} from '@folio/core';
import {App} from './app';
import {ApiProviderSettings} from './api-settings';
import {CliProviderSettings} from './cli-settings';

/** Provider configuration is a low-frequency task, separate from the reading canvas. */
export function Workspace(){
 const [api,setApi]=React.useState<TranslationProvider|undefined>();
 const [cli,setCli]=React.useState<TranslationProvider|undefined>();
 const [choice,setChoice]=React.useState<'manual'|'api'|'cli'>('manual');
 const [showSettings,setShowSettings]=React.useState(false);
 const previousFocus=React.useRef<HTMLElement|null>(null);
 const closeButton=React.useRef<HTMLButtonElement|null>(null);
 const provider=choice==='api'?api:choice==='cli'?cli:undefined;
 function openSettings(){
  previousFocus.current=document.activeElement as HTMLElement|null;
  setShowSettings(true);
 }
 function closeSettings(){setShowSettings(false);}
 React.useEffect(()=>{
  if(showSettings)closeButton.current?.focus();
  else previousFocus.current?.focus();
 },[showSettings]);
 React.useEffect(()=>{
  if(!showSettings)return;
  const handleKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();closeSettings();}};
  window.addEventListener('keydown',handleKey);
  return ()=>window.removeEventListener('keydown',handleKey);
 },[showSettings]);
 function changeApi(next:TranslationProvider|undefined){
  setApi(next);setChoice(old=>next?'api':old==='api'?'manual':old);
 }
 function changeCli(next:TranslationProvider|undefined){
  setCli(next);setChoice(old=>next?'cli':old==='cli'?'manual':old);
 }
 return <>
  <div aria-hidden={showSettings} inert={showSettings}><App translationProvider={provider} onOpenSettings={openSettings}/></div>
  <div className="folio-settings-scrim" hidden={!showSettings}>
   <section role="dialog" aria-modal="true" aria-labelledby="folio-settings-title" className="folio-settings-dialog">
    <header className="folio-settings-heading"><div><h2 id="folio-settings-title">Settings</h2><p>Translation providers · local-first</p></div>
      <button ref={closeButton} type="button" onClick={closeSettings}>Close settings</button></header>
    <div className="folio-settings-body">
      <div className="folio-settings-section"><ApiProviderSettings onChange={changeApi}/></div>
      <div className="folio-settings-section"><CliProviderSettings onChange={changeCli}/></div>
      <div className="folio-settings-section">
       <label>Active translation backend <select aria-label="Active translation backend" value={choice} onChange={event=>setChoice(event.target.value as 'manual'|'api'|'cli')}>
        <option value="manual">Local manual drafts only</option>
        <option value="api" disabled={!api}>Configured API provider</option>
        <option value="cli" disabled={!cli}>Authenticated Codex CLI</option>
       </select></label>
       <p>Only a user-confirmed excerpt is sent to an activated provider. A logged-in local CLI may still perform remote inference.</p>
      </div>
    </div>
   </section>
  </div>
 </>;
}
