import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  const profile = fs.readFileSync('./config/profile.md', 'utf8');
  const intel = fs.readFileSync('./config/micro1_intel.md', 'utf8');

  const SYSTEM_PROMPT = `You are the brain of an invisible AR teleprompter... (Truncated for test, using actual strings)
${profile}
${intel}
LIMIT EVERY ANSWER TO EXACTLY 2 TO 3 SENTENCES.
SEPARATE EVERY SINGLE SENTENCE with a double line break (blank line).
`;

  try {
    const responseStream = await gemini.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hi, I am Zara, a recruiter at Micro1. How are you today?' }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 300,
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
        ]
      }
    });

    let count = 0;
    let text = '';
    for await (const chunk of responseStream) {
      if (chunk.text) {
        text += chunk.text;
        count += chunk.text.length;
      }
    }
    console.log(`\n\n[SUCCESS] Generated ${count} characters: "${text}"`);
  } catch (err) {
    console.error('[ERROR]', err);
  }
}

test();
