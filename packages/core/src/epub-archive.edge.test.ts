import { expect,it,vi } from 'vitest';
import { zipFixture,bookFixture,MIME,CONTAINER } from '../test/fixture';
import { openEpubArchive } from './epub-archive';
const common:Array<[string,string|Uint8Array,Uint8Array?]>=[['mimetype',MIME],['META-INF/container.xml',CONTAINER]];
function edit(bytes:Uint8Array,where:(v:DataView)=>void){const copy=new Uint8Array(bytes);where(new DataView(copy.buffer));return copy;}
function central(b:Uint8Array){const v=new DataView(b.buffer);for(let i=0;i<b.length-4;i++)if(v.getUint32(i,true)===0x02014b50)return i;throw Error('fixture');}
it('supports ordinary zero-length directory entries while keeping the archive root confined',async()=>{
 const z=openEpubArchive(zipFixture([['mimetype',MIME],['META-INF/',new Uint8Array()],['META-INF/container.xml',CONTAINER]]));
 expect(z.paths()).toEqual(['mimetype','META-INF/container.xml']);
 const b=zipFixture([['mimetype',MIME],['META-INF/','x'],['META-INF/container.xml',CONTAINER]]);
 expect(()=>openEpubArchive(b)).toThrow('nonempty archive directory');
});
it('decodes deflate-raw ZIP resources and rejects invalid output/corruption',async()=>{
 const content='compressed archive chapter';
 const raw=new Uint8Array([75,206,207,45,40,74,45,46,78,77,81,72,44,74,206,200,44,75,85,72,206,72,44,40,73,45,2,0]);
 const input=zipFixture([...common,['OPS/chapter.txt',content,raw]]);
 expect(await openEpubArchive(input).text('OPS/chapter.txt')).toBe(content);
 const wrong=zipFixture([...common,['OPS/chapter.txt',content,new Uint8Array([0,1,2,3])]]);
 await expect(openEpubArchive(wrong).get('OPS/chapter.txt')).rejects.toThrow('invalid compressed resource');
 const no=new Uint8Array(input);
 vi.stubGlobal('DecompressionStream',undefined);
 await expect(openEpubArchive(no).get('OPS/chapter.txt')).rejects.toThrow('deflate-raw unavailable');
 vi.unstubAllGlobals();
});
it('rejects a shorter-than-declared decompressed length and an expanded output above the declaration',async()=>{
 const content='compressed archive chapter';
 const raw=new Uint8Array([75,206,207,45,40,74,45,46,78,77,81,72,44,74,206,200,44,75,85,72,206,72,44,40,73,45,2,0]);
 const b=zipFixture([...common,['OPS/chapter.txt',content,raw]]);
 const c=central(b);const bytes=edit(b,v=>{
  // first resource is third central entry
  let o=c;for(let i=0;i<2;i++)o+=46+v.getUint16(o+28,true)+v.getUint16(o+30,true)+v.getUint16(o+32,true);
  const local=v.getUint32(o+42,true);
  v.setUint32(o+24,content.length-1,true);v.setUint32(local+22,content.length-1,true);
 });
 await expect(openEpubArchive(bytes).get('OPS/chapter.txt')).rejects.toThrow('invalid compressed resource');
});
it('rejects unsafe flags, overlong entries, wrong local names and unsupported methods',()=>{
 const b=bookFixture(),at=central(b);
 const changes:Array<[number,number,2|4]>=[[8,0x40,2],[20,0,4],[24,0xffffffff,4],[28,65535,2],[30,65535,2],[32,65535,2],[42,0xffffffff,4],[10,77,2]];
 for(const [delta,value,width] of changes){
  const copy=edit(b,v=>width===2?v.setUint16(at+delta,value,true):v.setUint32(at+delta,value,true));
  expect(()=>openEpubArchive(copy)).toThrow();
 }
});

it('rejects divergent local and central names and aggregated declared expansion over 200 MiB',()=>{
 const x=bookFixture(),at=central(x);
 const changed=edit(x,v=>v.setUint8(at+46,'x'.charCodeAt(0)));
 expect(()=>openEpubArchive(changed)).toThrow('local data mismatch');
 const payload=new Uint8Array(160*1024),large=new Uint8Array([1]);
 const entries:Array<[string,string|Uint8Array,Uint8Array?]>=[...common];
 for(let i=0;i<7;i++)entries.push(['OPS/large-'+i,large,payload]);
 const z=zipFixture(entries),v=new DataView(z.buffer);
 let cursor=central(z);
 for(let n=0;n<entries.length;n++){
   const at=cursor,offset=v.getUint32(at+42,true);
   if(n>=2){v.setUint32(at+24,31*1024*1024,true);v.setUint32(offset+22,31*1024*1024,true);}
   cursor+=46+v.getUint16(at+28,true)+v.getUint16(at+30,true)+v.getUint16(at+32,true);
 }
 expect(()=>openEpubArchive(z)).toThrow('archive output limit');
});
