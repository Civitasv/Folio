import {afterEach,expect,it,vi} from 'vitest';
import {createNativeApiBridge,nativeInvoke} from './native-api';
afterEach(()=>vi.unstubAllGlobals());
it('does not invent a desktop bridge in normal browser context',()=>{
 vi.stubGlobal('__TAURI__',undefined);expect(nativeInvoke()).toBeUndefined();
});
it('uses only the Tauri invoke bridge and never exposes stored credentials',async()=>{
 const calls:string[]=[];
 const invoke=vi.fn(async(name:string,args?:Record<string,unknown>)=>{calls.push(name);
  if(name==='folio_api_has_key')return true;
  if(name==='folio_api_translate')return ' Bonjour ';
  if(name==='folio_api_cancel')return true;
  return null;
 });
 vi.stubGlobal('__TAURI__',{core:{invoke}});
 expect(nativeInvoke()).toBe(invoke);
 const bridge=createNativeApiBridge(invoke);
 await bridge.saveKey('private');
 expect(await bridge.hasKey()).toBe(true);
 expect(await bridge.translate({endpoint:'https://api.example.com/v1',model:'m'},
  {text:'Hello',source:'en',target:'fr',promptVersion:'v1'},new AbortController().signal)).toBe('Bonjour');
 await bridge.clearKey();
 expect(calls).toEqual(['folio_api_save_key','folio_api_has_key','folio_api_translate','folio_api_clear_key']);
 expect(invoke.mock.calls[2][1]).not.toHaveProperty('key');
});
it('refuses already cancelled work and aborts a running native command by request identifier',async()=>{
 let finish!:(v:unknown)=>void;
 const invoke=vi.fn(async(name:string)=>name==='folio_api_translate'?new Promise(resolve=>{finish=resolve;}):true);
 const bridge=createNativeApiBridge(invoke),cancel=new AbortController();cancel.abort();
 await expect(bridge.translate({endpoint:'x',model:'m'},{text:'x',source:'en',target:'fr',promptVersion:'v'},cancel.signal)).rejects.toThrow('cancelled');
 expect(invoke).not.toHaveBeenCalled();
 const pending=new AbortController(),job=bridge.translate({endpoint:'x',model:'m'},
  {text:'x',source:'en',target:'fr',promptVersion:'v'},pending.signal);
 pending.abort();finish('late');await expect(job).rejects.toThrow('cancelled');
 expect(invoke).toHaveBeenCalledWith('folio_api_cancel',expect.objectContaining({requestId:expect.any(String)}));
});
it('propagates native invocation errors and invalid output',async()=>{
 for(const response of [null,'  ']){
  const bridge=createNativeApiBridge(vi.fn(async()=>response));
  await expect(bridge.translate({endpoint:'x',model:'m'},{text:'x',source:'en',target:'fr',promptVersion:'v'},new AbortController().signal)).rejects.toThrow('Missing API translation');
 }
 const bridge=createNativeApiBridge(vi.fn(async()=>{throw Error('credential locked');}));
 await expect(bridge.translate({endpoint:'x',model:'m'},{text:'x',source:'en',target:'fr',promptVersion:'v'},new AbortController().signal)).rejects.toThrow('credential locked');
});

it('maps a rejected native invocation after cancellation to a harmless cancellation result',async()=>{
 let reject!:(value:Error)=>void;
 const invoke=vi.fn(async(name:string)=>name==='folio_api_translate'?new Promise((_resolve,fail)=>{reject=fail;}):true);
 const bridge=createNativeApiBridge(invoke),controller=new AbortController();
 const work=bridge.translate({endpoint:'x',model:'m'},{text:'abc',source:'en',target:'fr',promptVersion:'v'},controller.signal);
 controller.abort();reject(Error('late failure'));
 await expect(work).rejects.toThrow('Translation cancelled');
});
it('swallows cancellation-notification errors without unhandled provider outcome',async()=>{
 let finish!:(v:unknown)=>void;
 const invoke=vi.fn(async(name:string)=>name==='folio_api_translate'?new Promise(resolve=>{finish=resolve;}):
  Promise.reject(Error('cancel not possible')));
 const controller=new AbortController(),bridge=createNativeApiBridge(invoke);
 const work=bridge.translate({endpoint:'x',model:'m'},{text:'abc',source:'en',target:'fr',promptVersion:'v'},controller.signal);
 controller.abort();finish('late');
 await expect(work).rejects.toThrow('cancelled');
});

it('does not overwrite the native invocation error when the caller did not cancel',async()=>{
 const invoke=vi.fn(async(name:string)=>{if(name==='folio_api_translate')throw Error('transport failure');return null;});
 const bridge=createNativeApiBridge(invoke);
 await expect(bridge.translate({endpoint:'x',model:'m'},{text:'x',source:'en',target:'fr',promptVersion:'v'},new AbortController().signal)).rejects.toThrow('transport failure');
});
