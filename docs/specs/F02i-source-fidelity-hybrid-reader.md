# F02i — Source-fidelity hybrid scientific reader

Status: proposed for staged implementation | Parent: F02 product definition | Delivery: standalone, local-first desktop and browser
Owner: Folio. This document is the product and engineering acceptance contract for F02i.

## 1. Decision and relationship to earlier specs

**Folio is an AI-native space to read deeply and think further.** It does not replace the canonical bibliography in an external reference manager. Its reading experience must remain useful offline and with no configured AI.

This is an explicit **amendment** to the earlier F02 section 5 and F02b statements requiring *both* sides of Parallel to be semantic HTML: for PDF **Parallel now defaults to a genuine Folio-hosted PDF.js original-page rendering with selectable PDF text layer on the left**, and a structured, continuous target-language article on the right. This is not an iframe, operating-system Preview, permanently pasted page screenshot, cloud viewer or a claim that PDF layout can always be reconstructed exactly as HTML. The in-app original page is the authoritative visual source of record. Interleaved remains a **single semantic reading column** of source block A, translation A′, source block B, translation B′; source scientific media is shown once. Users can explicitly switch source presentation to structured original reflow where supported. F02a/c modes, local translation cache and imported PDFs remain supported. No silent migration of stored progress/identity/annotations.

The previous text-only reflow implementation remains an honest, reversible fallback while this system ships incrementally. Do not mark a staged slice as fully satisfying all F02i quality gates.

## 2. Experience / interaction acceptance

**Library:** retain compact reading queue and existing PDF/EPUB/DOI imports. Opening a PDF enters the focused full-window reader, no permanent Library/Inspector/chat pane.

**Parallel (双栏):** original paper left and target article right. PDF source includes pages, actual page proportions, selectable PDF.js text layer, original formulas/tables/figure vectors and usable keyboard/text selection. Translation is native semantic Folio typography over the versioned Document IR. A 50/50 adjustable splitter (minimum accessible widths), optional swap, and remembered per-document ratio and mode. Source and target share stable block IDs/source page-rect anchors for click/focus/hover, search and block-based sync. Scrolling is not mapped by percentage; programmatic follows must not cause feedback loops; scrolling/selection/annotation by hand is not hijacked. Origin PDF remains mounted while toggling layout to avoid re-initialization. Target absent/failed text is shown honestly, with visible original source; AI never runs simply because a PDF opens or the mode changes. Visual audit opens an original page with a highlighted source rectangle.

**Interleaved (单栏):** one scroll container displaying source block then target block in article order. Title, headings, body, captions, references are semantic text; scientific figures, charts, complex tables, algorithms and display equations are full-resolution **source-page region visual assets**, once per pair, with source and separately translated caption where safe. Never flatten table grid lines or invent scientific numeric values/LaTeX; if reconstruction confidence is inadequate, original cropped region is mandatory and clearly labeled. If image extraction fails, retain a reachable original-page audit instead of omitting source content. Reuse same IR IDs/cache/reading location across both modes, preserving document spot without reparse/retranslate. Long units receive bounded child chunks with immutable parent anchor; no untranslatable >4k-character dead end.

**Narrow and accessibility:** 1440/1280/1024/768/390 widths, 200% zoom, light/dark/paper, Chinese and English, keyboard-only, screen-reader labels, selectable/copyable original text, reduced motion/transparency and increased contrast. At narrow widths, preserve the explicitly selected mode (adapt stacked presentation of Parallel with independent named regions instead of secretly switching to Interleaved). Avoid decorative animation.

## 3. Three independent engines and canonical contract

### 3.1 Original source renderer (authoritative)

Version-matched locally bundled PDF.js + worker, PDFPageView/PDFViewer/text layer or an equivalent tested built-in PDF.js component. Do not use an embedded PDF browser preview, remote CDN asset, screen capture as the default original, or system Preview window. Original source bytes are immutable. PDF.js paints vector/raster/color/text and handles selection; restore current page/region/zoom. Support bounded page virtualization and cleanup/cancel while switching PDFs. Use available local cMaps, fonts and WASM artifacts when necessary; test macOS WebView loading, CSP and offline. Show explicit file/Worker/parser stage on failure, with retry against the stored bytes.

