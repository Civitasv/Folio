import { expect,it,vi } from 'vitest';
import { bookFixture, zipFixture, MIME, CONTAINER, OPF } from '../../core/test/fixture';
import { createReaderPlatform, type PdfStore, type StoredPdf } from './index';
import { createEpubPlatform } from './epub-platform';
function fixture(){
 const rows=new Map<string,StoredPdf>();
 const store:PdfStore={
  list:vi.fn(async()=>[...rows.values()]),get:vi.fn(async id=>rows.get(id)),
  put:vi.fn(async doc=>{rows.set(doc.id,doc);}),remove:vi.fn(async id=>{rows.delete(id);})
 };
 const hash=vi.fn(async()=> 'abcd');
 return {rows,store,hash,pdf:createReaderPlatform(store,hash),epub:createEpubPlatform(store,hash)};
}
it('imports a full EPUB, deduplicates, coexists with legacy PDF and stores progress/preferences',async()=>{
 const f=fixture();
 const pdf=await f.pdf.importPdf('PDF.pdf',new Uint8Array([37,80,68,70,45]));
 const epub=await f.epub.importEpub('Other.epub',bookFixture());
 expect(epub).toEqual({id:'epub:sha256:abcd',title:'Example Book',kind:'epub',progress:1,creators:['Alice']});
 expect(await f.epub.importEpub('New.epub',bookFixture())).toEqual(epub);
 expect(f.store.put).toHaveBeenCalledTimes(2);
 expect(await f.pdf.listDocuments()).toEqual([pdf,epub]);
 await expect(f.pdf.readPdf(epub.id)).rejects.toThrow('PDF not found');
 await expect(f.pdf.setProgress(epub.id,3)).rejects.toThrow('PDF not found');
 expect(await f.pdf.readPdf(pdf.id)).toEqual(new Uint8Array([37,80,68,70,45]));
 const saved=await f.epub.readEpub(epub.id);
 expect(saved.book.chapters).toHaveLength(2);
 expect(saved.anchor).toEqual({kind:'epub',cfi:'epubcfi(/6/2)',spineIndex:0});
 expect(saved.preferences).toEqual({fontSize:18,theme:'light'});
 await f.epub.setEpubLocation(epub.id,{kind:'epub',spineIndex:1,cfi:'epubcfi(/6/4)'});
 await f.epub.setEpubPreferences(epub.id,{fontSize:20,theme:'sepia'});
 expect((await f.epub.readEpub(epub.id)).preferences).toEqual({fontSize:20,theme:'sepia'});
 expect((await f.pdf.listDocuments())[1].progress).toBe(2);
 await f.pdf.deletePdf(epub.id);
 await expect(f.epub.readEpub(epub.id)).rejects.toThrow('EPUB not found');
});
it('rejects invalid EPUB and never stores it',async()=>{
 const f=fixture();
 await expect(f.epub.importEpub('bad.epub',new Uint8Array())).rejects.toThrow();
 expect(f.rows.size).toBe(0);
});
it('rejects bad locations, invalid preferences and non-EPUB document identifiers',async()=>{
 const f=fixture(),epub=await f.epub.importEpub('Book.epub',bookFixture());
 await expect(f.epub.setEpubLocation(epub.id,{kind:'epub',spineIndex:99,cfi:'bad'})).rejects.toThrow('Invalid EPUB position');
 for(const prefs of [{fontSize:13,theme:'dark' as const},{fontSize:27,theme:'light' as const},
  {fontSize:NaN,theme:'sepia' as const},{fontSize:18,theme:'fake' as 'dark'}])
  await expect(f.epub.setEpubPreferences(epub.id,prefs)).rejects.toThrow('Invalid EPUB preferences');
 await expect(f.epub.setEpubPreferences('none',{fontSize:18,theme:'dark'})).rejects.toThrow('EPUB not found');
 await expect(f.epub.setEpubLocation('none',{kind:'epub',spineIndex:0,cfi:'epubcfi(/6/2)'})).rejects.toThrow('EPUB not found');
});
it('restores missing/invalid legacy EPUB preference and anchor defaults',async()=>{
 const f=fixture(),epub=await f.epub.importEpub('Book.epub',bookFixture());
 const row=f.rows.get(epub.id)!;
 f.rows.set(epub.id,{...row,anchor:{kind:'epub',spineIndex:50,cfi:'bad'},preferences:undefined} as StoredPdf);
 const saved=await f.epub.readEpub(epub.id);
 expect(saved.anchor.spineIndex).toBe(0);
 expect(saved.preferences).toEqual({fontSize:18,theme:'light'});
});
it('uses filename when OPF title is absent, and does not mistake PDF for EPUB',async()=>{
 const f=fixture();
 const minimal=zipFixture([['mimetype',MIME],['META-INF/container.xml',CONTAINER],
  ['OPS/package.opf',OPF.replace('<dc:title>Example Book</dc:title>','').replace('properties="nav"','')],
  ['OPS/one.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body>One</body></html>'],
  ['OPS/two.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body>Two</body></html>']]);
 const epub=await f.epub.importEpub('Fallback.epub',minimal);
 expect(epub.title).toBe('Fallback');
 const pdf=await f.pdf.importPdf('Paper.pdf',new Uint8Array([37,80,68,70,45]));
 await expect(f.epub.readEpub(pdf.id)).rejects.toThrow('EPUB not found');
});
