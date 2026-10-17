# Folio Design Foundation

The pinned upstream Apple Design Skill is credited in `skill-sources.md`; this is Folio-specific product guidance, not Apple endorsement.

- Reading content takes priority over the current action, contextual metadata and global configuration.
- Notion-inspired clarity and whitespace with Zotero-inspired scholarly metadata where needed: simplicity is not feature concealment. Show only real working actions; future Collections, tags, citations, PDF text selection and full-text index need separate implementation.
- Apple interaction principles: immediate press/focus feedback; consistent spatial origin and symmetrical dismissal; interruptible **user-manipulated** transitions; no decorative bouncing/floating. Frequent keyboard navigation stays instant.
- System typography with clear type scale, appropriately readable book prose, long/multilingual/RTL labels, and 200% zoom. No remote/downloaded font dependency.
- Solid, readable reading canvas; restrained radii and shadow; translucent surfaces only for useful floating overlays, never layers of glass over text.
- Accessibility goal WCAG 2.2 AA, keyboard-operated actions, focus-visible, readable contrast; respect reduced-motion, reduced-transparency and increased-contrast preferences.
- Local-first and feature truth: DOI metadata-only ≠ full text, PDF iframe ≠ automatic PDF text selection; explicit remote AI consent, OS credential and CLI/browser distinctions remain intact.

| Before | After | Why |
| --- | --- | --- |
| Unrelated inline page styles | Shared namespaced design token/primitive system | Consistent visual hierarchy and focus |
| Provider settings precede reading | D01d puts settings in an explicit contextual screen | Keep reading primary |
| Library and reader share one long column | D01b/c workspace + contextual inspector | Show deep reference detail without crowding content |

D01a establishes tokens and primitives, not a claim of visual QA. D01b–d must test full narrow/desktop screenshots and keyboard flows.
