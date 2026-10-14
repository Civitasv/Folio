/** Shared library identity; actual file persistence belongs to the platform adapter. */
export interface LocalDocument {
  id: string;
  fingerprint: string;
  kind: 'pdf' | 'epub';
  title: string;
  progress: number;
  importedAt: string;
}
export type ImportDecision = { kind: 'duplicate'; existing: LocalDocument } | { kind: 'new' };
export function decideImport(documents: readonly LocalDocument[], fingerprint: string): ImportDecision {
  const existing = documents.find(document => document.fingerprint === fingerprint);
  return existing ? { kind: 'duplicate', existing } : { kind: 'new' };
}
export function normalizeProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
