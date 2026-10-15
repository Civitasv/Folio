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
 expect(bridge.saveKey).toHaveBeenCalledWith('secret');
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
