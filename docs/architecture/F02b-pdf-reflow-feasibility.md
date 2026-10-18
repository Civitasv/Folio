# F02b technical feasibility — decision record

Status: recommendation, not a benchmark or proof that a particular extraction engine already passes.
Companion: `docs/specs/F02b-native-structured-reflow.md`.
Scope: standalone Folio, local-first, PDF-to-structured-native-reflow, not embedded PDF viewer.

## Executive conclusion

**Feasible as a staged product**, but there is no universal deterministic algorithm turning arbitrary PDF drawing instructions into error-free title/body/figure/table/equation HTML. The fast, maintainable starting point is PDF.js to read the file and give local page text with geometry, Folio layout heuristics to assemble an owned versioned IR, and native semantic rendering. Preserve graphics/complex math with precise original-page region crops. Add optional local structural recognition only if fixture evaluation proves it necessary and its installation and licenses are suitable.

What must NOT be conflated:
- Rendering a PDF page correctly ≠ extracting reading-order text correctly.
- Getting selectable text ≠ identifying article title, heading, caption, float, table cells or equation.
- Extracting embedded image objects ≠ extracting a complete scientific figure (axes, vector paths, overlaid text and panels can live as separate drawing commands).
- Converting a page to Markdown ≠ a durable provenance-aware research document model.
- OCR ≠ restoring article semantics. It only provides additional text/geometry evidence.

## Current Folio gap confirmed against repository

- `apps/web/src/app.tsx` on the in-flight F02a branch uses an object URL inside a browser PDF iframe in the Original pane. Its page progress is an explicitly saved page, not observed automatically.
- `apps/web/src/translation-panel.tsx` needs a manually pasted bounded PDF excerpt for `TranslationIdentity`; the cache is scoped by document ID, anchor, source/target, provider/model and prompt version.
- `@folio/core` contains a reusable EPUB content-unit concept and translation contracts but no PDF layout/figure/table/equation IR.
- `apps/web/package.json` and workspace lockfile do not yet include PDF.js; it is not installed behind the current viewer.
- No native structural extraction, OCR, automatic PDF text translation or figure association can be claimed shipped. F02a is the visual bridge, F02b changes the actual reading architecture.

## Candidate evaluation

| Approach | What it does well | Main limitation / packaging implication | Decision |
| --- | --- | --- | --- |
| PDF.js locally bundled, Apache-2.0 | Render pages from local bytes, text content and geometry, outline/links, getOperatorList, optional getStructTree | It does not supply reliable cross-document scholarly reading order, section labels, figure/table semantics or math recognition out of the box | **Required lightweight foundation** |
| Folio geometry/layout logic over PDF.js | Explains and tests line/column/paragraph/heading/caption heuristics; no mandatory ML weight download | Rules fail on irregular journal templates/overlapping float/sidebar; must emit uncertainty and region fallback | **First recognizer; measurable quality gate** |
| Local Docling (MIT code, individual model licenses vary) | Document structure, reading order, tables, pictures, formulas, OCR; exports structured document, can run offline after models are available | Python/runtime/model size, installer/update/distribution complexity, first-run model download unless prefetched; need adapter and source-coordinate matching; should not be a mandatory desktop dependency before an actual spike | **Optional evaluation backend, not default dependency** |
| Marker/Surya | Strong structural Markdown/JSON and local inference options, can preserve tables/figure assets | Model-weights' commercial restrictions/conditions and inference backends must be reviewed; current licensing cannot be inferred from code license alone; deployment footprint; not automatic default | **Research-only candidate** |
| GROBID | Scholarly article title/metadata/citation/structure, TEI output | Figure pixel fidelity, general PDF drawing extraction, desktop stack/packaging and full layout reconstruction remain separate concerns | **Optional metadata/structure comparator, not main renderer** |
| Native PDF engines / system framework | Possible later platform-specific acceleration / fidelity | Complicates browser/desktop parity; license/distribution and cross-platform isolation need separate ADR | **Defer** |

### Relevant primary technical references

- PDF.js PDFPageProxy API: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html (`getTextContent`, `getOperatorList`, `getStructTree`, `render`). Structure tree is nullable.
- Mozilla PDF.js license: https://github.com/mozilla/pdf.js/blob/master/LICENSE (Apache-2.0).
- Docling official: https://docling.ai/ ; repository/license: https://github.com/docling-project/docling .
- Docling offline model prefetch: https://github.com/docling-project/docling/blob/main/docs/usage/advanced_options.md . Models ordinarily download on demand unless prefetched.
- Marker license/weight terms and inference requirements: https://github.com/datalab-to/marker ; review exact pinned version and weights before use.
- GROBID segmentation and figure/body semantics: https://grobid.readthedocs.io/en/latest/training/segmentation/ .

## Feasibility by content type

