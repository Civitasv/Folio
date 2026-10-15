import {expect,it} from 'vitest';
import {canonicalLanguage,languagePreferences,validateContentUnit,translationIdentity,epubContentUnits,DEFAULT_LANGUAGE_PREFERENCES} from './translation';
const pdf={anchor:{kind:'pdf' as const,page:3},unitIndex:0,text:'  Example.  '};
const epub={anchor:{kind:'epub' as const,spineIndex:1,cfi:'epubcfi(/6/4)'},unitIndex:1,text:' An EPUB paragraph. '};
it('canonicalizes 3+ target languages, stores distinct and recent choice order',()=>{
 for(const tag of ['fr','ja','en','de','es','zh-Hans'])expect(canonicalLanguage(tag)).toBe(tag);
 expect(canonicalLanguage('EN-us')).toBe('en-US');
 expect(canonicalLanguage('auto',true)).toBe('auto');
 expect(languagePreferences({...DEFAULT_LANGUAGE_PREFERENCES,target:'fr',recentTargets:['ja','fr','en','es','de','zh-Hans']}))
  .toEqual({source:'auto',target:'fr',recentTargets:['fr','ja','en','es','de'],view:'bilingual'});
});
it('rejects invalid locale, same language, invalid view and recent locale',()=>{
 for(const tag of ['','not_a_lang','en--US'])expect(()=>canonicalLanguage(tag)).toThrow('Invalid language tag');
 expect(()=>canonicalLanguage('auto')).toThrow('Invalid language tag');
 expect(()=>languagePreferences({...DEFAULT_LANGUAGE_PREFERENCES,source:'fr',target:'FR'})).toThrow('identical');
 expect(()=>languagePreferences({...DEFAULT_LANGUAGE_PREFERENCES,view:'not-mode' as 'original'})).toThrow('view');
 expect(()=>languagePreferences({...DEFAULT_LANGUAGE_PREFERENCES,recentTargets:['bad_@@']})).toThrow('language');
});
it('normalizes bounded PDF/EPUB units without conflating anchors',()=>{
 expect(validateContentUnit(pdf)).toEqual({...pdf,text:'Example.'});
 expect(validateContentUnit(epub)).toEqual({...epub,text:'An EPUB paragraph.'});
 for(const unit of [{...pdf,unitIndex:-1},{...pdf,unitIndex:1.5},{...pdf,text:''},{...pdf,text:'a'.repeat(4001)},
  {...pdf,anchor:{kind:'pdf' as const,page:0}},
  {...epub,anchor:{kind:'epub' as const,spineIndex:-1,cfi:'epubcfi(/6/4)'}},
  {...epub,anchor:{kind:'epub' as const,spineIndex:1,cfi:'broken'}}])
   expect(()=>validateContentUnit(unit)).toThrow();
});
it('requires complete provider-specific translation identity with target distinct from source',()=>{
 const input={documentId:'sha256:abc',unit:pdf,source:'en',target:'fr',providerId:'manual',model:'local-draft',promptVersion:'f01d-v1'};
 expect(translationIdentity(input).unit.text).toBe('Example.');
 expect(()=>translationIdentity({...input,source:'FR'})).toThrow('identical');
 for(const prop of ['documentId','providerId','model','promptVersion'] as const)
  expect(()=>translationIdentity({...input,[prop]:'  '})).toThrow('Incomplete');
});
it('extracts stable sanitized EPUB units and ignores nested duplicate text, empty and oversized blocks',()=>{
 const html='<h1>Title</h1><section><p>A <em>paragraph</em></p><blockquote>Quoted <p>Nested duplicate</p></blockquote><p></p><p>'+ 'x'.repeat(4001)+'</p><p>Final</p></section>';
 const units=epubContentUnits(html,1,'epubcfi(/6/4)');
 expect(units.map(u=>u.text)).toEqual(['Title','A paragraph','Quoted Nested duplicate','Final']);
 expect(units.map(u=>u.unitIndex)).toEqual([0,1,2,5]);
 expect(units[0].anchor).toEqual({kind:'epub',spineIndex:1,cfi:'epubcfi(/6/4)'});
 expect(epubContentUnits('',0,'epubcfi(/6/2)')).toEqual([]);
});
