export interface DocumentSummary { id: string; title: string; progress: number }
export interface ReaderPlatform {
  listDocuments(): Promise<DocumentSummary[]>;
  importPdf(title: string, bytes: Uint8Array): Promise<DocumentSummary>;
  readPdf(id: string): Promise<Uint8Array>;
  deletePdf(id: string): Promise<void>;
  setProgress(id: string, page: number): Promise<void>;
}
export { preflightPdf, MAX_PDF_BYTES } from './pdf';
export type { PdfImportError, PdfPreflight } from './pdf';
export { decideImport, normalizeProgress } from './library';
export type { LocalDocument, ImportDecision } from './library';
