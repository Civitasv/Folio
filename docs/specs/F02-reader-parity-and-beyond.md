# F02 — Reader parity baseline + Folio-native research workspace

Status: proposed

Reference baseline: `cynicalight/reader@2208babba77d88cf3a888a2ffddae87ab0c5cbfc` (2026-10-18). This is a **behavioral/product benchmark**, not permission to copy its implementation or visual identity. Reader changes after this pinned commit do not silently expand F02; they require an explicit review.

## User problem

The current D01 shell improved code organization but does not meet the product bar. The shipped browser preview still reads like an internal prototype: large unused canvas, browser-default file controls, dense/raw rows, a cramped inspector, weak typography and hierarchy, and reading actions visually compete with import/configuration.

More importantly, the core reading workflow is incomplete:

- PDF is still rendered by the browser's embedded PDF viewer, page progress is manually entered, and translation requires a pasted excerpt because Folio does not own PDF text selection/geometry.
- EPUB translation is exposed as a contextual panel rather than a true aligned source/translation reading surface.
- There is no Reader-style three-context reading workspace with resizable/collapsible TOC/search, primary reading canvas, and AI/notes.
- The product does not yet cover the scholarly library, annotations, search, AI assistance, import/export, desktop quality-of-life, and recovery workflows of the pinned Reader baseline.

Folio's new product bar is therefore:

> **Reach behavioral parity with the pinned Reader baseline, then exceed it in interaction quality, provenance, local-first control, and AI-native research workflows.**

D01 remains useful design-system infrastructure, but it is **not** visual/product acceptance. F02 supersedes the current reader/library presentation where necessary.

## Scope

### 1. Visual and information-architecture reset

Folio should combine:

- **Notion-like calm:** low visual noise, generous but purposeful whitespace, clear hierarchy, instant wayfinding, restrained surfaces.
- **Zotero-like scholarly depth:** metadata, organization, citations, tags, relationships and batch operations remain discoverable instead of being hidden for minimalism.
- **Apple-like interaction craft:** immediate press/focus feedback, spatially consistent panels, responsive resizing, reduced-motion/transparency support, system typography, keyboard-first desktop behavior.

Required top-level workspaces:

1. **Library** — books/papers, recent/favorites, collections/tags, search, import, trash.
2. **Reader** — left navigation/search, central document/parallel translation, right AI/notes; all three regions resizable and independently collapsible.
3. **Item details** — scholarly metadata, relationships, citation/export and document management.
4. **Settings** — appearance, translation, AI providers/models, shortcuts, proxy/diagnostics and desktop behavior.

The primary canvas must never look like an admin form. Native/default HTML controls may be used semantically but must be visually integrated into the shared component system.

### 2. Reader parity matrix

Every capability below must exist in Folio before F02 can be called complete.

#### Library and paper management

- Separate **book** and **paper** library modes; move eligible documents between them.
- EPUB/PDF import with bounded validation, deduplication and local persistence.
- Paper metadata edit: title, creators, year, venue, DOI, arXiv, abstract and user remark; online completion never overwrites explicit user edits without review.
- Nested collections/categories, tags and useful automatic/smart grouping based on real stored metadata.
- Grid and sortable table/list views, favorites/recent/read state, batch selection/actions.
- Duplicate-paper detection and explicit merge review.
- Bidirectional related-paper relationships.
- Optional journal-rank lookup/configuration with clearly scoped external data flow.
- Import by identifier/link/title where legally/technically available.
- Browser connector acquisition flow and local Zotero migration for supported metadata/files/collections/tags/notes/convertible annotations.
- Citation copy/export: GB/T 7714, APA, BibTeX and RIS.
- Trash with undo/restore; bytes, annotations and conversations are removed only after permanent deletion.

#### Unified reading surface

- Left region: hierarchical TOC/outline and in-document search.
- Center: format-appropriate reader and reading toolbar.
- Right region: AI conversation and notes/annotations.
- Side regions are resizable and collapsible; their state is local UI state and cannot corrupt document data.
- Reading position restores automatically.
- Deep links can reopen a document at a supported location.

#### PDF

