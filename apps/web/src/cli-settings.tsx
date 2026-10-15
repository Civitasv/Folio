import React from 'react';
import type {TranslationProvider} from '@folio/core';
import {createCliBridge,createCodexProvider,nativeInvoke,type CliBridge,type CliStatus} from '@folio/platform';
const invoke=nativeInvoke();
const runtimeBridge=invoke?createCliBridge(invoke):undefined;
export function CliProviderSettings({onChange,bridge=runtimeBridge}:{onChange:(provider:TranslationProvider|undefined)=>void;bridge?:CliBridge}){
 const [model,setModel]=React.useState('');
 const [status,setStatus]=React.useState<CliStatus|null>(null);
 const [active,setActive]=React.useState<TranslationProvider|undefined>();
 const [notice,setNotice]=React.useState('');
 const [error,setError]=React.useState('');
 const [busy,setBusy]=React.useState(false);
 const controller=React.useRef<AbortController|null>(null);
 React.useEffect(()=>()=>{controller.current?.abort();},[]);
 async function inspect(){
  setError('');setNotice('');setStatus(null);setBusy(true);setActive(undefined);onChange(undefined);
  try{
   const result=await bridge!.status();setStatus(result);
   setNotice(!result.installed?'Codex CLI not installed or not on PATH. Install and sign in separately.':
    !result.authenticated?'Codex CLI installed but not signed in. Complete codex login in your terminal.':
    'Codex CLI appears installed and signed in. Verify model access with an explicit translation test.');
  }catch{setError('Unable to inspect Codex CLI on this desktop.');}
  finally{setBusy(false);}
 }
 function updateModel(value:string){setModel(value);setActive(undefined);onChange(undefined);setError('');setNotice('');}
 function activate(){
  setError('');
  try{const provider=createCodexProvider(model,bridge!);
   setActive(provider);onChange(provider);setNotice('Codex CLI selected. Each excerpt requires confirmation; inference may be remote.');
  }catch(reason){setError(reason instanceof Error?reason.message:'Unable to activate Codex CLI');}
 }
 async function probe(selected:TranslationProvider){
  if(!window.confirm('Run a small Codex translation to check model access? This may use your CLI plan or provider quota.'))return;
  const abort=new AbortController();controller.current=abort;setBusy(true);setError('');setNotice('');
  try{await selected.translate({text:'Hello',source:'en',target:'fr',promptVersion:'f01f-health'},abort.signal);
   if(!abort.signal.aborted)setNotice('Codex translation test succeeded.');}
  catch(reason){setError(abort.signal.aborted?'Codex test cancelled.':reason instanceof Error?reason.message:'Codex translation test failed.');}
  finally{controller.current=null;setBusy(false);}
 }
 if(!bridge)return <section aria-label="CLI provider settings"><h2>Agent CLI</h2><p>Local CLI execution is unavailable in the browser preview. Open Folio Desktop to detect an installed, authenticated Codex CLI.</p></section>;
 return <section aria-label="CLI provider settings">
  <h2>Agent CLI · Codex</h2>
  <p>Uses the installed Codex CLI and its existing login; Folio never reads authentication tokens. The CLI may send your confirmed excerpt to a remote model. No shell or silent install/login.</p>
  <button disabled={busy} onClick={()=>void inspect()}>Check Codex CLI</button>
  {status?.installed&&<p>Installed version: {status.version||'unknown'} · {status.authenticated?'Signed in':'Not signed in'}</p>}
  <label>Codex model <input aria-label="Codex model" value={model} disabled={busy} placeholder="Enter a model available in your Codex CLI"
   onChange={e=>updateModel(e.target.value)}/></label>
  <button disabled={busy||!status?.installed||!status.authenticated||!model.trim()} onClick={activate}>Activate Codex CLI</button>
  {active&&<button disabled={busy} onClick={()=>void probe(active)}>Test Codex translation (may use quota)</button>}
  {busy&&<button onClick={()=>controller.current?.abort()}>Cancel Codex test</button>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
