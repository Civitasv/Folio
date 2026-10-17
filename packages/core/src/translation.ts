import type { ReaderAnchor } from './epub';
export type SourceLanguage = 'auto' | string;
export type TranslationView = 'original' | 'bilingual' | 'translation';
export interface LanguagePreferences { source: SourceLanguage; target: string; recentTargets: string[]; view: TranslationView }
export interface ContentUnit { anchor: ReaderAnchor; unitIndex: number; text: string }
export interface TranslationIdentity { documentId: string; unit: ContentUnit; source: string; target: string; providerId: string; model: string; promptVersion: string }
export interface TranslationEntry { key: string; identity: TranslationIdentity; sourceHash: string; translatedText: string; provenance: 'manual' | 'provider' }
export interface TranslationProvider {
 id: string; model: string; supportsAutoSource: boolean; dataFlow?: string;
 translate(request: {text: string; source: string; target: string; promptVersion: string},signal: AbortSignal): Promise<string>;
}
export const TRANSLATION_PROMPT_VERSION='f01d-v1';
export const DEFAULT_LANGUAGE_PREFERENCES: LanguagePreferences = {source:'auto',target:'zh-Hans',recentTargets:[],view:'bilingual'};
export const LANGUAGE_OPTIONS = [{tag:'auto',label:'Auto-detect'},{tag:'en',label:'English'},{tag:'zh-Hans',label:'简体中文'},
 {tag:'zh-Hant',label:'繁體中文'},{tag:'fr',label:'Français'},{tag:'ja',label:'日本語'},{tag:'de',label:'Deutsch'},{tag:'es',label:'Español'}] as const;
export function canonicalLanguage(value: string, allowAuto=false): string {
 if(value==='auto'){if(allowAuto)return value;throw Error('Invalid language tag');}
 try {
  const tags=Intl.getCanonicalLocales(value);
  return tags[0];
 }catch{throw Error('Invalid language tag');}
}
export function languagePreferences(value: LanguagePreferences): LanguagePreferences {
 const source=canonicalLanguage(value.source,true),target=canonicalLanguage(value.target);
 if(source!=='auto' && source===target)throw Error('Source and target are identical');
 if(!(['original','bilingual','translation'] as string[]).includes(value.view))throw Error('Invalid translation view');
 const recentTargets=[target,...value.recentTargets.map(tag=>canonicalLanguage(tag))].filter((tag,i,all)=>all.indexOf(tag)===i).slice(0,5);
 return {source,target,recentTargets,view:value.view};
}
export function validateContentUnit(unit: ContentUnit): ContentUnit {
 if(!Number.isSafeInteger(unit.unitIndex)||unit.unitIndex<0)throw Error('Invalid content unit');
 if(unit.anchor.kind==='pdf'){
  if(!Number.isSafeInteger(unit.anchor.page)||unit.anchor.page<1)throw Error('Invalid page anchor');
 } else if(!Number.isSafeInteger(unit.anchor.spineIndex)||unit.anchor.spineIndex<0 || !/^epubcfi\(.+\)$/.test(unit.anchor.cfi))throw Error('Invalid EPUB anchor');
 const text=unit.text.trim();
 if(!text || text.length>4000)throw Error('Select between 1 and 4000 characters');
 return {...unit,text};
}
export function translationIdentity(value: TranslationIdentity): TranslationIdentity {
 const unit=validateContentUnit(value.unit);
 const source=canonicalLanguage(value.source,true),target=canonicalLanguage(value.target);
 if(source===target)throw Error('Source and target are identical');
 if(!value.documentId.trim() || !value.providerId.trim() || !value.model.trim() || !value.promptVersion.trim())throw Error('Incomplete translation identity');
 return {...value,unit,source,target};
}
/** Parse only sanitized EPUB chapter HTML, extracting text without importing HTML into the translation layer. */
export function epubContentUnits(html: string,spineIndex: number,cfi: string): ContentUnit[] {
 const doc=new DOMParser().parseFromString(html,'text/html');
 const tags='h1,h2,h3,h4,h5,h6,p,blockquote,li,pre';
 return Array.from(doc.body.querySelectorAll(tags)).filter(el=>!el.parentElement!.closest(tags))
  .map((el,index)=>({anchor:{kind:'epub' as const,spineIndex,cfi},unitIndex:index,text:el.textContent!.trim()}))
  .filter(unit=>unit.text.length>0 && unit.text.length<=4000);
}
