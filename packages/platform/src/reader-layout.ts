/** Only viewing geometry is persisted. No document bytes, translated text or credentials. */
export interface ReaderLayoutPreference{ratio:number;swapped:boolean}
export interface ReaderLayoutStore{
 read(documentId:string):ReaderLayoutPreference;
 write(documentId:string,prefs:ReaderLayoutPreference):void;
}
const fallback=():ReaderLayoutPreference=>({ratio:50,swapped:false});
export function createReaderLayoutStore(store:Pick<Storage,'getItem'|'setItem'>):ReaderLayoutStore{
 const key=(id:string)=>'folio:reader-layout:v1:'+encodeURIComponent(id);
 return {
  read(id){
   try{
    const value=store.getItem(key(id));
    if(!value)return fallback();
    const parsed:unknown=JSON.parse(value);
    if(typeof parsed!=='object'||parsed===null)return fallback();
    const data=parsed as Partial<ReaderLayoutPreference>;
    if(typeof data.ratio!=='number'||!Number.isFinite(data.ratio)||data.ratio<30||data.ratio>70||
     typeof data.swapped!=='boolean')return fallback();
    return {ratio:data.ratio,swapped:data.swapped};
   }catch{return fallback();}
  },
  write(id,prefs){
   if(!Number.isFinite(prefs.ratio)||prefs.ratio<30||prefs.ratio>70)return;
   try{store.setItem(key(id),JSON.stringify({ratio:prefs.ratio,swapped:prefs.swapped}));}
   catch{/* A disabled/quota-limited preference store must never block reading. */}
  }
 };
}
export const browserReaderLayoutStore=createReaderLayoutStore({
 getItem(key){return localStorage.getItem(key);},
 setItem(key,value){localStorage.setItem(key,value);}
});
