import { describe, expect, it } from 'vitest';
import { MAX_PDF_BYTES, preflightPdf } from './pdf';
describe('PDF import preflight', () => {
  it('accepts PDF header bytes', () => expect(preflightPdf(new Uint8Array([37,80,68,70,45,49]))).toEqual({ok:true,byteLength:6}));
  it('rejects empty input', () => expect(preflightPdf(new Uint8Array())).toEqual({ok:false,error:'empty'}));
  it('rejects a non-PDF signature', () => expect(preflightPdf(new Uint8Array([80,75,3,4]))).toEqual({ok:false,error:'invalid_signature'}));
  it('rejects oversized input before inspecting its signature', () => expect(preflightPdf(new Uint8Array(MAX_PDF_BYTES+1))).toEqual({ok:false,error:'too_large'}));
});
