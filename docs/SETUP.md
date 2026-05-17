# The Seeing Eye — Setup Guide

## Prerequisites

### 1. API Keys (Already Done ✓)
- **Deepgram** — `DEEPGRAM_API_KEY` set in `.env`
- **Groq** — `GROQ_API_KEY` set in `.env`

### 2. BlackHole Virtual Audio (Required)

BlackHole is the modern replacement for Soundflower. It creates a virtual audio device so the HUD can "hear" what's coming through your speakers.

**Install:**
1. Go to [existential.audio/blackhole](https://existential.audio/blackhole/)
2. Download **BlackHole 2ch** (free — just enter your email)
3. Run the installer

**Configure Multi-Output Device:**
1. Open **Audio MIDI Setup** (Spotlight → "Audio MIDI Setup")
2. Click the **+** button (bottom-left) → **"Create Multi-Output Device"**
3. Check **both**:
   - Your headphones/speakers (so you still hear audio)
   - BlackHole 2ch (so the HUD captures it)
4. Right-click the new Multi-Output Device → **"Use This Device For Sound Output"**

**How it works:**
Audio from your Mac → splits to both your speakers AND BlackHole → HUD reads from BlackHole as its "microphone" input.

### 3. Node Dependencies (Already Done ✓)
```bash
npm install   # Already installed
```

---

## Running The Seeing Eye

### Start the app:
```bash
cd "/Volumes/WORK 2TB/WORK 2026/THE SEEING EYE"
npx electron .
```

### First-time audio permission:
- macOS will ask to grant microphone access to Electron
- **Allow it** — this is how the HUD reads from BlackHole

---

## Hotkeys

| Shortcut | Action |
|---|---|
| `⌘⇧H` | Show/hide HUD overlay |
| `⌘⇧L` | Start/stop listening (transcription + answers) |
| `⌘⇧C` | Clear transcript & answer history |
| `⌘⇧T` | Toggle click-through mode (mouse passes through) |

---

## Interview Workflow

1. **Before the interview:**
   - Set system audio output to your Multi-Output Device
   - Launch The Seeing Eye: `npx electron .`
   - Press `⌘⇧H` to show the HUD
   - Press `⌘⇧L` to start listening
   - Verify the status shows "LISTENING" with a green indicator

2. **During the interview:**
   - The HUD transcribes audio in real-time (LISTENING section)
   - When a question ends (1.2s silence), it auto-fires to Groq
   - Answer streams in as bullet points (ANSWER section)
   - Press `⌘⇧T` to toggle click-through if you need to interact with the browser underneath
   - **Never click the HUD during the interview** — use hotkeys only

3. **Between questions:**
   - Press `⌘⇧C` to clear for the next question (optional — it auto-clears)

4. **After the interview:**
   - Press `⌘⇧L` to stop listening
   - Press `⌘⇧H` to hide the HUD
   - Quit: `Ctrl+C` in terminal

---

## Stealth Features

The HUD is invisible to browser-based screen capture (Micro1, Google Meet, Teams, etc.):

- **Content Protection** — `setContentProtection(true)` (OS-level)
- **Panel Window** — Doesn't steal focus from Chrome (no blur events)
- **showInactive()** — Appears without triggering tab-switch detection
- **Hidden in Mission Control** — Won't appear in system UI
- **No Dock icon** — `skipTaskbar: true`
- **No shadow** — Shadows can leak into captures
- **Click-through mode** — Mouse events pass to browser underneath

---

## Troubleshooting

### "MIC ERROR" on status bar
- Check Audio MIDI Setup — make sure BlackHole 2ch exists
- Check System Settings → Privacy → Microphone → allow Electron

### No transcript appearing
- Verify the Multi-Output Device is set as system output
- Check the DEEPGRAM_API_KEY in `.env`
- Check terminal for error messages

### HUD visible in screen share
- Ensure you're sharing from a browser (Chrome), not a native app
- For Zoom: enable "Advanced Capture with window filtering" in Zoom settings
- Nuclear option: move HUD to your LG (left) monitor, share only Acer (right)

### Answers not generating
- Check GROQ_API_KEY in `.env`
- Check terminal for rate limit messages
- Free tier has rate limits — should be fine for interviews