| Element | Text-PDF first pass | Quality-safe Folio fallback | Risk |
| --- | --- | --- | --- |
| Body / abstract | PDF text items, positions and line merge | Original region for corrupt/uncertain spans | Low-to-medium |
| Article title / authors / affiliations | Typography + position + section/DOI hints | Uncertain block and original page audit | Medium |
| Heading hierarchy / sections | Relative font/space/layout cues | Visibly mark ambiguous hierarchy; no guessed scientific label | Medium |
| Multi-column reading order | Geometric zones and float-aware ordering | Per-page review/region fallback; explicit unresolved marker | High |
| Figure/chart/compound visual | Candidate region + high-resolution page-region crop | Keep complete exact visual in both panes, rather than rely only on extracted image object | Medium-to-high for detection, low for crop rendering once bounds are correct |
| Caption + figure pairing | Position, numbering and nearest applicable region | Separate caption, show uncertainty, allow correction | High |
| Table | Recognized cells/coordinates on simple layouts | Original table-region crop + separate translated caption; **no inferred cell data** | High |
| Block/inline equation | Preserve glyph/region/number, optional locally recognized math | Original math-region visual; translate only surrounding prose | High |
| References / footnotes | Numbering, section/position cues | Source text + location, linking only when certain | Medium-high |
| Scanned PDF | No selectable text from ordinary parser | In-app source page raster; label OCR required; separate opt-in local OCR spec | High / out of baseline |
| DOI/publisher metadata | Existing explicit opt-in acquisition | Local PDF printed content remains authoritative when discrepant | Low |

## Proof-of-concept experiment (F02b0) / go-no-go gates

Build a fixture corpus of **8–12 licensed/redistributable PDFs** and record each file's SHA-256, size, pages, source provenance and expected structural manifest. Include: one/two-column, full-width float spanning two columns, a remote-sensing graph (axes/color bars), formulas with subscripts/Greek symbols, a complex table, mixed Chinese/English, repeated page header/footer, long reference list, a scanned paper and malformed/encrypted case. Avoid storing user-private PDFs in public CI. For protected test material keep local gated fixtures and derived noncopyright evidence only.

Run both paths on the same fixture/machine:
A. PDF.js local text items/geometry and Folio heuristic layout.
B. Optional separately installed local Docling, with pinned, licensed models prefetched by explicit developer action; collect offline metrics and structure output. Adapter maps results back to PDF page/rect provenance. Compare source fidelity, not just Markdown visual similarity.

Review manually against original PDF:
1. Is body paragraph order correct, especially double columns and floats?
2. Are title, authors, abstract, headings, footer and references correctly distinguished?
3. Does each figure crop include every visible label, vector mark, axis, legend and multi-panel component, and does the caption belong to the figure?
4. Are table and formula contents exact or explicitly preserved visually?
5. Does every displayed block jump to a corresponding original source region?
6. How do parser memory, p50/p95 first-page latency, page throughput, cache size and CPU load behave when canceled/reopened/offline?

**Gate:** choose the lightweight route if it meets the spec's proposed >=95% corpus-reviewed paragraph-order target with no silent figure/table/equation corruption. If not, improve recognizer or use a properly licensed optional local advanced adapter, while keeping unreliable pages visibly in original-region mode. Thresholds must be measured, not advertised as already achieved.

## Integration/protection decisions

- Implement `DocumentIR` inside platform-independent core with schema validation; no HTML-as-cache or silent model-generated markup.
- Asset renderer takes a local asset ID and source region; only sanitized text nodes and known safe semantic React components are mounted.
- Persist source PDF immutably and derived artifacts under source hash/parser/layout version, with atomic write and invalidation. Existing F01 stored IDs, DOI references, EPUB and page-bound translation remain functional.
- Install PDF.js and its worker as pinned local dependency in a dedicated implementation PR with lockfile updates; do not load workers/fonts/CMaps from CDN. Review dynamic-worker CSP, platform behavior and untrusted PDF caps.
- Model download, advanced OCR and remote services are explicitly opt-in and show download size/license; no automatic network on application launch/import. Docling's offline mode still needs separately obtained model artifacts.
- Preserve an in-app fidelity overlay for checking original page content. An original-page raster fallback is a scientific correctness feature, **not** a return to the browser PDF viewer as the product UI.
- Never allow model output to mutate source block text or numeric evidence. Confidence / source region must remain inspectable.
- Check redistribution license for each dependency AND its downloaded model weights before any release; do not assume an MIT/Apache repository grants unrestricted model redistribution.

## Relative effort / key unknowns

- Core PDF.js extraction/text grouping: moderate.
- Robust column/float reading-order and cross-page merge: high.
- Figure-region/caption pairing and exact graph capture: high.
- Math, tables and scanner support: very high; preserve original region by default.
- Native Python/model packaging, updates, macOS notarization and Windows/Linux distribution: high; separate delivery only if clearly justified by corpus result.
- Largest quality risk: confidently presenting incorrect science after a plausible-looking reflow. For Folio, accurate fallback is preferable to cosmetically perfect but silently wrong content.

Decision request after spike: approve the minimum viable semantic source types and release corpus, retain/fix heuristic recognizer vs add optional advanced recognizer, and sign off on native packaging/security budget. Do not begin blanket UI migration on an unverified text-only extractor.
