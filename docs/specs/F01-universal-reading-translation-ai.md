# F01 — Universal Reading, Translation & Bring-Your-Own-AI

Status: proposed (requirements/spec only; implementation requires separate vertical slices)
Depends on: F00
Product: Folio — A quieter way to read.

## 1. Problem and goals
Readers bring PDFs, EPUB books and academic references identified by DOI. They need distraction-free reading, source-aligned translations into a language of their choosing, and AI assistance through either their own API credentials or an already authenticated local agent CLI. Folio remains local-first: no mandatory Folio account, backend, sync or telemetry.

Goals:
- Import and manage PDF and EPUB from local files; accept DOI as a resolution/import workflow, not as a document file type.
- Provide a unified document model for library, navigation, reading progress, annotations and translations while preserving format-specific location anchors.
- Support user-selected source and target languages, including auto-detect where supported, with original/translation side-by-side or translation hidden.
- Offer explicit, switchable API-key and local CLI AI backends with consistent capabilities, consent and error reporting.
- Persist documents, settings, reading state and translation cache locally.

## 2. Personas / journeys
A. Drag a local PDF or EPUB into Folio; see title, author (when present), format, import status; reopen offline and resume.
B. Paste a DOI or DOI URL; preview resolved metadata and available lawful full-text options; import an accessible PDF/EPUB if available or save a metadata-only reference with a clear status.
C. Open a document, select source language (Auto / explicit BCP-47 language) and target language, translate a selection, paragraph or visible range; toggle bilingual view; resume with cached translations offline.
D. Choose an OpenAI-compatible API endpoint + model + API key OR an installed/authenticated local agent CLI; run a short connectivity check; select provider for translation and future reading assistance; change provider without losing documents.

## 3. Functional requirements

### FR-IMPORT: library and acquisition
- Import local .pdf and .epub through picker and drag/drop. Validate actual file signature/container, size and parse errors; do not trust extension alone.
- Assign stable document ID and content fingerprint; define duplicate handling (reuse/open existing, or explicit second copy). Copy imported content into app-managed local storage by default, never silently modify the source file.
- Extract best-effort title, authors, language, page count (PDF) or spine/TOC (EPUB), cover/thumbnail where available. Missing metadata remains editable.
- DOI input accepts canonical DOI and https://doi.org/... URLs, normalizes/validates them and resolves metadata over network only after user action. Distinguish DOI metadata from full-text availability. Present publisher/open-access link and permitted downloadable source when available; no paywall bypass or fabricated download.
- DOI resolution failure/offline state must allow retry or saving the reference locally. Display source URL, provenance and acquisition status.
- Local library supports search by title/author/DOI, sort, remove from library and explicit deletion of managed file/cache with confirmation.

### FR-READER: unified reader
- PDF: page-based renderer, text selection, page/coordinate anchors, zoom and navigation.
- EPUB: reflowable renderer, TOC/chapter navigation, font size and theme controls, EPUB CFI or equivalent durable anchors.
- Shared domain: Document {id, kind, metadata, source, fingerprint, readingState}; content units with stable anchors; renderers stay format-specific.
- Restore progress and reading preferences locally. Graceful fallback for scanned/image-only PDF (no invented text; OCR is deferred).
- Never assume PDF pages and EPUB chapters are interchangeable; translation/annotation anchor adapters map each format to a stable unit.

### FR-TRANSLATION: user-configurable languages
- Source: Auto-detect when backend supports it, otherwise explicit language; target: explicit user-selected language (BCP-47 identifier), with searchable language picker and recent choices. No hardcoded English/Chinese pair.
- Reject or explain unsupported combinations; same source/target does not silently consume tokens.
- Translate selection, content unit/paragraph and visible range on demand; no automatic entire-book upload or background translation by default.
- Bilingual presentation aligns original and translated units; allow original-only, translation-only and side-by-side modes where layout permits. Preserve original text unmodified.
- Cache by document fingerprint + anchor + source-text hash + source/target languages + provider/model + prompt version. Invalidate correctly on source or settings change; mark stale results rather than silently mixing them.
- Preserve formulas, citations, code blocks, reference markers and paragraph structure as far as backend permits; never represent model output as verified source text.
- Show pending/error/retry/cancel and cost/privacy disclosure before remote calls; offline cached reading remains available.

### FR-AI: API key and authenticated local agent CLI
- Common provider contract: provider ID, model, capability discovery (translation, chat, structured output if available), health check, request, cancellation, errors and optional usage data. Do not promise feature parity when a provider lacks a capability.
- API mode: user-configurable supported API provider/compatible endpoint, model and key. Store credentials in OS credential store on desktop, never plaintext SQLite, logs, exported settings or UI analytics. Validate endpoint, TLS by default, timeouts, rate limits and helpful auth errors. No default Folio proxy.
- CLI mode: detect supported installed executables, display version and login/auth status when discoverable, and use the CLI's supported noninteractive invocation without reading/reusing its private tokens directly. Initial adapters should be explicitly selected after spike (e.g. Codex CLI and Claude Code CLI candidates); do not assume arbitrary agent CLIs share flags, JSON format, permissions or licensing. No silent installation/login.
- Desktop-only CLI execution via Tauri/Rust command boundary with explicit executable allowlist, fixed argv construction (no shell interpolation), scoped working directory, sanitized environment, bounded output/time, cancellation and user-visible failure. Never give CLI unrestricted filesystem access as a side effect of opening a document.
- Browser preview supports API mode where browser security/CORS permits and presents CLI as unavailable with an explanation; do not fake CLI functionality. Never expose API keys in bundled frontend assets.
- Provider selection may be global with per-task override. Explicit consent before sending document excerpts to an external API or CLI-backed service; distinguish local CLI process from remote inference performed by that CLI. Show what content will be sent.
- No claim that a CLI subscription guarantees programmatic usage: adapter must comply with supported invocation, authentication and provider terms.

