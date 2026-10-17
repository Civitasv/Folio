import './folio.css';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './app';
import {ApiProviderSettings} from './api-settings';
import {CliProviderSettings} from './cli-settings';
import type {TranslationProvider} from '@folio/core';
function Workspace(){
 const [api,setApi]=React.useState<TranslationProvider|undefined>();
 const [cli,setCli]=React.useState<TranslationProvider|undefined>();
 const [choice,setChoice]=React.useState<'manual'|'api'|'cli'>('manual');
 const provider=choice==='api'?api:choice==='cli'?cli:undefined;
 return <><ApiProviderSettings onChange={p=>{setApi(p);if(p)setChoice('api');}}/>
  <CliProviderSettings onChange={p=>{setCli(p);if(p)setChoice('cli');}}/>
  <label>Active translation backend <select aria-label="Active translation backend" value={choice} onChange={e=>setChoice(e.target.value as 'manual'|'api'|'cli')}>
   <option value="manual">Local manual drafts only</option>
   <option value="api" disabled={!api}>Configured API provider</option>
   <option value="cli" disabled={!cli}>Authenticated Codex CLI</option>
  </select></label>
  <App translationProvider={provider}/></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Workspace/></React.StrictMode>);