### 3.2 Local layout recognizer (evidence, not a text generator)

- First read local PDF text spans and normalized original page coordinates with PDF.js.
- Rasterize each original page at a documented bounded resolution (for layout inference only).
- Detect candidates for doc title, abstract, authors/affiliations, headings, body, references, header/footer, figure/chart/image, table, captions, inline/display formula, formula number, algorithm and footnote. Preserve detector label, confidence, normalized rectangle, source page, detector/model version, and source-span membership.
- Merge/conflict-resolve overlapping detections with deterministic, testable thresholds; prevent header logos becoming scientific figures. Group whole multi-panel figures, numbered captions and optional legend; retain table captions whether above or below grid. Associate only with evidence; unpaired areas stay inspectable.
- Compute reading order across columns and spanning floats with explicit within-column vertical constraints, while retaining qualified recognizer order between lanes. Never drop unassigned PDF spans; mark them unmatched. Track incomplete/scanned/malformed pages; no pretend OCR.
- A **separately verified, locally pinned ONNX detector** may be used if the corpus demonstrates improvement. Its specific model weight/license, inference runtime, signing and packaged bytes are release gates; do not copy third-party app code, automatically download weights, or imply a repository code license covers its weight. Initial implementation must provide a typed adapter and a deterministic/no-model fallback, with real Mac packaging integration in its own PR.
- Model predictions are untrusted annotations; cannot overwrite the source text, numeric evidence, or actual original page rectangles.

### 3.3 Versioned, provenance-aware Document IR (one source of identity)

Additive schema in platform-independent `packages/core`, with migration from existing F02b IR:
`DocumentIR {schemaVersion, documentId, sourceFingerprint, parserVersion, detectorVersion?, pages, blocks, warnings, incompletePages, sourceAssets}`.
Each `ContentBlock` has stable ID (source/page/span/region-derived; collision checked), `kind`, order, page, normalized rect, exact PDF source text or explicit source-only status, source span refs, confidence and origin (PDF text/detector/fallback), optional caption association, source asset ID and `needsReview`. Page-scoped region observations and assets are separate from canonical source PDF; document identities/progress and existing translation records are not destructively replaced. A derived cache is versioned under source hash/parser/model schema, atomic write/repair, cancel/resume and bounded file/memory sizes. No remote data flow on import.

Translation/annotation retains a stable source anchor, exact excerpt hash, source/target locale and provider/prompt version. A recognizer upgrade must not silently attach an old translation or highlight to different original text; re-link only after exact source and anchor validation, otherwise mark orphaned/review. Exports identify actual source page, not guessed citation metadata.

## 4. Scientific asset fidelity

A figure/table/formula asset is selected by **detected entire visual region** rather than dependence on an embedded bitmap XObject. Render the immutable source page at display-appropriate resolution and crop the full region including PDF drawing primitives, vector lines, axes, legends, embedded labels and all panels; pad and clamp within original page bounds. Cache assets by source fingerprint/page/rectangle/render version/display bucket, not by unstable process object URL. Display full visual in Parallel as part of native source PDF and in the translated pane when needed; in Interleaved render the visual once, with original caption and translated caption adjacent.

If table cell topology has not been reliably recognized, retain exact original grid crop. No inferred cells, p-values, formula symbols or silently “corrected” contradictions. Models may explain source discrepancies *as an attributed annotation*, never mutate the primary scientific content. Inline formulas remain exact PDF source glyphs/regions; explicit optional conversion follows separate proof/correction flow. Scanned pages show original page + OCR-needed notice, not empty-article success.

## 5. Delivery PRs / dependency graph

**F02i0 — architecture, typed layout evidence and corpus** (first executable slice): amend product/spec, define normalized region/asset contracts and deterministic grouping/reading-order code and tests in core. Wire the fallback builder to optionally consume already observed regions, preserving current behavior with no observations. Test figure/table/equation visual asset identity and source-anchor stability. This contains **no unlicensed model weight** and no fabricated detector output.

