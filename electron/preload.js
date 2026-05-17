/**
 * THE SEEING EYE — Preload Script
 * 
 * Secure bridge between Electron main process and renderer.
 * Exposes only the APIs the HUD needs — nothing more.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('seeingEye', {
  // Get the backend server port
  getServerPort: () => ipcRenderer.invoke('get-server-port'),

  // Listen for hotkey events from main process
  onToggleListening: (callback) => {
    ipcRenderer.on('toggle-listening', () => callback());
  },

  onClearAll: (callback) => {
    ipcRenderer.on('clear-all', () => callback());
  },

  onClickThroughChanged: (callback) => {
    ipcRenderer.on('click-through-changed', (_, isPassthrough) => callback(isPassthrough));
  },
});
