# D01 — Folio Workspace & Apple Design Foundation

Status: **proposed / spec only** (no Skill copied or UI code changed by this PR)  
Priority: before F01g feature implementation  
Base: `master` at `f9f5eb6656ba31e08b726ab55d91514838362328`  
Product: **Folio — A quieter way to read.**

## 1. Product intent

**A modern, calm reading workspace with the organizational seriousness of a research tool.**

Borrow *qualities*, not another product's visuals or code:
- **Notion:** approachable workspace, whitespace, discoverability, quiet typography, contextual actions, uncluttered navigation and fast re-entry.
- **Zotero:** trustworthy scholarly metadata, format/source distinction, a purposeful library/reader/inspector architecture, dense information *on demand*, clear provenance. Future organizational power must be properly modelled, not implied through nonfunctional buttons.
- **Apple:** platform-familiar hierarchy, predictable placement, immediate feedback, continuous and interruptible motion only when useful, careful type and restrained material/depth, accessibility and responsiveness.

Hierarchy of attention: **Document content > current task > contextual metadata/tools > global configuration.** Minimalism must not hide capability. Favor desktop- and keyboard-first web/Tauri, with adaptive narrow-window behavior and no Folio cloud requirement.

## 2. Evidence / current implementation audit

Verified on current `master`:
- `apps/web/src/main.tsx` stacks API settings, CLI settings, backend selector and the reader/library as full-page siblings; provider configuration competes with reading.
- `apps/web/src/app.tsx` is a narrow, single-column, inline-styled 960px page with a large wordmark, import controls, DOI panel, list and reader in document flow. Library search matches **title, creator and DOI only**; PDF is a browser `iframe`, not yet the promised PDF.js/native selection experience.
- `apps/web/src/epub-reader.tsx` retains sanitized sandboxed chapter HTML, saved chapter/TOC, font size and theme. Current translation units are chapter/ordinal aligned; not exact inline CFI.
- `apps/web/src/translation-panel.tsx` already handles languages, original/bilingual/translation modes, manual local draft, provider opt-in and cache. The large form is currently adjacent to, rather than elegantly integrated with, reading.
- `apps/web/src/doi-panel.tsx` already exposes metadata-only fallback and lawful OA discovery, with source/provenance. Do not collapse a DOI reference into an implied downloaded paper.
- `packages/ui/src/index.tsx` is minimal placeholder markup, not a design system. There are no shared application layout or component tokens.
- F01a–F01f domain and platform behavior must remain intact. F01e/F01f real-service/OS smoke and release restrictions remain tracked in [#9](https://github.com/Civitasv/Folio/issues/9).

Do not describe this as an already shipped three-pane Zotero-equivalent or an interactive PDF text-selection reader.

## 3. Skill integration (D01a prerequisite)

Upstream: [emilkowalski/skills](https://github.com/emilkowalski/skills), MIT, copyright 2026 Emil Kowalski. **Pin upstream commit `2d228630ba1446365f614a108cb8252f1feda202`**, not a mutable `main` or an unattended `npx ...@latest` install.

Mandatory primary source: [`skills/apple-design/SKILL.md`](https://github.com/emilkowalski/skills/blob/2d228630ba1446365f614a108cb8252f1feda202/skills/apple-design/SKILL.md). Supplementary review sources from the *same pinned revision*: `skills/emil-design-eng/SKILL.md` (taste, motion decision framework) and `skills/break-ui/SKILL.md` (realistic edge cases). No need to import the entire collection or adopt unrelated/mobile-specific recipes.

D01a implementation:
1. Vendor a reviewed copy of the **primary** upstream Skill at `.agents/skills/apple-design/SKILL.md`; preserve the source header, MIT license/copyright notice and attribution in `.agents/skills/THIRD_PARTY.md`. Verify the destination is recognized by supported agent tooling; `AGENTS.md` must also explicitly require reading its pinned path before UI implementation/review, so it remains discoverable when automatic skill discovery differs.
2. Record upstream repository, path, exact commit, original blob hash, license, local modifications (if any) and update procedure in `docs/design/skill-sources.md`. Audit every future update as a normal reviewed PR; never execute external installation scripts in CI, and do not silently alter an agent's global skills.
3. Optionally vendor supplementary *review* skills only after scope/license review; a URL citation in the Spec is sufficient initially. They do not override Folio privacy, architecture, product requirements or accessibility.
4. Derive a concise **Folio-specific** `docs/design/principles.md` and tokens from the source, rather than pasting 22 KB of generic advice into `AGENTS.md`. Apply design principles only to relevant surfaces: a normal list item needs immediate state, **not** an elaborate spring.
5. For each D01 implementation PR include a small before/after review table, responsive screenshots and named Skill principles actually applied. Copyright/reference acknowledgment is separate from claiming Apple endorsement.

Working translation of upstream guidance: immediate press feedback, consistent spatial origins and symmetric exits, interruptible user-manipulated panels, critical/overdamped motion by default, small spring overshoot only after a physical flick; text legibility and reduced-motion/reduced-transparency/high-contrast alternatives. **Avoid gratuitous Liquid Glass**.

## 4. Scope: one workspace, three contexts

Desktop information architecture (a *layout*, not three always-on feature panels):

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Folio  [Library / document breadcrumb]   Search   Import   Settings     │
├───────────────────┬────────────────────────────────┬────────────────────┤
│ Library navigation│ PRIMARY WORKSPACE              │ CONTEXT INSPECTOR  │
│                   │                                │ (hide/resizable)  │
│ All items         │ Library: searchable list       │ Selection summary │
│ PDF / EPUB / DOI   │ - title, authors, kind, state   │ Metadata / DOI    │
│                   │ - active/selected row           │ Reading / Sources │
│                   │                                │ Translation       │
│ [Only real saved  │ Reader: PDF or EPUB canvas      │ Relevant actions  │
│ collections once  │ - title / reader toolbar        │                  │
│ implemented]      │ - uncluttered reading content   │                  │
├───────────────────┴────────────────────────────────┴────────────────────┤
│ Local-only / contextual progress & errors; do not make a permanent      │
│ noisy status bar.                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Navigation**: All library, PDF, EPUB, DOI Reference as derived filters from existing `kind`, plus search. No fake Favorites, folders, Tags, smart collections, full-text search, citation engine or sync menu until independently implemented.
- **Library content**: text-first, Zotero-like sortable *when supported* rows, not decorative card grid by default. Show title, creators when present, distinct status `PDF / EPUB / Metadata only`, DOI where known, actual stored progress, local-only provenance. Dense/comfortable row setting is optional **UI-only** preference. Long multilingual metadata wraps/clamps accessibly with complete title on focus/detail.
- **Reader**: reading surface dominates width. Separate navigation and reading chrome from paper content; preserve existing PDF browser preview disclaimer, EPUB sandbox/TOC/anchors, locally saved progress and translation cache. Header focuses on Back to Library, title, chapter/page, TOC, display and contextual translation. Avoid persistent double headings/duplicated close buttons.
- **Inspector**: selected item metadata, DOI/source/OA status or reading controls, with a dedicated Translation tab; no exposing controls irrelevant to selected kind. API/CLI configuration belongs in an explicit Settings dialog/screen, not permanently above a document. Provider *choice/status* may be surfaced contextually, never secret inputs in reader chrome. Display label `Manual draft` vs `Provider translation`, and distinguish local CLI launcher from potentially remote inference.
- **Import**: one prominent `Import` action with Local File and Resolve DOI choices; existing drop target remains discoverable. DOI preview, failure, unverified metadata-only and lawful OA import states must remain explicit. Do not launch network requests merely by opening UI.

### Core journeys for the design review

1. First launch -> a quiet empty library with obvious Local PDF/EPUB and DOI actions -> imported document shown -> open and return without losing reading position.
2. Researcher pastes DOI -> previews metadata/provenance -> chooses metadata-only or available OA PDF -> saved reference remains *different* from a full-text document.
3. Reader switches EPUB chapter, theme and text size -> opens an aligned unit in Inspector -> changes target language -> sees original/translation modes -> manual/offline cache remains available.
4. PDF reader can enter a **manual page-bound excerpt** for translation; the interface must not imply automatic PDF text selection/OCR.
5. API and Codex configuration -> explicit connect/test/clear or inspect/login status -> choose active provider -> consent prompt shows bounded displayed excerpt and relevant remote disclosure; errors/cancellation and offline behavior remain visible.

## 5. Visual system proposal

Folio visual theme: **quiet, editorial, modern utility**. Warmth through calibrated neutral surfaces and meaningful whitespace, *not* a beige imitation of Notion and not a dense gray replica of Zotero.

| Token family | Initial direction (tune against screenshots/contrast checks) |
| --- | --- |
| Type | system UI stack (`system-ui` / macOS SF); reading content an optional local system serif, preserving original EPUB readability; no redistributed third-party font files |
| Type scale | 12/13 muted metadata; 14/15 main controls; 16 body; 20/24 section titles; 28–32 for empty/onboarding display only; weight and leading establish hierarchy |
| Spacing | 4px base; 8/12/16/24/32; reading prose max measure ~65–75ch; inspector content uses compact but legible spacing |
| Surfaces | system-aware neutral light/dark backgrounds; canvas distinct from sidebars; one restrained accent for active/primary actions; semantic success/warning/error colors |
| Shape/depth | modest radii (6/10/14), soft separation and shadows; use hairlines where meaningful, avoid card-within-card / glass-on-glass |
| Material | optional single translucent *floating* toolbar/overlay when it improves spatial layering; solid fallback; no blur behind long reading text |
| Controls | consistent hover, focus-visible, disabled, pressed, pending and failure states; icon+label for non-obvious actions; no icon-only destructive controls without name/confirmation |
| Motion | pointer-down response; frequent library/keyboard actions instant; context panel or popover from its origin, dismiss symmetrically; avoid `transition: all`; use `transform` / `opacity` only where appropriate |

Create tokenized `packages/ui` primitives and CSS variables or typed theme constants; never introduce a second arbitrary styling system per panel. Names: background/surface/raised, text/secondary/tertiary, accent, border/subtle, shadow, radius, spacing, type, motion and focus. Support native OS light/dark, manual preference if stored, and legible EPUB light/sepia/dark independently of app chrome.

## 6. Responsive and interaction contract

- Default desktop at 1440 and 1280px: 220–260px collapsible left sidebar, flexible primary pane and optional 280–340px inspector. **Reader width wins**; never shrink the document merely to preserve an inspector.
- Around 1024px: collapse inspector into an on-demand right sheet; preserve active document and focus. Around 768px: collapse sidebar into overlay. At 390px browser preview: one-pane navigation; import/search/reader remain usable; no horizontal clipping. Exact breakpoints to be adjusted by actual content and zoom, not device sniffing.
- Keyboard and semantics: `Cmd/Ctrl+K` may focus current title/creator/DOI library search (do **not** imply global command indexing); `Esc` closes the topmost non-destructive overlay; `Cmd/Ctrl+\\` toggles navigation only if focus safety and platform conflicts pass QA; preserve native keyboard text editing, explicit button labels and logical tab order. Shortcut list visible in settings/help. Don't hijack PDF iframe native shortcuts.
- Inspector opening/closing must maintain reader anchor and preserve unsaved manual translation drafts (warn on destructive context changes rather than silently discarding). New view selection cannot trigger provider requests.
- Resizable panels: if implemented, pointer tracks 1:1 and stops at usable min/max; keyboard-operable separator and persisted **local UI preference**; use no spring on every pointermove.
- Clear loading, empty, offline, cache hit, duplicate import, permission/credential unavailable, no-full-text, error/retry and cancellable work; predictable and recoverable. Do not introduce silent background network or blur privacy notices.

## 7. Accessibility, privacy and portability gates

- Target **WCAG 2.2 AA**: >=4.5:1 normal text and >=3:1 large text/essential UI indicators, distinguish selected/disabled/error by more than color, visible focus and status announcements, keyboard-operated selection/dialog/tab/resize, restore focus when a sheet closes.
- Test 200% browser zoom, long DOI/title, missing author, Latin/CJK/RTL mixed text, very long document lists, zero search hits and narrow WebView. Reflow without clipped destructive actions.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, `prefers-contrast`, and forced colors where supported. Keep feedback via non-moving alternatives, no flashing/looping ornamental animation.
- EPUB sandbox and sanitized HTML, PDF object-URL revoke, DOI provenance, API/CLI credential storage and bounded excerpt consent **must not regress**. No metadata or document uploads just to populate decoration, no telemetry or mandatory account.
- Browser preview and Tauri share UI without importing Tauri in presentation components. CLI appears unavailable in browser, not simulated as working. Native/macOS conventions should inform the shared layout, but do not claim this is a SwiftUI native build.

## 8. Architecture and delivery slices

This is a **design-system + existing-journey UX refactor**, not a hidden implementation of all Zotero features.

- **D01a — skill and foundation:** pin/vendor Apple Design Skill with MIT provenance, AGENTS.md reference, Folio design principles, tokens, reusable primitives (app shell, sidebar, toolbar, button, field, row, tabs, sheet, notification), baseline screenshots/interaction inventory. No external scripted skill install in CI.
- **D01b — Library Workspace:** replace the single column with adaptive shell, present existing derived format filters and title/creator/DOI search, selection + metadata Inspector, consolidated local/DOI import states, clear metadata-only identity. Preserve exact existing platform methods and storage IDs.
- **D01c — Reader Workspace:** PDF preview and EPUB rendering in primary canvas, TOC and settings chrome, contextual bilingual/manual translation in inspector. Preserve anchors, cached entries, explicit provider disclosure, error/abort behavior and fixed PDF limitations.
- **D01d — Providers and polish:** move API/Codex key/model/status to Settings; compact contextual active-provider control, disclosure and history of errors; accessibility, keyboard, responsive views, meaningful motion only and cross-browser/desktop QA.

Each slice gets a separate reviewable implementation PR/spec addendum; run a **before/after design review** using `apple-design`, optionally `emil-design-eng` and `break-ui`. Do not run D01g (not a feature) or start F01g until the D01 UI foundation has been accepted. A fresh screenshot/interactive walkthrough is part of UI acceptance, not proof inferred from TypeScript tests.

Future separate functional specs (NOT shipped or shown as functional in D01):
- Zotero-like nonduplicating multi-collection membership, nested collections, tags, saved searches, citation export and item relationships.
- Rich annotations/notes, highlight persistence, PDF.js text selection/geometry, true full-text indexing, advanced bibliographic editing and batch import.
- Notion-like notebook/block editor, backlinks, dashboards, cloud collaboration/sync. Folio is **not** committing to feature-for-feature Notion duplication.

## 9. Acceptance matrix

| Criterion | Required evidence |
| --- | --- |
| Skill source traceability | pinned source, MIT notice, local path, source diff/update steps and AGENTS.md review instruction |
| Visual coherence | screenshots and walkthrough of empty/filled library, DOI-only detail, PDF, EPUB, bilingual, settings, both themes; review against token definitions |
| Useful IA | first-launch import and search, doc open/back, DOI preview/save/OA path, reader navigation and provider setup can all be completed without a long scroll through unrelated settings |
| Fidelity to shipped features | every visible action works; no false full-text search, collection management, automatic PDF extraction, live CLI in browser or unsupported download |
| Accessibility | automated axe-equivalent checks + keyboard/screen-reader manual review, focus return, zoom, reduced motion/transparency, contrast measurements |
| Responsiveness | screenshot/functional matrix at 1440, 1280, 1024, 768, 390px plus 200% zoom; no clipped content/controls or unusably narrow reader |
| Preservation | same imported PDF/EPUB/DOI files, document IDs, reading progress, themes, chapter anchors, translation cache and consent/credential boundaries before/after |
| Reliability | zero/large/long/CJK/RTL data, offline cache, unsupported browser CLI, cancelled DOI/provider operations and errors |
| CI and review | `pnpm check` (typecheck, tests, 100% statements/branches/functions/lines on owned changed TS, build), `cargo check --workspace`, `cargo test --workspace`; UI screenshots, security regression and independent review recorded separately |

Visual QA tooling proposal: add an automated browser screenshot/accessibility pass (e.g. Playwright with frozen local fixtures, fixed viewport/color-scheme/reduced-motion and stable fonts) in implementation slices, not to this docs-only PR. Screenshot baselines should be human-reviewed rather than automatically blessed. Maintain a documented test matrix; do not claim native OS smoke until actually run.

## 10. Risks, rollback, decisions

- Risk: optimizing for sparse appearance hides scholarly metadata -> contextual Inspector with explicit discovery and selection state, retain keyboard access.
- Risk: CSS overhaul changes nested iframe sizing/scroll and translation focus -> preserve renderers and anchor contracts, verify reading and cache end-to-end.
- Risk: vendor skill drift and license omissions -> pin SHA and preserve notice; updates require code review and recorded diff.
- Risk: attractive "Zotero" mockups imply unimplemented features -> render only working controls; advanced organization requires future domain/adapter spec.
- Risk: overusing blur/springs harms comfort and performance -> favor solid legible surfaces, test reduced preferences and motion at real interaction frequency.
- Risk: responsive state/panel resizing corrupts documents or provider secrets -> store only layout choices in local UI state, never reuse document/cache or keyring structures for layout.
- Rollback: revert individual D01 UI PRs without migrations; the F01a–F01f local library/provider implementation remains source of truth. A docs-only Spec PR needs no runtime rollback.

**Open implementation decision:** exact screenshot reference treatment and token values to be tuned during D01a interactive design exploration; this Spec fixes the architecture, feature honesty, privacy, accessibility and acceptance criteria, not a premature pixel-perfect rendering. Upstream sources: Apple [HIG](https://developer.apple.com/design/human-interface-guidelines), [Notion sidebar](https://www.notion.com/help/navigate-with-the-sidebar), Zotero [Collections and Tags](https://www.zotero.org/support/collections_and_tags/) / [Quick Start](https://www.zotero.org/support/quick_start_guide).
