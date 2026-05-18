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
import { GoogleGenAI } from '@google/genai';
import { appendFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __llmDir = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__llmDir, '..', 'logs');

// Ensure logs directory exists
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

// Load user profile context
const PROFILE_PATH = join(__llmDir, '..', 'config', 'profile.md');
let PROFILE_DATA = '';
try {
  if (existsSync(PROFILE_PATH)) {
    PROFILE_DATA = readFileSync(PROFILE_PATH, 'utf-8');
  }
} catch (e) {
  console.error('[LLM] Could not load profile.md:', e);
}

// Load interview/company intel context
const INTEL_PATH = join(__llmDir, '..', 'config', 'micro1_intel.md');
let INTEL_DATA = '';
try {
  if (existsSync(INTEL_PATH)) {
    INTEL_DATA = readFileSync(INTEL_PATH, 'utf-8');
  }
} catch (e) {
  console.error('[LLM] Could not load micro1_intel.md:', e);
}

const SYSTEM_PROMPT = `You are a real-time interview teleprompter. Your job is to feed the candidate natural, first-person phrases they can read aloud seamlessly.

ROLE CONTEXT:
---
\${INTEL_DATA}
---

CANDIDATE CONTEXT (Only use if asked about resume/history):
---
\${PROFILE_DATA}
---

VOICE, CADENCE & HUMAN NATURALNESS (CRITICAL):
- Write the answer EXACTLY as it would be spoken out loud by a normal person. Use plain, conversational English.
- DO NOT use textbook marketing terms or academic phrasing (e.g., "psychographics", "demographics").
- DO NOT sound like an AI. Ban all robotic transitions like "Furthermore", "Moreover", "In conclusion".
- Provide full, detailed, high-quality answers. Do not summarize or hold back information.
- Imagine you are speaking to a colleague over coffee. Speak naturally.

FORMATTING RULE:
- Your response must be ONE CONTINUOUS PARAGRAPH. No line breaks. No bullet points. No bolding.`;

export class LLMEngine {
  constructor(config = {}) {
    this.groqKey = config.groqKey;
    this.geminiKey = config.geminiKey;
    this.groqModel = config.groqModel || 'llama-3.3-70b-versatile';
    this.geminiModel = config.geminiModel || 'gemini-2.5-flash';
    this.conversationHistory = [];
    this.maxHistory = 6; // Keep last 3 Q&A pairs

    if (this.groqKey) {
      this.groq = new Groq({ apiKey: this.groqKey });
    }
    
    if (this.geminiKey) {
      this.gemini = new GoogleGenAI({ apiKey: this.geminiKey });
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
      // Direct pipe to Gemini for advanced reasoning and natural persona
      if (this.gemini) {
        await this._streamGemini(messages, onToken, onDone);
        return;
      }
      
      // Fallback to Groq if Gemini isn't configured
      if (this.groq) {
        await this._streamGroq(messages, onToken, onDone);
        return;
      }

      throw new Error('No LLM provider configured');
    } catch (err) {
      console.error('[LLM] Generation error:', err.message);
      onDone(err.message);
    }
  }

  /**
   * Stream response from Gemini 3 Flash.
   */
  async _streamGemini(messages, onToken, onDone) {
    const startTime = Date.now();
    let fullResponse = '';
    let firstToken = true;

    try {
      // Convert history format to Gemini format
      const geminiContents = messages.slice(1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const responseStream = await this.gemini.models.generateContentStream({
        model: this.geminiModel,
        contents: geminiContents,
        config: {
          systemInstruction: messages[0].content, // System prompt
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
          ]
        }
      });

      for await (const chunk of responseStream) {
        let token = chunk.text;
        if (token) {
          // Hard-sanitize formatting from the stream before hitting the UI
          token = token.replace(/[\n*#_-]/g, ' ');
          if (firstToken) {
            console.log(`[LLM] Gemini First token in ${Date.now() - startTime}ms`);
            firstToken = false;
          }
          fullResponse += token;
          onToken(token);
        }
      }

      console.log(`[LLM] Gemini Complete in ${Date.now() - startTime}ms (${fullResponse.length} chars)`);
      console.log(`[LLM] Gemini Output: "${fullResponse}"`);
      this.conversationHistory.push({ role: 'assistant', content: fullResponse });
      
      const totalMs = Date.now() - startTime;
      console.log(`[LLM] Gemini Complete in ${totalMs}ms (${fullResponse.length} chars)`);

      // Log Q&A pair with telemetry
      this._logQA(this._currentQuestion, fullResponse, {
        firstTokenMs: firstToken ? totalMs : (Date.now() - startTime),
        totalMs,
        model: this.geminiModel,
        tokens: fullResponse.length,
      });

      onDone(null);
    } catch (err) {
      console.error('[LLM] Gemini Stream Error:', err.message);
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
      temperature: 0.7,    // Increased for natural speech cadence
      max_tokens: 300,      // Keep answers concise
    });

    for await (const chunk of stream) {
      let token = chunk.choices?.[0]?.delta?.content;
      if (token) {
        // Hard-sanitize formatting from the stream before hitting the UI
        token = token.replace(/[\n*#_-]/g, ' ');
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
