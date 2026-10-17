import { preflightPdf, type DocumentSummary, type ReaderPlatform, type EpubAnchor, type DoiMetadata } from '@folio/core';
import { createIndexedDbStore } from './indexeddb';
import { createEpubPlatform } from './epub-platform';
import { createDoiPlatform, createDoiResolver } from './doi-platform';
import {createTranslationIndexedDb} from './translation-indexeddb';
import {createTranslationPlatform,sha256Text} from './translation-platform';
import type { EpubPreferences } from './epub-platform';
export {normalizeApiConfig,createApiProvider,createNativeApiProvider,testApiConnection,translationMessages,apiResponseText} from './api-provider';
export type {ApiConfig,ApiFetch,NativeApiBridge} from './api-provider';
export {nativeInvoke,createNativeApiBridge} from './native-api';
export { createIndexedDbStore } from './indexeddb';
export { createEpubPlatform } from './epub-platform';
export { createDoiPlatform, createDoiResolver, unresolvedReference } from './doi-platform';
export { createTranslationIndexedDb } from './translation-indexeddb';
export { createTranslationPlatform,sha256Text } from './translation-platform';
export type {TranslationPlatform,TranslationStore,Digest} from './translation-platform';
export type { DoiPlatform, SavedReference, DoiResolver, MetadataFetch } from './doi-platform';
export type { EpubReaderPlatform, EpubPreferences, SavedEpub, EpubTheme } from './epub-platform';
export type StoredPdf = DocumentSummary & {
  fingerprint: string; bytes: Uint8Array; anchor?: EpubAnchor; preferences?: EpubPreferences;
  metadata?: DoiMetadata; linkedDocumentId?: string;
};
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
      return docs.map(doc => ({
        id:doc.id,title:doc.title,progress:doc.progress,
        ...(doc.kind==='epub' ? {kind:'epub' as const,creators:doc.creators??[]} : {}),
        ...(doc.kind==='reference' ? {kind:'reference' as const,doi:doc.doi,creators:doc.creators??[]} : {})
      }));
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
      if (doc.kind==='epub' || doc.kind==='reference') throw new Error('PDF not found');
      return new Uint8Array(doc.bytes);
    },
    async deletePdf(id) { await store.remove(id); },
    async setProgress(id, page) {
      const doc = await store.get(id);
      if (!doc) throw new Error('Document not found');
      if (doc.kind==='epub' || doc.kind==='reference') throw new Error('PDF not found');
      await store.put({ ...doc, progress: Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1 });
    }
  };
}
const browserStore = createIndexedDbStore({open:(name,version)=>indexedDB.open(name,version)});
async function hash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}
export const browserPlatform: ReaderPlatform = createReaderPlatform(browserStore,hash);
export const browserTranslationPlatform=createTranslationPlatform(createTranslationIndexedDb({open:(name,version)=>indexedDB.open(name,version)}),sha256Text);
export const universalPlatform = {
  ...browserPlatform,
  ...createEpubPlatform(browserStore,hash),
  ...createDoiPlatform(browserStore,browserPlatform,createDoiResolver((url,options)=>fetch(url,options)),(url,options)=>fetch(url,options)),
  ...browserTranslationPlatform
};
