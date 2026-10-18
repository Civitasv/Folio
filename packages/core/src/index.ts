import type { EpubAnchor } from './epub';
export interface DocumentSummary {
  id: string; title: string; progress: number;
  kind?: 'pdf' | 'epub' | 'reference'; creators?: string[]; doi?: string;
}
export interface ReaderPlatform {
  listDocuments(): Promise<DocumentSummary[]>;
  importPdf(title: string, bytes: Uint8Array): Promise<DocumentSummary>;
  readPdf(id: string): Promise<Uint8Array>;
  deletePdf(id: string): Promise<void>;
  setProgress(id: string, page: number): Promise<void>;
}
export { canonicalLanguage, languagePreferences,validateContentUnit,translationIdentity,epubContentUnits,
 TRANSLATION_PROMPT_VERSION,DEFAULT_LANGUAGE_PREFERENCES,LANGUAGE_OPTIONS } from './translation';
export type { SourceLanguage,TranslationView,LanguagePreferences,ContentUnit,TranslationIdentity,TranslationEntry,TranslationProvider } from './translation';
export { normalizeDoi, doiUrl, safePublicHttps } from './doi';
export type { DoiMetadata } from './doi';
export { preflightPdf, MAX_PDF_BYTES } from './pdf';
export type { PdfImportError, PdfPreflight } from './pdf';
export { preflightEpub, MAX_EPUB_BYTES, normalizeEpubAnchor } from './epub';
export type { EpubImportError, EpubPreflight, ReaderAnchor, PdfAnchor, EpubAnchor, EpubMetadata, EpubTocItem, EpubSpineItem } from './epub';
export { openEpubArchive, safeArchivePath, resolveEpubPath } from './epub-archive';
export type { EpubArchive } from './epub-archive';
export { parseEpub, chapterCfi } from './epub-book';
export type { ParsedEpub, EpubChapter } from './epub-book';
export { decideImport, normalizeProgress } from './library';
export type { LocalDocument, ImportDecision } from './library';

export { buildPdfIR, readingPairs } from './pdf-ir';
export type { PdfBlockKind, PdfRect, PdfTextSpan, PdfPageInput, PdfBlock, PdfDocumentIR, ReadingPair, ReadingMode } from './pdf-ir';
