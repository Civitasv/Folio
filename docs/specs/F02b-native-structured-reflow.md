# F02b — Structured PDF ingestion and native Folio reflow

Status: proposed; feasibility spike and engineering approval required before implementation.
Parent: F02 Folio product definition. Product form: standalone local-first app.
Decision: a PDF is immutable input data, **not the reader UI**.

## 1. User-visible goal

Opening a paper goes directly into an uncluttered, full-window, 50/50 source/translation reader:
- **Left: Original**, rebuilt from extracted PDF content using Folio's own semantic typography, not an iframe, embedded browser PDF viewer or permanently visible paper-page screenshot.
- **Right: Translation**, reconstructed from the same ordered structural blocks. A block with no translated output has a truthful pending/error/not-requested state rather than fake translation.
- Title, authors, affiliations, abstract, headings, paragraphs, lists, figures, captions, tables, equations, references and footnotes occupy the correct logical order when recognized; preserve source order and provenance.
- Both halves share the same block IDs and can scroll/jump by block with no pixel-perfect scroll coupling. Each scrolls independently; source focus highlights its corresponding translated unit. No always-open library, inspector or chat.
- Reading typography (font, size, line height, width, theme) is Folio-controlled, including separate target-language typography. Preserve source mathematical meaning and data. Source page/location remains available for audit as an **in-app original-page fidelity view** on demand, never as the main reading surface.
- Source text and assets are read and processed on device. OCR/model enhancement must be explicitly installed/initiated, not assumed.

### Non-goal: “convert PDF to its original HTML”
PDF usually describes positioned drawing instructions; logical title/paragraph/table/figure relationships often have to be inferred. Folio stores confidence/provenance for these inferences, supports correction and provides fidelity fallback rather than asserting perfect reconstruction. Do not silently edit scientific data or let translation rewrite the source.

## 2. Content and display contract

### Source
- Source is a semantic HTML rendering of a versioned **Folio Document IR** (see §4), not generated free-form untrusted HTML or flattened Markdown.
- Original words retain line-wrap cleanup only when safe, dehyphenation with evidence/undo, Unicode normalization only when semantically safe, inline emphasis/superscripts/subscripts and source links when reconstructable.
- Titles and section heading hierarchy are distinguished from body by multiple signals, not just font size alone; creator/DOI metadata can assist but never replace printed text silently.
- Two-column pages become one continuous logical reading stream. Multi-column, full-width float, sidebar, references and footnote ordering must be evaluated per page and across page boundaries.
- Headers/footers/page numbers can be suppressed in reflow only when repeated-pattern confidence is sufficient; still retain source anchors and an option to inspect original page.
- Figures: first-class figure block with original high-fidelity visual, same visual in both panes; preserve vector diagrams by **region-rendered crops of the source page** when individual object extraction would omit paths/text/overlays. Crop boxes include image and graph content without truncating labels. Caption is separately represented and translated on the right, with figure number preserved. Do not promise translation of text baked into figure imagery.
- Tables: semantic cells/grid, row/column spanning and table notes only when high-confidence; otherwise show a precise high-resolution original region in both panes, separately translate caption and mark table content as not structurally translated. Never infer numerical values.
- Equations: preserve page-region visual (block and inline as feasible) and original numbering first; verified LaTeX/MathML can be attached as *derived* optional representation. Never fabricate symbols by treating glyph-extraction garbage as correct mathematics. Translate surrounding text but not numerical/formula payload automatically.
- Footnotes, bibliographic references, citations, inline links and figure/table cross-references are linked to anchors only where resolved.
- Scanned/encrypted/corrupt PDF or text layer with missing/garbled glyphs: explain the condition and provide an in-app original-page raster fallback, not an embedded preview window; local OCR is separately opt-in in a later slice. Do not claim unavailable semantic reflow/translation.

### Translation
- Translate selected paragraph/section or explicitly approved bounded batch, in document order using source block IDs. Do not auto-upload a whole PDF at open, and never use a high-level “Translate full paper” label if processing is only a page/excerpt.
- Each payload carries exact source text, allowable context and excluded scientific literals; explicit provider and data-flow confirmation before remote call; local-only/manual mode always available.
- Preserve figure/table/equation identity and numbering. Captions/body/headers use target-language text, while both panes reference the same original figure or fallback table crop. Disambiguate translation provenance, status and model; cancellation and partial failure never corrupt source or prior cached translations.
- Existing F01d/F01e/F01f providers and language preferences remain behind the typed platform API. The current 4,000-character ContentUnit limit is a **bounded transport unit**: split larger semantic blocks into stable sub-units and reassemble; do not truncate or change cache identity silently.
- If no text is extractable, right side explains inability to translate rather than showing invented content.

## 3. Architecture / process boundaries

```text
Immutable local PDF bytes + content SHA-256
   -> PDF.js worker (embedded locally; no CDN)
       -> page text spans/geometry/font + PDF outline/annotations/optional structure tree
       -> exact page render for source fidelity and bounded region assets
   -> Folio layout recognizer (geometry/rules + per-page/page-crossing analysis)
       -> ordered semantic Document IR with confidence and source coordinates
       -> quality gate / local optional advanced recognizer adapter
   -> Folio native semantic renderer (React, sanitized text/asset URLs)
       -> Original block view                 -> Target block view
       -> source provenance / correction      -> translation keyed by block/sub-unit
   -> local cache/versioned persistence via @folio/platform
```

