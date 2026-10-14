import { preflightPdf, type DocumentSummary } from '@folio/core';

/** Browser preview persistence; desktop will use a native adapter. */
const DB_NAME = 'folio-preview';
const STORE = 'documents';
type StoredPdf = DocumentSummary & { bytes: Uint8Array; fingerprint: string };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (error: unknown) => void) => void): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let value: T;
    let failure: unknown;
    let hasFailure = false;
    tx.oncomplete = () => { db.close(); if (hasFailure) reject(failure); else resolve(value); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(hasFailure ? failure : tx.error); };
    operation(tx.objectStore(STORE), v => { value = v; }, error => { failure = error; hasFailure = true; try { tx.abort(); } catch { db.close(); reject(error); } });
  });
}
async function fingerprint(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
export const browserPlatform = {
  async listDocuments(): Promise<DocumentSummary[]> {
    return transact('readonly', (store, resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as StoredPdf[]).map(({id,title,progress}) => ({id,title,progress})));
      req.onerror = () => reject(req.error);
    });
  },
  async importPdf(title: string, bytes: Uint8Array): Promise<DocumentSummary> {
    const check = preflightPdf(bytes);
    if (!check.ok) throw new Error(check.error);
    const hash = await fingerprint(bytes);
    const id = 'sha256:' + hash;
    return transact('readwrite', (store, resolve, reject) => {
      const lookup = store.get(id);
      lookup.onerror = () => reject(lookup.error);
      lookup.onsuccess = () => {
        if (lookup.result) { resolve(lookup.result as StoredPdf); return; }
        const doc: StoredPdf = {id, fingerprint:hash, title:title.replace(/\.pdf$/i, '') || 'Untitled', progress:1, bytes:new Uint8Array(bytes)};
        const put = store.put(doc);
        put.onsuccess = () => resolve(doc);
        put.onerror = () => reject(put.error);
      };
    });
  },
  async readPdf(id: string): Promise<Uint8Array> {
    return transact('readonly', (store, resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => req.result ? resolve((req.result as StoredPdf).bytes) : reject(new Error('Document not found'));
      req.onerror = () => reject(req.error);
    });
  },
  async setProgress(id: string, page: number): Promise<void> {
    return transact('readwrite', (store, resolve, reject) => {
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        if (!req.result) { reject(new Error('Document not found')); return; }
        const doc = req.result as StoredPdf;
        const put = store.put({...doc,progress:Number.isFinite(page) ? Math.max(1,Math.floor(page)) : 1});
        put.onsuccess = () => resolve(undefined);
        put.onerror = () => reject(put.error);
      };
    });
  }
};
