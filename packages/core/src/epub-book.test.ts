import { expect,it } from 'vitest';
import { bookFixture, zipFixture, MIME, CONTAINER, OPF, CHAPTER } from '../test/fixture';
import { parseEpub, chapterCfi } from './epub-book';
it('extracts metadata, safe chapters and nested TOC from an offline EPUB',async()=>{
 const book=await parseEpub(bookFixture());
 expect(book.metadata.title).toBe('Example Book');
 expect(book.metadata.creators).toEqual(['Alice']);
 expect(book.metadata.language).toBe('en');
 expect(book.metadata.spine).toHaveLength(2);
 expect(book.metadata.toc[0].children[0].label).toBe('Second');
 expect(book.chapters).toHaveLength(2);
 expect(book.chapters[0].html).toContain('Hello <strong>reader</strong>');
 expect(book.chapters[0].html).toContain('data:image/png;base64,');
 expect(book.chapters[0].html).not.toContain('onclick');
 expect(book.chapters[0].html).not.toContain('script');
 expect(book.chapters[0].html).not.toContain('href=');
 expect(chapterCfi(1)).toBe('epubcfi(/6/4)');
});
it('rejects encryption, absent OPF, malformed XML and bad spine',async()=>{
 const base:[string,string|Uint8Array][]=[['mimetype',MIME],['META-INF/container.xml',CONTAINER]];
 for(const entries of [
  [...base,['META-INF/encryption.xml','<encrypted/>'] as [string,string]],
  [...base],
  [['mimetype',MIME],['META-INF/container.xml','<!DOCTYPE foo><container/>'],['OPS/package.opf',OPF]] as [string,string][],
  [...base,['OPS/package.opf','<bad/>'] as [string,string]],
  [...base,['OPS/package.opf',OPF.replace('<spine><itemref idref="c1"/><itemref idref="c2"/></spine>','')] as [string,string]],
  [...base,['OPS/package.opf',OPF.replace('idref="c1"','idref="unknown"')] as [string,string]],
  [...base,['OPS/package.opf',OPF.replace('<itemref idref="c1"/>','').replace('<itemref idref="c2"/>','')] as [string,string]]
 ]){
  await expect(parseEpub(zipFixture(entries))).rejects.toThrow();
 }
});
it('rejects missing/malformed XHTML body, disallowed DOCTYPE and corrupt resources',async()=>{
 const entries:[string,string|Uint8Array][]=[['mimetype',MIME],['META-INF/container.xml',CONTAINER],['OPS/package.opf',OPF],
 ['OPS/one.xhtml','<html/>'],['OPS/two.xhtml','<html><body/></html>'],['OPS/nav.xhtml','<html/>']];
 await expect(parseEpub(zipFixture(entries))).rejects.toThrow();
 entries[3]=['OPS/one.xhtml','<!DOCTYPE html><html><body/></html>'];
 await expect(parseEpub(zipFixture(entries))).rejects.toThrow();
 entries[3]=['OPS/one.xhtml',CHAPTER];
 await expect(parseEpub(zipFixture(entries))).rejects.toThrow();
});
