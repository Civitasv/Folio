# F01d — language preferences, aligned content units, on-demand translation and local cache

Depends: merged F01a/b/c. Browser-preview vertical slice; no actual API-key/CLI inference until F01e/f.

## Delivery
- Global source language: Auto or valid canonical BCP-47 tag. Target: explicit canonical BCP-47, at least zh-Hans, en, fr, ja, de, es. Language picker offers choices and retains recent targets; no forced English/Chinese pairing. Show an error rather than calling a provider when source equals target.
- EPUB: extract ordered paragraph/headline content units from **already sanitized** chapter HTML, anchored to spine/CFI and unit ordinal; reader shows original-aligned bilingual view, translation-only, or original-only. Do not execute arbitrary book HTML. PDF browser preview cannot access embedded native PDF text: explicitly pasted excerpt, anchored to selected PDF page. Do not claim automatic PDF selection, OCR, geometry or precise EPUB within-paragraph CFI.
- Explicit user action only. Show the exact bounded source text before a provider request, cancellation and retry. Mock provider used in unit/integration tests; no real AI provider shipped in this slice. Manual local translation drafts can be saved without a network connection, clearly labelled not machine-generated.
- Typed provider contract allows capability-supported auto source, per-operation cancellation, provider/model identity, promptVersion, result metadata and error. API/CLI wiring deferred F01e/f. No background translation or entire-book upload.
- Cache identity includes canonical document id/fingerprint, format-specific anchor/unit ordinal, SHA-256 source-text hash, source/target languages, provider ID/model, prompt version. Save source/result and show provider/provenance; changed text/target/provider/prompt cannot reuse stale cache. Reopening offline loads matching entry without contacting a provider.
- Separate origin-local IndexedDB database `folio-translation-preview` v1: settings + cache, no changes to existing `folio-preview` v1 document schema, with deletion of a removed document's entries. Browser clearing site storage removes everything. No API keys stored. Error/blocked/transaction handling is explicit.
- Preserve original text unmodified; translated text displayed only as plain React text, never untrusted HTML. Manual fallback stays local and cannot be mislabeled AI. Future provider disclosure must state which excerpt is transmitted.

## Verification
- Three+ targets tested, source/target validation, explicit request/no-implicit-network, PDF and EPUB distinct anchor mapping, source text hash and model/target/prompt cache invalidation, local storage/reopen/cleanup, cancel/failure/retry, modes and chapter navigation.
- CI: typecheck, all TS coverage four dimensions 100% (new files included), build, Rust check/test; meaningful negative tests.
- Independent reviewer + browser offline, EPUB/PDF real-file and IndexedDB upgrade/quota tests to be recorded before merge. Do not claim E2E merely because jsdom tests pass.

## Risk / rollback
- Manual entry is not verified translation. Auto source is disallowed for provider adapters without detection capability. No live backend is implied. Revert PR leaves old PDF/EPUB/DOI storage untouched; separate translation-preview database can be cleared independently.
