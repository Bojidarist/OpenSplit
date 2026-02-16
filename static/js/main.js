/**
 * Application entry point.
 * Imports all modules, initializes the application, and wires event listeners.
 */

import { SAVE_INDICATOR_INTERVAL } from './config.js';
import { containerWidth, dirtyState, updateSaveIndicator } from './state.js';
import { connectWS } from './websocket.js';
import { applyTheme, initKeyboardShortcuts, initModals } from './modals.js';
import { initResize } from './resize.js';

// --- Initialize Application ---

// Get the main container
const container = document.querySelector('.container');
container.style.width = containerWidth + 'px';

// Apply theme
applyTheme();

// Connect to WebSocket server
connectWS();

// Initialize resize handles
initResize(container);

// Initialize all modal event handlers
initModals(container);

// Initialize keyboard shortcuts
initKeyboardShortcuts();

// Update save indicator periodically
setInterval(updateSaveIndicator, SAVE_INDICATOR_INTERVAL);

// Warn before closing with unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (dirtyState.hasUnsavedChanges && dirtyState.changeCount > 0) {
        const message = 'You have unsaved changes. Export your splits before leaving?';
        e.preventDefault();
        e.returnValue = message;
        return message;
    }
});
