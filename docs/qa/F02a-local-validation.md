# F02a — Standalone full-window PDF split: manual acceptance

Status: pending real-device/manual QA. Nothing here claims an observed screenshot or OS test.

## Startup

```sh
pnpm install --frozen-lockfile
pnpm check
cargo check --workspace
cargo test --workspace
pnpm desktop
```

Use the actual app reported by the desktop shell, with at least one normal text PDF and EPUB. Browser preview can also be checked using `pnpm dev`; IndexedDB is origin-scoped, and browser site-data clearing is destructive.

## Reader acceptance

| Action | Expected |
| --- | --- |
| Open local PDF | The entire Folio window switches from Library to exactly two equal primary reading panes: **Original PDF** left, **Target translation** right. No persistent Library navigation, Inspector, document grid or stacked import form in this view. |
| Original PDF | PDF appears as a native browser PDF preview in the left pane, with page-specific manual position control. Saving and reopening returns to saved page; closing revokes unused object URL. PDF is never uploaded to a Folio server. |
| Target translation | Right pane remains visible independently of translation provider. When available, chosen target language is clearly visible, all other language options folded under an expandable control, and the resulting target text is the main content. Original excerpt is not duplicated in an output block. |
| No result | No generated sample/placeholder that appears to be an actual translation; clear instruction to add a source excerpt from the displayed page. In F02a this step is temporarily manual, because PDF text extraction belongs to F02b. |
| Translation | Paste at most 4,000 characters using Add source passage, choose target language, save local manual draft or deliberately choose configured provider and confirm exact excerpt data-flow. Existing exact page/text/language/provider cache only. Changing language or opening a document does not trigger remote translation. Cancellation and error must be visible. |
| Missing adapter | If translation functions are missing on a platform, keep original PDF readable and show a real explanatory right-pane state. |
| More | Import a new PDF/EPUB or delete current PDF (with confirmation); no library list becomes permanently stacked above reader. |
| Return | Back to Library restores import/search/filters/DOI and document list; EPUB and DOI reference pathways behave as before. |
| Exceptions | Invalid/oversized PDF and local quota, failed read, failed position persistence, failed provider/abort: visibly report and preserve previously stored documents. |

## Manual visual/accessibility gate

Capture real evidence for desktop widths 1440, 1280 and 1024; narrow/zoom behavior at 768 and 390 must be usable (a vertical mobile fallback is intentional when two panes cannot remain legible). Also test 200% zoom, CJK and long titles, light/dark, reduced motion, increased contrast, keyboard-only navigation, Settings focus, page control, Details menu and source passage editor. Verify independent source/target scrolling and no horizontal content clipping. Do not treat jsdom and CI as screenshot/desktop acceptance.

## Deferred engines

This PR does **not** ship PDF.js text extraction/reflow, automatic page tracking, whole-paper translation, OCR, block alignment, formula parsing, synced reading, or native window fullscreen switching. F02b/F02c must implement and test these with real PDF fixtures. “Full-window” means the app's reading canvas fills the available window, without forcing OS fullscreen.
