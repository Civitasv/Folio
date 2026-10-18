import {expect,it,vi} from 'vitest';
import {createReaderLayoutStore} from './reader-layout';
it('stores split and side preference per document without document bytes',()=>{
 const memory=new Map<string,string>();
 const store=createReaderLayoutStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v);}});
 expect(store.read('one')).toEqual({ratio:50,swapped:false});
 store.write('one',{ratio:65,swapped:true});
 expect(store.read('one')).toEqual({ratio:65,swapped:true});
 expect(store.read('two')).toEqual({ratio:50,swapped:false});
 expect([...memory.keys()]).toEqual(['folio:reader-layout:v1:one']);
 expect(memory.get('folio:reader-layout:v1:one')).toBe('{"ratio":65,"swapped":true}');
});
it('refuses corrupt or stale layouts and out-of-range preferences',()=>{
 const entries=new Map<string,string>();
 const store=createReaderLayoutStore({getItem:k=>entries.get(k)??null,setItem:(k,v)=>{entries.set(k,v);}});
 const key='folio:reader-layout:v1:bad';
 for(const value of ['bad','null','[]','{}','{"ratio":101,"swapped":false}',
  '{"ratio":29,"swapped":true}','{"ratio":"50","swapped":true}',
  '{"ratio":50,"swapped":"false"}','{"ratio":50}']){
  entries.set(key,value);expect(store.read('bad')).toEqual({ratio:50,swapped:false});
 }
 expect(store.read('missing')).toEqual({ratio:50,swapped:false});
 for(const ratio of [NaN,Infinity,29,71])store.write('skip',{ratio,swapped:false});
 expect(entries.has('folio:reader-layout:v1:skip')).toBe(false);
 store.write('safe',{ratio:30,swapped:false});store.write('safe',{ratio:70,swapped:true});
 expect(store.read('safe')).toEqual({ratio:70,swapped:true});
});
it('falls back if local storage or JSON read fails, and never throws for disabled storage',()=>{
 const store=createReaderLayoutStore({getItem:vi.fn(()=>{throw Error('denied');}),setItem:vi.fn(()=>{throw Error('quota');})});
 expect(store.read('x')).toEqual({ratio:50,swapped:false});
 expect(()=>store.write('x',{ratio:50,swapped:false})).not.toThrow();
});
