import { expect, it } from 'vitest';
import { decideImport, normalizeProgress, type LocalDocument } from './library';
const document: LocalDocument = {id:'one',fingerprint:'sha256:abc',kind:'pdf',title:'Paper',progress:40,importedAt:'2026-10-14T00:00:00Z'};
it('recognizes duplicate content by fingerprint', () => expect(decideImport([document], 'sha256:abc')).toEqual({kind:'duplicate',existing:document}));
it('allows new content', () => expect(decideImport([document], 'sha256:def')).toEqual({kind:'new'}));
it('clamps progress and rejects non-finite values', () => {
  expect(normalizeProgress(35)).toBe(35);
  expect(normalizeProgress(-1)).toBe(0);
  expect(normalizeProgress(101)).toBe(100);
  expect(normalizeProgress(Number.NaN)).toBe(0);
});
