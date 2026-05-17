/**
 * THE SEEING EYE — HUD Frontend Logic
 * 
 * Handles:
 * 1. Audio capture from system (via BlackHole virtual mic)
 * 2. Streaming audio to backend via Socket.IO
 * 3. Displaying live transcript and streaming answers
 * 4. Hotkey responses from Electron main process
 */

// ── State ──────────────────────────────────────

let socket = null;
let isListening = false;
let audioContext = null;
let mediaStream = null;
let processorNode = null;

// ── DOM References ─────────────────────────────

const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const latencyDisplay = document.getElementById('latency-display');
const transcriptFinal = document.getElementById('transcript-final');
const transcriptPartial = document.getElementById('transcript-partial');
const answerDiv = document.getElementById('answer');

// ── Initialize ─────────────────────────────────

async function init() {
  const port = await window.seeingEye.getServerPort();
  socket = io(`http://localhost:${port}`);

  setupSocketHandlers();
  setupHotkeyHandlers();

  console.log('[HUD] Initialized, connecting to server on port', port);
}

// ── Socket Event Handlers ──────────────────────

function setupSocketHandlers() {
  socket.on('connect', () => {
    console.log('[HUD] Connected to server');
  });

  // Live transcript — partial (green, updating)
  socket.on('transcript-partial', ({ text }) => {
    transcriptPartial.textContent = text;
    autoScrollTranscript();
  });

  // Live transcript — final (committed)
  socket.on('transcript-final', ({ text }) => {
    transcriptFinal.textContent += (transcriptFinal.textContent ? ' ' : '') + text;
    transcriptPartial.textContent = '';
    autoScrollTranscript();
  });

  // Question detected — show it highlighted
  socket.on('question-detected', ({ question }) => {
    setStatus('processing', 'THINKING');
    answerDiv.innerHTML = `<div class="question-highlight">Q: ${escapeHtml(question)}</div>`;
  });

  // Answer tokens streaming in
  socket.on('answer-token', ({ token }) => {
    // Remove placeholder if present
    const placeholder = answerDiv.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    // Append token
    const span = document.createElement('span');
    span.className = 'token-new';
    span.textContent = token;
    answerDiv.appendChild(span);

    // Auto-scroll answer
    answerDiv.scrollTop = answerDiv.scrollHeight;
  });

  // Answer complete
  socket.on('answer-complete', ({ error }) => {
    if (error) {
      answerDiv.innerHTML += `<div style="color: #ff4444; font-size: 11px; margin-top: 8px;">Error: ${error}</div>`;
    }
    if (isListening) {
      setStatus('listening', 'LISTENING');
    }
    // Clear transcript for next question
    transcriptFinal.textContent = '';
    transcriptPartial.textContent = '';
  });

  socket.on('listening-started', () => {
    setStatus('listening', 'LISTENING');
  });

  socket.on('listening-stopped', () => {
    setStatus('off', 'STANDBY');
  });

  socket.on('error', ({ message }) => {
    console.error('[HUD] Server error:', message);
    setStatus('off', 'ERROR');
  });
}

// ── Audio Capture ──────────────────────────────

async function startAudioCapture() {
  try {
    // Find BlackHole 2ch device — this captures system audio
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    const blackhole = audioInputs.find(d => d.label.toLowerCase().includes('blackhole'));

    const audioConstraints = {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };

    // If BlackHole found, use it explicitly
    if (blackhole) {
      audioConstraints.deviceId = { exact: blackhole.deviceId };
      console.log('[HUD] Using BlackHole 2ch for audio capture');
    } else {
      console.warn('[HUD] BlackHole not found — using default mic. System audio capture may not work.');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    // Use ScriptProcessor for raw PCM access
    // (AudioWorklet would be cleaner but this is simpler for v1)
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = (event) => {
      if (!isListening) return;

      const inputData = event.inputBuffer.getChannelData(0);

      // Convert Float32 to Int16 PCM (what Deepgram expects)
      const pcmBuffer = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Send raw audio to server
      socket.emit('audio-data', pcmBuffer.buffer);
    };

    source.connect(processorNode);
    processorNode.connect(audioContext.destination);

    console.log('[HUD] Audio capture started');
  } catch (err) {
    console.error('[HUD] Audio capture failed:', err.message);
    setStatus('off', 'MIC ERROR');
  }
}

function stopAudioCapture() {
  if (processorNode) {
    processorNode.disconnect();
    processorNode = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  console.log('[HUD] Audio capture stopped');
}

// ── Toggle Listening ───────────────────────────

async function toggleListening() {
  if (isListening) {
    isListening = false;
    socket.emit('stop-listening');
    stopAudioCapture();
  } else {
    isListening = true;
    await startAudioCapture();
    socket.emit('start-listening');
  }
}

// ── Clear All ──────────────────────────────────

function clearAll() {
  transcriptFinal.textContent = '';
  transcriptPartial.textContent = '';
  answerDiv.innerHTML = '<span class="placeholder">Waiting for question...</span>';
  socket.emit('clear-history');
  console.log('[HUD] Cleared');
}

// ── Hotkey Handlers ────────────────────────────

function setupHotkeyHandlers() {
  window.seeingEye.onToggleListening(() => {
    toggleListening();
  });

  window.seeingEye.onClearAll(() => {
    clearAll();
  });
}

// ── UI Helpers ─────────────────────────────────

function setStatus(state, text) {
  statusIndicator.className = `indicator ${state}`;
  statusText.textContent = text;
}

function autoScrollTranscript() {
  const section = document.querySelector('.transcript-section');
  section.scrollTop = section.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Boot ───────────────────────────────────────

init();
