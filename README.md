# THE SEEING EYE

Real-time interview HUD with invisible overlay, live transcription, and AI-powered answers.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  System Audio (via BlackHole)                    │
│  Captures interviewer's voice                    │
└──────────────────┬──────────────────────────────┘
                   │ Audio stream
                   ▼
┌─────────────────────────────────────────────────┐
│  Server (Node.js + Socket.IO)                    │
│  ├── Transcriber  → Deepgram Nova-2 streaming    │
│  ├── LLM Engine   → Groq (Llama 3.3 70B)        │
│  └── VAD          → Silence detection            │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket (streaming tokens)
                   ▼
┌─────────────────────────────────────────────────┐
│  Electron HUD Overlay                            │
│  ├── setContentProtection(true)                  │
│  ├── Always-on-top, frameless, transparent bg    │
│  ├── Live transcript (words as they're spoken)   │
│  └── Answer card (streams in on question end)    │
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure API keys
cp .env.example .env
# Edit .env with your Deepgram + Groq keys

# 3. Install BlackHole (virtual audio driver)
brew install blackhole-2ch

# 4. Set up Multi-Output Device in Audio MIDI Setup
# (see docs/audio-setup.md)

# 5. Launch
npm run dev
```

## Hotkeys

| Key | Action |
|---|---|
| `⌘ Shift H` | Toggle HUD visibility |
| `⌘ Shift L` | Toggle listening on/off |
| `⌘ Shift C` | Clear transcript & answers |

## API Keys

| Service | Free Tier | Sign Up |
|---|---|---|
| Deepgram | $200 credit | [console.deepgram.com](https://console.deepgram.com) |
| Groq | Free tier | [console.groq.com](https://console.groq.com) |
| Gemini | Free tier (fallback) | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

## Project Structure

```
THE SEEING EYE/
├── electron/           # Electron main process
│   ├── main.js         # App entry, window creation
│   ├── preload.js      # Secure IPC bridge
│   └── window.js       # Overlay window management
├── server/             # Backend services
│   ├── index.js        # Express + Socket.IO server
│   ├── transcriber.js  # Deepgram streaming STT
│   ├── llm.js          # LLM provider (Groq/Gemini)
│   └── vad.js          # Voice activity detection
├── renderer/           # HUD frontend
│   ├── index.html      # HUD markup
│   ├── style.css       # Dark, glanceable styling
│   └── app.js          # Frontend logic
├── config/             # Configuration
│   └── defaults.js     # Default settings
├── scripts/            # Utilities
│   ├── setup.js        # First-time setup
│   └── start.js        # Dev launcher
└── docs/               # Documentation
    └── audio-setup.md  # BlackHole config guide
```
