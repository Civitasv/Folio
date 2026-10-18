# F02b/F02c implementation evidence and merge gate

Scope: PR #19; temporary native text-reflow and two-mode implementation, on top of F02a focused shell.

## What has code and tests
- PDF.js dependency and locally bundled worker; local PDF text/geometry passes into Folio-owned source blocks and retained per-block page location.
- Parallel original/translation native articles and Interleaved original-block → translated-block source order; source-page raster inspection is available **on demand** only, not default iframe PDF UI.
- Existing manually saved and explicitly consented provider translations share the same source/target language and exact excerpt cache contract; selected provider does not hide manual draft.
- Mode preference stores only a versioned per-document enum locally. EPUB/DOI/library paths remain separate.
- Unit regressions cover source ordering, partial translation, consent, cancellation, late responses, storage denial and PDF parse failure. A genuine generated PDF fixture runs through the installed PDF.js module/worker in CI rather than a mocked parser.
- Source bytes remain immutable; no automatic upload or background provider call.

## Known open F02b0 / F02b3 blockers

**A green test suite alone is not a sign-off for full F02b/F02c.** The current deterministic recognizer is a conservative scientific-reading baseline, not a general full-fidelity document converter. Caption-associated painted image regions can now be detected and rendered using original PDF page-region pixels (rather than extracting only a bitmap object); one shared asset is shown once in Interleaved and in both articles in Parallel. Multi-line captions can be kept together, and uncaptained header logos do not become article Figures. However, this is still heuristic association; uncaptioned/vector-only diagrams, correct placement in unusual floats, table vector grids/cells and mathematical payloads are NOT validated or generally reconstructed. The code must not market these as complete. Page-fidelity audit remains available and warnings must remain explicit.

Before treating native reflow as a complete scientific-reader replacement or merging PR #19 under the full F02b/F02c promise:
1. F02b0 corpus: sample #01 from a user-provided ten-page CC-BY scientific PDF has now been manually inspected; see `docs/qa/F02b0-supplied-pdf-01.md` for SHA-256, golden figure rectangles, seven vector-grid tables and source inconsistencies. **The original PDF is NOT committed**. Still gather 7–11 more legally usable PDFs and locally run the exact final Folio build against the original sample, with manually reviewed reading-order/figure/table/formula manifests. Include two-column figure floats, Chinese/English, a remote-sensing graph, math, scanned and broken PDFs.
2. F02b3: finish corpus-verified figure/caption/complete region association beyond normal embedded bitmap paints (vector-only diagrams, clipped overlays, unusual float ordering). Normal bitmap-region rendering and media-once Interleaved behavior are now implemented, but real visual comparison against uploaded PDF is still required.
3. Equation and complex table fidelity: verified native reconstruction or exact cropped visual fallback, and no invented numbers or symbols. Required `DocumentIR` quality flags/source regions, stable IDs and layout migrations.
4. Long blocks: stable sub-unit partition >4000 chars with exact source cache identity and reassembly, no dead-end translation states.
5. Reader interactions: reviewed block focus/mode-switch location restoration, visible/accessible original-page audit, narrow viewports, visual evidence at 1440/1280/1024/768/390 and 200% zoom.
6. Desktop-specific validation: actual macOS Tauri app import, parse, render, close, reopen, resource cleanup, offline and reduced motion. GitHub Actions Linux Rust/web jobs do not prove this.
7. Pass `pnpm check`, `cargo check --workspace`, `cargo test --workspace` for the exact final SHA, request independent code/UX review, and close evidence gaps before removing Draft/merging.

## Decision log

PR #18 docs merged into F02 parent plan; PR #16 parent plan merged to master. F02a PR #17 remains its own focused-shell QA dependency, and PR #19 is based on its branch. No claim that the full F02b0 corpus or scientific-media fidelity gates passed. **Do not merge PR #19 solely because its CI turns green.**
