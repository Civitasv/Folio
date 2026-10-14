# Folio

*A quieter way to read.* Local-first PDF/EPUB browser preview and user-initiated scholarly DOI reference acquisition.

## Development
Run `pnpm install --frozen-lockfile`, `pnpm dev` for the browser preview, `pnpm check` for TypeScript, tests, coverage and production build, and `cargo test --workspace` for Rust. Desktop shell: `pnpm desktop`.

PDF: local picker/drop, signature/size preflight, SHA-256 deduplication, IndexedDB, search, delete and embedded browser PDF viewer with explicitly saved page number. EPUB: bounded ZIP/OPF reader, local metadata, EPUB2/3 TOC, sanitized reflowable chapter content, chapter position and font/theme settings. Both formats remain locally managed.

DOI (F01c): a DOI or doi.org URL is looked up **only after explicit user action** using Crossref/DataCite, with best-effort OpenAlex open-access discovery; source/provenance displayed. Save a local metadata-only or clearly unresolved/offline reference, deduplicate and reopen offline. A reported public HTTPS OA PDF may be imported by **explicit separate click** if its source allows browser CORS and no redirects; the download is capped and verified before existing PDF import. If browser CORS blocks the source, open the reported source to download and import manually. No paywall bypass or assertion that every DOI supplies full text.

No Folio account, server, sync, implicit document upload or default LLM use. Native SQLite/managed files, PDF.js text/anchors and translation / API / CLI AI are future slices. Browser IndexedDB is origin-scoped; clearing site data removes saved copies. See `docs/specs/F01c-doi-acquisition.md`.
