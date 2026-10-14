# F01b — EPUB import and reflowable browser reader

Status: implementation in Draft PR #4. Depends on F01a (#3, merged). No account, Folio server, upload or automatic external resource requests.

## Functional implementation
- Import local EPUB using picker/drag-and-drop, verify OCF initial mimetype and full central directory and local headers, CRC, entry and aggregate size, compression ratio, encryption flags, duplicate names and path traversal.
- EPUB parser reads META-INF/container.xml, OPF metadata/manifest/spine, EPUB3 nav or EPUB2 NCX TOC, reflowable XHTML and allowlisted local raster images. DTD/entities and encrypted/obfuscated books are rejected. ZIP64, fixed-layout, media overlays, remote and scripted resources are explicitly unsupported in this preview.
- Original scripts, publisher styles, links, embedded content and external requests are discarded; a no-scripts sandboxed iframe uses strict CSP, data-only raster images and Folio-controlled font/theme. Text and basic semantic structure remain selectable.
- Both formats share existing origin-local IndexedDB, hash identity and deletion. Legacy folio-preview v1 PDF records with no kind remain valid without a destructive schema migration; EPUB records have kind/creators, raw bytes, independent CFI-like chapter anchor and presentation preferences.
- TOC, previous/next chapters, one-based chapter progress, persistent font size and light/sepia/dark mode. Chapter-granularity stable CFI-like markers generated from spine index; this is **not** full publisher CFI offset support. PDF still has separate one-based page progress.
- Browser-safe fallback for unsupported/decompression errors. No silent network calls.

## Security and limits
100 MiB compressed input; 2,000 entries; 32 MiB maximum extracted entry, 200 MiB aggregate declared output and 200:1 size ratio. Non-streaming raw EPUB input/parsed book is held in browser memory; test large inputs manually before release. DecompressionStream deflate-raw is required; unsupported browsers show a failure. All archive paths and OPF hrefs confined to archive root; ZIP64/multi-disk unsupported. No DRM circumvention.
Passing OCF preflight alone never qualifies as a parseable book; full parse runs before import persistence and again on opening.

## Validation and release gates
- CI: pnpm typecheck/test/build + full owned TypeScript statement/branch/function/line coverage at 100%; cargo check/test workspace.
- Fixture tests: real central directory with correct CRC, invalid signatures, malformed archive, missing package/spine/chapters, archive limits, path traversal, XHTML sanitization, TOC and images, local PDF+EPUB migration coexistence, stored location/theme.
- Browser smoke still required: reload offline, real-world EPUB3 and EPUB2 books, corrupt files, storage quota, navigation, zero-network-content policy and cross-browser compatibility. Record evidence in PR before marking ready.
- Independent fresh-context review and all required green CI checks before merge; do not auto-merge draft/red/unreviewed PR.

## Rollback
Revert PR #4; IDB folio-preview database/store remains v1 and old PDF bytes/progress are unchanged. EPUB rows remain inert if the feature is rolled back, not deleted automatically.

## Future slices
Native managed files/SQLite; full EPUB CFI/within-chapter offsets, fixed-layout/ZIP64/DRM handling; PDF.js text and coordinate anchors; DOI, translation, API and CLI providers remain follow-up work.
