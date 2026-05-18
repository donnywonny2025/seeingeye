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
│  ├── LLM Engine   → Gemini 3 Flash / Groq      │
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
| Gemini | Primary | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Deepgram | $200 credit | [console.deepgram.com](https://console.deepgram.com) |
| Groq | Free tier (fallback) | [console.groq.com](https://console.groq.com) |

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

## Prompt Engineering & Streaming Issues (Developer Notes)

During development, significant issues were encountered when trying to force the LLMs (specifically Gemini 2.5 Flash) to format their answers for a live teleprompter HUD.

### The Core Conflict
The user requires high-quality, detailed, flowing answers. Because the answers are read live on camera, the text must stream into the UI as **one continuous paragraph** without sudden line breaks (`\n`) that cause the DOM to shift and break the user's eye contact/focus.

### The Failures
1. **The "Brevity Limit" Failure:** We attempted to stop formatting bugs by limiting the output to "1-2 sentences" or "Max 50 words". While this successfully prevented the AI from generating lists, it completely ruined the quality of the answers, resulting in vague platitudes.
2. **The "Negative Constraint" Failure:** We attempted to use negative constraints in the `SYSTEM_PROMPT` (e.g., "NEVER use bolding", "NEVER use bullet points"). Because LLMs are probabilistic, when asked a structural question (e.g., "What are the 5 components of X?"), the model's base training overrides the negative constraint. It feels compelled to write a 5-point list with bold headers, completely ignoring the "no markdown" rule.

### The Ultimate Fix (Code-Level Sanitization)
We abandoned trying to use prompt engineering to control the strict mechanical formatting of the text. 
1. **Prompt Restoration:** The `SYSTEM_PROMPT` in `server/llm.js` was restored to encourage full, detailed, conversational answers.
2. **Stream Sanitization:** The true fix was implemented in the code layer. As tokens stream back from Gemini/Groq in `server/llm.js`, they are intercepted and hard-sanitized using a regex:
   ```javascript
   token = token.replace(/[\n*#_-]/g, ' ');
   ```
This allows the LLM to "think" in whatever complex lists or bolding it wants in its brain, ensuring high-quality answers. However, by the time the stream hits the Electron renderer, it is a single, unbroken block of plain text. The CSS (`white-space: pre-wrap; word-break: break-word;`) naturally wraps the text horizontally, keeping the HUD completely stable for the user.
