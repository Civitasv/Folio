import { expect, it, vi } from 'vitest';
import { createReaderPlatform, type PdfStore, type StoredPdf } from './index';

function fixture() {
  const records = new Map<string, StoredPdf>();
  const store: PdfStore = {
    list: vi.fn(async () => [...records.values()]),
    get: vi.fn(async id => records.get(id)),
    put: vi.fn(async doc => { records.set(doc.id, doc); }),
    remove: vi.fn(async id => { records.delete(id); })
  };
  const hash = vi.fn(async () => 'abc');
  return { store, records, hash, platform: createReaderPlatform(store, hash) };
}
const bytes = new Uint8Array([37,80,68,70,45,49]);
it('imports, fingerprints, strips extension, lists without leaking bytes and deduplicates', async () => {
  const { platform, hash, store } = fixture();
  const doc = await platform.importPdf('Example.PDF', bytes);
  expect(doc).toEqual({id:'sha256:abc',title:'Example',progress:1});
  expect(await platform.importPdf('Renamed.pdf',bytes)).toEqual(doc);
  expect(hash).toHaveBeenCalledTimes(2);
  expect(store.put).toHaveBeenCalledTimes(1);
  expect(await platform.listDocuments()).toEqual([doc]);
  const read = await platform.readPdf(doc.id);
  expect(read).toEqual(bytes);
  read[0] = 0;
  expect(await platform.readPdf(doc.id)).toEqual(bytes);
  await platform.setProgress(doc.id, 6.9);
  expect(await platform.listDocuments()).toEqual([{...doc,progress:6}]);
  await platform.deletePdf(doc.id);
  expect(await platform.listDocuments()).toEqual([]);
});
it('rejects invalid bytes before hashing and storage', async () => {
  const {platform,hash,store} = fixture();
  await expect(platform.importPdf('x',new Uint8Array())).rejects.toThrow('empty');
  expect(hash).not.toHaveBeenCalled();
  expect(store.put).not.toHaveBeenCalled();
});
it('provides an untitled fallback, clamps page and handles nonfinite page', async () => {
  const {platform} = fixture();
  const doc=await platform.importPdf(' .pdf ',bytes);
  expect(doc.title).toBe('Untitled');
  await platform.setProgress(doc.id,-1);
  expect((await platform.listDocuments())[0].progress).toBe(1);
  await platform.setProgress(doc.id,Number.NaN);
  expect((await platform.listDocuments())[0].progress).toBe(1);
});
it('reports missing documents for reading and progress', async () => {
  const {platform} = fixture();
  await expect(platform.readPdf('missing')).rejects.toThrow('Document not found');
  await expect(platform.setProgress('missing',2)).rejects.toThrow('Document not found');
});

it('lists legacy EPUB rows with missing optional creators without leaking bytes',async()=>{
 const {platform,records}=fixture();
 records.set('epub:old',{id:'epub:old',kind:'epub',title:'Old book',progress:1,fingerprint:'x',bytes:new Uint8Array([1])});
 expect(await platform.listDocuments()).toEqual([{id:'epub:old',kind:'epub',title:'Old book',progress:1,creators:[]}]);
});
