import { expect, it } from 'vitest';
import { bookFixture, zipFixture, MIME, CONTAINER } from '../test/fixture';
import { openEpubArchive, resolveEpubPath, safeArchivePath } from './epub-archive';
const good=()=>bookFixture();
function find(bytes:Uint8Array,signature:number):number {
 const v=new DataView(bytes.buffer);
 for(let i=0;i<bytes.length-4;i++) if(v.getUint32(i,true)===signature) return i;
 return -1;
}
it('opens EPUB central directory and checks resources and bytes', async()=>{
 const zip=openEpubArchive(good());
 expect(zip.paths()).toContain('OPS/package.opf');
 expect(await zip.text('mimetype')).toBe(MIME);
 expect(await zip.text('META-INF/container.xml')).toBe(CONTAINER);
 expect(await zip.get('OPS/pic.png')).toEqual(new Uint8Array([137,80,78,71]));
 await expect(zip.get('missing')).rejects.toThrow('missing resource');
});
it('normalizes safe relative references without escaping archive',()=>{
 expect(safeArchivePath('OPS/chapter.xhtml')).toBe('OPS/chapter.xhtml');
 expect(resolveEpubPath('OPS/chapter.xhtml','../images/a%20b.png#figure')).toBe('images/a b.png');
 expect(resolveEpubPath('OPS/chapter.xhtml','./next.xhtml?x')).toBe('OPS/next.xhtml');
 for(const path of ['','/absolute','../bad','a/./b','a//b','http:resource','a\\b','a#b','a?b','a\0b'])
  expect(()=>safeArchivePath(path)).toThrow();
 for(const href of ['%','https://evil.test','/a','../../escape','a\\b','']) expect(()=>resolveEpubPath('OPS/c.xhtml',href)).toThrow();
});
it('rejects missing and corrupt central directory and bad counts',()=>{
 const b=good(); const v=new DataView(b.buffer);const end=b.length-22;
 for(const edit of [(x:Uint8Array)=>x[x.length-22]=0,(x:Uint8Array)=>new DataView(x.buffer).setUint16(end+4,1,true),
  (x:Uint8Array)=>new DataView(x.buffer).setUint16(end+8,1,true),
  (x:Uint8Array)=>new DataView(x.buffer).setUint16(end+10,0,true),
  (x:Uint8Array)=>new DataView(x.buffer).setUint32(end+12,0,true),
  (x:Uint8Array)=>new DataView(x.buffer).setUint32(end+16,0xfffffffe,true)]){
   const copy=new Uint8Array(b);edit(copy);expect(()=>openEpubArchive(copy)).toThrow();
 }
 expect(v.getUint16(end+10,true)).toBeGreaterThan(0);
});
it('rejects non-EPUB ZIP with container absent, duplicate paths or invalid archive names',()=>{
 expect(()=>openEpubArchive(zipFixture([['mimetype',MIME],['other','x']]))).toThrow('missing EPUB structure');
 expect(()=>openEpubArchive(zipFixture([['mimetype',MIME],['META-INF/container.xml',CONTAINER],['META-INF/container.xml','bad']]))).toThrow('duplicate');
 expect(()=>openEpubArchive(zipFixture([['mimetype',MIME],['../evil','x'],['META-INF/container.xml',CONTAINER]]))).toThrow('unsafe archive path');
});
it('verifies local metadata, CRC, entry limits, methods and data',async()=>{
 const goodBytes=good(),central=find(goodBytes,0x02014b50), v=new DataView(goodBytes.buffer);
 const local=find(goodBytes,0x04034b50);
 const mutations:Array<[number,number,number]>=[
  [central,0,4],[central+8,1,2],[central+10,99,2],[central+20,0,4],
  [central+24,0xffffffff,4],[central+28,0xffff,2],[central+42,0xffffffff,4],
  [local+8,8,2],[local+14,123,4],[local+26,0,2],
 ];
 for(const [pos,value,size] of mutations){
  const bytes=new Uint8Array(goodBytes), dv=new DataView(bytes.buffer);
  if(size===2)dv.setUint16(pos,value,true);else dv.setUint32(pos,value,true);
  expect(()=>openEpubArchive(bytes)).toThrow();
 }
 expect(v.getUint32(central,true)).toBe(0x02014b50);
 const corrupted=good();corrupted[30+'mimetype'.length]=0;
 expect(()=>openEpubArchive(corrupted)).toThrow();
 const crc=good(),pos=crc.indexOf(137); crc[pos]^=1;
 await expect(openEpubArchive(crc).get('OPS/pic.png')).rejects.toThrow('integrity mismatch');
});
