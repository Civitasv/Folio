# F02a — Local standalone functional validation

Status: pending human/manual QA. This is an **execution checklist**, not a claim that any screenshot or OS test was performed.

## Setup

From the Folio monorepo root, use a current Node/pnpm and the Rust/Tauri prerequisites appropriate to the OS:

```sh
pnpm install --frozen-lockfile
pnpm check
cargo check --workspace
cargo test --workspace
pnpm dev
```

Open the URL Vite reports. Repeat against the native shell with `pnpm desktop` when its local platform prerequisites are installed. Browser IndexedDB storage is origin-specific; do not clear site data between pre-/post-change comparisons. Configure network-offline mode **after** any necessary initial dependency setup. Tests cannot guarantee native entitlement, OS credential-store and authenticated CLI behavior.

## Functional smoke (record pass/fail, OS and app SHA)

| Case | Action | Expected |
| --- | --- | --- |
| First launch | Open a clean local origin | Calm Library landing; import, search and explicit DOI action available. No AI calls or DOI lookup on boot. |
| PDF import | Add a real text PDF through the picker and drag/drop | Stored locally; document row shows PDF; PDF browser preview opens directly in primary reading canvas; import/library stack is absent from the active main canvas. |
| PDF progress | Save a valid page, close and reopen | Saved page restored; invalid page yields clear error; browser preview honestly identified as temporary and page save manual. |
| EPUB import | Import a real EPUB with TOC and multilingual text | Sanitized chapter opens in main; navigation, appearance and saved chapter survive close/reopen. |
| Sidebar | Open reader, hide/reveal library and details | Main canvas expands/reflows; source stays mounted; closing reader while both hidden restores the Library shell. |
| Translation | Use manual local draft; if configured, separately confirm selected provider operation | Only displayed excerpt sent after explicit consent; cache and exact anchor preserved; no synthetic translation shown when absent. |
| DOI | Look up a valid DOI by explicit click; save metadata-only; optionally import OA PDF | Metadata-only visibly distinct from the locally stored PDF; no automatic background download or full-text assertion. |
| Library | Filter by format, search title/creator/DOI, delete inactive and active docs | Records stay accurate; destructive delete requires confirmation; local translation cache for deleted item is removed. |
| Offline/reopen | Disconnect after local imports and reopen | Local PDFs, EPUBs, last position and cached manual translations remain usable. |
| Error | Invalid signature, oversized file, quota/storage failure | Visible failure; current documents remain intact. |

## Visual/accessibility gate

Capture **real** before/after screenshots at 1440, 1280, 1024, 768 and 390 CSS-pixel widths, 200% zoom, dark/light system scheme, reduced motion and increased contrast. Test long and CJK titles, keyboard-only navigation/focus, screen reader landmarks/labels and inspector controls. Verify PDF iframe and EPUB sandbox do not overflow horizontally. Keep PR Draft until visual review and active PDF/EPUB smoke are actually recorded.

## Deferred engine acceptance

F02a deliberately keeps the browser PDF iframe and page-bound manual text excerpt. It **does not validate PDF text extraction, source/translation parallel reading, linked scrolling or annotations**. Those belong to F02b–d with separate real-file fixtures and coverage. Never report these as delivered by this branch.
