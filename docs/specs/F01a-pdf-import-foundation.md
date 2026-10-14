# F01a — PDF import foundation

Status: first implementation slice. Parent: F01 universal reading spec (PR #2).

Scope: dependency-free PDF header preflight, size cap (provisional 100 MiB), negative-case tests. Header validation is necessary but not proof of parseability or safety.

Acceptance: empty, oversized and non-PDF bytes rejected; valid PDF header accepted; 100% owned TypeScript coverage and green pnpm/Rust CI.

Deferred: native managed-file import, content fingerprint, SQLite persistence, PDF.js rendering, progress restoration and E2E fixtures. No PDF upload or cloud account.

## Browser preview increment

The web entrypoint now accepts PDF files, preflights signatures, hashes content with SHA-256, deduplicates by fingerprint, stores bytes and manually saved page position in IndexedDB, and opens the locally stored PDF using the browser built-in PDF viewer and revocable object URL. This is browser-preview functionality only: it is not PDF.js text extraction, automatic page tracking, native SQLite or a desktop production storage adapter. Verify import/reopen/offline and quota/error paths before declaring the slice complete.
