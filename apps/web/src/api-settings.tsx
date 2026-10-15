import React from 'react';
import type {TranslationProvider} from '@folio/core';
import {createApiProvider,createNativeApiProvider,createNativeApiBridge,nativeInvoke,normalizeApiConfig,
 testApiConnection,type ApiConfig,type NativeApiBridge} from '@folio/platform';

const runtimeInvoke=nativeInvoke();
const runtimeBridge=runtimeInvoke?createNativeApiBridge(runtimeInvoke):undefined;
export function ApiProviderSettings({onChange,bridge=runtimeBridge,
 fetcher=fetch}:{onChange:(provider:TranslationProvider|undefined)=>void;bridge?:NativeApiBridge;fetcher?:typeof fetch}){
 const [endpoint,setEndpoint]=React.useState('https://api.openai.com/v1');
 const [model,setModel]=React.useState('');
 const [key,setKey]=React.useState('');
 const [connected,setConnected]=React.useState(false);
 const [selected,setSelected]=React.useState<TranslationProvider|undefined>();
 const [error,setError]=React.useState('');
 const [status,setStatus]=React.useState('');
 const [busy,setBusy]=React.useState(false);
 const controller=React.useRef<AbortController|null>(null);
 React.useEffect(()=>{
  let live=true;
  if(bridge)void bridge.hasKey().then(present=>{if(live)setStatus(present?'A desktop credential is stored. Activate with its endpoint and model.':'No desktop credential stored.');})
   .catch(()=>{if(live)setError('OS credential store unavailable.');});
  return ()=>{live=false;controller.current?.abort();};
 },[bridge]);
 function edit(callback:()=>void){
  controller.current?.abort();setConnected(false);setSelected(undefined);onChange(undefined);setStatus('');setError('');
  callback();
 }
 async function activate(){
  setError('');setStatus('');setBusy(true);
  try{
   const config:ApiConfig=normalizeApiConfig({endpoint,model});
   if(bridge){
    if(key.trim()){await bridge.saveKey(key);setKey('');}
    if(!await bridge.hasKey())throw Error('Save a key in the OS credential store before activating');
   } else if(!key.trim())throw Error('Enter an API key for this browser session');
   const provider=bridge?createNativeApiProvider(config,bridge):createApiProvider(config,()=>key,fetcher);
   setSelected(provider);onChange(provider);setStatus(bridge?'Desktop provider activated (key in OS credential store).':'Browser provider activated (key kept in memory until reload).');
  }catch(reason){setError(reason instanceof Error?reason.message:'Provider activation failed');}
  finally{setBusy(false);}
 }
 async function probe(active:TranslationProvider){
  if(!window.confirm('Test connection with a small model request? This may use paid API tokens.'))return;
  const pending=new AbortController();controller.current=pending;setError('');setStatus('');setBusy(true);
  try{await testApiConnection(active,pending.signal);setConnected(true);setStatus('Connection test succeeded.');}
  catch(reason){setConnected(false);setError(pending.signal.aborted?'Connection test cancelled.':reason instanceof Error?reason.message:'Connection test failed');}
  finally{controller.current=null;setBusy(false);}
 }
 async function clear(){
  setError('');setStatus('');setBusy(true);controller.current?.abort();
  try{if(bridge)await bridge.clearKey();setKey('');setSelected(undefined);setConnected(false);onChange(undefined);
   setStatus('API credential cleared.');}
  catch{setError('Unable to clear the OS credential.');}
  finally{setBusy(false);}
 }
 return <section aria-label="API provider settings">
  <h2>API provider</h2><p>No Folio proxy. Only the displayed excerpt is sent after confirmation in the reader. Your provider may charge for requests.</p>
  <label>API endpoint <input aria-label="API endpoint" value={endpoint} disabled={busy} onChange={e=>edit(()=>setEndpoint(e.target.value))}/></label>
  <label>Model <input aria-label="API model" value={model} disabled={busy} onChange={e=>edit(()=>setModel(e.target.value))}/></label>
  <label>API key ({bridge?'OS credential store':'memory-only browser preview'}) <input aria-label="API key" type="password" autoComplete="off" value={key} disabled={busy}
   onChange={e=>edit(()=>setKey(e.target.value))}/></label>
  <button disabled={busy||!model.trim()} onClick={()=>void activate()}>Activate API provider</button>
  {selected&&<button disabled={busy} onClick={()=>void probe(selected)}>Test connection (may incur API cost)</button>}
  {busy&&<button onClick={()=>controller.current?.abort()}>Cancel connection test</button>}
  <button disabled={busy} onClick={()=>void clear()}>Clear API key</button>
  {connected&&<p>Provider reachable at last explicit check.</p>}
  {status&&<p role="status">{status}</p>}{error&&<p role="alert">{error}</p>}
  <p>Browser providers require source CORS permission; browser keys are discarded on reload. Desktop credentials are never stored in Folio IndexedDB.</p>
 </section>;
}
