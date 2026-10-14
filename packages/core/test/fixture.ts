/** Small stored-method ZIP fixture for deterministic EPUB unit/integration tests. */
const enc = new TextEncoder();
function crc(data: Uint8Array): number {
  let c=-1;
  for(const b of data){ c^=b; for(let i=0;i<8;i++) c=c&1?(c>>>1)^0xedb88320:c>>>1; }
  return (c^-1)>>>0;
}
function w16(a:number[],n:number){a.push(n&255,(n>>>8)&255);}
function w32(a:number[],n:number){w16(a,n);w16(a,n>>>16);}
export function zipFixture(entries: Array<[string,string|Uint8Array,Uint8Array?]>): Uint8Array {
  const local:number[] = [], central:number[]=[];
  for(const [path,value,compressed] of entries){
    const name=enc.encode(path),data=typeof value==='string'?enc.encode(value):value,at=local.length,hash=crc(data),payload=compressed??data,method=compressed?8:0;
    w32(local,0x04034b50);w16(local,20);w16(local,0x800);w16(local,method);
    w16(local,0);w16(local,0);w32(local,hash);w32(local,payload.length);w32(local,data.length);
    w16(local,name.length);w16(local,0);local.push(...name);for(const value of payload)local.push(value);
    w32(central,0x02014b50);w16(central,20);w16(central,20);w16(central,0x800);
    w16(central,method);w16(central,0);w16(central,0);w32(central,hash);
    w32(central,payload.length);w32(central,data.length);w16(central,name.length);w16(central,0);w16(central,0);
    w16(central,0);w16(central,0);w32(central,0);w32(central,at);central.push(...name);
  }
  const result=[...local,...central],centralAt=local.length;
  w32(result,0x06054b50);w16(result,0);w16(result,0);
  w16(result,entries.length);w16(result,entries.length);w32(result,central.length);w32(result,centralAt);w16(result,0);
  return Uint8Array.from(result);
}
export const MIME='application/epub+zip';
export const CONTAINER='<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
export const OPF='<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Example Book</dc:title><dc:creator>Alice</dc:creator><dc:language>en</dc:language></metadata><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="two.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="pic" href="pic.png" media-type="image/png"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>';
export const CHAPTER='<html xmlns="http://www.w3.org/1999/xhtml"><body><h1 onclick="bad()">Chapter One</h1><script>alert(1)</script><p style="color:red">Hello <strong>reader</strong>.</p><img src="pic.png" alt="illustration"/><a href="https://evil.test">Remote</a></body></html>';
export const NAV='<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="one.xhtml">First</a><ol><li><a href="two.xhtml">Second</a></li></ol></li></ol></nav></body></html>';
export function bookFixture(extra: Array<[string,string|Uint8Array]> = []): Uint8Array {
  return zipFixture([['mimetype',MIME],['META-INF/container.xml',CONTAINER],['OPS/package.opf',OPF],
    ['OPS/one.xhtml',CHAPTER],['OPS/two.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Chapter Two</p></body></html>'],
    ['OPS/nav.xhtml',NAV],['OPS/pic.png',new Uint8Array([137,80,78,71])],...extra]);
}