- PDF.js belongs to `packages/pdf` (or equivalent bounded extraction package), not to shared abstract `@folio/core`. React never invokes Tauri APIs directly. A dedicated worker isolates parsing and enables cancellation, incremental page processing, memory caps and cleanup.
- `@folio/core` owns a platform-independent, versioned IR, validators, deterministic block IDs, source provenance, reading-order and alignment contracts. `@folio/platform` persists original bytes, document IR, assets and translation with transactional failure handling; native/browsers differ only in adapters.
- Folio layout analysis starts deterministic and explainable (span grouping, baselines, columns, vertical whitespace, font hierarchy, repeated-header patterns, caption/ref regex with locale-aware variants). PDF structure tree may assist but is often absent and is never presumed complete.
- Advanced local model recognizer is optional, replaceable and separately consented. Do not make Python/PyTorch, multi-GB weights, auto-download or external service a mandatory dependency for first-run local reading.
- The IR, not HTML/Markdown, is the durable intermediate format. Rendering and translation must not depend on a specific PDF parser's proprietary schema.
- Progressive first-page extraction then nearby pages/background queue with cancel/retry; hash + parser version + layout algorithm version invalidate derived cache. Preserve immutable PDF, F01 files, DOI IDs, manual page anchor, old translation cache and existing stored document keys. Explicit adapter/migration for cached page-bound excerpts; no destructive implicit remapping.

## 4. Versioned intermediate representation (contract proposal)

```ts
type BlockKind =
  | 'title' | 'authors' | 'affiliations' | 'abstract'
  | 'heading' | 'paragraph' | 'list-item' | 'quote'
  | 'figure' | 'caption' | 'table' | 'equation'
  | 'footnote' | 'reference' | 'header-footer' | 'unknown';

interface SourceRegion {
  pageIndex: number; // zero-based, coordinates normalized to original page
  rects: Array<[number, number, number, number]>; // x0,y0,x1,y1
  textSpanRefs?: string[];
}
interface ContentBlock {
  id: string; kind: BlockKind; order: number;
  source: SourceRegion[]; // one block may cross columns or pages
  text?: string; runs?: InlineRun[]; children?: string[];
  assetId?: string; captionBlockId?: string; references?: string[];
  confidence: number; qualityFlags: string[];
}
interface DocumentIR {
  schemaVersion: number; sourceSha256: string;
  parserVersion: string; layoutVersion: string; pageCount: number;
  blocks: ContentBlock[]; readingOrder: string[];
  assets: Record<string, {kind:'page-region'|'embedded'; mime:string; source:SourceRegion[]; sha256:string}>;
  reviewFlags: Array<{blockId?:string; pageIndex:number; reason:string}>;
}
```

Exact representation and source coordinate conventions require an approved implementation-level type spec and tests. Stable identity derives from source fingerprint plus stable source spans/regions and versioned disambiguation, **not** translated text or ordinal alone. A revised layout version must provide an anchor migration/matching strategy; unresolved anchors are visibly marked rather than silently linked to a different block. Assets are local opaque IDs, not persistent blob: URLs.

## 5. Extraction stages and user-facing quality gate

1. Preflight: existing size/signature constraints, page count and page dimensions, encryption/password state, text availability and low-trust glyph quality. Never execute embedded PDF scripts or fetch external assets.
2. Span pass: obtain text items + transforms, widths/heights, style/font family if available and page geometry; identify lines and candidate paragraph blocks without assuming input stream order equals reading order.
3. Layout pass: identify column zones, full-width regions, title/author/abstract, section hierarchy, page furniture and candidates for caption/figure/table/equation/reference; handle float order and continuation across pages. Store hypotheses and confidence.
4. Asset pass: associate image/vector/text operators with figure candidates if reliable; otherwise generate page-region crop from locally rendered page (bounded resolution and dimensions) for full fidelity. Crop source regions and count saved with each asset. Separate captions from picture regions.
5. Reading-order validation: non-overlapping ordered spans; detect missing/duplicate text, likely interleaved columns, repeated headers and orphaned captions; let an untrusted region fall back to original-region presentation.
6. IR validation: schema/bounds, source SHA, no unsafe HTML, monotonic order, block/asset/translation-link integrity and versioned cache save; partial/corrupt result is not presented as complete.
7. Render source immediately from available valid blocks; render translation asynchronously only by user request and explicit provider consent.

### Quality UX
- “Structured reading ready” only when layout passes threshold; indicate uncertain blocks/page and provide **View original page**, report/correct reading order, or per-region image fallback.
- Show a small non-invasive processing status and actionable explanations, not a false “100% converted” toast.
- Preserve a source fidelity route so reader can check graph axes, equations, units and citation context at any time.

## 6. Design and accessibility

