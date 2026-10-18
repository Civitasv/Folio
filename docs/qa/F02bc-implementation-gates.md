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

**A green test suite alone is not a sign-off for full F02b/F02c.** The current deterministic layout recognizer is a *text-only feasibility baseline*, not a full scientific document converter. Its confidence values are heuristic, its figure/table/caption pairing is incomplete, and it does not currently extract a complete graphic (vector paths, graph axes, inline text, legend) or validate table cell grids / math. The code must not market these as reconstructed. Page-fidelity audit remains available and an explicit warning appears for text-only fallback.

Before treating native reflow as a complete scientific-reader replacement or merging PR #19 under the full F02b/F02c promise:
1. F02b0 corpus: 8–12 legally usable representative scientific PDFs, with manually reviewed expected reading-order/figure/table/formula manifests. Include two-column figure floats, Chinese/English, a remote-sensing graph, math, scanned and broken PDFs.
2. F02b3: automatic figure / caption / complete region association and preservation of image + vector/overlay material. Show shared source media in Parallel and only once in Interleaved, with original and translated caption adjacent.
3. Equation and complex table fidelity: verified native reconstruction or exact cropped visual fallback, and no invented numbers or symbols. Required `DocumentIR` quality flags/source regions, stable IDs and layout migrations.
4. Long blocks: stable sub-unit partition >4000 chars with exact source cache identity and reassembly, no dead-end translation states.
5. Reader interactions: reviewed block focus/mode-switch location restoration, visible/accessible original-page audit, narrow viewports, visual evidence at 1440/1280/1024/768/390 and 200% zoom.
6. Desktop-specific validation: actual macOS Tauri app import, parse, render, close, reopen, resource cleanup, offline and reduced motion. GitHub Actions Linux Rust/web jobs do not prove this.
7. Pass `pnpm check`, `cargo check --workspace`, `cargo test --workspace` for the exact final SHA, request independent code/UX review, and close evidence gaps before removing Draft/merging.

## Decision log

PR #18 docs merged into F02 parent plan; PR #16 parent plan merged to master. F02a PR #17 remains its own focused-shell QA dependency, and PR #19 is based on its branch. No claim that the full F02b0 corpus or scientific-media fidelity gates passed. **Do not merge PR #19 solely because its CI turns green.**
