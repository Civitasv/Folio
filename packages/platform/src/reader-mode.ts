import type {ReadingMode} from '@folio/core';

/** Versioned view-only preference: never stores document content or invokes native APIs. */
export interface ReaderModeStore {
 read(documentId:string):ReadingMode;
 write(documentId:string,mode:ReadingMode):void;
}
export function createReaderModeStore(store:Pick<Storage,'getItem'|'setItem'>):ReaderModeStore{
 const key=(id:string)=>'folio:reader-mode:v1:'+encodeURIComponent(id);
 return {
  read(id){
   try{
    const value=store.getItem(key(id));
    return value==='interleaved'?'interleaved':'parallel';
   }catch{return 'parallel';}
  },
  write(id,mode){
   try{store.setItem(key(id),mode);}catch{/* Storage may be disabled/quota-limited; remain readable. */}
  }
 };
}
export const browserReaderModeStore=createReaderModeStore({
 getItem(key){return localStorage.getItem(key);},
 setItem(key,value){localStorage.setItem(key,value);}
});
