import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {ApiProviderSettings} from './api-settings';
import type {NativeApiBridge} from '@folio/platform';
const response=()=>new Response(JSON.stringify({choices:[{message:{content:'Bonjour'}}]}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function fill(){fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-1'}});
 fireEvent.change(screen.getByLabelText('API key'),{target:{value:'secret'}});
}
it('starts with no provider, requires in-memory key and user-initiated billable probe',async()=>{
 const change=vi.fn(),fetcher=vi.fn(async()=>response());
 render(<ApiProviderSettings onChange={change} fetcher={fetcher}/>);
 expect(change).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-1'}});
 fireEvent.click(screen.getByText('Activate API provider'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Enter an API key for this browser session');
 fireEvent.change(screen.getByLabelText('API key'),{target:{value:'secret'}});
 fireEvent.click(screen.getByText('Activate API provider'));
 await screen.findByText(/Browser provider activated/);
 expect(change).toHaveBeenCalledWith(expect.objectContaining({model:'model-1'}));
 expect(fetcher).not.toHaveBeenCalled();
 const confirm=vi.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
 fireEvent.click(screen.getByText(/Test connection/));expect(fetcher).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText(/Test connection/));
 await screen.findByText('Connection test succeeded.');
 expect(fetcher).toHaveBeenCalledOnce();expect(confirm).toHaveBeenCalledTimes(2);
});
it('rejects invalid endpoint and model, forgets active provider after edits and key clearing',async()=>{
 const change=vi.fn(),fetcher=vi.fn(async()=>response());
 render(<ApiProviderSettings onChange={change} fetcher={fetcher}/>);
 fireEvent.change(screen.getByLabelText('API endpoint'),{target:{value:'http://localhost/v1'}});
 fill();fireEvent.click(screen.getByText('Activate API provider'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('HTTPS'));
 fireEvent.change(screen.getByLabelText('API endpoint'),{target:{value:'https://api.example.org/v1'}});
 fireEvent.click(screen.getByText('Activate API provider'));
 await screen.findByText(/Browser provider activated/);
 fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-2'}});
 expect(change).toHaveBeenLastCalledWith(undefined);
 fireEvent.click(screen.getByText('Clear API key'));
 expect(await screen.findByText('API credential cleared.')).toBeTruthy();
 expect(screen.getByLabelText('API key')).toHaveProperty('value','');
});
it('saves desktop secrets through the native bridge, reuses stored credential, probes, and clears it',async()=>{
 let stored=false;
 const bridge:NativeApiBridge={saveKey:vi.fn(async()=>{stored=true;}),hasKey:vi.fn(async()=>stored),
 clearKey:vi.fn(async()=>{stored=false;}),translate:vi.fn(async()=> 'Bonjour')};
 const change=vi.fn();vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<ApiProviderSettings onChange={change} bridge={bridge}/>);
 expect(await screen.findByText('No desktop credential stored.')).toBeTruthy();
 fill();fireEvent.click(screen.getByText('Activate API provider'));
 await screen.findByText(/Desktop provider activated/);
 expect(bridge.saveKey).toHaveBeenCalledWith('https://api.openai.com/v1','secret');
 expect(screen.getByLabelText('API key')).toHaveProperty('value','');
 fireEvent.click(screen.getByText(/Test connection/));
 await screen.findByText('Connection test succeeded.');
 expect(bridge.translate).toHaveBeenCalled();
 fireEvent.click(screen.getByText('Clear API key'));
 expect(await screen.findByText('API credential cleared.')).toBeTruthy();
 expect(bridge.clearKey).toHaveBeenCalledOnce();
});
it('reports native storage unavailable, missing key, failed connection and clear failures',async()=>{
 const bridge:NativeApiBridge={saveKey:vi.fn(async()=>{}),hasKey:vi.fn(async()=>false),
 clearKey:vi.fn(async()=>{throw Error('locked');}),translate:vi.fn(async()=>{throw Error('not authorized');})};
 render(<ApiProviderSettings onChange={vi.fn()} bridge={bridge}/>);
 await screen.findByText('No desktop credential stored.');
 fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-1'}});
 fireEvent.click(screen.getByText('Activate API provider'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('OS credential'));
 fireEvent.click(screen.getByText('Clear API key'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Unable to clear the OS credential.');
 vi.mocked(bridge.hasKey).mockRejectedValueOnce(Error('locked'));
 cleanup();render(<ApiProviderSettings onChange={vi.fn()} bridge={bridge}/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','OS credential store unavailable.');
});
it('handles provider health errors and explicit cancellation without leaking a saved key',async()=>{
 const bridge:NativeApiBridge={saveKey:vi.fn(async()=>{}),hasKey:vi.fn(async()=>true),
 clearKey:vi.fn(async()=>{}),translate:vi.fn(async()=>{throw Error('service denied');})};
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<ApiProviderSettings onChange={vi.fn()} bridge={bridge}/>);
 fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-1'}});
 fireEvent.click(screen.getByText('Activate API provider'));
 await screen.findByText(/Desktop provider activated/);
 fireEvent.click(screen.getByText(/Test connection/));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','service denied');
 expect(confirm).toHaveBeenCalledOnce();
});

it('uses a previously saved desktop credential without requiring re-entry',async()=>{
 const bridge:NativeApiBridge={saveKey:vi.fn(async()=>{}),hasKey:vi.fn(async()=>true),
 clearKey:vi.fn(async()=>{}),translate:vi.fn(async()=> 'Bonjour')};
 render(<ApiProviderSettings onChange={vi.fn()} bridge={bridge}/>);
 await screen.findByText(/A desktop credential is stored/);
 fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-1'}});
 fireEvent.click(screen.getByText('Activate API provider'));
 await screen.findByText(/Desktop provider activated/);
 expect(bridge.saveKey).not.toHaveBeenCalled();
});
it('reveals cancellation and handles non-Error activation, probe and storage failures',async()=>{
 const bridge:NativeApiBridge={saveKey:vi.fn(async()=>{throw 'denied';}),hasKey:vi.fn(async()=>true),
 clearKey:vi.fn(async()=>{}),translate:vi.fn(async()=>{throw 'provider down';})};
 const change=vi.fn();vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<ApiProviderSettings onChange={change} bridge={bridge}/>);
 fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-1'}});
 fireEvent.change(screen.getByLabelText('API key'),{target:{value:'secret'}});
 fireEvent.click(screen.getByText('Activate API provider'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Provider activation failed');
 vi.mocked(bridge.saveKey).mockResolvedValueOnce();
 fireEvent.click(screen.getByText('Activate API provider'));
 await screen.findByText(/Desktop provider activated/);
 fireEvent.click(screen.getByText(/Test connection/));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Connection test failed');
});
it('aborts a running user-initiated connection test via explicit cancel',async()=>{
 let finish!:(error:Error)=>void;
 const bridge:NativeApiBridge={saveKey:vi.fn(async()=>{}),hasKey:vi.fn(async()=>true),clearKey:vi.fn(async()=>{}),
 translate:vi.fn(async(_config,_request,signal)=>new Promise<string>((_resolve,reject)=>{
  finish=reject;signal.addEventListener('abort',()=>reject(Error('cancelled')));
 }))};
 vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<ApiProviderSettings onChange={vi.fn()} bridge={bridge}/>);
 fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-1'}});
 fireEvent.click(screen.getByText('Activate API provider'));await screen.findByText(/Desktop provider activated/);
 fireEvent.click(screen.getByText(/Test connection/));expect(await screen.findByText('Cancel connection test')).toBeTruthy();
 fireEvent.click(screen.getByText('Cancel connection test'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Connection test cancelled.');
});
it('aborts an in-flight probe when provider panel unmounts and ignores late status',async()=>{
 let finish!:(result:string)=>void;
 const bridge:NativeApiBridge={saveKey:vi.fn(async()=>{}),hasKey:vi.fn(async()=>true),clearKey:vi.fn(async()=>{}),
 translate:vi.fn(async()=>new Promise<string>(resolve=>{finish=resolve;}))};
 vi.spyOn(window,'confirm').mockReturnValue(true);
 const page=render(<ApiProviderSettings onChange={vi.fn()} bridge={bridge}/>);
 fireEvent.change(screen.getByLabelText('API model'),{target:{value:'model-1'}});
 fireEvent.click(screen.getByText('Activate API provider'));await screen.findByText(/Desktop provider activated/);
 fireEvent.click(screen.getByText(/Test connection/));await screen.findByText('Cancel connection test');
 page.unmount();await act(async()=>finish('Late'));expect(bridge.translate).toHaveBeenCalledOnce();
});

it('activates the default native Tauri bridge when the global API exists at module evaluation',async()=>{
 vi.resetModules();
 const invoke=vi.fn(async(name:string)=>{
  if(name==='folio_api_has_key')return true;
  return null;
 });
 vi.stubGlobal('__TAURI__',{core:{invoke}});
 const module=await import('./api-settings');
 const view=render(<module.ApiProviderSettings onChange={vi.fn()}/>);
 expect(await screen.findByText(/A desktop credential is stored/)).toBeTruthy();
 view.unmount();vi.resetModules();vi.unstubAllGlobals();
});

it('never reuses a desktop key for a different API endpoint',async()=>{
 const saved=new Map<string,string>();
 const desktop:NativeApiBridge={
  saveKey:vi.fn(async(endpoint,key)=>{saved.set(endpoint,key);}),
  hasKey:vi.fn(async endpoint=>saved.has(endpoint)),
  clearKey:vi.fn(async endpoint=>{saved.delete(endpoint);}),
  translate:vi.fn(async()=> 'Bonjour')
 };
 render(<ApiProviderSettings onChange={vi.fn()} bridge={desktop}/>);
 await screen.findByText('No desktop credential stored.');
 fill();fireEvent.click(screen.getByText('Activate API provider'));
 await screen.findByText(/Desktop provider activated/);
 fireEvent.change(screen.getByLabelText('API endpoint'),{target:{value:'https://other.example.org/v1'}});
 fireEvent.click(screen.getByText('Activate API provider'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Save a key'));
 expect(desktop.hasKey).toHaveBeenCalledWith('https://other.example.org/v1');
 expect(desktop.translate).not.toHaveBeenCalled();
});
