# Folio

*A quieter way to read.* Local-first PDF/EPUB browser preview and user-initiated scholarly DOI reference acquisition.

## Development
Run `pnpm install --frozen-lockfile`, `pnpm dev` for the browser preview, `pnpm check` for TypeScript, tests, coverage and production build, and `cargo test --workspace` for Rust. Desktop shell: `pnpm desktop`.

PDF: local picker/drop, signature/size preflight, SHA-256 deduplication, IndexedDB, search, delete and embedded browser PDF viewer with explicitly saved page number. EPUB: bounded ZIP/OPF reader, local metadata, EPUB2/3 TOC, sanitized reflowable chapter content, chapter position and font/theme settings. Both formats remain locally managed.

DOI (F01c): a DOI or doi.org URL is looked up **only after explicit user action** using Crossref/DataCite, with best-effort OpenAlex open-access discovery; source/provenance displayed. Save a local metadata-only or clearly unresolved/offline reference, deduplicate and reopen offline. A reported public HTTPS OA PDF may be imported by **explicit separate click** if its source allows browser CORS and no redirects; the download is capped and verified before existing PDF import. If browser CORS blocks the source, open the reported source to download and import manually. No paywall bypass or assertion that every DOI supplies full text.

No Folio account, server, sync, implicit document upload or default LLM use. Native SQLite/managed files, PDF.js text/anchors and translation / API / CLI AI are future slices. Browser IndexedDB is origin-scoped; clearing site data removes saved copies. See `docs/specs/F01c-doi-acquisition.md`.

F01d preview adds opt-in language settings, stable EPUB chapter paragraph units and manually pasted PDF page excerpts, aligned local translation drafts and a provider-neutral typed API for later F01e/F01f connectors. Cache remains origin-local and keyed by text SHA-256, anchor, languages, provider/model and prompt version. Without a configured provider the interface **does not claim AI translation**; manual drafts work offline.

F01e: Explicit OpenAI-compatible API provider settings. Browser secrets are **memory-only** and provider CORS must permit requests; desktop stores the key in its OS credential store and sends requests from Rust without returning the saved key to the frontend. No endpoint is contacted at startup; connection test may incur paid tokens. See `docs/specs/F01e-api-key-provider.md`.

F01f: Folio Desktop can explicitly check an installed, authenticated Codex CLI and select a concrete model. For confirmed excerpts only it calls noninteractive `codex exec` via fixed read-only argv/stdin from an empty temporary working directory, with JSONL validation, cancellation and bounded output/time. CLI-backed inference can be remote. The browser never executes Codex; see `docs/specs/F01f-codex-cli-provider.md`.
