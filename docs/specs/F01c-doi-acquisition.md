# F01c — DOI lookup and lawful acquisition

Status: in implementation, Draft PR #5. Parent: F01 universal reading, follows merged PRs #3 and #4.

## Acceptance
- Normalize/validate bare DOI, doi: and doi.org URLs; no URL is interpreted as a DOI except the two canonical resolver hosts. Keep DOI a reference identifier, distinct from PDF and EPUB.
- User action alone triggers remote Crossref lookup, then DataCite fallback, and best-effort OpenAlex OA discovery; fixed resolver origins, omitted credentials, redirect:error and AbortSignal. Verify returned DOI matches. UI reports provider, metadata provenance, error/retry/cancel and that lookup transmits the DOI to external services.
- DOI metadata contains available title, creators, venue, publisher, date, language, source and canonical landing URL. Missing fields are not fabricated. OA discovery only displays HTTPS public-looking links for an exact DOI with source-marked OA flags; no unqualified publisher link is called OA.
- Save metadata-only reference locally by canonical DOI identity; duplicate handling; searchable title/creator/DOI; offline reopening; delete with confirmation; allow saving a clearly marked **Unresolved** DOI after network failure.
- Show source/publisher link separately from OA landing and OA PDF; explicit opt-in OA PDF import where browser CORS/redirect policy allows, stream with 100 MiB cap, content type + PDF signature validation, then pass through existing managed PDF import. Never fetch paywalled links or arbitrary DOI redirects. If CORS blocks, offer the source link for manual download/import.
- A linked reference and downloaded PDF are independent library rows; deleting a PDF does not silently destroy the reference. Existing PDF/EPUB persisted data stays readable; IndexedDB schema version remains 1.
- Tests cover DOI normalization, Crossref, DataCite fallback, OpenAlex exact DOI & OA constraints, abort/failure, metadata-only/offline/dedup/deletion, streaming PDF import and failure, React actions. Owned TS coverage stays 100% across all four metrics. CI typecheck, Vitest and production build, Rust check/test.
- No Folio account, server or telemetry. No implicit network request on startup or when reopening local references. Do not claim every DOI provides a full text; do not bypass paywalls.
- Distinct future work: native SQLite/managed files, sophisticated OA license evaluation, PDF.js and F01d translation/provider slices.

## Safety and limitations
Metadata may be incomplete/stale; display source and OA provenance. HTTPS URL shape checks cannot prove remote host identity or content rights. The browser's redirect:error, CORS, omitted credentials and user intent guard best-effort download; browser CORS may make importing inaccessible. Offer open-source/manual import. DOI metadata is untrusted display data, never executable instructions or automatic agent input. Abort/timeout and explicit errors; do not cache network failure as verified metadata. No background refresh.

## Evidence and rollback
Record actual CI and independent review/manual browser evidence in PR before ready/merge. Browser offline, actual DOI from both registries, DOI with no OA, OA CORS and quota require smoke. Rollback: revert PR, no destructive migration of existing document rows; inert local reference rows can remain.
