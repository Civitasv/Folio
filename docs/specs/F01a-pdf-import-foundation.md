# F01a — PDF import and local browser reading preview

Status: implementation candidate in PR #3, pending CI and review. Parent: F01 universal reading spec (PR #2).

## Scope and acceptance
- No Folio backend/account or document upload. Browser preview stores PDF bytes and page number locally in IndexedDB; desktop-native SQLite/managed files are a separate delivery gate.
- Import PDF from picker or drag/drop; reject empty/non-PDF-signature/>100 MiB files; do not trust filename; preflight is **not** full PDF parsing or a security guarantee.
- SHA-256 fingerprint and deterministic document identity; duplicate import opens the existing copy without resetting reading position.
- Reader opens locally stored bytes via revocable object URL and browser built-in PDF viewer. Explicit page save and restoration on reopening; no false claim of automatic page tracking.
- Library title search, deletion with confirmation, error paths for storage/read/import/save/delete and missing/invalid inputs. Deletion removes stored bytes and progress together.
- Core logic is independent of browser storage; ReaderPlatform + PdfStore contract enables a later native adapter.

## Verification
- pnpm check: TypeScript + Vitest coverage + web production build; cargo check/test --workspace through CI.
- 100% statements, branches, functions, lines for owned core/platform/UI code including apps/web/src/app.tsx (bootstrap main.tsx has no feature logic).
- Tests for domain validation, deduplication, copy isolation, persisted progress, missing documents, transaction commit vs failure, browser error paths and React interactions.
- Review manual browser smoke on Chrome/Firefox/Safari, import and reload offline, multi-MiB documents, corruption and quota errors before promoting preview to product-quality.
- No claim of completed manual smoke, OS-specific packaging or native persistence without recorded evidence.

## Explicit deferrals (not implemented by PR #3)
- PDF.js text extraction, selection, coordinate anchors, page count and automatic progress; browser viewer cannot reliably report its internal page.
- Tauri native import, managed document files, SQLite, migrations and OS credential store; add a dedicated native-storage PR.
- EPUB, DOI, translation, API-key providers and authenticated local agent CLI: follow F01b–g. No remote API calls in F01a.

## Security and rollback
- Import is local; PDF viewer sandboxing and browser parser updates are browser responsibilities. Do not misrepresent five-byte header validation as document parseability.
- IndexedDB is origin-scoped and browser-managed: clearing site data deletes the preview library; quotas and private sessions differ per browser. Source file is never modified.
- Rollback: revert PR #3, leave prior indexedDB data untouched (database folio-preview v1), no destructive migration. Follow-up readers must account for the legacy progress field being a one-based page.
