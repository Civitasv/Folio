# D01d — Settings and final UX polish

Status: implementation. Parent: D01 / D01c. Branch: `feat/d01d-settings-and-polish`.

## User problem and scope
The existing API/Codex controls occupy the top of the reading page, making low-frequency provider setup compete with daily library use. Mount a true Workspace entry and put existing tested provider components in a Settings dialog accessible from the reading toolbar. Keep browser key memory semantics, native keyring/CLI boundaries, explicit health-test and excerpt consent unchanged. Retain provider settings mounted but visually hidden between dialog openings to preserve session-only entered keys and provider selection. Modal applies inert to reading while active, opens with close-button focus, handles Escape, and returns focus on close.

## Acceptance
- No giant provider form above the library on startup. Settings trigger in App toolbar opens a labelled aria-modal dialog; close and Escape work, background inert, focus restored.
- API, Codex and manual selection remain explicit; clearing the currently active provider falls back to manual. Browser CLI still clearly unavailable rather than fake auth; no request on toggling settings.
- Light/dark/reduced motion/transparency responsive settings at narrow and desktop sizes. Validation, status, cancellation and errors remain visible. No copied Notion/Zotero UX/IP.
- Automated tests cover modal focus/Escape and API/CLI/manual state transitions and App integration, 100% four owned TS metrics; `pnpm check`, `cargo check --workspace`, `cargo test --workspace`. Actual visual/keyboard/screen-reader screenshots at 390/768/1024/1280/1440 and 200% zoom are release QA, not falsely reported as automated proof.

## Risks / rollback
Hidden but mounted provider forms should not cause network calls or expose secrets; existing native keyring check is local only. Cross-platform keyring and real installed Codex release checks continue in #9. No schema changes, no new dependencies or background network. Revert D01d UI PR to restore previous entrypoint; no data migrations.
