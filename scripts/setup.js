/**
 * THE SEEING EYE — First-Time Setup
 * 
 * Checks prerequisites and helps configure the environment.
 */

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

console.log('');
console.log('═══════════════════════════════════════════');
console.log('  THE SEEING EYE — Setup');
console.log('═══════════════════════════════════════════');
console.log('');

// Check Node.js version
const nodeVersion = process.version;
console.log(`✓ Node.js ${nodeVersion}`);

// Check for BlackHole
try {
  const audioDevices = execSync('system_profiler SPAudioDataType 2>/dev/null || echo "unknown"').toString();
  if (audioDevices.includes('BlackHole')) {
    console.log('✓ BlackHole virtual audio driver detected');
  } else {
    console.log('✗ BlackHole not detected');
    console.log('  Install with: brew install blackhole-2ch');
    console.log('  Then configure in Audio MIDI Setup (see docs/audio-setup.md)');
  }
} catch {
  console.log('? Could not check for BlackHole');
}

// Check .env
const envPath = join(root, '.env');
if (!existsSync(envPath)) {
  copyFileSync(join(root, '.env.example'), envPath);
  console.log('✓ Created .env from template');
} else {
  console.log('✓ .env exists');
}

// Check for API keys in .env
try {
  const { config } = await import('dotenv');
  config({ path: envPath });
  
  console.log(`${process.env.DEEPGRAM_API_KEY ? '✓' : '✗'} Deepgram API key ${process.env.DEEPGRAM_API_KEY ? 'configured' : 'MISSING — get one at console.deepgram.com'}`);
  console.log(`${process.env.GROQ_API_KEY ? '✓' : '✗'} Groq API key ${process.env.GROQ_API_KEY ? 'configured' : 'MISSING (fallback) — get one at console.groq.com'}`);
  console.log(`${process.env.GEMINI_API_KEY ? '✓' : '✗'} Gemini API key ${process.env.GEMINI_API_KEY ? 'configured' : 'MISSING (primary) — get one at aistudio.google.com'}`);
} catch {
  console.log('? Could not check API keys');
}

console.log('');
console.log('Next steps:');
console.log('  1. Fill in API keys in .env');
console.log('  2. Install BlackHole if not done');
console.log('  3. Run: npm run dev');
console.log('');
