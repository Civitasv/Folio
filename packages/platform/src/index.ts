import { preflightPdf, type DocumentSummary, type ReaderPlatform } from '@folio/core';
import { createIndexedDbStore } from './indexeddb';
export { createIndexedDbStore } from './indexeddb';

/** The storage interface is shared; only the browser implementation depends on IndexedDB. */
export type StoredPdf = DocumentSummary & { fingerprint: string; bytes: Uint8Array };
export interface PdfStore {
  list(): Promise<StoredPdf[]>;
  get(id: string): Promise<StoredPdf | undefined>;
  put(doc: StoredPdf): Promise<void>;
  remove(id: string): Promise<void>;
}
export type Fingerprint = (bytes: Uint8Array) => Promise<string>;

export function createReaderPlatform(store: PdfStore, fingerprint: Fingerprint): ReaderPlatform {
  return {
    async listDocuments() {
      const docs = await store.list();
      return docs.map(({ id, title, progress }) => ({ id, title, progress }));
    },
    async importPdf(title, bytes) {
      const valid = preflightPdf(bytes);
      if (!valid.ok) throw new Error(valid.error);
      const hash = await fingerprint(bytes);
      const id = 'sha256:' + hash;
      const existing = await store.get(id);
      if (existing) return { id: existing.id, title: existing.title, progress: existing.progress };
      const doc: StoredPdf = {
        id, fingerprint: hash, title: title.trim().replace(/\.pdf$/i, '').trim() || 'Untitled',
        progress: 1, bytes: new Uint8Array(bytes)
      };
      await store.put(doc);
      return { id: doc.id, title: doc.title, progress: doc.progress };
    },
    async readPdf(id) {
      const doc = await store.get(id);
      if (!doc) throw new Error('Document not found');
      return new Uint8Array(doc.bytes);
    },
    async deletePdf(id) { await store.remove(id); },
    async setProgress(id, page) {
      const doc = await store.get(id);
      if (!doc) throw new Error('Document not found');
      await store.put({ ...doc, progress: Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1 });
    }
  };
}
export const browserPlatform: ReaderPlatform = createReaderPlatform(
  createIndexedDbStore({ open: (name, version) => indexedDB.open(name, version) }),
  async bytes => {
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  }
);
