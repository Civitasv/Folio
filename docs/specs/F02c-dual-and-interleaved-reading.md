# F02c — Parallel and Interleaved bilingual reading

Status: proposed / implementation contract, dependent on validated F02b semantic source IR. Product: standalone local-first Folio. This is a **reading presentation** spec, not a second parsing/translation pipeline.

## 1. Goal and modes

One paper, one immutable original PDF, one versioned source Document IR and one exact-source translation cache. The reading toolbar exposes only two equally first-class modes:

| Mode | Presentation | Scroll ownership | Main use |
| --- | --- | --- | --- |
| **Parallel / 双栏** | Full-window split, **left original / right target language**, same article reading order in each pane | Two independently scrollable panes. Optional/controllable follow by semantic block, never by percentage | Long-form comparison or checking a figure against translated prose |
| **Interleaved / 单栏** | A centered continuous article: **Original block A, translation of A; original block B, translation of B; ...** | Exactly one scrollbar for the feed; both members of a pair stay close in reading order | Intensive paragraph-by-paragraph reading and learning |

Important: “Interleaved” does **not** mean concatenate the entire original article before the entire translated article, nor put two text columns inside each block. For each paragraph/title/caption/footnote, display its original first and its direct translation immediately afterwards. A user's explicit view preference survives document reopen and is not altered by parser output or translation status. Default may be Parallel until tested in local usability; switching changes layout only.

No third permanent sidebar, paper-preview iframe, mandatory AI chat, raw Markdown page or provider form in the reading area. A low-profile header has Back, title, `Parallel | Interleaved`, target language, and non-intrusive reading/translation status. Source fidelity opens only on demand.

## 2. One content model, two renderers

```text
DocumentIR.readingOrder: [A, B, C, ...]
             +
TranslationStore: Map<blockId + sourceHash + target + provider/model/promptVersion, result/status>
             ↓
deriveReadingPairs(IR, translationState)
             ↓
   ┌ Parallel ─────────────────────────┐
   │ SourceArticle: A B C …             │
   │ TargetArticle: A' B' C' …          │
   └───────────────────────────────────┘
   ┌ Interleaved ──────────────────────┐
   │ ReadingFeed: A A' B B' C C' …      │
   └───────────────────────────────────┘
```

Define `ReadingPair` as a derived, presentation-neutral join; not a duplicate persistent translation:
```ts
type ReadingMode = 'parallel' | 'interleaved';
interface ReadingPair {
  blockId: string; source: ContentBlock;
  target: TranslationDisplay; // not-requested | queued | translating | complete | failed | cancelled | source-only
  sourceHash: string; assetId?: string;
}
interface ReaderViewPreferences {
  mode: ReadingMode; targetLanguage: string;
  parallelRatio?: number; syncByBlock?: boolean;
  sourceTypography?: Typography; targetTypography?: Typography;
}
interface SemanticReaderLocation {
  documentId: string; blockId: string;
  fraction: number; // 0…1, viewport-aligned within same semantic block/pair
  sourceRegion?: SourceRegion;
}
```
Types above are an illustrative implementation contract; concrete TS definitions must be added to `@folio/core` with validation and migration tests. `TranslationDisplay` is derived from existing stored `TranslationIdentity`/entry plus pending state, not an unaudited string or a copied mutable source block. For source blocks longer than 4,000 characters, use stable sub-unit IDs and reassemble before rendering one pair, with no silent truncation. The source/target views must take *the same* `ReadingPair[]`.

Reusable `SourceBlock` and `TargetBlock` components are shared between both modes. Content identification, parser invocation, annotation, translation requests and local asset loading are **not** mode-dependent. CSS/classes and React composition determine only presentation. Switching modes must not change IDs, trigger network, consume provider tokens, re-extract PDF, lose highlight/note identity or reset active translation jobs.

## 3. Presentation details

