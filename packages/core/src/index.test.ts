import { expect, it } from 'vitest';
import { decideImport, MAX_PDF_BYTES, normalizeProgress, preflightPdf } from './index';
it('exposes the supported PDF and library entrypoint contract', () => {
  expect(MAX_PDF_BYTES).toBe(100 * 1024 * 1024);
  expect(preflightPdf(new Uint8Array([37, 80, 68, 70, 45]))).toEqual({ok:true,byteLength:5});
  expect(decideImport([], 'sha256:new')).toEqual({kind:'new'});
  expect(normalizeProgress(50)).toBe(50);
});
