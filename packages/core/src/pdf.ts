/** PDF import preflight; parsing and durable native storage are separate gates. */
export type PdfImportError = 'empty' | 'too_large' | 'invalid_signature';
export type PdfPreflight = { ok: true; byteLength: number } | { ok: false; error: PdfImportError };
export const MAX_PDF_BYTES = 100 * 1024 * 1024;
const signature = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;
export function preflightPdf(bytes: Uint8Array): PdfPreflight {
  if (bytes.length === 0) return { ok: false, error: 'empty' };
  if (bytes.length > MAX_PDF_BYTES) return { ok: false, error: 'too_large' };
  if (!signature.every((value, index) => bytes[index] === value)) return { ok: false, error: 'invalid_signature' };
  return { ok: true, byteLength: bytes.length };
}
