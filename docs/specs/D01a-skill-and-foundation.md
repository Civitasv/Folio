# D01a — Skill integration and shared UI foundation

Status: implementation. Parent: `docs/specs/D01-apple-design-workspace.md` (accepted PR #10). Depends on merged F01a–F01f.

## Scope
Copy upstream Apple Design Skill byte-for-byte at pinned commit, preserve MIT license/provenance and add discovery in AGENTS.md. Distill Folio-specific design principles. Introduce a single CSS light/dark/reduced-* token foundation and tested presentation-only React workspace primitives. Import the CSS at the browser entry. No model/reader/provider/storage migration. D01b will actually mount the multi-pane workspace.

## Non-goals
Notion/Zotero duplication, fake collections or tags, third-party font or icon bundles, cloud features, moving API/Codex forms in this slice, running mutable npx installer in CI.

## Acceptance
Exact upstream file and license plus update policy; semantic accessible primitive regions and active/inactive navigation controls; keyboard button semantics; restrained scoped CSS with visible focus and OS theme/motion/transparency/contrast fallbacks. No regression in existing imports, documents, DOI, EPUB, translation/provider behavior. New executable module under 100% statements/branches/functions/lines. CI `pnpm check`, `cargo check --workspace`, `cargo test --workspace`. Real screenshot + screen reader/keyboard inspection deferred until workspace is mounted in D01b/c and must be recorded, not inferred from unit tests.

## Risk/rollback
CSS applied globally only to root box-sizing/body via system tokens; component styling uses `folio-` prefixes. No schema changes, remote side effects or credentials touched. Revert this PR independently. Independent design review and actual screenshot verification follow.
