import {expect,it,vi} from 'vitest';
import {createTranslationPlatform,sha256Text,type TranslationStore} from './translation-platform';
import {DEFAULT_LANGUAGE_PREFERENCES,type LanguagePreferences,type TranslationEntry,type TranslationIdentity} from '@folio/core';
const unit={anchor:{kind:'epub' as const,spineIndex:0,cfi:'epubcfi(/6/2)'},unitIndex:0,text:'Hello world'};
const input:TranslationIdentity={documentId:'epub:abc',unit,source:'en',target:'fr',providerId:'manual',model:'local-draft',promptVersion:'f01d-v1'};
function fake(){
 let settings:LanguagePreferences|undefined;
 const cache=new Map<string,TranslationEntry>();
 const store:TranslationStore={readPreferences:vi.fn(async()=>settings),writePreferences:vi.fn(async p=>{settings=p;}),
  read:vi.fn(async key=>cache.get(key)),write:vi.fn(async item=>{cache.set(item.key,item);}),
  removeDocument:vi.fn(async id=>{for(const [key,entry] of cache)if(entry.identity.documentId===id)cache.delete(key);})};
 const digest=vi.fn(async text=>'hash:'+text);
 return {store,digest,cache,p:createTranslationPlatform(store,digest)};
}
it('remembers settings and at least three language choices locally',async()=>{
 const f=fake();
 expect(await f.p.getLanguages()).toEqual({...DEFAULT_LANGUAGE_PREFERENCES,recentTargets:['zh-Hans']});
 for(const target of ['fr','ja','de'])await f.p.setLanguages({source:'auto',target,recentTargets:['fr','ja'],view:'bilingual'});
 expect((await f.p.getLanguages()).target).toBe('de');
 expect(f.store.writePreferences).toHaveBeenCalledTimes(3);
 await expect(f.p.setLanguages({...DEFAULT_LANGUAGE_PREFERENCES,source:'en',target:'en'})).rejects.toThrow('identical');
});
it('keeps format anchors, source hashes, target language, model and prompt distinct in local cache',async()=>{
 const f=fake();const one=await f.p.saveManualTranslation(input,' Bonjour ');
 expect(one.translatedText).toBe('Bonjour');
 expect(one.provenance).toBe('manual');
 expect(await f.p.findTranslation(input)).toEqual(one);
 for(const x of [{...input,target:'ja'},{...input,unit:{...unit,text:'Changed'}},{...input,model:'new'},
  {...input,promptVersion:'v2'},{...input,providerId:'different'},
  {...input,unit:{...unit,anchor:{kind:'epub' as const,spineIndex:1,cfi:'epubcfi(/6/4)'}}},
  {...input,unit:{...unit,unitIndex:1}},
  {...input,unit:{...unit,anchor:{kind:'pdf' as const,page:1}}}])
  expect(await f.p.findTranslation(x)).toBeUndefined();
 expect(f.cache.size).toBe(1);
 expect(f.digest).toHaveBeenCalledWith('Hello world');
 await f.p.deleteTranslations('epub:abc');
 expect(f.cache.size).toBe(0);
});
it('rejects invalid drafts and does not store malformed output',async()=>{
 const f=fake();
 for(const text of ['   ','x'.repeat(16001)])await expect(f.p.saveManualTranslation(input,text)).rejects.toThrow('Invalid translation output');
 expect(f.cache.size).toBe(0);
});
it('does not execute a provider implicitly; validates capability, cancellation and identity',async()=>{
 const f=fake(),signal=new AbortController();
 const provider={id:'mock',model:'test',supportsAutoSource:false,translate:vi.fn(async()=> ' Bonjour ')};
 expect(provider.translate).not.toHaveBeenCalled();
 await expect(f.p.translate({...input,providerId:'other'},provider,signal.signal)).rejects.toThrow('mismatch');
 await expect(f.p.translate({...input,source:'auto',providerId:'mock',model:'test'},provider,signal.signal)).rejects.toThrow('detect');
 signal.abort();
 await expect(f.p.translate({...input,providerId:'mock',model:'test'},provider,signal.signal)).rejects.toThrow('cancelled');
 expect(provider.translate).not.toHaveBeenCalled();
 const next=new AbortController();
 const ok=await f.p.translate({...input,providerId:'mock',model:'test'},provider,next.signal);
 expect(ok.provenance).toBe('provider');
 expect(ok.translatedText).toBe('Bonjour');
 expect(provider.translate).toHaveBeenCalledWith({text:'Hello world',source:'en',target:'fr',promptVersion:'f01d-v1'},next.signal);
});
it('rejects provider results after cancellation and preserves cache',async()=>{
 const f=fake(),abort=new AbortController();
 const provider={id:'mock',model:'test',supportsAutoSource:true,translate:vi.fn(async()=>{abort.abort();return 'Late';})};
 await expect(f.p.translate({...input,source:'auto',providerId:'mock',model:'test'},provider,abort.signal)).rejects.toThrow('cancelled');
 expect(f.cache.size).toBe(0);
});
it('returns deterministic SHA-256 digest in hex for UTF-8 text',async()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 vi.stubGlobal('crypto',{subtle:{digest:vi.fn(async()=>new Uint8Array([0,255,12]).buffer)}});
 expect(await sha256Text('é')).toBe('00ff0c');
 vi.unstubAllGlobals();
 expect(prior).toBeDefined();
});
