/**
 * THE SEEING EYE — Stealth Overlay Window Manager
 * 
 * Creates a frameless, always-on-top, transparent Electron window
 * hardened for invisibility against browser-based screen capture
 * (Micro1, Google Meet, Teams, etc.)
 * 
 * Key stealth techniques (sourced from Ezzi open-source implementation):
 * - setContentProtection(true) — OS-level capture exclusion
 * - type: 'panel' — doesn't steal focus from other apps
 * - showInactive() — appears without triggering blur events
 * - setIgnoreMouseEvents — click-through to prevent focus theft
 * - setHiddenInMissionControl — invisible in Mission Control
 * - hasShadow: false — shadows show up in captures
 * - skipTaskbar: true — no dock/taskbar icon
 */

import { BrowserWindow, screen } from 'electron';
import { join } from 'path';

/** Track click-through state */
let isClickThrough = false;

/**
 * Create the stealth HUD overlay window.
 * @param {string} electronDir - Path to electron/ directory
 * @returns {BrowserWindow}
 */
export function createOverlayWindow(electronDir) {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const hudWidth = parseInt(process.env.HUD_WIDTH) || 420;
  const hudHeight = parseInt(process.env.HUD_HEIGHT) || 520;

  const win = new BrowserWindow({
    // ── Size & Position ──
    width: hudWidth,
    height: hudHeight,
    x: screenWidth - hudWidth - 20,
    y: screenHeight - hudHeight - 20,

    // ── Stealth Properties ──
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: true,
    movable: true,
    fullscreenable: false,
    enableLargerThanScreen: true,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#00000000',   // Fully transparent ARGB

    // ── Focus Stealth ──
    // 'panel' type: macOS panel windows don't steal active state
    // from other apps, don't appear in Dock window list
    type: 'panel',
    focusable: true,

    // ── No title bar remnants ──
    titleBarStyle: 'hidden',

    // ── Web Preferences ──
    webPreferences: {
      preload: join(electronDir, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // ═══════════════════════════════════════════════════════
  // STEALTH LAYER 1: Content Protection
  // Makes window invisible to all screen capture pipelines.
  // On macOS: NSWindow.sharingType = NSWindowSharingNone
  // Browser getDisplayMedia() (what Micro1 uses) respects this.
  // ═══════════════════════════════════════════════════════
  win.setContentProtection(true);

  // ═══════════════════════════════════════════════════════
  // STEALTH LAYER 2: Workspace & Z-Level
  // 'screen-saver' is the highest z-level before system windows.
  // Stays above full-screen apps and across all virtual desktops.
  // ═══════════════════════════════════════════════════════
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'screen-saver', 1);

  // ═══════════════════════════════════════════════════════
  // STEALTH LAYER 3: System UI Hiding
  // Prevents the window from appearing in Mission Control,
  // window button tooltips, or Dock window lists.
  // ═══════════════════════════════════════════════════════
  if (typeof win.setHiddenInMissionControl === 'function') {
    win.setHiddenInMissionControl(true);
  }
  if (typeof win.setWindowButtonVisibility === 'function') {
    win.setWindowButtonVisibility(false);
  }

  // Start interactive (not click-through)
  win.setIgnoreMouseEvents(false);
  isClickThrough = false;

  // ═══════════════════════════════════════════════════════
  // FOCUS PRESERVATION
  // Re-apply stealth config on every focus gain, because
  // macOS can reset window properties during focus transitions.
  // ═══════════════════════════════════════════════════════
  win.on('focus', () => {
    win.setContentProtection(true);
    win.setAlwaysOnTop(true, 'screen-saver', 1);
    win.setHasShadow(false);
    if (typeof win.setHiddenInMissionControl === 'function') {
      win.setHiddenInMissionControl(true);
    }
  });

  // Load the HUD renderer
  const rendererPath = join(electronDir, '..', 'renderer', 'index.html');
  win.loadFile(rendererPath);

  // Start hidden — user toggles with ⌘⇧H
  win.hide();

  console.log('[WINDOW] Stealth overlay created — 3-layer protection ACTIVE');

  return win;
}

/**
 * Show the overlay WITHOUT stealing focus from the active app.
 * This prevents Micro1 from detecting a blur/visibilitychange event.
 * @param {BrowserWindow} win
 */
export function showOverlayStealth(win) {
  if (!win || win.isDestroyed()) return;

  // Set opacity to 0 first to prevent visual flash
  win.setOpacity(0);

  // showInactive() is the key — shows without stealing focus
  win.showInactive();

  // Re-apply stealth config
  win.setContentProtection(true);
  win.setAlwaysOnTop(true, 'screen-saver', 1);

  // Fade in
  const opacity = parseFloat(process.env.HUD_OPACITY) || 0.92;
  win.setOpacity(opacity);
}

/**
 * Toggle click-through mode.
 * When enabled: mouse events pass through to the app underneath.
 * When disabled: overlay is interactive (can scroll, etc.)
 * @param {BrowserWindow} win
 * @returns {boolean} New click-through state
 */
export function toggleClickThrough(win) {
  if (!win || win.isDestroyed()) return false;

  isClickThrough = !isClickThrough;

  if (isClickThrough) {
    // Click-through: events pass to app below
    // { forward: true } means we still get hover events on macOS
    win.setIgnoreMouseEvents(true, { forward: true });
  } else {
    // Interactive: overlay receives mouse events
    win.setIgnoreMouseEvents(false);
  }

  return isClickThrough;
}
