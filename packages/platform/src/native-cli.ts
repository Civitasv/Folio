import type {CliBridge,CliStatus} from './cli-provider';
import {nativeInvoke} from './native-api';
type Invoke=(name:string,args?:Record<string,unknown>)=>Promise<unknown>;
export function createCliBridge(invoke:Invoke):CliBridge {
 return {
  async status(){
   const result=await invoke('folio_cli_status');
   if(!result||typeof result!=='object')throw Error('Invalid Codex CLI status');
   const value=result as Record<string,unknown>;
   if(typeof value.installed!=='boolean'||typeof value.authenticated!=='boolean')throw Error('Invalid Codex CLI status');
   return {installed:value.installed,authenticated:value.authenticated,
    version:typeof value.version==='string'?value.version:undefined};
  },
  async translate(model,request,signal){
   if(signal.aborted)throw Error('Codex translation cancelled');
   const requestId=crypto.randomUUID();
   const cancel=()=>{void invoke('folio_cli_cancel',{requestId}).catch(()=>{});};
   signal.addEventListener('abort',cancel,{once:true});
   try{
    const result=await invoke('folio_cli_translate',{model,source:request.source,target:request.target,
     text:request.text,promptVersion:request.promptVersion,requestId});
    if(signal.aborted)throw Error('Codex translation cancelled');
    if(typeof result!=='string'||!result.trim())throw Error('Codex returned no translation');
    return result.trim();
   }catch(error){if(signal.aborted)throw Error('Codex translation cancelled');throw error;}
   finally{signal.removeEventListener('abort',cancel);}
  }
 };
}
export function browserCliAvailability(){
 return nativeInvoke()!==undefined;
}
