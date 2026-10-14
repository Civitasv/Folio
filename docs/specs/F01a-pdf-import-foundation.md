# F01a — PDF import foundation

Status: first implementation slice. Parent: F01 universal reading spec (PR #2).

Scope: dependency-free PDF header preflight, size cap (provisional 100 MiB), negative-case tests. Header validation is necessary but not proof of parseability or safety.

Acceptance: empty, oversized and non-PDF bytes rejected; valid PDF header accepted; 100% owned TypeScript coverage and green pnpm/Rust CI.

Deferred: native managed-file import, content fingerprint, SQLite persistence, PDF.js rendering, progress restoration and E2E fixtures. No PDF upload or cloud account.
