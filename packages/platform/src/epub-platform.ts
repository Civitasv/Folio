import { chapterCfi, normalizeEpubAnchor, parseEpub, type EpubAnchor, type ParsedEpub, type DocumentSummary } from '@folio/core';
import type { PdfStore, StoredPdf, Fingerprint } from './index';

export type EpubTheme = 'light'|'sepia'|'dark';
export interface EpubPreferences { fontSize: number; theme: EpubTheme }
export interface SavedEpub { book: ParsedEpub; anchor: EpubAnchor; preferences: EpubPreferences }
type StoredEpub = StoredPdf & {
  kind: 'epub'; anchor: EpubAnchor; preferences: EpubPreferences;
  creators: string[];
};
export interface EpubReaderPlatform {
  importEpub(name: string, bytes: Uint8Array): Promise<DocumentSummary>;
  readEpub(id: string): Promise<SavedEpub>;
  setEpubLocation(id: string, anchor: EpubAnchor): Promise<void>;
  setEpubPreferences(id: string, preferences: EpubPreferences): Promise<void>;
}
export function createEpubPlatform(store: PdfStore, hash: Fingerprint): EpubReaderPlatform {
  async function record(id: string): Promise<StoredEpub> {
    const value=await store.get(id);
    if (!value || value.kind!=='epub') throw new Error('EPUB not found');
    return value as StoredEpub;
  }
  return {
    async importEpub(name, bytes) {
      const book=await parseEpub(bytes); // reject invalid publications before persisting anything
      const id='epub:sha256:'+await hash(bytes);
      const existing=await store.get(id);
      if (existing) return {id:existing.id,title:existing.title,progress:existing.progress,kind:'epub',creators:(existing as StoredEpub).creators};
      const doc: StoredEpub = {
        id,kind:'epub',fingerprint:id.slice('epub:sha256:'.length),
        title:book.metadata.title||name.trim().replace(/\.epub$/i,'')||'Untitled EPUB',
        progress:1,creators:book.metadata.creators,
        anchor:{kind:'epub',cfi:chapterCfi(0),spineIndex:0},
        preferences:{fontSize:18,theme:'light'},bytes:new Uint8Array(bytes)
      };
      await store.put(doc);
      return {id,title:doc.title,progress:1,kind:'epub',creators:doc.creators};
    },
    async readEpub(id) {
      const doc=await record(id);
      const book=await parseEpub(doc.bytes);
      return { book,anchor:normalizeEpubAnchor(doc.anchor,book.chapters.length)??{kind:'epub',cfi:chapterCfi(0),spineIndex:0},
        preferences:doc.preferences??{fontSize:18,theme:'light'} };
    },
    async setEpubLocation(id,anchor) {
      const doc=await record(id), book=await parseEpub(doc.bytes);
      const valid=normalizeEpubAnchor(anchor,book.chapters.length);
      if (!valid) throw new Error('Invalid EPUB position');
      await store.put({...doc,anchor:valid,progress:valid.spineIndex+1});
    },
    async setEpubPreferences(id,prefs) {
      const doc=await record(id);
      if (!Number.isInteger(prefs.fontSize) || prefs.fontSize<14 || prefs.fontSize>26 ||
          !(['light','sepia','dark'] as string[]).includes(prefs.theme)) throw new Error('Invalid EPUB preferences');
      await store.put({...doc,preferences:{...prefs}});
    }
  };
}
