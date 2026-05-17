/**
 * THE SEEING EYE — Electron Main Process
 * 
 * Creates the invisible HUD overlay window and manages
 * the application lifecycle. The overlay uses multi-layer
 * stealth to remain invisible to browser-based screen capture.
 * 
 * Hotkeys:
 *   ⌘⇧H  — Toggle HUD visibility
 *   ⌘⇧L  — Toggle listening (start/stop transcription)
 *   ⌘⇧C  — Clear transcript and answers
 *   ⌘⇧T  — Toggle click-through mode
 */

import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createOverlayWindow, showOverlayStealth, toggleClickThrough } from './window.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let overlayWindow = null;
let serverProcess = null;

// ── App Lifecycle ────────────────────────────────────

app.whenReady().then(async () => {
  // Start the backend server
  const { startServer } = await import('../server/index.js');
  serverProcess = await startServer();

  // Create the invisible overlay
  overlayWindow = createOverlayWindow(__dirname);

  // Register global hotkeys
  registerHotkeys();

  console.log('[MAIN] The Seeing Eye is active.');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ── Hotkey Registration ──────────────────────────────

function registerHotkeys() {
  // Toggle HUD visibility (stealth show/hide)
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (!overlayWindow) return;
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
      console.log('[HOTKEY] HUD hidden');
    } else {
      // Use stealth show — doesn't steal focus from browser
      showOverlayStealth(overlayWindow);
      console.log('[HOTKEY] HUD shown (stealth)');
    }
  });

  // Toggle listening
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (!overlayWindow) return;
    overlayWindow.webContents.send('toggle-listening');
    console.log('[HOTKEY] Toggle listening');
  });

  // Clear transcript and answers
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (!overlayWindow) return;
    overlayWindow.webContents.send('clear-all');
    console.log('[HOTKEY] Cleared');
  });

  // Toggle click-through (so clicks pass to browser underneath)
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (!overlayWindow) return;
    const isPassthrough = toggleClickThrough(overlayWindow);
    overlayWindow.webContents.send('click-through-changed', isPassthrough);
    console.log(`[HOTKEY] Click-through: ${isPassthrough ? 'ON' : 'OFF'}`);
  });
}

// ── IPC Handlers ─────────────────────────────────────

ipcMain.handle('get-server-port', () => {
  return process.env.PORT || 4400;
});