### Parallel (双栏)
- Reader occupies the entire Folio app window. Original source article left, translated article right, initially about 50/50; adjustable divider and persisted ratio within useful minimum column widths. Reflow *both* articles independently using Folio semantic typography; this is not a PDF.js page view.
- Headings, author metadata, abstract, paragraphs and references follow `DocumentIR.readingOrder` in both panes. A source paragraph and its translated counterpart share `data-block-id`, but their heights need not match; **never align via page number, pixel offset or scroll percentage**.
- Source and target have independent scrollbars and separate typography options. Explicit synced reading, if on, follows the active pane's nearest semantic block ID and relative position. Programmatic follow is suppressed from feeding back; pointer/keyboard/wheel input elects the owning pane. Hover marks corresponding blocks without unsolicited scroll. Clicking either block can focus its counterpart. Failed/unrequested target shows local per-block status and retry, not fake prose.
- Keep both panes live on resize/swap; the first implementation can omit swapping if not ready, but must not show a nonfunctional button. Mode switches preserve reading location via `SemanticReaderLocation`.

### Interleaved (单栏)
- A **single** centered reading feed and scrollbar; each source block is followed immediately by its translated block within an accessible group, not separated by entire sections/pages. Repeat in original logical order.
- Visual hierarchy: source uses normal article ink, target below uses independently configurable target font and a subtle left inset or muted language label. Slight spacing **inside** a pair and larger spacing **between** successive pairs; do not put each paragraph in a heavy bordered card.
- A heading appears as original heading followed by translated heading; abstract paragraph followed by its translation; each numbered caption paired likewise. Maintain heading-level semantics for assistive tech (a translated heading may be visually styled without duplicating document outline heading levels).
- If a translation is not requested/pending/failed, retain the source and put a small status/action in the target slot directly after it, keeping next source block in correct order. Partial batch results appear in-place without layout re-sorting. Never substitute original English for missing target text as if translated.
- In this mode no cross-pane scroll sync exists and no second scrollbar is created. Selection of original/translated text annotates the same source `blockId` with origin language and exact selection spans; preserve quote/citation provenance.
- Switching from/to Parallel remembers the most recently focused/topmost visible `blockId` and fraction, then restores it in the destination. Avoid remounting a long-running translation job. Reader mode is a local view preference, not a request to regenerate translations.

### Media and scientific fidelity (both modes)
- For prose/heading/author/abstract/list/caption/footnote: source block then corresponding translated text in Interleaved; each is in its respective side in Parallel.
- A **figure/chart/diagram** is one shared original media asset for a logical block. Parallel can show it in both articles to retain context. Interleaved shows the image **once**, followed by original caption and translated caption in that order, rather than wasting vertical space with two identical screenshots. Labels, graph data and axes remain unchanged; text baked into an image is not silently localized.
- Complex table: verified semantic table when safe, otherwise show exact original page-region crop once in Interleaved (both panes in Parallel). Translate only confirmed table caption/notes, not fabricated cells, numbers, units or formula symbols. Keep source/translation of table caption adjacent.
- Equation: show intact original equation and number once in Interleaved; a clearly marked explanatory translation, when requested, belongs to surrounding prose or an annotation, not a visually duplicated/altered equation. Parallel shows equation in both relevant positions as original visual evidence.
- Grouped figure+caption and equation+number still have stable constituent source IDs and parent group ID where needed; navigation/annotations link to exact source regions. Never have different scientific source data between modes.

## 4. Translation lifecycle and security

- Extract only from locally validated F02b IR, never from an iframe scrape. Send bounded exact source units to a user-selected provider only after explicit operation and remote data-flow consent; loading/opening/mode-switching/language switching alone never starts remote inference.
- Store by document/source block fingerprint, exact source hash, target language, provider/model and prompt version; previous completed translation stays usable while a separately consented retry is in progress. Ignore out-of-date responses from changed document/version/language; no silent matching by ordinal.
- Target statuses: not requested / queued / translating / paused / complete / failed / cancelled / source-only (math/asset/fallback). Progress for selected range should be honest; absent content is not claimed translated.
- Existing F01 manual page-bound translation is a legacy record. Attempt verified source/block anchor migration; unmatched excerpts remain accessible as legacy notes/drafts, never bound automatically to an unrelated block.

