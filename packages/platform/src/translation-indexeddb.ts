import type {LanguagePreferences,TranslationEntry} from '@folio/core';
import type {TranslationStore} from './translation-platform';
/** Separate local database, intentionally no migration/change to the PDF/EPUB/DOI store. */
export function createTranslationIndexedDb(factory:Pick<IDBFactory,'open'>):TranslationStore {
 async function transact<T>(mode:IDBTransactionMode,execute:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{
   const request=factory.open('folio-translation-preview',1);
   request.onupgradeneeded=()=>{request.result.createObjectStore('entries',{keyPath:'key'});};
   request.onerror=()=>reject(request.error??new Error('Cannot open translation cache'));
   request.onblocked=()=>reject(new Error('Translation database is blocked'));
   request.onsuccess=()=>resolve(request.result);
  });
  return new Promise<T>((resolve,reject)=>{
   let output:T;
   const tx=db.transaction('entries',mode);
   tx.oncomplete=()=>{db.close();resolve(output);};
   tx.onerror=()=>{db.close();reject(tx.error??new Error('Translation transaction failed'));};
   tx.onabort=()=>{db.close();reject(tx.error??new Error('Translation transaction aborted'));};
   const request=execute(tx.objectStore('entries'));
   request.onsuccess=()=>{output=request.result;};
  });
 }
 const settings='settings:translation';
 return {
  async readPreferences(){const record=await transact<{key:string;value:LanguagePreferences}|undefined>('readonly',s=>s.get(settings));
   return record?.value;},
  writePreferences:async value=>{await transact('readwrite',s=>s.put({key:settings,value}));},
  read:key=>transact('readonly',s=>s.get(key)),
  write:async entry=>{await transact('readwrite',s=>s.put(entry));},
  async removeDocument(id){
   const entries=await transact<Array<{key:string}>>('readonly',s=>s.getAll());
   const prefix=encodeURIComponent(id)+'|';
   for(const entry of entries.filter(x=>x.key.startsWith(prefix)))await transact('readwrite',s=>s.delete(entry.key));
  }
 };
}
