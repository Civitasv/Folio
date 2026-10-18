# F02 — Folio product definition: an AI-native space for deep reading

Status: proposed | Product line: Folio | Owner of truth: this spec and approved addenda

## 1. Identity and promise

**Folio — Read deeper. Think further.**
**An AI-native reading space for research.**

Folio helps researchers understand a document, interrogate its claims, connect the evidence, and leave with durable, traceable understanding. It is a **local-first reading and thinking workspace**. It must remain useful without an AI account, internet connection, or external reference manager.

Folio does **not** attempt to be the canonical bibliographic database or a complete word-processor citation ecosystem. A compact, independent reading library supports direct file import. Users may connect an external reference manager, which remains authoritative for bibliographic assets where configured. Folio owns reading state, local annotations, inquiry threads and reading notes; exports/sync adapters explicitly define what is copied or linked and how conflicts are handled.

Product principles: Reading before configuration; evidence before generated certainty; user-owned files; editable and reversible work; quiet surface, scholarly depth on demand; transparent provider choice; no simulated functionality.

## 2. Jobs to be done

1. Open a text PDF/EPUB (local import, DOI-open-access discovery or connected reference-manager item) and resume at the exact reading position.
2. Read the same structured original and translation in either Parallel (original left, target right) or Interleaved (each original block followed immediately by its translation), without losing figures, formulae, page references or context; adjust language and reading style.
3. Select a source passage, ask a question or request explanation, and verify the result against exact source anchors.
4. Highlight, annotate, form research questions and turn them into durable notes and reusable research threads.
5. Export notes, cited passages and reading state back to the originating manager or portable formats with explicit user control.

## 3. Product boundary

### Folio owns
- PDF and EPUB import/read/render, local lightweight inbox/library, recent/to-read/in-progress/finished states, per-document reading and layout preferences.
- DOI and optional bibliographic metadata sufficient for identification, provenance and citation links; source and local copies must be distinguished.
- Navigation, search inside a document, selection, annotation, bilingual translation, AI assistance, evidence-linked notes and research threads.
- Local persistence/backup/restore; user-selected providers through authenticated CLI or API; provider diagnostics and permission/consent records.
- Adapters to external reference managers, beginning with Zotero, with unidirectional open/import first and explicit, reversible write-back later.

### External reference manager owns by default
- Canonical bibliography, massive collection hierarchies, long-term citation-style database, manuscript/word-processor reference insertion, global duplicate and metadata resolution.
- Folio must not fork this into an incompatible second source of truth. It should not overwrite external metadata or annotations silently.

### Independent mode
Direct PDF/EPUB and DOI use without external apps must be first class. Library actions required for reading (import, find, resume, remove, export) work on their own. Advanced source-manager features are progressive integrations, never startup dependencies.

## 4. Information architecture and interaction design

Two distinct surfaces, not one stacked page:

- **Library:** calm document-centric landing: recent reading, to-read/in-progress/completed and a searchable compact document list; PDF/EPUB/DOI acquisition; explicit source labels and import state. Import is a single unobtrusive action, not an always-open administrative form. Metadata-only references never masquerade as downloaded full text. Remove is safe/recoverable when trash is implemented; until then destructive deletion is confirmed.
- **Reader:** quiet full-window **Parallel / Interleaved** reading modes using the **same** original Document IR and translation cache. Parallel shows semantic original on the left and target translation on the right, initially about 50/50. Interleaved is **one continuous column**: original block A followed immediately by translation of A, then original B followed by translation of B, etc. A small header holds the explicit mode switch, title, target language and Back to Library. No permanently mounted library, TOC, Inspector, AI chat, cards or settings in either mode. Later navigation/search/notes/Ask appear only when requested; they must not create a compulsory third pane. Keep each mode accessible in narrow windows without silently changing the selected mode.
- **Settings:** deliberate low-frequency dialog/screen for appearance, language, provider, data storage, import adapters and privacy.
- **Research notes:** evidence-linked, editable and exportable; not just a transient chat history.

Design language: restrained Apple-like system typography and interaction; clear Notion-like whitespace and hierarchy; dense metadata only at point of use. Native, reusable controls with reliable keyboard focus/ARIA, legible light/dark/paper themes and no fake glass/decorative animation. Use pinned local Apple design skill and Folio design principles. 200% zoom, 390–1440 px, reduced motion/transparency and increased contrast are acceptance gates.

## 5. Reader and parallel reading

**Primary reading modes:** **Parallel (双栏)** and **Interleaved (单栏)**, both rendered from the same source block IDs and stored translations. Parallel: semantic original article left, translated article right, adjustable remembered ratio and optional block-focused sync (not pixel/scroll-percentage matching). Interleaved: exactly one semantic reading column and scrollbar, repeating source block then its translation for every title, heading, paragraph and caption, with scientific-asset exceptions to avoid duplicated images/equations. Do not place the entire original before the entire translation. Mode switching only changes presentation, not parsing, cached translation, annotation identity or provider activity. Missing translations display a truthful in-place state; source stays readable. Additional source-only/target-only focus views are future optional scopes, not substitutes for these two modes. See F02c spec.

