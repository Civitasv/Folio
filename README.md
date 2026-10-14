# Folio

*A quieter way to read.* Local-first PDF/EPUB browser preview with AI planned as an opt-in feature.

## Development

Run `pnpm install --frozen-lockfile`, `pnpm dev` for the web preview, `pnpm check` for TypeScript/tests/coverage/build, and `cargo test --workspace` for Rust. Desktop shell: `pnpm desktop`.

PDF: picker/drop, preflight, SHA-256 dedup, IndexedDB, title search, confirmed deletion, embedded browser PDF viewer and explicit saved page number.

EPUB (F01b): picker/drop, bounded validated ZIP/OPF extraction, title/creator/spine/TOC, sandboxed basic reflowable XHTML with local raster images and no scripts/external resources, chapter navigation, stored chapter-based CFI-like anchor, local font size/theme preferences. Unsupported: encrypted/DRM, ZIP64, fixed-layout and sophisticated original styling. Browser storage is origin-scoped; clearing site data removes stored copies.

No Folio account, Folio-hosted server or upload. Native managed files/SQLite, PDF.js text/anchors, DOI, translation and API/CLI providers are distinct future slices. See `docs/specs/F01b-epub-import-reader.md`.
