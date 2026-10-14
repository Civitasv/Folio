import { expect,it } from 'vitest';
import { zipFixture,MIME,CONTAINER,OPF,NAV,CHAPTER } from '../test/fixture';
import { parseEpub } from './epub-book';
function sample({opf=OPF,nav=NAV,chapter=CHAPTER,container=CONTAINER,more=[]}:{opf?:string,nav?:string,chapter?:string,container?:string,more?:Array<[string,string|Uint8Array]>}={}){
 return zipFixture([['mimetype',MIME],['META-INF/container.xml',container],['OPS/package.opf',opf],
 ['OPS/one.xhtml',chapter],['OPS/two.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Two</p></body></html>'],
 ['OPS/nav.xhtml',nav],['OPS/pic.png',new Uint8Array([137,80,78,71])],...more]);
}
it('reads EPUB2 NCX nested navigation and handles unusable or missing links',async()=>{
 const opf=OPF.replace('properties="nav"','').replace('<spine>','<spine toc="ncx">')
 .replace('</manifest>','<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>');
 const ncx='<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint><navLabel><text>One</text></navLabel><content src="one.xhtml"/><navPoint><navLabel><text>Two</text></navLabel><content src="two.xhtml"/></navPoint></navPoint><navPoint><content src="https://bad.test"/></navPoint></navMap></ncx>';
 const book=await parseEpub(sample({opf,more:[['OPS/toc.ncx',ncx]]}));
 expect(book.metadata.toc[0].children[0].label).toBe('Two');
 expect(book.metadata.toc[1]).toEqual({label:'Untitled',href:'',children:[]});
});
it('supports a nav with span-only, external, missing and nested headings',async()=>{
 const nav='<html xmlns="http://www.w3.org/1999/xhtml"><body><nav type="toc"><ul><li><span>Heading</span><ul><li><a href="../bad.xhtml">Bad</a></li></ul></li><li><a href="https://bad.test">External</a></li><li><a href="one.xhtml">One</a></li></ul></nav></body></html>';
 const book=await parseEpub(sample({nav}));
 expect(book.metadata.toc.map(x=>x.label)).toEqual(['Heading','External','One']);
 expect(book.metadata.toc[0].children[0].href).toBe('');
 expect(book.metadata.toc[1].href).toBe('');
 expect(book.metadata.toc[2].href).toBe('OPS/one.xhtml');
});
it('sanitizes unsafe XHTML, escaped text, scripts, inline styles and non-raster assets',async()=>{
 const chapter='<html xmlns="http://www.w3.org/1999/xhtml"><body><!--comment--><script>alert(1)</script><style>bad</style><custom><p>Tom &amp; Jerry &lt;3&gt;</p></custom><br/><hr/><img src="https://evil.test/x.png"/><img src="missing.png"/><img/><img src="pic.png" alt="A &amp; B"/><a href="https://evil.test">safe text</a></body></html>';
 const html=(await parseEpub(sample({chapter}))).chapters[0].html;
 expect(html).toContain('Tom &amp; Jerry &lt;3&gt;');
 expect(html).toContain('<br><hr>');
 expect(html).toContain('data:image/png;base64,');
 expect(html).toContain('alt="A &amp; B"');
 expect(html).toContain('safe text');
 expect(html).not.toContain('alert(1)');
 expect(html).not.toContain('evil.test');
 expect(html).not.toContain('comment');
});
it('rejects duplicate/bad manifest IDs and OPF unsupported media',async()=>{
 for(const opf of [OPF.replace('id="c1"','id=""'),OPF.replace('href="one.xhtml"','href=""'),
  OPF.replace('id="c2"','id="c1"'),OPF.replace('media-type="application/xhtml+xml"','media-type="application/pdf"')]){
  await expect(parseEpub(sample({opf}))).rejects.toThrow();
 }
});
it('handles missing optional metadata, empty nav and nonlinear spine',async()=>{
 const opf=OPF.replace(/<metadata[^>]*>[\s\S]*?<\/metadata>/,'')
 .replace('<itemref idref="c2"/>','<itemref idref="c2" linear="no"/>');
 const book=await parseEpub(sample({opf,nav:'<html xmlns="http://www.w3.org/1999/xhtml"><body><p>No TOC</p></body></html>'}));
 expect(book.metadata.title).toBeUndefined();
 expect(book.metadata.creators).toEqual([]);
 expect(book.metadata.language).toBeUndefined();
 expect(book.metadata.spine).toHaveLength(1);
 expect(book.metadata.toc).toEqual([]);
});