**F02i1 — genuine PDF.js original-pane adapter:** version-matched local worker and original-page/text-layer rendering inside focused reader, viewport lifecycle and source location bridge, no iframe; unit/integration + real macOS text selection/manual screenshots. Parallel defaults to source-native left and semantic target right; old semantic-source presentation is a clearly labeled fallback. Restore modes across reopen. If reader cannot initialize, show retry and safe fallback without data loss.

**F02i2 — recognizer spike and on-device delivery:** compare deterministic recognizer with separately licensed/pinned local model(s) on the same corpus; record runtime/memory/latency and deployment terms. Only if accepted, implement ONNX inference through the platform boundary (desktop-native preferred), explicit model availability state, SHA/signature, bundled/installable offline assets, no automatic download, cancellation and per-page progress. Browser remains useful with fallback.

**F02i3 — full scientific region crops and data migrations:** figures, tables, formulas and multi-panel/cross-column associations; rendered high-resolution source crops, incremental cache; verified caption ordering and multilingual paragraph geometry. Preserve existing source IDs/translation cache safely.

**F02i4 — aligned presentation and research interactions:** splitter/side swap, block focus, source/target scroll arbitration, selection, note/search source anchors, accessible feedback, responsive/zoom manual QA. Interleaved remains source+target block pairs.

Each PR links this spec, has exact-head `pnpm check`, `cargo check --workspace`, `cargo test --workspace` as applicable, meaningful negative tests, independent review if available, privacy + licensing assessment, regressions and rollback. Green CI alone never certifies visual/installed App correctness. Stacked PRs are not silently merged into `master` while dependencies/draft remain pending. Owner may explicitly request a labeled local-acceptance snapshot that preserves known limitations.

## 6. Corpus and measurable quality gates

8–12 lawful test PDFs with SHA-256/expected manifests: real double-column with floats, seven vector-grid tables, labelled multi-panel figures, remote-sensing graph with axes/color bar, math/subscripts, Chinese/English, long citations, landscape/rotated, scanned and malformed/encrypted PDF. User-provided clinical paper from `docs/qa/F02b0-supplied-pdf-01.md` is local private sample #01: **never commit or distribute its original bytes or clinical images** without separate permission. Maintain offline/CI-safe synthetic fixture derived from one's own drawing commands; additional private corpus manual QA remains local.

Proposed minimum release gates: >=95% human-verified paragraph reading order over reviewed text corpus, no unacknowledged omission/mutation of figure/table/formula scientific content, correct source anchors for every displayed block, no duplicate scientific asset in Interleaved; page-header/brand filtering and multi-line captions; time and peak memory measured for cold 10-page / 50-page / cancel/reopen on target Mac, with target thresholds approved only after baseline measurement. Source-side scientific discrepancies (e.g. table p-value vs prose) remain verbatim, never “fixed” by parsing/translation.

Automated: versioned schema and migration/rollback; adversarial columns/caption association, arbitrary order/nonfinite/overlap inputs, all/partial/no OCR text, loading failures, model unavailable/corrupt, cancellation, repeated open, CSP/Worker assets, no unexpected network, provider consent, cache invalidation, exact original-page/crop coordinates, keyboard/screen-reader and reduced-motion tests. UI screenshot/manual device evidence for all named widths and theme settings plus direct text selection/copy on macOS Tauri; independent review records evidence and unresolved gaps.

## 7. Failure handling and privacy

PDF import is not reflow completion. Import preserves the original and separately reports parse/render/model steps. Layout failure falls back to original PDF source; partial text still readable; image inference failure cannot erase the original or block text. If a local model is absent/invalid, show bounded opt-in install details or use deterministic recognizer; do not call an external model/server or download at app startup. Device files/images/derived medical content never go to CI, telemetry or provider without visible exact-scope user action. Existing API/CLI credentials and permission boundaries unchanged. No mandatory account, sync, upload, analytics or cloud processing.

## 8. Out of scope and signoff

No automatic remote OCR, wholesale PDF-to-editable-HTML fidelity claim, citation-manager replacement, silent correction of scientific tables, unauthorized model-weight redistribution, immediate document-wide AI call, or hidden third pane. Preserve legal attribution to separately used dependency/model; independently verify weight license and packaged binaries prior to production release.

Complete F02i requires all five delivered slices and manual acceptance evidence, not just a detailed Spec or the initial core implementation.
