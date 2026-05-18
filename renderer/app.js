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
let userMicStream = null;
let userMicContext = null;
let userMicProcessor = null;

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

  // Question detected — clear the answer box and show THINKING
  socket.on('question-detected', ({ question }) => {
    setStatus('processing', 'THINKING');
    answerDiv.innerHTML = ''; // Clear previous answer, but don't show the question here
  });

  // Answer tokens streaming in
  socket.on('answer-token', ({ token }) => {
    // Remove placeholder if present
    const placeholder = answerDiv.querySelector('.placeholder');
    if (placeholder) placeholder.remove();

    // Append token to the last text node to prevent kerning layout jitter
    const lastNode = answerDiv.lastChild;
    if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
      lastNode.nodeValue += token;
    } else {
      answerDiv.appendChild(document.createTextNode(token));
    }

    // Auto-scroll answer only if it's overflowing (prevents unnecessary layout thrashing)
    if (answerDiv.scrollHeight > answerDiv.clientHeight) {
      answerDiv.scrollTop = answerDiv.scrollHeight;
    }
  });

  // Answer complete
  socket.on('answer-complete', ({ error }) => {
    if (error) {
      answerDiv.innerHTML += `<div style="color: #ff4444; font-size: 11px; margin-top: 8px;">Error: ${error}</div>`;
    }
    if (isListening) {
      setStatus('listening', 'LISTENING');
    }
    // We intentionally DO NOT clear the transcript here anymore. 
    // The question stays on screen so you can read it, and the strict CSS height prevents the UI from bouncing.
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
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    const blackhole = audioInputs.find(d => d.label.toLowerCase().includes('blackhole'));

    // ── Stream 1: BlackHole (interviewer audio) ──
    const interviewerConstraints = {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };

    if (blackhole) {
      interviewerConstraints.deviceId = { exact: blackhole.deviceId };
      console.log('[HUD] Interviewer stream: BlackHole 2ch');
    } else {
      console.warn('[HUD] BlackHole not found — using default mic for interviewer stream');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: interviewerConstraints });
    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    processorNode.onaudioprocess = (event) => {
      if (!isListening) return;
      const inputData = event.inputBuffer.getChannelData(0);
      const pcmBuffer = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      socket.emit('audio-data', pcmBuffer.buffer);
    };

    source.connect(processorNode);
    processorNode.connect(audioContext.destination);
    console.log('[HUD] Interviewer audio capture started');

    // ── Stream 2: Real mic (user's voice for logging) ──
    const realMic = audioInputs.find(d =>
      !d.label.toLowerCase().includes('blackhole') &&
      d.deviceId !== 'default' &&
      d.label !== ''
    );

    if (realMic) {
      const userMicConstraints = {
        deviceId: { exact: realMic.deviceId },
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };

      userMicStream = await navigator.mediaDevices.getUserMedia({ audio: userMicConstraints });
      userMicContext = new AudioContext({ sampleRate: 16000 });
      const userSource = userMicContext.createMediaStreamSource(userMicStream);

      userMicProcessor = userMicContext.createScriptProcessor(4096, 1, 1);
      userMicProcessor.onaudioprocess = (event) => {
        if (!isListening) return;
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmBuffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        socket.emit('user-audio-data', pcmBuffer.buffer);
      };

      userSource.connect(userMicProcessor);
      userMicProcessor.connect(userMicContext.destination);
      console.log(`[HUD] User mic stream: ${realMic.label}`);
    } else {
      console.warn('[HUD] No real mic found — user voice will not be logged');
    }
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
  // Clean up user mic stream
  if (userMicProcessor) {
    userMicProcessor.disconnect();
    userMicProcessor = null;
  }
  if (userMicStream) {
    userMicStream.getTracks().forEach(track => track.stop());
    userMicStream = null;
  }
  if (userMicContext) {
    userMicContext.close();
    userMicContext = null;
  }
  console.log('[HUD] All audio capture stopped');
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
