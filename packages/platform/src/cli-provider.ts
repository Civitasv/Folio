import type {TranslationProvider} from '@folio/core';
export interface CliStatus {installed:boolean;authenticated:boolean;version?:string|null}
export interface CliBridge {
 status():Promise<CliStatus>;
 translate(model:string,request:{text:string;source:string;target:string;promptVersion:string},signal:AbortSignal):Promise<string>;
}
export function createCodexProvider(model:string,bridge:CliBridge):TranslationProvider{
 const name=model.trim();
 if(!name||name.length>100||!/^[a-z0-9][a-z0-9._:\/-]*$/i.test(name))throw Error('Invalid Codex model');
 return {id:'cli:codex',model:name,supportsAutoSource:true,
  dataFlow:'Codex CLI runs on this desktop using the existing CLI login and can send the excerpt to its remote model provider. This is not offline inference.',
  translate:(request,signal)=>bridge.translate(name,request,signal)};
}
