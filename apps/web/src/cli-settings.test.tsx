import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {CliProviderSettings} from './cli-settings';
import type {CliBridge} from '@folio/platform';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(status={installed:true,authenticated:true,version:'codex 1.0'}){
 const bridge:CliBridge={status:vi.fn(async()=>status),translate:vi.fn(async()=> 'Bonjour')};
 return {bridge,onChange:vi.fn()};
}
it('shows browser unavailable state without running a fake CLI probe',()=>{
 vi.stubGlobal('__TAURI__',undefined);
 const onChange=vi.fn();render(<CliProviderSettings onChange={onChange}/>);
 expect(screen.getByText(/unavailable in the browser preview/)).toBeTruthy();
 expect(screen.queryByText('Check Codex CLI')).toBeNull();expect(onChange).not.toHaveBeenCalled();
});
it('checks a real bridge only on click; distinguishes absent, unauthenticated and authenticated state',async()=>{
 const f=fixture({installed:false,authenticated:false,version:''});
 render(<CliProviderSettings {...f}/>);
 expect(f.bridge.status).not.toHaveBeenCalled();expect(screen.getByText('Activate Codex CLI')).toHaveProperty('disabled',true);
 fireEvent.click(screen.getByText('Check Codex CLI'));
 expect(await screen.findByText(/not installed or not on PATH/)).toBeTruthy();
 vi.mocked(f.bridge.status).mockResolvedValueOnce({installed:true,authenticated:false,version:'codex 0.2'});
 fireEvent.click(screen.getByText('Check Codex CLI'));
 expect(await screen.findByText(/not signed in/)).toBeTruthy();
 expect(screen.getByText(/Not signed in/)).toBeTruthy();
 vi.mocked(f.bridge.status).mockResolvedValueOnce({installed:true,authenticated:true,version:'codex 1.0'});
 fireEvent.click(screen.getByText('Check Codex CLI'));
 expect(await screen.findByText(/Codex CLI appears installed and signed in/)).toBeTruthy();
 expect(screen.getByText(/Signed in/)).toBeTruthy();
});
it('activates explicit model and requires separate paid test consent',async()=>{
 const f=fixture(),confirm=vi.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValue(true);
 render(<CliProviderSettings {...f}/>);
 fireEvent.click(screen.getByText('Check Codex CLI'));await screen.findByText(/appears installed and signed in/);
 fireEvent.change(screen.getByLabelText('Codex model'),{target:{value:'gpt-5'}});
 fireEvent.click(screen.getByText('Activate Codex CLI'));
 await screen.findByText(/Codex CLI selected/);
 expect(f.onChange).toHaveBeenCalledWith(expect.objectContaining({id:'cli:codex',model:'gpt-5'}));
 fireEvent.click(screen.getByText(/Test Codex translation/));
 expect(f.bridge.translate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText(/Test Codex translation/));
 await screen.findByText('Codex translation test succeeded.');
 expect(f.bridge.translate).toHaveBeenCalledWith('gpt-5',
  {text:'Hello',source:'en',target:'fr',promptVersion:'f01f-health'},expect.any(AbortSignal));
 expect(confirm).toHaveBeenCalledTimes(2);
 fireEvent.change(screen.getByLabelText('Codex model'),{target:{value:'model-2'}});
 expect(f.onChange).toHaveBeenLastCalledWith(undefined);
});
it('reports invalid CLI model, status failures and provider failure',async()=>{
 const f=fixture();render(<CliProviderSettings {...f}/>);
 vi.mocked(f.bridge.status).mockRejectedValueOnce(Error('blocked'));
 fireEvent.click(screen.getByText('Check Codex CLI'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to inspect Codex CLI on this desktop.');
 fireEvent.click(screen.getByText('Check Codex CLI'));await screen.findByText(/appears installed and signed in/);
 fireEvent.change(screen.getByLabelText('Codex model'),{target:{value:'--yolo'}});
 fireEvent.click(screen.getByText('Activate Codex CLI'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Invalid Codex model');
 fireEvent.change(screen.getByLabelText('Codex model'),{target:{value:'gpt-5'}});
 fireEvent.click(screen.getByText('Activate Codex CLI'));await screen.findByText(/Codex CLI selected/);
 vi.spyOn(window,'confirm').mockReturnValue(true);
 vi.mocked(f.bridge.translate).mockRejectedValueOnce(Error('missing model access'));
 fireEvent.click(screen.getByText(/Test Codex translation/));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','missing model access');
 vi.mocked(f.bridge.translate).mockRejectedValueOnce('other failure');
 fireEvent.click(screen.getByText(/Test Codex translation/));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Codex translation test failed.');
});
it('cancels an in-flight model test and never claims success after cancellation',async()=>{
 const f=fixture(),abortSignals:AbortSignal[]=[];
 vi.mocked(f.bridge.translate).mockImplementationOnce(async(_model,_request,signal)=>new Promise((_resolve,reject)=>{
  abortSignals.push(signal);signal.addEventListener('abort',()=>reject(Error('cancelled')));
 }));
 vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<CliProviderSettings {...f}/>);
 fireEvent.click(screen.getByText('Check Codex CLI'));await screen.findByText(/appears installed and signed in/);
 fireEvent.change(screen.getByLabelText('Codex model'),{target:{value:'gpt-5'}});
 fireEvent.click(screen.getByText('Activate Codex CLI'));
 fireEvent.click(screen.getByText(/Test Codex translation/));
 await screen.findByText('Cancel Codex test');
 fireEvent.click(screen.getByText('Cancel Codex test'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Codex test cancelled.');
 expect(abortSignals[0].aborted).toBe(true);
});
it('aborts native work when leaving the settings screen',async()=>{
 const f=fixture(),abortSignals:AbortSignal[]=[];
 vi.mocked(f.bridge.translate).mockImplementationOnce(async(_model,_request,signal)=>new Promise((_resolve,reject)=>{
  abortSignals.push(signal);signal.addEventListener('abort',()=>reject(Error('cancelled')));
 }));
 vi.spyOn(window,'confirm').mockReturnValue(true);
 const page=render(<CliProviderSettings {...f}/>);
 fireEvent.click(screen.getByText('Check Codex CLI'));await screen.findByText(/appears installed and signed in/);
 fireEvent.change(screen.getByLabelText('Codex model'),{target:{value:'gpt-5'}});
 fireEvent.click(screen.getByText('Activate Codex CLI'));
 fireEvent.click(screen.getByText(/Test Codex translation/));await screen.findByText('Cancel Codex test');
 page.unmount();expect(abortSignals[0].aborted).toBe(true);
});
it('handles an installed CLI without a version string',async()=>{
 const f=fixture({installed:true,authenticated:true,version:''});render(<CliProviderSettings {...f}/>);
 fireEvent.click(screen.getByText('Check Codex CLI'));expect(await screen.findByText(/Installed version: unknown/)).toBeTruthy();
});

it('activates the native CLI bridge only when Tauri is available at module import',async()=>{
 vi.resetModules();
 const invoke=vi.fn(async(name:string)=>name==='folio_cli_status'?{installed:true,authenticated:true,version:'codex'}:null);
 vi.stubGlobal('__TAURI__',{core:{invoke}});
 const module=await import('./cli-settings');
 const view=render(<module.CliProviderSettings onChange={vi.fn()}/>);
 fireEvent.click(screen.getByText('Check Codex CLI'));
 await screen.findByText(/appears installed and signed in/);
 expect(invoke).toHaveBeenCalledWith('folio_cli_status');
 view.unmount();vi.resetModules();vi.unstubAllGlobals();
});
