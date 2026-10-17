import type {ApiConfig,NativeApiBridge} from './api-provider';
type Invoke=(name:string,args?:Record<string,unknown>)=>Promise<unknown>;
export function normalizeNativeFailure(error:unknown,cancelled:boolean):unknown{
 return cancelled?Error('Translation cancelled'):error;
}
export function nativeInvoke():Invoke|undefined {
 const holder=globalThis as typeof globalThis & {__TAURI__?:{core?:{invoke?:Invoke}}};
 return holder.__TAURI__?.core?.invoke;
}
export function createNativeApiBridge(invoke:Invoke):NativeApiBridge {
 return {
  saveKey:async (endpoint,key)=>{await invoke('folio_api_save_key',{endpoint,key});},
  hasKey:async endpoint=>Boolean(await invoke('folio_api_has_key',{endpoint})),
  clearKey:async endpoint=>{await invoke('folio_api_clear_key',{endpoint});},
  async translate(config:ApiConfig,request,signal){
   if(signal.aborted)throw Error('Translation cancelled');
   const requestId=crypto.randomUUID();
   const abort=()=>{void invoke('folio_api_cancel',{requestId}).catch(()=>{});};
   signal.addEventListener('abort',abort,{once:true});
   try{
    const result=await invoke('folio_api_translate',{endpoint:config.endpoint,model:config.model,
      text:request.text,source:request.source,target:request.target,promptVersion:request.promptVersion,requestId})
      .catch(error=>Promise.reject(normalizeNativeFailure(error,signal.aborted)));
    if(signal.aborted)throw Error('Translation cancelled');
    if(typeof result!=='string'||!result.trim())throw Error('Missing API translation');
    return result.trim();
   }finally{signal.removeEventListener('abort',abort);}
  }
 };
}
