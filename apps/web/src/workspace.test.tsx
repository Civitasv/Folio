import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';

vi.mock('./app',()=>({App:({translationProvider,onOpenSettings}:{
 translationProvider?:{id:string};onOpenSettings:()=>void
})=><><button onClick={onOpenSettings}>Settings</button><output data-testid="active-provider">{translationProvider?.id??'manual'}</output></>}));
vi.mock('./api-settings',()=>({ApiProviderSettings:({onChange}:{onChange:(provider:unknown)=>void})=>
 <section aria-label="Mock API config"><button onClick={()=>onChange({id:'api:test',model:'m',supportsAutoSource:true,translate:vi.fn()})}>Connect API</button>
 <button onClick={()=>onChange(undefined)}>Clear API</button></section>}));
vi.mock('./cli-settings',()=>({CliProviderSettings:({onChange}:{onChange:(provider:unknown)=>void})=>
 <section aria-label="Mock CLI config"><button onClick={()=>onChange({id:'cli:codex',model:'m',supportsAutoSource:true,translate:vi.fn()})}>Connect CLI</button>
 <button onClick={()=>onChange(undefined)}>Clear CLI</button></section>}));
import {Workspace} from './workspace';
afterEach(()=>cleanup());

it('does not expose the provider forms on the library first screen, restores focus and closes by Escape',()=>{
 render(<Workspace/>);
 const open=screen.getByRole('button',{name:'Settings'});
 open.focus();
 expect(screen.queryByRole('dialog',{name:'Settings'})).toBeNull();
 expect(screen.getByTestId('active-provider')).toHaveProperty('textContent','manual');
 fireEvent.click(open);
 const dialog=screen.getByRole('dialog',{name:'Settings'});
 expect(dialog.getAttribute('aria-modal')).toBe('true');
 expect(screen.getByRole('button',{name:'Close settings'})).toBe(document.activeElement);
 fireEvent.keyDown(window,{key:'ArrowRight'});
 expect(screen.getByRole('dialog',{name:'Settings'})).toBeTruthy();
 fireEvent.keyDown(window,{key:'Escape'});
 expect(screen.queryByRole('dialog',{name:'Settings'})).toBeNull();
 expect(document.activeElement).toBe(open);
 fireEvent.click(open);fireEvent.click(screen.getByRole('button',{name:'Close settings'}));
 expect(screen.queryByRole('dialog',{name:'Settings'})).toBeNull();
 expect(document.activeElement).toBe(open);
});
it('switches between manual/API/CLI and falls back to manual when current provider clears',()=>{
 render(<Workspace/>);fireEvent.click(screen.getByRole('button',{name:'Settings'}));
 const choice=screen.getByLabelText('Active translation backend') as HTMLSelectElement;
 expect(choice.value).toBe('manual');
 expect(screen.getByRole('option',{name:'Configured API provider'})).toHaveProperty('disabled',true);
 expect(screen.getByRole('option',{name:'Authenticated Codex CLI'})).toHaveProperty('disabled',true);
 fireEvent.click(screen.getByRole('button',{name:'Connect API'}));
 expect(choice.value).toBe('api');
 expect(screen.getByTestId('active-provider').textContent).toBe('api:test');
 fireEvent.click(screen.getByRole('button',{name:'Connect CLI'}));
 expect(choice.value).toBe('cli');
 expect(screen.getByTestId('active-provider').textContent).toBe('cli:codex');
 fireEvent.change(choice,{target:{value:'api'}});
 expect(screen.getByTestId('active-provider').textContent).toBe('api:test');
 fireEvent.click(screen.getByRole('button',{name:'Clear API'}));
 expect(choice.value).toBe('manual');
 expect(screen.getByTestId('active-provider').textContent).toBe('manual');
 fireEvent.click(screen.getByRole('button',{name:'Connect API'}));
 fireEvent.click(screen.getByRole('button',{name:'Connect CLI'}));
 fireEvent.click(screen.getByRole('button',{name:'Clear API'}));
 expect(choice.value).toBe('cli');
 fireEvent.click(screen.getByRole('button',{name:'Clear CLI'}));
 expect(choice.value).toBe('manual');
 fireEvent.click(screen.getByRole('button',{name:'Connect CLI'}));
 fireEvent.click(screen.getByRole('button',{name:'Connect API'}));
 fireEvent.click(screen.getByRole('button',{name:'Clear CLI'}));
 expect(choice.value).toBe('api');
 fireEvent.change(choice,{target:{value:'manual'}});
 expect(screen.getByTestId('active-provider').textContent).toBe('manual');
 fireEvent.change(choice,{target:{value:'api'}});
 expect(screen.getByTestId('active-provider').textContent).toBe('api:test');
});
