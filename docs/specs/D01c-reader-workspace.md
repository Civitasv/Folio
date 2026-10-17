# D01c — Reader-first workspace and contextual translation

Status: implementation. Parent D01 / D01b. Feature branch feat/d01c-reader-workspace.

## User problem and scope
The library currently appears before the reader and translation controls compete with document reading. Elevate the selected PDF/EPUB content in the primary canvas and place current PDF page-bound/manual and EPUB chapter-unit translation in the contextual Inspector. The EPUB reader can portal its existing TranslationPanel into a supplied UI container; standalone isolated reader preserves an inline fallback. DOI metadata-only remains distinct; no PDF.js/OCR or publisher-resource loading is implied.

## Acceptance
PDF iframe, object URL revoke and saved page remain unchanged. EPUB sanitized sandbox iframe, local preferences, TOC/CFI chapter movement and translation cache identity survive portal relocation; language/remote provider consent remains user-triggered. No new network call from UI mounting. Reading canvas precedes library list when active but library/delete and import remain accessible. Responsive and reduced-motion inherit D01a. Automated regression covers PDF inspector and EPUB portal plus existing fallback. Commands: pnpm check (100% owned TS metrics), cargo check/test --workspace. Real 390/768/1024/1280/1440, 200% zoom and keyboard/assistive/manual provider QA remain separate from automated coverage.

## Risk and rollback
Portal host can remount translation when first available; no persisted draft must silently disappear after unrelated shell resize. Page/chapter identity and cache remain platform-owned. Revert presentation PR to remove portal without storage migration. Full live macOS/Windows/Linux and external providers stay tracked in #9.
