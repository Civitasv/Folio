# D01b — Library workspace implementation

Parent: D01 / D01a. Scope: mount tested shared shell in real library with All/PDF/EPUB/DOI derived filters, preserve title/author/DOI query, show selected item metadata context or DOI acquisition with original verified/unverified/OA flows. Import, reader and translation stay functional. Responsive list at 390–1440; no fake Collections, tags or full-text search. The original PDF iframe is a preview, not PDF.js extraction.

Verification: existing and new UI tests, pnpm check with all four TS metrics 100%, Rust check/test, viewport/keyboard review manually before declaring visual QA complete. Risk: relocating DOI panel alters tab flow and scroll; regression tests cover selection, DOI state, imports, reading anchor/metadata. No migration; revert PR to restore original layout.
