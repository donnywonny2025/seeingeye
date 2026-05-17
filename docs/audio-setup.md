# Audio Setup Guide — BlackHole on macOS

## What is BlackHole?

BlackHole is a free, open-source virtual audio driver. It creates a "virtual cable" that routes audio from one app to another. We use it to capture the interviewer's audio (from your browser) and feed it to The Seeing Eye for transcription.

## Installation

```bash
brew install blackhole-2ch
```

After installation, restart your Mac (or at minimum, log out and back in).

## Configuration

### Step 1: Open Audio MIDI Setup

1. Open **Audio MIDI Setup** (search Spotlight or find in `/Applications/Utilities/`)
2. Click the **+** button at the bottom left
3. Select **Create Multi-Output Device**

### Step 2: Configure the Multi-Output Device

In the new Multi-Output Device, check these audio devices:

| Device | Use |
|---|---|
| ✅ Built-in Output (or your speakers/headphones) | So YOU can hear the audio |
| ✅ BlackHole 2ch | So The Seeing Eye can capture the audio |

**Important:** Make sure your speakers/headphones are listed **first** (drag to top if needed). This ensures audio quality isn't affected.

### Step 3: Set as System Output

1. Open **System Settings → Sound → Output**
2. Select **Multi-Output Device** as your output
3. (Or: Option-click the volume icon in the menu bar → Select Multi-Output Device)

### Step 4: Configure The Seeing Eye

When you launch The Seeing Eye and press ⌘⇧L to start listening, your browser will ask for microphone permission. Select **BlackHole 2ch** as the input source.

## How It Works

```
Browser (Interview Audio)
    │
    ▼
Multi-Output Device
    ├──→ Speakers (you hear it)
    └──→ BlackHole 2ch (The Seeing Eye captures it)
              │
              ▼
        The Seeing Eye → Deepgram → Answer
```

## Troubleshooting

**No audio captured?**
- Make sure Multi-Output Device is set as system output
- Make sure BlackHole 2ch is checked in the Multi-Output Device
- Check that you selected BlackHole 2ch when the browser asked for microphone permission

**Echo or feedback?**
- Make sure echo cancellation is disabled in The Seeing Eye (it is by default)
- Don't use BlackHole as both input AND output

**Volume control missing?**
- Multi-Output Devices don't show volume in the menu bar — that's normal
- Control volume via the individual device settings in Audio MIDI Setup