- Main experience: 56-ish-pixel thin Folio header, two reading columns, minimal central divider, source/translation heading, target language, visible translation status. Both columns use semantic article typography and have their own continuous scrollbars; width/size/line-height configurable independently, with no artificial paper-page border.
- Same stable block ID appears in both renderers. Clicking a source section focuses/scrolls the corresponding target block and vice versa; no scroll feedback loops. A figure anchors its translated caption as well as the shared image.
- Placeholder UI is non-scholarly and visibly labeled; do not turn a confidence guess into an apparent fact.
- Source fidelity/reading order review is a deliberate in-app overlay on a block/page, not an always-on PDF preview or third column.
- At too-narrow widths (e.g. 390), tabs/vertical stacking of two semantic articles is permitted; 200% zoom, dark/light/paper themes, reduced motion, contrast, CJK, RTL/bidi, selectable text, copy and keyboard/assistive tech required.
- Do not expose source HTML from PDF directly through `dangerouslySetInnerHTML`; plain text nodes plus validated semantic components and bounded local assets only.

## 7. Implementation slices and dependency gates

- **F02b0 — Feasibility spike (no UX replacement):** 8–12 legally redistributable fixture PDFs; inspect text/geometry/reading order; compare deterministic extraction vs optional locally installed structural recognizer. Produce source-to-IR JSON and reviewable block visualization. Decide pass/fail for text-only baseline, figures/table/equation fallbacks, licensing, size/performance.
- **F02b1 — IR and extraction:** PDF.js dependency/workers and security configuration; typed IR, versioned cache, page-block provenance, basic headings/paragraphs/two-column order, cancellation and honest quality failures.
- **F02b2 — Native reflow renderer:** replace iframe with Folio semantic article; heading/paragraph/list/reference presentation; source fidelity overlay and recorded source location; safe original-page fallback where required.
- **F02b3 — Figures, captions, tables and math fidelity:** original region crops and association; table semantic mode only on validated extraction; formula/number correctness via source-region fallback; fixture regression.
- **F02c — Aligned translation:** target renderer from the same IR, per-block cache/translation, independent style and block sync, opt-in bounded batches, errors/cancel/swap/mode as supported. Remove manual-paste as the ordinary path only once local text-unit extraction is proven.
- **F02b4 (conditional) — local advanced layout/OCR adapter:** only after feasibility results, licenses, model/installer footprint, download privacy, offline packaging and performance have been approved. Its absence must not break regular text PDFs.

Do not merge F02b2 into main or remove the original-page fallback until the quality gate passes representative paper types. F02a focused shell remains a separately reviewable predecessor.

## 8. Acceptance / definition of done

**Functional:** open a locally stored ordinary text PDF without an iframe and without pasting text; title/abstract/heading/body/captions appear as structured source; at least a complex two-column article follows correct reading order; copied text follows readable article order; figures retain legible axes/labels and correct captions; formulae and numerical tables never silently change. Open and navigate the original page at the block's exact source region. Read/explain/translate only exact bounded units.

**Engineering:** no network access during PDF open/parse/reflow; no remote model except explicit consent; no external model download on startup; bounded memory, lazy asset generation, cancellation at any page and worker cleanup. Original PDF and old reading state survive parsing error, app restart, partial cache write and failed migration.

**Test corpus before promotion:** cover single-column, two-column with floating figure, remote-sensing/data-rich figures, equations and inline symbols, complex table, footnote/references, mixed CJK/English, repeated page furniture, long paper, scanner-only PDF, malformed/encrypted document. Include expected ordered block manifest and manually reviewed reference crops; do not rely on generated test assertions derived from the same algorithm.

**Proposed decision targets, to be calibrated with real fixtures (not current observed performance):**
- 100% of verified source blocks have traceable original page + normalized region or are explicitly flagged unanchored.
- For eligible selectable-text test PDFs, >= 95% correct body paragraph sequence on reviewed corpus; no silently truncated full figure, mutated data value or skipped equation in gold fixtures.
- All known low-confidence/scanned/unsupported pages must show honest fallback. Semantic table/math coverage can be low in first slice if original visual integrity is maintained.
- First valid content appears progressively (target <= 3 s for a typical 10-page text PDF on agreed reference machine); capture p50/p95 latency, peak memory and generated cache size on macOS instead of asserting a benchmark without measurement.
- `pnpm check`, `cargo check --workspace`, `cargo test --workspace`, 100% changed executable owned TS coverage with negative-path tests; screenshots and actual standalone app smoke at 1440/1280/1024/768/390 and 200% zoom. CI green is not a substitute for visual or scientific fidelity review.

## 9. Privacy, rollback and explicit exclusions

Do not modify the source PDF. Keep exact original bytes, local-only derived IR/assets and isolated translation cache. Any optional layout model download requires an explicit size/version/license display and user action; AI/remote enhanced conversion requires a separate consent prompt specifying data transferred. PDF parsing is treated as untrusted input, with size/page/image/time bounds and escaped output.

Excluded from baseline promise: guaranteed universal PDF reconstruction, automatic scanned PDF OCR, reliable reconstruction of arbitrary vector-table cell structure, translation of text *inside* figure bitmap, conversion of every equation to correct LaTeX, whole-paper upload, and unreviewed external parsing services.
