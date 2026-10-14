# Folio

*A quieter way to read.* Local-first reading, with opt-in AI features specified separately.

## Development

Run `pnpm install --frozen-lockfile`, then `pnpm dev` for the browser preview, `pnpm check` for TypeScript, tests, coverage and build, and `cargo test --workspace` for Rust. Desktop shell: `pnpm desktop`.

PR #3 implements a browser-only local PDF import preview: file picker or drag/drop, signature/size preflight, SHA-256 deduplication, IndexedDB, title search, confirmed deletion and an embedded browser PDF viewer with explicit page saving. Documents are not sent to a Folio service. Clearing browser site data deletes stored PDFs. For scope and limitations, see `docs/specs/F01a-pdf-import-foundation.md`.

Native SQLite/managed files, PDF.js text/anchors, EPUB, DOI, translation and API/CLI providers are **not** implemented by this preview; see the F01 spec for planned vertical slices.
