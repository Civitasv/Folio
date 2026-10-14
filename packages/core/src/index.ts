export interface DocumentSummary { id: string; title: string; progress: number }
export interface ReaderPlatform { listDocuments(): Promise<DocumentSummary[]> }
export { preflightPdf, MAX_PDF_BYTES } from './pdf';
export type { PdfImportError, PdfPreflight } from './pdf';
export { decideImport, normalizeProgress } from './library';
export type { LocalDocument, ImportDecision } from './library';
