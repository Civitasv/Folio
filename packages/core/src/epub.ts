/**
 * EPUB OCF first-entry preflight only. A passing result does not prove that
 * the ZIP central directory, EPUB package, resources or XML are valid/safe.
 */
export const MAX_EPUB_BYTES = 100 * 1024 * 1024;
export type EpubImportError = 'empty' | 'too_large' | 'invalid_container' | 'invalid_mimetype';
export type EpubPreflight = { ok: true; byteLength: number } | { ok: false; error: EpubImportError };
const SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const;
const NAME = new TextEncoder().encode('mimetype');
const MIME = new TextEncoder().encode('application/epub+zip');
const MIN_HEADER = 30 + NAME.length + MIME.length;
function matches(bytes: Uint8Array, at: number, expected: Uint8Array | readonly number[]): boolean {
  return expected.every((value, index) => bytes[at + index] === value);
}
export function preflightEpub(bytes: Uint8Array): EpubPreflight {
  if (bytes.length === 0) return { ok: false, error: 'empty' };
  if (bytes.length > MAX_EPUB_BYTES) return { ok: false, error: 'too_large' };
  if (bytes.length < MIN_HEADER || !matches(bytes, 0, SIGNATURE)) return { ok: false, error: 'invalid_container' };
  const zip = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = zip.getUint16(6, true);
  const method = zip.getUint16(8, true);
  const compressed = zip.getUint32(18, true);
  const uncompressed = zip.getUint32(22, true);
  const nameLength = zip.getUint16(26, true);
  const extraLength = zip.getUint16(28, true);
  if ((flags & 0x0009) !== 0 || method !== 0 || compressed !== MIME.length ||
      uncompressed !== MIME.length || nameLength !== NAME.length || extraLength !== 0 ||
      !matches(bytes, 30, NAME) || !matches(bytes, 30 + NAME.length, MIME)) {
    return { ok: false, error: 'invalid_mimetype' };
  }
  return { ok: true, byteLength: bytes.length };
}

export type PdfAnchor = { kind: 'pdf'; page: number };
export type EpubAnchor = { kind: 'epub'; cfi: string; spineIndex: number };
export type ReaderAnchor = PdfAnchor | EpubAnchor;
export interface EpubTocItem { label: string; href: string; children: EpubTocItem[] }
export interface EpubSpineItem { id: string; href: string }
export interface EpubMetadata {
  title?: string;
  creators: string[];
  language?: string;
  spine: EpubSpineItem[];
  toc: EpubTocItem[];
}
/** A storage-shape guard, not a full CFI parser. Resolve CFI against the actual book. */
export function normalizeEpubAnchor(anchor: EpubAnchor, spineLength: number): EpubAnchor | null {
  if (!Number.isSafeInteger(anchor.spineIndex) || anchor.spineIndex < 0 || anchor.spineIndex >= spineLength) return null;
  const cfi = anchor.cfi.trim();
  if (!cfi.startsWith('epubcfi(') || !cfi.endsWith(')')) return null;
  return { kind: 'epub', cfi, spineIndex: anchor.spineIndex };
}
