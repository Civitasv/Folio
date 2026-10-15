import {expect,it,vi} from 'vitest';
import {createTranslationIndexedDb} from './translation-indexeddb';
import type {LanguagePreferences,TranslationEntry} from '@folio/core';
type Outcome='ok'|'open-error'|'blocked'|'tx-error'|'tx-abort';
function fake(outcome:Outcome='ok',error=true){
 const rows=new Map<string,unknown>(),close=vi.fn(),createObjectStore=vi.fn();let upgraded=false;
 const open=vi.fn(()=>{
  const request:any={result:null,error:error?Error('open failed'):null};
  queueMicrotask(()=>{
   if(outcome==='open-error'){request.onerror?.();return;}
   if(outcome==='blocked'){request.onblocked?.();return;}
   request.result={close,createObjectStore,transaction:vi.fn((_name:string,_mode:string)=>{
    const tx:any={error:error?Error('tx failed'):null};
    function reply<T>(callback:()=>T){
     const req:any={result:undefined};
     queueMicrotask(()=>{req.result=callback();req.onsuccess?.();queueMicrotask(()=>{
      if(outcome==='tx-error')tx.onerror?.();
      else if(outcome==='tx-abort')tx.onabort?.();
      else tx.oncomplete?.();
     });});return req;
    }
    tx.objectStore=()=>({get:(key:string)=>reply(()=>rows.get(key)),
     getAll:()=>reply(()=>[...rows.values()]),put:(entry:any)=>reply(()=>{rows.set(entry.key,entry);return entry.key;}),
     delete:(key:string)=>reply(()=>{rows.delete(key);})});
    return tx;
   })};
   if(!upgraded){upgraded=true;request.onupgradeneeded?.();}
   request.onsuccess?.();
  });return request as IDBOpenDBRequest;
 });
 return {factory:{open},open,rows,close,createObjectStore};
}
const prefs:LanguagePreferences={source:'en',target:'ja',recentTargets:['ja'],view:'bilingual'};
const entry=(id:string,key:string):TranslationEntry=>({key,identity:{documentId:id,unit:{anchor:{kind:'pdf',page:2},unitIndex:0,text:'Text'},
 source:'en',target:'ja',providerId:'manual',model:'local-draft',promptVersion:'f01d-v1'},
 sourceHash:'hash',translatedText:'翻訳',provenance:'manual'});
it('opens a dedicated v1 database and commits preferences, cache, and targeted cleanup',async()=>{
 const f=fake(),s=createTranslationIndexedDb(f.factory);
 expect(await s.readPreferences()).toBeUndefined();
 await s.writePreferences(prefs);
 expect(await s.readPreferences()).toEqual(prefs);
 expect(await s.read('missing')).toBeUndefined();
 const a=entry('sha256:a','sha256%3Aa|first'),b=entry('sha256:b','sha256%3Ab|first');
 await s.write(a);await s.write(b);
 expect(await s.read(a.key)).toEqual(a);
 await s.removeDocument('sha256:a');
 expect(await s.read(a.key)).toBeUndefined();
 expect(await s.read(b.key)).toEqual(b);
 expect(await s.readPreferences()).toEqual(prefs);
 expect(f.open).toHaveBeenCalledWith('folio-translation-preview',1);
 expect(f.createObjectStore).toHaveBeenCalledWith('entries',{keyPath:'key'});
 expect(f.createObjectStore).toHaveBeenCalledTimes(1);
 expect(f.close).toHaveBeenCalled();
});
it.each([true,false])('reports translation cache open errors (with native error: %s)',async error=>{
 await expect(createTranslationIndexedDb(fake('open-error',error).factory).readPreferences())
  .rejects.toThrow(error?'open failed':'Cannot open translation cache');
});
it('reports blocked upgrade without touching documents database',async()=>{
 await expect(createTranslationIndexedDb(fake('blocked').factory).readPreferences()).rejects.toThrow('Translation database is blocked');
});
it.each(['tx-error','tx-abort'] as const)('does not claim committed write on %s',async outcome=>{
 for(const native of [true,false]){
  const f=fake(outcome,native);
  await expect(createTranslationIndexedDb(f.factory).writePreferences(prefs)).rejects.toThrow(native?'tx failed':
   outcome==='tx-error'?'Translation transaction failed':'Translation transaction aborted');
  expect(f.close).toHaveBeenCalledOnce();
 }
});