- Replace the browser PDF iframe with a Folio-owned **PDF.js** renderer/text layer.
- Continuous scrolling, page navigation, zoom and fit-width.
- Outline navigation and internal-link handling.
- Text selection with stable page/normalized geometry anchors.
- Page/block text extraction owned locally; no manual paste is required for normal text PDFs.
- Source / **parallel side-by-side** / translation-only modes.
- Parallel mode keeps source and translation synchronized around stable block anchors and allows pane order swapping.
- Hover/focus linkage across aligned source/translation blocks.
- Local processing may progressively derive reading order, text blocks, captions and image regions; incomplete/scanned pages are explicitly marked rather than silently invented.
- Figure/image preview and contextual copy/explain actions where the underlying block exists.
- PDF internal citation/reference preview and a return-to-reading-location path.
- Scanned-image OCR, password PDFs, complex cross-page selections and other unsupported cases must be truthfully gated until separately implemented.

#### EPUB

- Sanitized application-owned rendering; no publisher scripts or uncontrolled remote resources.
- Continuous scroll and paginated reading modes.
- Hierarchical TOC, chapter/cross-chapter links and search.
- Typography: font family where available, size, line height, margins and theme.
- On-demand chapter translation.
- Source / **parallel side-by-side** / translation-only modes.
- Parallel panes synchronize by stable chapter/block/sentence anchors, support pane swapping and sentence/block hover linkage.
- Source and translation share the same logical annotations.
- Translation typography can be configured independently.
- Fixed-layout, vertical/RTL and complex footnote behavior must be explicitly validated before being claimed.

#### Search, annotations and notes

- EPUB full-text index plus literal fallback; PDF page-text search.
- Bookmarks, highlights, underlines, question annotations and free-form notes.
- Annotation colors and labels/tags.
- Search/filter notes by kind, color, label and text.
- Hover preview and jump-to-source.
- Undo for recent annotation mutations.
- Export annotation digest/notes to Markdown with source location links.
- Optional auto-copy selection and sentence-selection shortcut behavior.
- Customizable highlight palette.

#### AI assistance

- Translate/explain a selection.
- Attach multiple selected passages to a question.
- Summarize **current EPUB chapter** or **current PDF page** with truthful scope labels.
- Persistent local conversation history and generation cancellation.
- Default document context may include title/abstract; broader chapter/page context is opt-in and bounded.
- Answer citations/source references jump back to the exact supported source anchor and provide a temporary visual locator.
- Text and image capability checks are explicit; missing capability blocks only the dependent action, not local reading.
- Streaming output where supported.
- AI features remain optional; normal reading/search/annotations work without an AI account.

#### Provider parity

- Official authenticated **Codex CLI**, **Claude Code CLI**, and **Kimi Code CLI** adapters where platform support is verified.
- API provider path supporting OpenAI-compatible and Anthropic-compatible protocols.
- User-selectable model per task; separate chat/translation choices and supported reasoning/effort controls.
- No silent CLI installation/login, token extraction or shell interpolation.
- Each remote action states exactly what document material can leave the machine; startup performs no inference request.

#### Desktop product quality

- Native file-open lifecycle and explicit supported file associations when release validation is complete.
- Update check/download UX with trustworthy integrity/version state.
- System/manual/direct proxy modes plus connection test.
- Privacy-filtered diagnostic export.
- First-run setup guide and offline release notes.
- Windows/macOS validation; Linux support is documented truthfully according to actual packaging status.

### 3. Folio must be better, not merely equal

Parity is the floor. Folio adds the following product-level differentiators as F02 vertical slices mature:

- **Evidence-first AI:** every generated research answer that uses document context can expose the exact local passages/anchors used, provider/model identity, task scope and data-flow provenance.
- **Research threads:** a selection → question → answer → follow-up can be pinned as a local research thread that survives independently of transient chat UI and links back to source passages.
- **Bring-your-own-agent as a first-class concept:** CLI and API providers share one capability model, so the reading experience does not privilege one vendor.
- **Parallel reading as a core layout, not a translation sidebar:** source and translation receive equal reading-space priority with draggable ratio, swap, sync on/off, and useful keyboard shortcuts.
- **Command-palette / keyboard-first desktop flow:** open document, search, toggle panes, change reading mode, create annotation, ask/explain, and jump between source references without pointer-only dependence.
- **Feature truth and reversible actions:** avoid fake Zotero/Notion affordances; destructive operations prefer recoverable trash/undo over repeated confirmation dialogs.
- **Local semantic retrieval later in F02 only after an explicit privacy/performance spec:** no mandatory Folio cloud or background document upload.

