# THE SEEING EYE — AI Directives

## Project Identity
Real-time interview HUD. Captures audio, transcribes live, generates answers, displays in an invisible Electron overlay.

## Architecture Rules
- **Speed is everything.** Every design decision optimizes for minimum latency.
- **Streaming everywhere.** STT streams partial transcripts. LLM streams tokens. UI renders incrementally.
- **No frameworks in renderer.** Plain HTML/CSS/JS. No React, no Vue. The HUD is a single page, not a web app.
- **Electron for stealth.** `setContentProtection(true)` is non-negotiable. The overlay must be invisible to screen capture.

## Tech Stack
- **Electron** — Desktop app with OS-level content protection
- **Deepgram Nova-2** — Streaming STT via WebSocket (~300ms latency)
- **Groq** — LLM inference (Llama 3.3 70B, ~200ms first token)
- **Socket.IO** — Real-time comms between server and renderer
- **Express** — Lightweight HTTP server for config endpoints

## Code Style
- ES modules (`import/export`)
- Async/await over callbacks
- Descriptive variable names
- Comments on non-obvious logic only
- Error handling on every external call (API, audio, socket)

## File Locations
- Electron process code → `electron/`
- Backend services → `server/`
- HUD frontend → `renderer/`
- Configuration → `config/`
- Scripts/utilities → `scripts/`