### FR-LOCAL: persistence and privacy
- Desktop: SQLite metadata/reading state/cache + managed local document files. Browser preview: browser-safe adapter with limitations disclosed. No account, sync, telemetry or Folio-operated document server.
- Network access only for user-initiated DOI resolution, source download and opted-in AI calls. Explain remote metadata queries and provider data flows.
- Offer export/backup and deletion semantics in later scoped slice; avoid irreversible schema assumptions.

## 4. Architecture / data contracts (proposal)
- packages/core: DocumentKind, DocumentMetadata, DocumentSource, ReaderAnchor discriminated union (PDF page/rect/text offsets; EPUB CFI/spine), ContentUnit, TranslationRequest/Result, ProviderCapabilities, ProviderError.
- packages/platform: import/resolution, local persistence, provider adapters behind typed interfaces.
- packages/ui: library import, DOI entry, reader chrome, language picker, translation view, provider settings/status.
- crates/folio-core: native file validation/import, DOI metadata resolution boundary, persistence, safe CLI process adapter.
- Renderer candidates: PDF.js for PDF; EPUB.js or equivalent for EPUB after license/security review. DOI metadata via Crossref/DataCite and lawful open-access discovery, with rate limiting and attribution.
- Provider calls operate on bounded selected text/content units, not raw whole-library access. Cache remains provider-neutral in presentation and provider-specific in identity.

## 5. Delivery slices / dependencies
- F01a Local library and PDF import, persistence, validation, reading progress.
- F01b EPUB import, reflowable renderer, TOC/CFI, common library metadata.
- F01c DOI resolution, metadata preview, lawful full-text acquisition and metadata-only fallback.
- F01d Language settings, content-unit alignment, on-demand translation, cache and bilingual UX (initially mock provider in tests).
- F01e API-key provider, secure credentials, consent, errors and integration.
- F01f CLI provider spike and first supported adapter, capability detection, sandboxed process invocation, consent and integration.
- F01g End-to-end journeys, migration, offline/privacy/security and desktop packaging checks.
Dependencies: F01a before F01d; F01b and F01c can follow shared import contracts; F01d before live provider integration. Each slice requires its own implementation spec and PR.

## 6. Acceptance criteria
1. Valid PDF and EPUB import, reopen offline, progress restoration and invalid-file rejection demonstrated with fixtures.
2. DOI normalization, metadata lookup, unavailable full text, network failure and retry covered by contract/integration tests; no assumption every DOI yields a PDF.
3. At least three distinct translation target languages verified in tests; source/target choice persists and changes cache identity.
4. Original/translation alignment remains stable across navigation, retry and reopening; no implicit whole-document upload.
5. API mode supports configured credentials and explicit data-flow consent; invalid key, timeout, provider failure and cancellation are handled.
6. CLI mode detects absent/unauthed/unsupported CLI and safely invokes at least one supported authenticated CLI on desktop; browser explains unavailability; never reads CLI auth secrets.
7. Local-only workflows operate offline; DOI and external AI functions degrade explicitly offline.
8. CI requires typecheck, build, Rust checks/tests and 100% statement/branch/function/line coverage for owned TypeScript production modules, with meaningful fixtures and no artificial exclusions. Rust coverage reported with scoped threshold to be specified per slice; native/OS and external-service E2E are separately reported. Coverage does not replace behavior/security testing.
9. Cross-platform behavior documented; Linux/macOS/Windows desktop smoke validation before declaring CLI integration generally available.
10. Each slice includes spec, review evidence, risk/rollback, green CI and merge gate. Never auto-merge draft/red PRs.

## 7. Non-goals / open decisions
Non-goals: cloud sync, social sharing, DRM circumvention, publisher paywall bypass, bulk scholarly scraping, built-in OCR, automatic full-library indexing or translation, mobile app, custom hosted LLM gateway.
Decisions for implementation specs: first CLI adapter(s) based on actual noninteractive API; DOI discovery service/fallback and rate limits; EPUB renderer and content sanitization; max import size; supported API endpoints/models; credential store/browser key handling; translation cost estimates and language catalog; OS sandboxing strategy.

## 8. Threats and review checklist
- EPUB HTML/script/resource sanitization and zip-bomb/path traversal.
- PDF parser vulnerabilities and malicious files.
- DOI SSRF/redirect restrictions; trusted resolver and download origin policy.
- Prompt injection in imported text; treat content as data, never executable instructions to the CLI.
- No shell invocation, secret leakage, unbounded subprocesses or silent network transfer.
- Metadata/source provenance, copyright and licensing; accessibility, keyboard navigation and screen reader behavior.