## Non-goals

- Copying Reader's source code, branding or pixel design.
- Claiming “parity” while substituting static mock controls for real functionality.
- Mandatory Folio accounts, cloud sync, telemetry or server-side document storage.
- Automatic upload of whole books/papers to an LLM.
- OCR, password-PDF bypass, paywall circumvention or DRM removal without separate approved specs.
- Replacing Tauri/Rust with Reader's Electron/Go stack merely to imitate its architecture.
- Treating current D01 screenshots or green unit tests as visual acceptance.

## Architecture / data and privacy

Folio keeps its existing boundary:

`React UI -> typed platform interface -> Browser adapter or Tauri commands -> Rust core -> SQLite/local files`.

F02 introduces a format-neutral reader contract rather than coupling UI directly to PDF.js/EPUB implementation details. The contract should cover:

- current location and progress
- TOC and search
- selection and stable source anchor
- annotations
- source content units / translation blocks
- source-reference navigation
- appearance controls
- format-specific capabilities

### PDF

PDF.js becomes a first-class dependency behind a Folio adapter. Text content and selection geometry are extracted locally. Stable anchors must be derived from document identity + page + normalized geometry/block identity, not volatile DOM node IDs. Translation and annotations bind to those anchors.

### EPUB

Keep the sanitized parsing boundary. Evolve chapter units into stable block/sentence anchors used consistently by search, annotation, translation, AI references and reading-location restoration.

### Persistence

Browser preview may continue to use IndexedDB, but new schemas require explicit versioned migrations and failure/quota tests. Desktop source of truth moves toward SQLite + managed local files through Rust specs; browser and desktop implementations share core contracts but do not fake identical persistence internals.

Trash must be recoverable and distinct from permanent delete. Provider credentials never enter document databases. Layout preferences and secrets are stored separately from document content.

### AI and privacy

- Local actions never require AI.
- Remote inference happens only after a user action whose UI discloses the selected provider and bounded source scope.
- No default/background document upload.
- CLI subprocesses use fixed argument construction, bounded IO, cancellation/timeouts and temporary working directories according to provider requirements.
- Raw provider/CLI logs are not rendered as answers and diagnostic export filters secrets.
- Online metadata/ratings/connector actions disclose their network dependency separately from LLM use.

## Delivery slices

This feature is intentionally split; “Reader parity” is too large for one reviewable PR.

- **F02a — Reading workspace + true parallel mode**
  - visual reset of Library/Reader chrome using the existing Apple design foundation
  - unified resizable/collapsible three-region reader shell
  - Folio-owned PDF.js renderer/text layer, automatic page progress and local text selection
  - PDF/EPUB source / parallel / translation modes with swap and sync controls
  - EPUB chapter translation moved into the reading surface rather than the inspector
  - no fake AI/annotation controls before their slices
- **F02b — Search + annotations + notes**
  - format search, stable selection anchors, bookmark/highlight/underline/question/note, labels/colors, filters, undo and Markdown export
- **F02c — Scholarly library depth**
  - book/paper modes, rich metadata, list/table/grid, collections/tags, favorites/recent/read state, duplicates/merge, related papers, trash and citation export
- **F02d — Acquisition and migration**
  - richer DOI/arXiv/title/link import, connector, supported Zotero migration, journal-rank optional integration
- **F02e — Source-grounded AI workspace**
  - selection explain/translate, multi-passage prompts, page/chapter summary, persistent chat, jump-to-source citations, research threads and streaming/cancel
- **F02f — Provider parity**
  - Codex + Claude Code + Kimi Code CLI capability adapters, OpenAI/Anthropic-compatible API protocols, per-task models/effort and capability tests
- **F02g — Desktop finish**
  - file associations, updater, proxy, diagnostics, onboarding/release notes and cross-platform installed-app evidence
- **F02h — Local retrieval / “better than Reader” research layer**
  - separately approved local indexing/retrieval design, cross-document evidence graph/search and research-thread workflows; must remain optional/local-first

