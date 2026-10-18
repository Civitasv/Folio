# F02a — Reader-first visual and navigation reset

Status: implementation | Parent: F02 Folio product definition

## User problem
The existing Library page is a sparse administrative form; the import dropzone and document list remain vertically stacked above an open book, and the right DOI form dominates empty state. PDF remains an explicit browser preview pending F02b. F02a only changes the visual shell and navigation: **no fake PDF text extraction, AI, annotations or parallel mode**.

## Scope and behavior
- Distinct Library and Reading canvases. The Reader opens immediately in main when a document is selected. Import/search/list moves to a compact secondary navigation while reading, preserving deletion and search.
- Library landing: strong product identity, purposeful import action, lightweight searchable document rows with clear format/progress/creator, metadata-only DOI visually separated from full text. A metadata lookup remains explicit, never auto-triggered.
- Reader: document title and format; back to Library and contextual actions; preserve PDF iframe temporary fallback and manual page save until F02b; preserve sandboxed EPUB chapter, local progress, chapter preferences, current translation/consent and cache.
- Responsive navigation/inspector behavior; avoid an always-on DOI inspector dominating the Library by providing a separate explicit DOI acquisition state while keeping its existing user journey working.
- Light/dark tokens, consistent form styling, focus-visible, 200% zoom, reduced-motion/transparency/high contrast.
- Existing local documents and adapter method signatures must remain unchanged; no persistence migration.

## Non-goals
PDF.js, automatic PDF progress, actual side-by-side source/translation, new AI/annotation/storage methods and source-manager adapters belong to later slices. Do not label the F02a shell as completed parallel reading.

## Acceptance
1. No document: import discoverable, no faux reader actions, search and DOI remain explicitly accessible.
2. Document selected: reader precedes everything in main; no permanent import/dropzone/library list above the reader; secondary library affordances stay accessible.
3. PDF load/error/save/reopen/object-URL lifecycle works exactly as before; EPUB TOC/navigation/theme and sanitized iframe are untouched.
4. Long, multilingual and metadata-only rows wrap properly; keyboard reaches import/search/delete/back/settings/translation.
5. Tests cover transition Library→Reader→Library, active reading does not stack Library above reader, and import while reader active.
6. Run pnpm check, cargo check/test; visual checks at 1440/1280/1024/768/390 and 200% zoom remain manual acceptance, not inferred from tests.

## Risks and rollback
Conditional locations must never remount an in-flight provider panel or trigger remote work. The selected document is the sole mode source of truth; no URL/schema mutations. Revert F02a if visual/manual acceptance fails without touching document or translation stores. D01 prior visual acceptance issue remains open until real screenshots are reviewed.
