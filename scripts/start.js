/**
 * THE SEEING EYE — Dev Launcher
 * 
 * Starts both the backend server and Electron app.
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, copyFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

// Ensure .env exists
const envPath = join(root, '.env');
const envExample = join(root, '.env.example');
if (!existsSync(envPath)) {
  console.log('[SETUP] No .env found — copying from .env.example');
  copyFileSync(envExample, envPath);
  console.log('[SETUP] Created .env — please fill in your API keys.');
  console.log('[SETUP] Then run `npm run dev` again.');
  process.exit(0);
}

// Launch Electron (which also starts the server)
console.log('[DEV] Launching The Seeing Eye...');
const electron = spawn('npx', ['electron', '.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
});

electron.on('close', (code) => {
  console.log(`[DEV] Electron exited with code ${code}`);
  process.exit(code);
});
