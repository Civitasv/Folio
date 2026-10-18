import {expect,it,vi} from 'vitest';
import {createReaderModeStore} from './reader-mode';
it('persists view-only mode by document without cross-paper leakage',()=>{
 const data=new Map<string,string>();
 const store=createReaderModeStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}});
 expect(store.read('pdf:a')).toBe('parallel');
 store.write('pdf:a','interleaved');
 expect(store.read('pdf:a')).toBe('interleaved');
 expect(store.read('pdf:b')).toBe('parallel');
 expect([...data.keys()]).toEqual(['folio:reader-mode:v1:pdf%3Aa']);
 data.set('folio:reader-mode:v1:pdf%3Aa','unrecognized');
 expect(store.read('pdf:a')).toBe('parallel');
});
it('stays readable if browser storage throws',()=>{
 const store=createReaderModeStore({getItem:vi.fn(()=>{throw Error('denied');}),setItem:vi.fn(()=>{throw Error('quota');})});
 expect(store.read('x')).toBe('parallel');
 expect(()=>store.write('x','interleaved')).not.toThrow();
});
