/**
 * THE SEEING EYE — Main Server
 * 
 * Express + Socket.IO backend that orchestrates:
 * 1. Audio capture from the renderer (via Socket.IO)
 * 2. Streaming transcription (Deepgram)
 * 3. LLM answer generation (Groq)
 * 4. Streaming results back to the HUD
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Transcriber } from './transcriber.js';
import { LLMEngine } from './llm.js';
import { VADManager } from './vad.js';
import { appendFileSync } from 'fs';

const __serverDir = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__serverDir, '..', 'logs');

const PORT = process.env.PORT || 4400;

export async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIO(httpServer, {
    cors: { origin: '*' }
  });

  // ── Initialize Services ──────────────────────────

  const llm = new LLMEngine({
    groqKey: process.env.GROQ_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    groqModel: process.env.GROQ_MODEL,
    geminiModel: process.env.GEMINI_MODEL,
  });

  // ── Health Check ─────────────────────────────────

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
    });
  });

  // ── Config Page ──────────────────────────────────

  app.use('/config', express.static(join(__serverDir, '..', 'renderer'), { index: 'config.html' }));

  // ── Socket.IO Connection Handler ─────────────────

  io.on('connection', (socket) => {
    console.log('[SERVER] Client connected:', socket.id);

    let transcriber = null;
    let userTranscriber = null;
    const vad = new VADManager();
    let isProcessingQuestion = false;
    let userSpeechBuffer = '';

    // ── Start Listening ──────────────────────────

    socket.on('start-listening', async () => {
      if (!process.env.DEEPGRAM_API_KEY) {
        socket.emit('error', { message: 'DEEPGRAM_API_KEY not configured' });
        return;
      }

      transcriber = new Transcriber(process.env.DEEPGRAM_API_KEY, {
        model: process.env.DEEPGRAM_MODEL,
      });

      // Partial transcript — words appearing in real-time
      transcriber.on('transcript-partial', (text) => {
        vad.addPartial(text);
        socket.emit('transcript-partial', { text });
      });

      // Final transcript segment
      transcriber.on('transcript-final', (text) => {
        vad.addFinal(text);
        socket.emit('transcript-final', { text });
      });

      // Utterance ended — the speaker stopped talking
      transcriber.on('utterance-end', async () => {
        const question = vad.flush();
        if (!question || question.length < 10 || isProcessingQuestion) return;

        console.log(`[SERVER] Question detected: "${question.substring(0, 80)}..."`);
        isProcessingQuestion = true;

        socket.emit('question-detected', { question });

        // Generate streaming answer
        await llm.generateAnswer(
          question,
          // onToken — stream each token to the HUD
          (token) => {
            socket.emit('answer-token', { token });
          },
          // onDone — answer complete
          (error) => {
            socket.emit('answer-complete', { error });
            isProcessingQuestion = false;
          }
        );
      });

      transcriber.on('error', (err) => {
        socket.emit('error', { message: err.message });
      });

      await transcriber.start();
      socket.emit('listening-started');
      console.log('[SERVER] Listening started');
    });

    // ── Receive Interviewer Audio Data ───────────

    socket.on('audio-data', (data) => {
      if (transcriber) {
        transcriber.sendAudio(Buffer.from(data));
      }
    });

    // ── Receive User Mic Audio Data ──────────────

    socket.on('user-audio-data', async (data) => {
      if (!userTranscriber) {
        // Spin up a log-only transcriber for the user's mic on first audio
        userTranscriber = new Transcriber(process.env.DEEPGRAM_API_KEY, {
          model: process.env.DEEPGRAM_MODEL,
        });

        userTranscriber.on('transcript-final', (text) => {
          userSpeechBuffer += (userSpeechBuffer ? ' ' : '') + text;
        });

        userTranscriber.on('utterance-end', () => {
          if (userSpeechBuffer && userSpeechBuffer.length > 5) {
            // Write to daily log
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const logFile = join(LOG_DIR, `session_${dateStr}.log`);
            const entry = `\n── YOU (${now.toISOString()}): ${userSpeechBuffer}\n`;
            try { appendFileSync(logFile, entry); } catch (e) { /* silent */ }
            console.log(`[SERVER] User said: "${userSpeechBuffer.substring(0, 80)}..."`);
            userSpeechBuffer = '';
          }
        });

        userTranscriber.on('error', (err) => {
          console.error('[SERVER] User mic transcriber error:', err.message);
        });

        await userTranscriber.start();
        console.log('[SERVER] User mic transcriber started (log-only)');
      }

      userTranscriber.sendAudio(Buffer.from(data));
    });

    // ── Stop Listening ───────────────────────────

    socket.on('stop-listening', () => {
      if (transcriber) {
        transcriber.stop();
        transcriber = null;
      }
      if (userTranscriber) {
        userTranscriber.stop();
        userTranscriber = null;
      }
      vad.clear();
      userSpeechBuffer = '';
      socket.emit('listening-stopped');
      console.log('[SERVER] Listening stopped');
    });

    // ── Clear History ────────────────────────────

    socket.on('clear-history', () => {
      llm.clearHistory();
      vad.clear();
      socket.emit('history-cleared');
    });

    // ── Disconnect ───────────────────────────────

    socket.on('disconnect', () => {
      if (transcriber) {
        transcriber.stop();
        transcriber = null;
      }
      if (userTranscriber) {
        userTranscriber.stop();
        userTranscriber = null;
      }
      console.log('[SERVER] Client disconnected:', socket.id);
    });
  });

  // ── Start Server ─────────────────────────────────

  httpServer.listen(PORT, () => {
    console.log(`[SERVER] Running on port ${PORT}`);
    console.log(`[SERVER] Deepgram: ${process.env.DEEPGRAM_API_KEY ? '✓' : '✗'}`);
    console.log(`[SERVER] Groq: ${process.env.GROQ_API_KEY ? '✓' : '✗'}`);
    console.log(`[SERVER] Gemini: ${process.env.GEMINI_API_KEY ? '✓' : '✗'}`);
  });

  return httpServer;
}

// Allow running standalone
if (process.argv[1] && process.argv[1].includes('server/index.js')) {
  startServer();
}
