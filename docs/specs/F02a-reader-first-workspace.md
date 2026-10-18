# F02a — Full-window, two-pane PDF reading

Status: implementation | Parent: F02 Folio product definition | Standalone App first

## Decision
Keep the library as a separate landing surface. Opening a PDF changes the *entire* application into a focused two-pane reader: **left original PDF; right target-language translated content**. No persistent left library navigation, inspector, cards, AI chat or settings form inside the reading canvas. The app's window is the full-screen reading workspace (not a forced OS fullscreen request).

### Scope
- Thin shared header with Back to Library, truncated document title, explicit page position and low-frequency Settings / More actions. Source and target panes fill remaining window height and split roughly 50/50. Each pane scrolls independently; long file names do not squeeze content.
- Left: original local PDF, unmodified browser PDF preview until F02b. Preserve object URL lifecycle, manual saved page, error and loading state. No claim of PDF text selection or automatic page detection.
- Right: **translated output is the primary reading typography**, with target language visibly selectable; original text is never duplicated as a second output block. Before a translation exists, an honest empty state gives the user an explicit action to paste a bounded source excerpt from the current PDF page. The source excerpt/settings editor can expand when needed; it is not a permanent third pane. Translation uses existing language preferences, page anchor, exact-text cache, manual draft, optional configured provider, explicit remote consent and cancellation. No translation fires on document open or target-language change.
- Unsupported translation platform: right pane remains visible with clear diagnostic and Settings entry, never invents translated content.
- EPUB and metadata-only references keep their existing independent behavior in this slice; app settings remains separate.
- Library import/search/filter/delete/DOI acquisition remain available on returning to Library; contextual More menu may expose deletion while in reading mode.

### Later F02b/F02c, not included
Use bundled PDF.js to extract normal PDF text locally and render source text layer; then feed exact anchored source units to translation on demand, eventually aligning PDF blocks, figures and formulas. Existing iframe and manual excerpt are a **temporary functional bridge**, not full-paper translation. Avoid CDN/implicit network to fetch PDF rendering code.

### Acceptance
1. PDF opening removes old three-column library/inspector chrome completely and shows two equal, full-height panes titled Original PDF / Translation. Exiting returns to Library.
2. Native PDF preview is only in left pane, no import/dropzone/library table stacked above it. Translation result is only in right pane. Right pane retains its place even with provider unavailable.
3. Changing page changes the page anchor of subsequent excerpt translation only after explicit save; previously cached translations are looked up only with matching source/target/page/provider.
4. No auto-network requests; exact excerpt confirmation before optional provider operation; manual drafts clearly labelled; user can cancel an in-flight provider request.
5. Keep import, progress, DOI, EPUB, deletion, object URL cleanup and provider settings regressions. Tests assert absence of reading chrome, live language selection, manual saving and alternate no-provider state.
6. CI: pnpm check / cargo check/test. Real PDF/EPUB, native shell, long/CJK document, light/dark, 1440/1280/1024/768/390 and 200% keyboard/visual QA must be recorded before merge. CI does not constitute visual acceptance.

## Risk / rollback
No schema/storage migration and no new document upload path. Refactor is UI-only, leaving platform abstraction intact; rollback reverts the PDF focused-reader surface without deleting local data. Do not silently mark F02b or F02c complete.
