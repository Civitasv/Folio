import { afterEach, expect, it, vi } from 'vitest';
import { createIndexedDbStore } from './indexeddb';
import { browserPlatform, type StoredPdf } from './index';

type Outcome = 'ok' | 'open-error' | 'blocked' | 'tx-error' | 'tx-abort';
function mockIndexedDb(outcome: Outcome = 'ok', withError = true) {
  const values = new Map<string, StoredPdf>();
  const close = vi.fn();
  const createObjectStore = vi.fn();
  let upgraded = false;
  const open = vi.fn(() => {
    const request: any = { result: null, error: withError ? new Error('open failed') : null };
    queueMicrotask(() => {
      if (outcome === 'open-error') { request.onerror?.(); return; }
      if (outcome === 'blocked') { request.onblocked?.(); return; }
      request.result = {
        close,
        createObjectStore,
        transaction: vi.fn((_name: string, _mode: string) => {
          const tx: any = { error: withError ? new Error('transaction failed') : null };
          function reply<T>(value: () => T): IDBRequest<T> {
            const req: any = { result: undefined };
            queueMicrotask(() => {
              req.result = value();
              req.onsuccess?.();
              queueMicrotask(() => {
                if (outcome === 'tx-error') tx.onerror?.();
                else if (outcome === 'tx-abort') tx.onabort?.();
                else tx.oncomplete?.();
              });
            });
            return req as IDBRequest<T>;
          }
          tx.objectStore = () => ({
            getAll: () => reply(() => [...values.values()]),
            get: (key: string) => reply(() => values.get(key)),
            put: (doc: StoredPdf) => reply(() => { values.set(doc.id, doc); return doc.id; }),
            delete: (key: string) => reply(() => { values.delete(key); return undefined; })
          });
          return tx;
        })
      };
      if (!upgraded) { upgraded = true; request.onupgradeneeded?.(); }
      request.onsuccess?.();
    });
    return request as IDBOpenDBRequest;
  });
  return { factory: { open }, open, close, createObjectStore, values };
}
const sample: StoredPdf = { id:'sha256:a', fingerprint:'a', title:'A', progress:1, bytes:new Uint8Array([37,80,68,70,45]) };
afterEach(() => vi.unstubAllGlobals());
it('commits getAll/get/put/delete and opens a versioned managed store', async () => {
  const fake = mockIndexedDb();
  const store = createIndexedDbStore(fake.factory);
  expect(await store.list()).toEqual([]);
  await store.put(sample);
  expect(await store.get(sample.id)).toEqual(sample);
  expect(await store.list()).toEqual([sample]);
  await store.remove(sample.id);
  expect(await store.get(sample.id)).toBeUndefined();
  expect(fake.open).toHaveBeenCalledWith('folio-preview',1);
  expect(fake.createObjectStore).toHaveBeenCalledWith('documents',{keyPath:'id'});
  expect(fake.createObjectStore).toHaveBeenCalledTimes(1);
  expect(fake.close).toHaveBeenCalledTimes(6);
});
it.each([true,false])('propagates indexedDB open failures (error object: %s)', async withError => {
  const store = createIndexedDbStore(mockIndexedDb('open-error',withError).factory);
  await expect(store.list()).rejects.toThrow(withError ? 'open failed' : 'Cannot open local library');
});
it('reports blocked upgrades explicitly', async () => {
  await expect(createIndexedDbStore(mockIndexedDb('blocked').factory).list()).rejects.toThrow('Local library upgrade is blocked');
});
it.each(['tx-error','tx-abort'] as const)('rejects %s only after transaction outcome', async outcome => {
  for (const withError of [true,false]) {
    const fake=mockIndexedDb(outcome,withError);
    const store=createIndexedDbStore(fake.factory);
    await expect(store.put(sample)).rejects.toThrow(withError ? 'transaction failed' :
      outcome === 'tx-error' ? 'Local library transaction failed' : 'Local library transaction aborted');
    expect(fake.close).toHaveBeenCalledOnce();
  }
});
it('default browser platform hashes content and uses injected browser IndexedDB', async () => {
  const fake=mockIndexedDb();
  vi.stubGlobal('indexedDB',fake.factory);
  vi.stubGlobal('crypto',{subtle:{digest:vi.fn(async () => new Uint8Array([0, 255]).buffer)}});
  const doc=await browserPlatform.importPdf('A.pdf',sample.bytes);
  expect(doc.id).toBe('sha256:00ff');
  expect(await browserPlatform.listDocuments()).toEqual([doc]);
});
