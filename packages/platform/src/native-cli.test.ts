import {afterEach,expect,it,vi} from 'vitest';
import {createCliBridge,browserCliAvailability,normalizeCliFailure} from './native-cli';
afterEach(()=>vi.unstubAllGlobals());
const request={text:'Hello',source:'en',target:'fr',promptVersion:'f01f-v1'};
it('never offers CLI in a plain browser and can report native availability explicitly',()=>{
 vi.stubGlobal('__TAURI__',undefined);expect(browserCliAvailability()).toBe(false);
 vi.stubGlobal('__TAURI__',{core:{invoke:vi.fn()}});expect(browserCliAvailability()).toBe(true);
});
it('inspects installation/authentication status without touching secret files',async()=>{
 const invoke=vi.fn(async(name:string)=>name==='folio_cli_status'?{installed:true,authenticated:false,version:'codex-cli 0.1'}:null);
 const status=await createCliBridge(invoke).status();
 expect(status).toEqual({installed:true,authenticated:false,version:'codex-cli 0.1'});
 expect(invoke).toHaveBeenCalledWith('folio_cli_status');
 for(const result of [null,3,{}, {installed:'yes',authenticated:true}])
  await expect(createCliBridge(vi.fn(async()=>result)).status()).rejects.toThrow('Invalid Codex CLI status');
 expect(await createCliBridge(vi.fn(async()=>({installed:false,authenticated:false,version:null}))).status())
  .toEqual({installed:false,authenticated:false,version:undefined});
});
it('transmits only the excerpt to a fixed native command and returns plain translation output',async()=>{
 const invoke=vi.fn(async(name:string,_args?:Record<string,unknown>)=>name==='folio_cli_translate'?' Salut ':true);
 const bridge=createCliBridge(invoke);
 expect(await bridge.translate('gpt-5',request,new AbortController().signal)).toBe('Salut');
 expect(invoke).toHaveBeenCalledWith('folio_cli_translate',expect.objectContaining({
  model:'gpt-5',text:'Hello',source:'en',target:'fr',requestId:expect.any(String)
 }));
 const args=invoke.mock.calls[0][1] as Record<string,unknown>;
 expect(args).not.toHaveProperty('key');expect(args).not.toHaveProperty('command');
});
it('rejects pre-cancelled commands and requests native cancellation for in-flight runs',async()=>{
 let finish!:(v:unknown)=>void;
 const invoke=vi.fn(async(name:string)=>name==='folio_cli_translate'?new Promise(resolve=>{finish=resolve;}):true);
 const bridge=createCliBridge(invoke),abort=new AbortController();abort.abort();
 await expect(bridge.translate('model',request,abort.signal)).rejects.toThrow('cancelled');
 expect(invoke).not.toHaveBeenCalled();
 const running=new AbortController(),job=bridge.translate('model',request,running.signal);
 running.abort();finish('Late');
 await expect(job).rejects.toThrow('cancelled');
 expect(invoke).toHaveBeenCalledWith('folio_cli_cancel',expect.objectContaining({requestId:expect.any(String)}));
});
it('rejects invalid output and preserves native process errors and cancellation',async()=>{
 for(const output of [null,0,'  '])
  await expect(createCliBridge(vi.fn(async()=>output)).translate('m',request,new AbortController().signal)).rejects.toThrow('no translation');
 await expect(createCliBridge(vi.fn(async()=>{throw Error('CLI not logged in');})).translate('m',request,new AbortController().signal)).rejects.toThrow('CLI not logged in');
 let reject!:(e:Error)=>void;
 const invoke=vi.fn(async(name:string)=>name==='folio_cli_translate'?new Promise((_resolve,fail)=>{reject=fail;}):Promise.reject(Error('cancel unavailable')));
 const controller=new AbortController();
 const job=createCliBridge(invoke).translate('m',request,controller.signal);
 controller.abort();reject(Error('cancelled by native CLI'));
 await expect(job).rejects.toThrow('cancelled');
});

it('normalizes a rejected CLI command using the caller cancellation state',()=>{
 const source=Error('Codex not logged in');
 expect(normalizeCliFailure(source,false)).toBe(source);
 expect((normalizeCliFailure(source,true) as Error).message).toBe('Codex translation cancelled');
});