**PDF:** The default reader must be Folio-native structured reflow, **not an iframe, browser PDF preview, or permanently displayed PDF page screenshot**. Locally parse source bytes with PDF.js, reconstruct a confidence/provenance-aware Document IR (title, author, abstract, headings, paragraphs, figures/captions, tables, equations, references/footnotes as validated) and render semantic source/target articles from the same ordered blocks. For scientific fidelity, figures/complex tables/equations may use original high-resolution page-region crops in both panes, with separately translatable captions. Preserve exact original page/rect anchors, offer an in-app original-page audit/fallback for uncertain content, and never silently guess data or mathematical symbols. Ordinary text-PDF extraction is local; OCR and optional advanced layout models are separately authorized and not mandatory at startup. See F02b spec and feasibility ADR.
  
**EPUB:** Sanitized local chapter rendering; TOC/spine navigation, chapter link, reading location, font/line-height/margins/theme, scroll/paginated layouts and stable paragraph anchors. Parallel mode aligns chapter content units with translated results, retains formatting where safe and synchronizes to the nearest stable anchor. Translation of current chapter is explicitly initiated and bounded; caching by source hash, language, model, provider and prompt version.

**Shared:** Every selection/highlight/translation/research note refers back to a stable original anchor. Translation is a derived view, never a destructive document replacement. A reader can operate offline over locally cached content. No remote scripts from source documents.

## 6. AI-native comprehension

- Explain/translate selection; answer a question using user-selected passages; optional bounded page/chapter context with visible scope.
- Honest task labels: “current page” is not “whole paper”; distinguish direct source passages, model interpretation and user's own notes.
- Answers cite exact source locations and support click-to-jump, transient focus and a return path.
- Persistent local conversation, cancellation, loading/error/retry and provider/model/provenance metadata.
- **Research threads:** turn an original excerpt plus one or more questions/answers into local, editable, reusable research notes. Link across documents by stable source identities, without background uploads.
- Provider neutrality: manual/local-only mode, supported installed authenticated Agent CLIs and user-configured compatible APIs behind one typed capability contract; no credential extraction, hidden login, automatic inference or upload at startup.
- Explicit remote-data-flow confirmation with exact bounded excerpt and provider identity for each initiated operation, with tested cancellation and no secret leakage.

## 7. Annotations and research outcomes

- Bookmark, highlight, underline, question, free-form note; source and translation refer to the same logical original anchor.
- Annotation labels/colors, filter/search, undo where possible, selection-toolbar keyboard access and hover previews.
- Notes can embed an original citation/quote, user comment, contextual question and linked answer; revise without erasing provenance.
- Export Markdown with document identity, canonical DOI when present, page/chapter location and safe local deep links; later adapter-specific write-back is consented and conflict-aware.
- Local backup/export/import must not contain provider keys or inaccessible private-path assumptions.

## 8. External-manager integration

First supported adapter: **Zotero**.

1. Open or import an explicitly selected item/attachment, retaining its external library/item/attachment identity and source path when available.
2. Show provenance: linked external file versus managed local copy versus metadata-only reference. No destructive move and no silent changes to Zotero storage.
3. Reopen the source from Folio when permission/path allows; missing/offline file must degrade gracefully to cached copy or clearly explain failure.
4. Explicit export/write-back of notes/annotations only after round-trip format mapping, duplicate/idempotence checks and conflict choices (keep local / keep external / export copy).
5. Version/capability detection, clear permissions and a documented disconnect path. Work normally with the adapter disabled.
6. EndNote and other managers use the same abstract adapter only after supported access and data round-trip are validated; do not promise unsupported direct database mutation.

## 9. Architecture and persistence

Retain `React UI -> typed platform interface -> Browser IndexedDB adapter or Tauri -> Rust -> managed files/SQLite`. UI components never import native shell APIs directly.

Domain contracts: `DocumentIdentity`, `SourceProvenance`, `ReaderLocation`, `ContentBlock`, `SourceAnchor`, `TranslationIdentity`, `Annotation`, `ResearchThread`, `ExternalReferenceLink`, `ProviderCapability`. Extend only through separate approved migrations. One canonical document identity supports independent local import and external references; external IDs cannot replace content fingerprints. Text/sanitized EPUB and PDF anchors are format-specific implementations behind shared navigation/selection interfaces.

