import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {TranslationPanel} from './translation-panel';
import type {TranslationPlatform} from '@folio/platform';
import {languagePreferences,type LanguagePreferences,type TranslationIdentity,type TranslationEntry,type TranslationProvider} from '@folio/core';
const doc={id:'sha256:abc',title:'Paper',progress:2};
const u={anchor:{kind:'epub' as const,spineIndex:0,cfi:'epubcfi(/6/2)'},unitIndex:0,text:'Hello world'};
const prefs:LanguagePreferences={source:'en',target:'fr',recentTargets:['fr'],view:'bilingual'};
function fixture(){
 let settings={...prefs};
 const cache=new Map<string,TranslationEntry>();
 const key=(x:TranslationIdentity)=>[x.documentId,x.unit.text,x.target,x.source,x.providerId,x.model,x.unit.unitIndex].join('|');
 const platform:TranslationPlatform={
  getLanguages:vi.fn(async()=>settings),
  setLanguages:vi.fn(async p=>{settings=languagePreferences(p);return settings;}),
  findTranslation:vi.fn(async x=>cache.get(key(x))),
  saveManualTranslation:vi.fn(async(x,text)=>{
   const entry:TranslationEntry={key:key(x),identity:x,sourceHash:'hash',translatedText:text,provenance:'manual'};cache.set(key(x),entry);return entry;
  }),
  translate:vi.fn(async(x,provider,signal)=>{
   const translatedText=await provider.translate({text:x.unit.text,source:x.source,target:x.target,promptVersion:x.promptVersion},signal);
   const entry:TranslationEntry={key:key(x),identity:x,sourceHash:'hash',translatedText,provenance:'provider'};cache.set(key(x),entry);return entry;
  }),
  deleteTranslations:vi.fn(async()=>{})
 };
 return {platform,cache};
}
const provider:TranslationProvider={id:'mock',model:'small',supportsAutoSource:true,translate:vi.fn(async()=> 'Bonjour')};
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('loads and saves a manual local draft with original/translation alignment and no default provider call',async()=>{
 const f=fixture();render(<TranslationPanel doc={doc} platform={f.platform} units={[u]}/>);
 expect(screen.getByText('Loading translation settings…')).toBeTruthy();
 expect(await screen.findByText(/AI provider unavailable/)).toBeTruthy();
 expect(f.platform.translate).not.toHaveBeenCalled();
 expect(screen.getByTestId('translation-original')).toHaveProperty('textContent','Hello world');
 fireEvent.change(screen.getByLabelText('Manual translation'),{target:{value:'Bonjour !'}});
 fireEvent.click(screen.getByText('Save local translation'));
 expect(await screen.findByText('Local translation draft saved.')).toBeTruthy();
 expect(screen.getByTestId('translation-result')).toHaveProperty('textContent','Bonjour !');
 expect(f.platform.saveManualTranslation).toHaveBeenCalledWith(expect.objectContaining({documentId:doc.id,unit:u,
  source:'en',target:'fr',providerId:'manual',model:'local-draft'}),'Bonjour !');
});
it('switches target and view, reloads only matching cache, and handles multiple content units',async()=>{
 const f=fixture();
 render(<TranslationPanel doc={doc} platform={f.platform} units={[u,{...u,unitIndex:1,text:'Second paragraph'}]}/>);
 await screen.findByText(/AI provider unavailable/);
 fireEvent.change(screen.getByLabelText('Manual translation'),{target:{value:'Bonjour'}});
 fireEvent.click(screen.getByText('Save local translation'));await screen.findByText('Local translation draft saved.');
 fireEvent.change(screen.getByLabelText('Target language'),{target:{value:'ja'}});
 await waitFor(()=>expect(f.platform.setLanguages).toHaveBeenCalledWith(expect.objectContaining({target:'ja'})));
 await waitFor(()=>expect(screen.getByTestId('translation-result').textContent).toContain('No cached translation'));
 fireEvent.change(screen.getByLabelText('Translation view'),{target:{value:'original'}});
 await waitFor(()=>expect(f.platform.setLanguages).toHaveBeenCalledWith(expect.objectContaining({view:'original'})));
 expect(screen.queryByTestId('translation-result')).toBeNull();
 fireEvent.change(screen.getByLabelText('Translation view'),{target:{value:'translation'}});
 await waitFor(()=>expect(f.platform.setLanguages).toHaveBeenCalledWith(expect.objectContaining({view:'translation'})));
 expect(screen.queryByTestId('translation-original')).toBeNull();
 fireEvent.change(screen.getByLabelText('Content unit'),{target:{value:'1'}});
 await waitFor(()=>expect(f.platform.findTranslation).toHaveBeenCalledWith(expect.objectContaining({unit:expect.objectContaining({unitIndex:1,text:'Second paragraph'})})));
});
it('treats PDF excerpts as explicit user entry bound to current page and keeps empty text disabled',async()=>{
 const f=fixture();render(<TranslationPanel doc={doc} platform={f.platform}/>);
 await screen.findByLabelText('PDF excerpt');
 expect(screen.getByText('Save local translation')).toHaveProperty('disabled',true);
 fireEvent.change(screen.getByLabelText('PDF excerpt'),{target:{value:'Citation [1]'}});
 fireEvent.change(screen.getByLabelText('Manual translation'),{target:{value:'Référence [1]'}});
 fireEvent.click(screen.getByText('Save local translation'));
 await waitFor(()=>expect(f.platform.saveManualTranslation).toHaveBeenCalledWith(expect.objectContaining({
  unit:{anchor:{kind:'pdf',page:2},unitIndex:0,text:'Citation [1]'}}),'Référence [1]'));
});
it('requires explicit confirmation for provider, supports cancelled consent and successful translation',async()=>{
 const f=fixture(),confirm=vi.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValue(true);
 const mock={...provider,translate:vi.fn(async()=> 'Bonjour')};
 render(<TranslationPanel doc={doc} platform={f.platform} units={[u]} provider={mock}/>);
 await screen.findByLabelText('Translation method');
 fireEvent.change(screen.getByLabelText('Translation method'),{target:{value:'provider'}});
 fireEvent.click(screen.getByText('Translate displayed excerpt'));
 expect(confirm).toHaveBeenCalledOnce();expect(f.platform.translate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Translate displayed excerpt'));
 await waitFor(()=>expect(f.platform.translate).toHaveBeenCalledOnce());
 expect(await screen.findByText('Provider translation saved locally.')).toBeTruthy();
 expect(screen.getByTestId('translation-result')).toHaveProperty('textContent','Bonjour');
 expect(screen.getByText('Provider translation')).toBeTruthy();
});
it('shows provider cancellation and failure, and manual fallback',async()=>{
 const f=fixture();let reject!:(e:Error)=>void;
 const mock={...provider,translate:vi.fn(()=>new Promise<string>((_resolve,failed)=>{reject=failed;}))};
 vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<TranslationPanel doc={doc} platform={f.platform} units={[u]} provider={mock}/>);
 await screen.findByLabelText('Translation method');
 fireEvent.change(screen.getByLabelText('Translation method'),{target:{value:'provider'}});
 fireEvent.click(screen.getByText('Translate displayed excerpt'));
 expect(await screen.findByText('Cancel translation')).toBeTruthy();
 fireEvent.click(screen.getByText('Cancel translation'));
 await act(async()=>reject(Error('cancelled')));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Translation cancelled.');
 vi.mocked(mock.translate).mockRejectedValueOnce(Error('provider down'));
 fireEvent.click(screen.getByText('Translate displayed excerpt'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Provider translation failed.'));
 fireEvent.change(screen.getByLabelText('Translation method'),{target:{value:'manual'}});
 expect(screen.getByLabelText('Manual translation')).toBeTruthy();
});
it('handles cache, settings and local save errors without claiming success',async()=>{
 const f=fixture();vi.mocked(f.platform.getLanguages).mockRejectedValueOnce(Error('quota'));
 const view=render(<TranslationPanel doc={doc} platform={f.platform} units={[u]}/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Cannot load translation preferences.');
 view.unmount();
 vi.mocked(f.platform.findTranslation).mockRejectedValueOnce(Error('storage'));
 render(<TranslationPanel doc={doc} platform={f.platform} units={[u]}/>);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Cannot read local translation cache.');
 vi.mocked(f.platform.setLanguages).mockRejectedValueOnce(Error('invalid'));
 fireEvent.change(screen.getByLabelText('Source language'),{target:{value:'ja'}});
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Invalid language preferences or local storage unavailable.');
 vi.mocked(f.platform.saveManualTranslation).mockRejectedValueOnce(Error('quota'));
 fireEvent.change(screen.getByLabelText('Manual translation'),{target:{value:'bonjour'}});
 fireEvent.click(screen.getByText('Save local translation'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Unable to save translation'));
});
it('renders empty EPUB chapter translation context and ignores a late preference result after unmount',async()=>{
 const f=fixture();let finish!:(p:LanguagePreferences)=>void;
 vi.mocked(f.platform.getLanguages).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const view=render(<TranslationPanel doc={doc} platform={f.platform} units={[]}/>);
 view.unmount();await act(async()=>finish(prefs));
 render(<TranslationPanel doc={doc} platform={f.platform} units={[]}/>);
 await screen.findByLabelText('Source language');
 expect(screen.queryByText('Save local translation')).toBeNull();
});

it('rehydrates an exact cached draft offline without sending text to any provider',async()=>{
 const f=fixture();
 await f.platform.saveManualTranslation({documentId:doc.id,unit:u,source:'en',target:'fr',providerId:'manual',
 model:'local-draft',promptVersion:'f01d-v1'},'Cached Bonjour');
 render(<TranslationPanel doc={doc} platform={f.platform} units={[u]}/>);
 await waitFor(()=>expect(screen.getByTestId('translation-result')).toHaveProperty('textContent','Cached Bonjour'));
 expect(screen.getByLabelText('Manual translation')).toHaveProperty('value','Cached Bonjour');
 expect(f.platform.translate).not.toHaveBeenCalled();
});
it('cleans up pending provider requests and discards a late settings failure after unmount',async()=>{
 const f=fixture(),controllerSignal:AbortSignal[]=[];
 const mock={...provider,translate:vi.fn((_req:unknown,signal:AbortSignal)=>new Promise<string>((_resolve,reject)=>{
  controllerSignal.push(signal);signal.addEventListener('abort',()=>reject(Error('cancelled')));
 }))};
 vi.spyOn(window,'confirm').mockReturnValue(true);
 const page=render(<TranslationPanel doc={doc} platform={f.platform} units={[u]} provider={mock}/>);
 await screen.findByLabelText('Translation method');
 fireEvent.change(screen.getByLabelText('Translation method'),{target:{value:'provider'}});
 fireEvent.click(screen.getByText('Translate displayed excerpt'));
 expect(await screen.findByText('Cancel translation')).toBeTruthy();
 page.unmount();expect(controllerSignal[0].aborted).toBe(true);
 let reject!:(error:Error)=>void;
 vi.mocked(f.platform.getLanguages).mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));
 const stale=render(<TranslationPanel doc={doc} platform={f.platform} units={[u]}/>);
 stale.unmount();await act(async()=>reject(Error('late storage failure')));
});
it('does not apply cache errors after unmount or lose manual mode when a provider disappears',async()=>{
 const f=fixture();let reject!:(e:Error)=>void;
 vi.mocked(f.platform.findTranslation).mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));
 const view=render(<TranslationPanel doc={doc} platform={f.platform} units={[u]} provider={provider}/>);
 await waitFor(()=>expect(f.platform.findTranslation).toHaveBeenCalledOnce());
 view.unmount();await act(async()=>reject(Error('late cache failure')));
 const second=render(<TranslationPanel doc={doc} platform={f.platform} units={[u]} provider={provider}/>);
 await screen.findByLabelText('Translation method');
 fireEvent.change(screen.getByLabelText('Translation method'),{target:{value:'provider'}});
 second.rerender(<TranslationPanel doc={doc} platform={f.platform} units={[u]}/>);
 expect(screen.queryByLabelText('Translation method')).toBeNull();
 expect(screen.getByLabelText('Manual translation')).toBeTruthy();
});

it('accepts arbitrary canonical BCP-47 source and target tags and displays recent custom targets',async()=>{
 const f=fixture();render(<TranslationPanel doc={doc} platform={f.platform} units={[u]}/>);
 await screen.findByLabelText('Custom target language');
 fireEvent.change(screen.getByLabelText('Custom target language'),{target:{value:'PT-br'}});
 fireEvent.click(screen.getByText('Use target language'));
 await waitFor(()=>expect(screen.getByLabelText('Target language')).toHaveProperty('value','pt-BR'));
 expect(screen.getByText('pt-BR (recent)')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Custom source language'),{target:{value:'ko-KR'}});
 fireEvent.click(screen.getByText('Use source language'));
 await waitFor(()=>expect(screen.getByLabelText('Source language')).toHaveProperty('value','ko-KR'));
 expect(screen.getByRole('option',{name:'ko-KR'})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Target language'),{target:{value:'fr'}});
 await waitFor(()=>expect(screen.getByLabelText('Target language')).toHaveProperty('value','fr'));
 fireEvent.change(screen.getByLabelText('Target language'),{target:{value:'pt-BR'}});
 await waitFor(()=>expect(screen.getByLabelText('Target language')).toHaveProperty('value','pt-BR'));
 fireEvent.change(screen.getByLabelText('Custom target language'),{target:{value:'bad_@@'}});
 fireEvent.click(screen.getByText('Use target language'));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Invalid language preferences or local storage unavailable.');
});
it('disables blank custom language actions without persisting a spurious choice',async()=>{
 const f=fixture();render(<TranslationPanel doc={doc} platform={f.platform} units={[u]}/>);
 await screen.findByLabelText('Custom target language');
 expect(screen.getByText('Use target language')).toHaveProperty('disabled',true);
 expect(screen.getByText('Use source language')).toHaveProperty('disabled',true);
});


it('shows only translated target output in the focused PDF pane with advanced language options folded away',async()=>{
 const f=fixture();
 render(<TranslationPanel doc={doc} platform={f.platform} layout="target-pane"/>);
 expect(await screen.findByText(/No translation yet/)).toBeTruthy();
 expect(screen.getByRole('region',{name:'Target translation'})).toBeTruthy();
 expect(screen.queryByTestId('translation-original')).toBeNull();
 expect(screen.queryByLabelText('Translation view')).toBeNull();
 expect(f.platform.translate).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Target language'),{target:{value:'ja'}});
 await waitFor(()=>expect(f.platform.setLanguages).toHaveBeenCalledWith(expect.objectContaining({target:'ja'})));
 fireEvent.click(screen.getByText('Language options'));
 expect(screen.getByLabelText('Source language')).toBeTruthy();
 fireEvent.click(screen.getByText('Add source passage'));
 fireEvent.change(screen.getByLabelText('PDF excerpt'),{target:{value:'Local PDF passage'}});
 fireEvent.change(screen.getByLabelText('Manual translation'),{target:{value:'訳文'}});
 fireEvent.click(screen.getByText('Save local translation'));
 await waitFor(()=>expect(f.platform.saveManualTranslation).toHaveBeenCalledWith(expect.objectContaining({
  target:'ja',unit:{anchor:{kind:'pdf',page:2},unitIndex:0,text:'Local PDF passage'}
 }),'訳文'));
 expect(screen.getByTestId('translation-result').textContent).toContain('訳文');
 expect(screen.getByText('Local draft')).toBeTruthy();
 expect(f.platform.translate).not.toHaveBeenCalled();
});
