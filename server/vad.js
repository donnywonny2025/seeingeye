/**
 * THE SEEING EYE — Voice Activity Detection
 * 
 * Manages transcript buffering and question detection.
 * Accumulates partial transcripts into complete questions
 * and fires when the speaker finishes an utterance.
 */

export class VADManager {
  constructor() {
    this.currentUtterance = '';
    this.fullTranscript = [];
    this.silenceTimer = null;
    this.silenceThreshold = 1500; // ms of silence = question complete
  }

  /**
   * Add a partial transcript chunk.
   * @param {string} text - Partial transcript from Deepgram
   */
  addPartial(text) {
    this.currentUtterance = text;
    this._resetSilenceTimer();
  }

  /**
   * Finalize the current transcript segment.
   * @param {string} text - Final transcript from Deepgram
   */
  addFinal(text) {
    if (text && text.trim()) {
      this.fullTranscript.push(text.trim());
    }
    this.currentUtterance = '';
  }

  /**
   * Get the complete accumulated question text.
   * @returns {string}
   */
  getQuestion() {
    const question = this.fullTranscript.join(' ').trim();
    return question;
  }

  /**
   * Flush the question buffer and return the question.
   * @returns {string}
   */
  flush() {
    const question = this.getQuestion();
    this.fullTranscript = [];
    this.currentUtterance = '';
    return question;
  }

  /**
   * Get the current partial text being spoken.
   * @returns {string}
   */
  getCurrentPartial() {
    return this.currentUtterance;
  }

  /**
   * Reset silence detection timer.
   */
  _resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }

  /**
   * Clear everything.
   */
  clear() {
    this.currentUtterance = '';
    this.fullTranscript = [];
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }
}
