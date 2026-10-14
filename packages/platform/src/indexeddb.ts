import type { PdfStore, StoredPdf } from './index';

const DATABASE = 'folio-preview';
const STORE = 'documents';

/** Resolves only after the IndexedDB transaction commits; no cloud or network access. */
export function createIndexedDbStore(factory: Pick<IDBFactory, 'open'>): PdfStore {
  async function database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = factory.open(DATABASE, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onerror = () => reject(req.error ?? new Error('Cannot open local library'));
      req.onsuccess = () => resolve(req.result);
      req.onblocked = () => reject(new Error('Local library upgrade is blocked'));
    });
  }
  async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await database();
    return new Promise((resolve, reject) => {
      let result: T;
      const tx = db.transaction(STORE, mode);
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Local library transaction failed')); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Local library transaction aborted')); };
      const req = run(tx.objectStore(STORE));
      req.onsuccess = () => { result = req.result; };
    });
  }
  return {
    list: () => transaction('readonly', store => store.getAll() as IDBRequest<StoredPdf[]>),
    get: id => transaction('readonly', store => store.get(id) as IDBRequest<StoredPdf | undefined>),
    put: async doc => { await transaction('readwrite', store => store.put(doc)); },
    remove: async id => { await transaction('readwrite', store => store.delete(id)); }
  };
}