Preserve all existing F01 imported documents/identities, EPUB location, PDF progress, user language settings, translation cache and explicit provider consent. Versioned upgrades need interrupted/quota/corrupt migration tests and a no-document-loss rollback or forward repair. Credentials remain memory-only in the browser and OS keyring in desktop; never in document/annotation export. Metadata lookup is a distinct opt-in network action, and local reading must not hit a Folio server.

## 10. Delivery and dependencies

- **F02a — Full-window source/target PDF reading shell:** compact separate Library; two equal reading panes for PDFs, original left/target output right, minimal header, transparent manual excerpt bridge through existing translation provider/cache while PDF.js is not shipped, no fake features. Preserve existing EPUB/DOI/provider behavior. This is the immediate standalone implementation slice.
- **F02b — Native structured PDF reflow:** feasibility spike with representative papers, PDF.js local geometry extraction, layout/reading-order recognizer, versioned semantic Document IR, figures/captions and exact page-region fallback, original-page audit, native semantic source renderer, outline/search/selection and source anchors. Retire browser iframe after quality gate, not after a text-only prototype. See `F02b-native-structured-reflow.md` and `../architecture/F02b-pdf-reflow-feasibility.md`.
- **F02c — Parallel / Interleaved reading:** project the same F02b IR and exact-source translation store into either left-original/right-target full-window Parallel or alternating original-block/translation-block one-column Interleaved. Preserve shared figure/formula fidelity and annotations; switch layout without reparse/retranslation; explicit bounded provider operation and local cache. See `F02c-dual-and-interleaved-reading.md`. EPUB uses the same rendering contract when its normalized source blocks/assets support it.
- **F02d — Research marks:** cross-format selection anchor, search, annotation, note, undo, Markdown export.
- **F02e — AI comprehension:** selection context, multi-excerpt questions, evidence-grounded answer links, streaming/cancel, persistent conversations and research threads.
- **F02f — External-manager adapter:** Zotero import/link/open first, then verified opt-in round-trip write-back. Independent mode remains fully usable.
- **F02g — Reader quality and desktop finish:** layout/reflow provenance, accessibility, diagnostics, backups, onboarding, updates, packaging, real provider/OS tests and regression coverage.
- **F02h — Optional local retrieval:** separate explicit privacy and performance spec before cross-document indexing/research links.

Each slice must have a reviewable child spec/PR. A parent-level complete label requires real acceptance evidence, not plans or static mock controls.

## 11. Acceptance and evidence gates

- User with no documents sees a clear, attractive import/onboarding action; populated library shows scannable distinct records rather than raw filename slug rows.
- Reading opens with an explicit Parallel/Interleaved mode control, without permanent Library, Inspector or chat sidebar. Parallel shows original left/translation right; Interleaved shows A/A′, B/B′ in one scroller. Missing translation is never fabricated; before the structured text engine ships, the bounded manual source-excerpt bridge is explicitly identified as temporary.
- Opening a document makes the reading content primary immediately. Search/import/library do not remain stacked above an iframe.
- PDF and EPUB source/parallel/translation controls only appear when the corresponding actual engines/capabilities exist; disabled/unsupported states are truthful.
- Normal text PDFs can be searched and selected without manual paste once F02b ships; exact stable anchors survive reopen.
- Parallel mode provides two independently useful semantic panes and block-focused alignment, with real cached/provenance-labelled translations. Interleaved mode shows each original block immediately before its translated counterpart with shared source ID, one scroller and no duplicate figure/equation asset; switching between modes preserves the semantic reading location without triggering translation or parsing.
- No external manager/AI account required to import, read, search local text, annotate or resume.
- Explicit provider and external-manager operations cannot leak entire documents by accident or mutate external data silently.
- 1440/1280/1024/768/390 px, both color schemes and paper, 200% zoom, long titles, CJK and RTL labels, keyboard-only and screen-reader checks, reduced preferences.
- `pnpm check`, `cargo check --workspace`, `cargo test --workspace`; changed owned executable TypeScript modules target 100% statements, branches, functions and lines with negative-path tests; Rust needs meaningful tests. Include real PDF/EPUB sample and installed-app smoke before claiming release readiness.
- CI green alone never constitutes visual/OS acceptance; record exact head SHA and manual evidence. Never silently merge a red/draft/unreviewed PR.

## 12. Non-goals and risks

No mandatory cloud account/sync, telemetry, DRM/paywall bypass, mass bibliography reimplementation, forced manager migration, unspecified full-text upload, fabricated OCR or one-click paper-wide synthesis when only a page is available. Keep long-term canonical citation editing with the originating manager unless a future scope explicitly changes this.

Risk controls: avoid “minimal” layout that hides useful metadata; keep raw PDFs and anchors stable when introducing the new renderer; ensure dual-pane scrolling does not create feedback loops; maintain reversible migration/explicit read-only external-manager integration; never render unsupported tool affordances. The D01 shell is implementation infrastructure, not a visual acceptance sign-off.
