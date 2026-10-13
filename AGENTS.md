# Folio agent contract

Folio is local-first. Never introduce mandatory accounts, cloud storage, telemetry, or upload document content without explicit product approval.

## Change loop
1. Read README, docs/architecture.md, and the active spec before edits.
2. Define scope, acceptance criteria, risks, and a verification plan in docs/specs/Fxx-*.md.
3. Implement the smallest vertical slice on a feature branch. Keep UI independent of Tauri through a platform adapter.
4. Run pnpm check and relevant Rust checks; record commands, outcomes and limitations in the PR.
5. Review against acceptance criteria, privacy boundaries, platform portability, and regression risks. Prefer an independent fresh-context reviewer; disclose when unavailable.
6. Do not claim success without evidence. CI green is necessary, not sufficient. Merge only after required checks and review gates pass; never bypass protections.

## Architecture boundaries
- apps/web: browser entrypoint.
- apps/desktop: Tauri shell.
- packages/core: platform-independent contracts.
- packages/ui: shared presentation.
- packages/platform: environment adapter.
- crates/: native domain and storage, never required to run the browser preview.
- PDF files and reading data stay on device. External LLM calls are opt-in and explicit.

## Delivery
Each feature PR links its spec, describes tests and evidence, includes a risk/rollback note and records deferred issues. No fabricated screenshots or CI status.

## Testing and merge policy
- Every changed executable production module must have automated tests. Target 100% statements, branches, functions and lines for owned TypeScript domain/platform/UI code; no lowering thresholds or blanket coverage exclusions to game the gate.
- Rust core requires unit/integration tests and coverage reporting; native Tauri bootstrap and generated code are reported separately, not falsely represented as covered.
- Include regression tests for bug fixes and meaningful negative cases; coverage does not prove correctness.
- After review and required checks pass, use GitHub auto-merge (squash preferred). Never merge red, draft, or unreviewed PRs. Repository rulesets must require CI checks and prevent bypass.