## 5. Persistence, responsive behavior and accessibility

- Mode, divider ratio, font preferences and last semantic location persist locally per document or user preference with explicit precedence. `DocumentIR` and translations do not encode the view mode.
- Narrow viewports: Interleaved remains a normal responsive one-column article. If user selects Parallel at a width that cannot fit two legible columns, offer clearly marked Source/Translation tabs or an explicit suggestion to switch; tabs remain *Parallel mode presentation*, not fake Interleaved. Never render unreadably narrow columns.
- Keyboard: mode segmented switch, skip-to-content, block navigation, outline, source jump, passage translation and error retry; clear source/target accessible labels and status announcements. One-column reading order in DOM must be source then translation for each block. RTL target language should affect only the target sub-block's direction, not the original.
- Avoid per-block modal setup and visual noise. Support dark/light/paper, 200% zoom, CJK/multilingual, contrast and reduced motion. Source fidelity overlay provides page/region audit and supports keyboard dismiss/return to same `blockId`.

## 6. Implementation and test slices

- **F02c1 — Pure view projection:** typed `deriveReadingPairs`, status selectors, stable order, source/target components and explicit mode state. Synthetic `DocumentIR` fixtures first; do not couple to external parser state. Test target hash mismatch/failed/pending/asset cases.
- **F02c2 — Interleaved:** one scroller, source then target for title/paragraph/caption, figure-once and formula-once rules, accessibility and native CSS; saved layout preference. No provider call on switch.
- **F02c3 — Parallel:** two independent scrollers, adjustable ratio, target/source by same IDs, block focus and optionally gated sync with feedback-loop suppression.
- **F02c4 — End-to-end integration:** connect F02b real text PDF corpus, live local translation/cache and explicitly selected API/CLI; full mode transitions, restarts, partial failures, figure/data/math fidelity.
- EPUB adapts the same pair renderer from sanitized source chapter units after its own stable block identity/asset mapping is validated; do not translate injected EPUB HTML directly.

## 7. Acceptance

1. Given ordered blocks A, B, C and translations A', B', C', Parallel renders left `A B C` and right `A' B' C'`; Interleaved renders exactly `A A' B B' C C'` **with one feed and no extra sidebar**. Include a missing B' status immediately after B without moving C.
2. Both modes render the **same** user-owned source text, cache and figure assets; changing mode triggers zero parse calls, zero provider calls and no storage rewrite of IR/translation. Restore the same source `blockId` position within tolerance.
3. Source and target figure/caption/complex table/equation follow media-once rules in Interleaved and fidelity preservation in Parallel. No changed numbers, incorrect formula or missing chart legend.
4. Test a two-column academic PDF, a real mixed graph/caption example, a long bilingual heading, no translation provider, error/cancel/retry and target language switching. No raw PDF iframe in final reflow experience.
5. Test macOS standalone actual window widths 1440/1280/1024/768/390, 200% zoom, keyboard/screen reader, long CJK/RTL target, focus/selection, offline and restored mode/reading location.
6. `pnpm check` (100% owned TS statements/branches/functions/lines), `cargo check --workspace`, `cargo test --workspace` and real file/manual visual QA for exact shipped SHA; never infer a successful screenshot/native smoke from CI alone.

## 8. Exclusions

Not a global PDF retranslation button, cloud-first workflow, paper-faithful browser preview, unlimited OCR, rewriting plots' embedded text, perfect alignment where parser confidence is low, automatic whole-paper upload, or converting source content into mutable AI output. All source fidelity gaps are labelled and available for original-page inspection.
