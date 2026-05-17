/**
 * THE SEEING EYE — Deepgram Streaming Transcriber
 * 
 * Connects to Deepgram Nova-2 via WebSocket for real-time
 * speech-to-text. Emits partial and final transcripts.
 * 
 * Latency: ~300ms from audio → text
 */

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import EventEmitter from 'events';

export class Transcriber extends EventEmitter {
  constructor(apiKey, options = {}) {
    super();
    this.apiKey = apiKey;
    this.model = options.model || 'nova-2';
    this.connection = null;
    this.isListening = false;
  }

  /**
   * Open a streaming connection to Deepgram.
   * Emits 'transcript-partial' and 'transcript-final' events.
   */
  async start() {
    if (this.isListening) return;

    const deepgram = createClient(this.apiKey);

    this.connection = deepgram.listen.live({
      model: this.model,
      language: 'en-US',
      smart_format: true,
      punctuate: true,
      interim_results: true,      // Get partial transcripts as they come
      utterance_end_ms: 1200,     // Detect end of utterance after 1.2s silence
      vad_events: true,           // Voice activity detection
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1,
    });

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      this.isListening = true;
      console.log('[TRANSCRIBER] Deepgram connection open');
      this.emit('ready');
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (!transcript || transcript.trim() === '') return;

      if (data.is_final) {
        this.emit('transcript-final', transcript);
      } else {
        this.emit('transcript-partial', transcript);
      }
    });

    this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      // The speaker stopped talking — question is complete
      this.emit('utterance-end');
    });

    this.connection.on(LiveTranscriptionEvents.Error, (err) => {
      console.error('[TRANSCRIBER] Error:', err.message);
      this.emit('error', err);
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      this.isListening = false;
      console.log('[TRANSCRIBER] Connection closed');
      this.emit('closed');
    });
  }

  /**
   * Send raw audio data to Deepgram.
   * @param {Buffer} audioData - PCM audio buffer (16-bit, 16kHz, mono)
   */
  sendAudio(audioData) {
    if (this.connection && this.isListening) {
      this.connection.send(audioData);
    }
  }

  /**
   * Close the Deepgram connection.
   */
  stop() {
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
      this.isListening = false;
    }
  }
}
