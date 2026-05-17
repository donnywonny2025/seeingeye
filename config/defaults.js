/**
 * THE SEEING EYE — Default Configuration
 */

export const defaults = {
  // Server
  port: 4400,

  // Deepgram
  deepgram: {
    model: 'nova-2',
    language: 'en-US',
    sampleRate: 16000,
    encoding: 'linear16',
    utteranceEndMs: 1200,
  },

  // LLM
  llm: {
    provider: 'groq',
    groqModel: 'llama-3.3-70b-versatile',
    maxTokens: 300,
    temperature: 0.3,
    maxHistory: 6,
  },

  // HUD
  hud: {
    width: 420,
    height: 520,
    opacity: 0.92,
    position: 'bottom-right',
  },

  // Hotkeys
  hotkeys: {
    toggleHud: 'CommandOrControl+Shift+H',
    toggleListening: 'CommandOrControl+Shift+L',
    clearAll: 'CommandOrControl+Shift+C',
  },
};
