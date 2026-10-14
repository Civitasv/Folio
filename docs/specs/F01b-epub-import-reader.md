# F01b — EPUB import, reflowable reader and common metadata

Status: **in progress**, first foundation increment in PR #4. Parent: F01 universal reading spec, after F01a (merged PR #3).
Product: Folio — A quieter way to read.

## Outcome and boundaries
A user imports a local EPUB, views editable best-effort title/author/language and spine/TOC, opens it offline in a reflowable and sandboxed reader, changes font size/theme, navigates chapters, and resumes at an EPUB CFI location. Local data remains on the device. F01b must not regress PDF import or conflate page numbers and EPUB CFI anchors.

## Implementation sequence
1. **Foundation (this first commit):** dependency-free EPUB OCF initial-header preflight, explicit EPUB CFI/spine anchor types, negative/positive unit tests. Preflight is deliberately not a full ZIP parser and must never be described as safe extraction or valid EPUB proof.
2. Safe EPUB archive adapter. Review renderer/parser libraries (epub.js and Readium Web as candidates), licensing, maintenance and sandbox model before adding one and regenerating a pinned pnpm lockfile. Validate central directory, container.xml, OPF, manifest, spine and nav/NCX, and reject corrupt/encrypted/DRM or unsupported archives with clear errors. Bound entry count, compressed/uncompressed bytes, compression ratio, nested/resource fetch, filename normalization and processing time; reject traversal, duplicate conflicting entries and script/external origin access.
3. Unified document metadata and local persistence. Add discriminated document kind + progress/anchor to library and migrate existing folio-preview v1 PDF rows without deleting bytes; import copy, fingerprint/deduplication, deletion and local reopening. Extract title, creators, language and cover best effort. Never infer author from filename.
4. Reflowable reader via a **format-specific** adapter; use isolated/sandboxed resource rendering with scripted publication content off, blocked unexpected external requests, and safe relative-resource resolution. Expose stable EPUB CFI/spine, TOC, font size, theme, keyboard navigation, loading/error/retry, and local restoration.
5. Browser tests with valid EPUB fixtures, offline reload, sanitization, missing OPF, zip bomb, malformed paths/CFI, import/delete regression and PDF coexistence. Keep required owned TS statement/branch/function/line coverage at 100%. Native desktop storage/packaging is a separate gate; do not imply it exists.

## OCF preflight contract (foundation)
- 100 MiB provisional compressed input cap (decompressed output and resource caps must be checked later).
- The ZIP must start with a local-file-header signature; the first entry must be named `mimetype`, be stored/uncompressed, have no extra header/encryption/data descriptor and have exact `application/epub+zip` bytes, with matching declared sizes.
- A valid leading header alone does **not** prove valid central directory, CRC, container.xml, safe filenames or parseable publication. Do not persist an EPUB as a usable book on preflight alone.
- CFI normalization is a lightweight storage-shape guard, **not** EPUB CFI grammar validation or anchor resolution; the renderer must validate/resolve against the active publication.

## Cross-format contracts
- `ReaderAnchor = {kind:'pdf',page:number} | {kind:'epub',cfi:string,spineIndex:number}`.
- Metadata shape: `EpubMetadata` with title, creators, language, spine and nested TOC; optional/missing data represented honestly.
- Existing PDF preview schema (`progress` one-based page) remains compatible until an explicit, tested migration.
- No server, account, silent network fetch, mandatory AI or publisher paywall bypass.

## Initial acceptance and evidence
- Unit tests for short/empty/oversized input, false ZIP/incorrect mimetype and all first-entry OCF fields; positive header fixture; PDF stays green.
- Anchor tests for valid location, invalid CFI shape, out-of-range/negative/nonfinite spine index.
- CI runs `pnpm check` and Rust check/test. This first increment does **not** close F01b as a completed EPUB reader.

## Risk / rollback
Treat EPUB archive and XHTML as untrusted input; enforce size/path/sandbox boundaries before enabling open/render. No changes to browser persistence or destructive migration in the foundation commit. Revert PR #4 to roll back. Follow-up commits must record smoke evidence and remaining unsupported EPUB variants.
