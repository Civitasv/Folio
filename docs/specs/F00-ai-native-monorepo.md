# F00 — AI Native Foundation & Monorepo

Status: proposed for implementation in this PR.

## Problem
Establish a repeatable, testable starting point for a local-first cross-platform reader without building a cloud backend.

## Scope
- pnpm workspace, shared domain and UI packages, browser preview.
- Tauri 2 desktop shell and Rust workspace foundation.
- Platform adapter contract with browser implementation.
- AGENTS.md change loop, spec template, PR template and CI.
- A minimal library landing screen with no fabricated product functionality.

## Non-goals
PDF import, document parsing, SQLite persistence, translation, model calls, authentication, cloud sync, mobile packaging.

## Acceptance
1. pnpm install --frozen-lockfile succeeds with committed lockfile.
2. pnpm check runs type checks, tests and production web build.
3. Browser app renders a library landing screen via shared UI and adapter.
4. Desktop shell points to the same browser UI and has a valid Tauri configuration.
5. cargo check --workspace and cargo test --workspace pass.
6. CI exercises JS and Rust on pull requests.
7. No mandatory network service at runtime, account or telemetry.

## Risks and review
Platform adapter semantics may diverge between browser and desktop; review contract boundaries before F01. Desktop bundle validation requires OS-specific runners in a later feature. PR must report actual test evidence and deferred items.

## Testing amendment
F00 adds Vitest + V8 coverage and Testing Library. Enforce 100% statements/branches/functions/lines for owned shared TypeScript modules. Rust tests run in CI; native coverage reporting and full desktop smoke testing remain explicit follow-up gates. Coverage is a measured scope, not a claim of 100% of all application behavior. GitHub auto-merge is permitted only after required checks, review and draft conversion.
