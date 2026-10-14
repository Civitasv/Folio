import { describe, expect, it } from 'vitest';
import { MAX_EPUB_BYTES, preflightEpub, normalizeEpubAnchor, type EpubAnchor } from './epub';

function epubHeader(): Uint8Array {
  const mime = new TextEncoder().encode('application/epub+zip');
  const name = new TextEncoder().encode('mimetype');
  const bytes = new Uint8Array(30 + name.length + mime.length);
  bytes.set([0x50, 0x4b, 0x03, 0x04]);
  const view = new DataView(bytes.buffer);
  view.setUint32(18, mime.length, true);
  view.setUint32(22, mime.length, true);
  view.setUint16(26, name.length, true);
  bytes.set(name, 30);
  bytes.set(mime, 30 + name.length);
  return bytes;
}
describe('EPUB OCF first-entry preflight (not full validation)', () => {
  it('recognizes the exact first mimetype entry', () => {
    const b = epubHeader();
    expect(preflightEpub(b)).toEqual({ok:true,byteLength:b.length});
    // Byte offsets must respect an incoming subarray's nonzero byteOffset.
    const padded = new Uint8Array(b.length + 8);
    padded.set(b, 3);
    expect(preflightEpub(padded.subarray(3,3+b.length))).toEqual({ok:true,byteLength:b.length});
  });
  it('rejects empty, oversized and truncated container input', () => {
    expect(preflightEpub(new Uint8Array())).toEqual({ok:false,error:'empty'});
    expect(preflightEpub(new Uint8Array(MAX_EPUB_BYTES+1))).toEqual({ok:false,error:'too_large'});
    expect(preflightEpub(new Uint8Array([0x50,0x4b,0x03,0x04]))).toEqual({ok:false,error:'invalid_container'});
  });
  it('rejects a non-ZIP first header even when the rest looks like EPUB', () => {
    const b = epubHeader(); b[0]=0;
    expect(preflightEpub(b)).toEqual({ok:false,error:'invalid_container'});
  });
  it.each([
    ['encrypted',6,1,1],
    ['data descriptor',6,8,1],
    ['compressed first entry',8,8,2],
    ['wrong compressed length',18,21,4],
    ['wrong uncompressed length',22,21,4],
    ['wrong name length',26,7,2],
    ['nonempty extra',28,1,2],
  ] as const)('rejects %s', (_case, at, value, width) => {
    const b=epubHeader(); const view=new DataView(b.buffer);
    if(width===1) view.setUint8(at,value);
    else if(width===2) view.setUint16(at,value,true);
    else view.setUint32(at,value,true);
    expect(preflightEpub(b)).toEqual({ok:false,error:'invalid_mimetype'});
  });
  it('rejects fake first-entry name and content', () => {
    const b=epubHeader(); b[30]=0;
    expect(preflightEpub(b)).toEqual({ok:false,error:'invalid_mimetype'});
    const c=epubHeader(); c[38]=0;
    expect(preflightEpub(c)).toEqual({ok:false,error:'invalid_mimetype'});
  });
});
describe('EPUB anchor storage contract', () => {
  const location: EpubAnchor = {kind:'epub',cfi:' epubcfi(/6/2[chapter]!/4/2) ',spineIndex:0};
  it('normalizes a stored CFI without claiming to resolve it', () =>
    expect(normalizeEpubAnchor(location,2)).toEqual({...location,cfi:'epubcfi(/6/2[chapter]!/4/2)'}));
  it.each([-1,2,1.1,Number.NaN,Number.POSITIVE_INFINITY])('rejects invalid spine index %s', index =>
    expect(normalizeEpubAnchor({...location,spineIndex:index},2)).toBeNull());
  it.each(['bad', 'epubcfi(', 'xepubcfi(/6/2)'])('rejects malformed CFI storage shape %s', cfi =>
    expect(normalizeEpubAnchor({...location,cfi},2)).toBeNull());
});