Each slice receives its own addendum spec and reviewable PR. Later slices must build on stable reader/domain contracts rather than duplicating format-specific UI logic.

## Acceptance criteria

F02 parent acceptance requires all slices that map to the pinned parity matrix to be complete and verified. Individual slices have narrower gates.

Global gates:

- There is no Reader-baseline capability listed in **Scope §2** that is represented only by a nonfunctional control.
- At 1440 and 1280 px, opening a PDF/EPUB immediately presents the reading canvas; import/library configuration is no longer stacked above the active reader.
- PDF normal-text reading does **not** require manual pasted excerpts for translation/search/selection.
- Both PDF and EPUB expose source / parallel / translation modes; parallel is a real two-pane reading layout with adjustable width, pane swap and sync behavior.
- Left and right reader panels are independently collapsible/resizable and remain usable at 1024 px; narrow layouts deliberately transform rather than clip.
- Keyboard-only users can reach core library/reader/search/annotation/AI actions with visible focus; screen-reader labels/state are meaningful.
- Light, dark, paper/sepia and system appearance are coherent; reduced motion/transparency and increased contrast remain usable.
- No mandatory account, telemetry, sync or implicit LLM/network request is introduced.
- Every destructive library action is either recoverable through trash/undo or clearly confirmed when irreversible.
- Provider/model/source scope and remote data flow are visible before remote inference.
- Existing F01 document IDs, imported files, reading progress and translation cache are either preserved by migration or intentionally migrated with a tested rollback path.

## Verification commands and evidence

Every implementation slice:

- `pnpm check`
- `cargo check --workspace`
- `cargo test --workspace`
- 100% statements/branches/functions/lines for owned changed TypeScript production modules, without coverage games
- relevant Rust unit/integration coverage and explicit exclusions only for generated/bootstrap code
- regression/negative tests for malformed files, missing capability, offline/error/cancel paths, migration failures and privacy boundaries
- fixed-fixture visual walkthrough at 1440, 1280, 1024, 768 and 390 px; light/dark/paper where applicable; 200% zoom
- keyboard + screen-reader manual review for changed flows
- real PDF/EPUB samples for the reader slice; do not infer UI quality from jsdom
- installed desktop/provider smoke where the slice depends on OS/CLI/network behavior

F02a additionally requires real PDF.js text selection/progress/search smoke and parallel-scroll verification on multi-page PDF + multi-chapter EPUB. No screenshot is accepted if browser-default controls or clipped/overlapping panels remain in the core path.

## Risks and rollback

- **Scope explosion:** pinned baseline + vertical slices prevent “match everything forever.” New Reader features are separate decisions.
- **PDF migration risk:** browser iframe and PDF.js differ in navigation/rendering. Keep old reader behind a short-lived development fallback until PDF.js smoke/selection/progress evidence is recorded, then remove the fallback rather than ship two permanent behaviors.
- **Anchor instability:** format-specific stable anchor tests are required before annotations/AI references build on them.
- **Visual minimalism hiding scholarly depth:** library/item-detail acceptance explicitly checks metadata-heavy records and batch workflows.
- **AI privacy regression:** remote data-flow tests and provider-neutral contracts remain hard gates.
- **Persistence migration:** every IndexedDB/SQLite migration has backup/recovery semantics and downgrade/rollback notes before merge.

Rollback is per slice. Reverting a UI slice must not delete user documents. Domain/storage migrations need explicit reversible or forward-repair plans; do not rely on “clear app data.”

## Review notes and deferred work

- The current screenshot/visual state should be treated as a rejected prototype, not as D01 acceptance.
- Issue #15 remains useful as evidence tracking for D01-era accessibility/responsive checks, but F02a will provide a new visual acceptance target and can supersede obsolete screenshot expectations.
- Reader's pinned baseline explicitly still lacks OCR, password-PDF handling, PDF thumbnails/background FTS, cross-document AI retrieval, independent multi-session management, Ollama and reading statistics. These are **not required for parity solely because they appear on Reader's own future roadmap**; Folio may implement selected items under F02h or later specs.
- Independent fresh-context review remains required for security-sensitive provider/native changes.
