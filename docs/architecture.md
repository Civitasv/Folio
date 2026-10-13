# Architecture

Folio is a local-first reading environment, not a cloud service.

React UI -> typed platform interface -> Browser adapter (preview) or Tauri commands -> Rust core -> SQLite and local files.

Browser preview may use browser storage; desktop uses native storage. No browser UI imports Tauri APIs directly. PDF.js owns rendering and text selection; document blocks retain stable IDs, page coordinates and reading order. Translation is keyed by block ID and cached locally. AI providers are opt-in (OpenAI-compatible and local inference planned).

The initial Rust crate is a native foundation; document parsing, durable storage, and LLM integrations are future specs. Never claim those capabilities exist before implementation.
