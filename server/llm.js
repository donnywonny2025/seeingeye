/**
 * THE SEEING EYE — LLM Engine
 * 
 * Handles answer generation with streaming token output.
 * Primary: Groq (fastest — ~200ms first token)
 * Fallback: Gemini Flash
 * 
 * All responses stream token-by-token for minimum perceived latency.
 */

import Groq from 'groq-sdk';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __llmDir = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__llmDir, '..', 'logs');

// Ensure logs directory exists
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const SYSTEM_PROMPT = `You are a real-time interview assistant. When given a question from an interviewer, provide a concise, structured answer the candidate can glance at quickly.

Rules:
- Keep answers SHORT — 3-5 bullet points maximum
- Lead with the most important point
- Use specific technical terms and metrics when relevant
- If it's a behavioral question, use the STAR framework (Situation, Task, Action, Result)
- Never say "I" — write in second person ("You should mention...")
- No filler, no fluff. Every word must earn its place.
- Format for GLANCEABILITY — the candidate has 1-2 seconds to read this.`;

export class LLMEngine {
  constructor(config = {}) {
    this.groqKey = config.groqKey;
    this.geminiKey = config.geminiKey;
    this.groqModel = config.groqModel || 'llama-3.3-70b-versatile';
    this.conversationHistory = [];
    this.maxHistory = 6; // Keep last 3 Q&A pairs

    if (this.groqKey) {
      this.groq = new Groq({ apiKey: this.groqKey });
    }
  }

  /**
   * Generate a streaming answer to an interview question.
   * @param {string} question - The transcribed question
   * @param {function} onToken - Callback for each token as it arrives
   * @param {function} onDone - Callback when generation completes
   */
  async generateAnswer(question, onToken, onDone) {
    this._currentQuestion = question;
    // Add question to conversation history
    this.conversationHistory.push({ role: 'user', content: question });

    // Trim history to stay within context limits
    while (this.conversationHistory.length > this.maxHistory) {
      this.conversationHistory.shift();
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.conversationHistory,
    ];

    try {
      // Try Groq first (fastest)
      if (this.groq) {
        await this._streamGroq(messages, onToken, onDone);
        return;
      }

      // TODO: Gemini fallback
      throw new Error('No LLM provider configured');
    } catch (err) {
      console.error('[LLM] Generation error:', err.message);
      onDone(err.message);
    }
  }

  /**
   * Stream response from Groq.
   */
  async _streamGroq(messages, onToken, onDone) {
    const startTime = Date.now();
    let fullResponse = '';
    let firstToken = true;

    const stream = await this.groq.chat.completions.create({
      model: this.groqModel,
      messages,
      stream: true,
      temperature: 0.3,    // Lower = more focused answers
      max_tokens: 300,      // Keep answers concise
    });

    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content;
      if (token) {
        if (firstToken) {
          console.log(`[LLM] First token in ${Date.now() - startTime}ms`);
          firstToken = false;
        }
        fullResponse += token;
        onToken(token);
      }
    }

    // Save assistant response to history
    this.conversationHistory.push({ role: 'assistant', content: fullResponse });
    
    const totalMs = Date.now() - startTime;
    console.log(`[LLM] Complete in ${totalMs}ms (${fullResponse.length} chars)`);

    // Log Q&A pair with telemetry
    this._logQA(this._currentQuestion, fullResponse, {
      firstTokenMs: firstToken ? totalMs : (Date.now() - startTime),
      totalMs,
      model: this.groqModel,
      tokens: fullResponse.length,
    });

    onDone(null);
  }

  /**
   * Clear conversation history.
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Log a Q&A pair with telemetry to a daily log file.
   */
  _logQA(question, answer, metrics) {
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const logFile = join(LOG_DIR, `session_${dateStr}.log`);

      const entry = [
        `\n${'═'.repeat(60)}`,
        `TIME: ${now.toISOString()}`,
        `MODEL: ${metrics.model}`,
        `LATENCY: first_token=${metrics.firstTokenMs}ms | total=${metrics.totalMs}ms`,
        `CHARS: ${metrics.tokens}`,
        ``,
        `Q: ${question}`,
        ``,
        `A: ${answer}`,
        `${'═'.repeat(60)}\n`,
      ].join('\n');

      appendFileSync(logFile, entry);
    } catch (err) {
      console.error('[LLM] Log write failed:', err.message);
    }
  }
}
