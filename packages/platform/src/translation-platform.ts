import {canonicalLanguage,languagePreferences,translationIdentity,DEFAULT_LANGUAGE_PREFERENCES,
 type ContentUnit,type LanguagePreferences,type TranslationEntry,type TranslationIdentity,type TranslationProvider} from '@folio/core';
export type Digest=(text:string)=>Promise<string>;
export interface TranslationStore {
 readPreferences():Promise<LanguagePreferences|undefined>;
 writePreferences(prefs:LanguagePreferences):Promise<void>;
 read(key:string):Promise<TranslationEntry|undefined>;
 write(entry:TranslationEntry):Promise<void>;
 removeDocument(documentId:string):Promise<void>;
}
export interface TranslationPlatform {
 getLanguages():Promise<LanguagePreferences>;
 setLanguages(prefs:LanguagePreferences):Promise<LanguagePreferences>;
 findTranslation(identity:TranslationIdentity):Promise<TranslationEntry|undefined>;
 saveManualTranslation(identity:TranslationIdentity,translatedText:string):Promise<TranslationEntry>;
 translate(identity:TranslationIdentity,provider:TranslationProvider,signal:AbortSignal):Promise<TranslationEntry>;
 deleteTranslations(documentId:string):Promise<void>;
}
export function createTranslationPlatform(store:TranslationStore,digest:Digest):TranslationPlatform {
 async function indexed(input:TranslationIdentity){
  const identity=translationIdentity(input);
  const sourceHash=await digest(identity.unit.text);
  const coordinates=identity.unit.anchor.kind==='pdf'
    ? 'pdf:'+identity.unit.anchor.page : 'epub:'+identity.unit.anchor.spineIndex+':'+identity.unit.anchor.cfi;
  const key=[identity.documentId,coordinates,identity.unit.unitIndex,sourceHash,identity.source,identity.target,
    identity.providerId,identity.model,identity.promptVersion].map(encodeURIComponent).join('|');
  return {identity,sourceHash,key};
 }
 function validResult(text:string):string {
  const result=text.trim();
  if(!result || result.length>16000)throw Error('Invalid translation output');
  return result;
 }
 async function save(input:TranslationIdentity,translatedText:string,provenance:TranslationEntry['provenance']){
  const index=await indexed(input);
  const entry:TranslationEntry={...index,translatedText:validResult(translatedText),provenance};
  await store.write(entry);return entry;
 }
 return {
  async getLanguages(){return languagePreferences((await store.readPreferences())??DEFAULT_LANGUAGE_PREFERENCES);},
  async setLanguages(prefs){const normalized=languagePreferences(prefs);await store.writePreferences(normalized);return normalized;},
  async findTranslation(input){const index=await indexed(input);return store.read(index.key);},
  saveManualTranslation:(input,text)=>save(input,text,'manual'),
  async translate(input,provider,signal){
   const identity=translationIdentity(input);
   if(provider.id!==identity.providerId || provider.model!==identity.model)throw Error('Provider identity mismatch');
   if(identity.source==='auto'&&!provider.supportsAutoSource)throw Error('Provider cannot detect source language');
   if(signal.aborted)throw Error('Translation cancelled');
   const translated=await provider.translate({text:identity.unit.text,source:identity.source,target:identity.target,
     promptVersion:identity.promptVersion},signal);
   if(signal.aborted)throw Error('Translation cancelled');
   return save(identity,translated,'provider');
  },
  deleteTranslations:id=>store.removeDocument(id)
 };
}
export async function sha256Text(text:string):Promise<string>{
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
