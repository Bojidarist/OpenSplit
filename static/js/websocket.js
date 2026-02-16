/**
 * WebSocket connection management.
 */

import { WS_RECONNECT_DELAY } from './config.js';
import { serverIP } from './state.js';
import { updateTimer } from './timer.js';

/** The active WebSocket connection. */
let ws = null;

/** When true, the onclose handler should NOT auto-reconnect. */
let intentionalClose = false;

/**
 * Establishes a WebSocket connection to the timer server.
 * Automatically reconnects on disconnection (unless closed intentionally).
 */
export function connectWS() {
    ws = new WebSocket(`ws://${serverIP}/ws`);

    ws.onopen = () => {
        console.log('Connected to timer server');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateTimer(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('Disconnected from timer server');
        if (!intentionalClose) {
            setTimeout(connectWS, WS_RECONNECT_DELAY);
        }
        intentionalClose = false;
    };
}

/**
 * Sends a command to the server over WebSocket.
 * @param {string} command - The command name.
 * @param {Object} extra - Additional data to include.
 */
export function sendCommand(command, extra = {}) {
    const msg = { command, ...extra };
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

/**
 * Closes and re-establishes the WebSocket connection.
 */
export function reconnectWS() {
    if (ws) {
        intentionalClose = true;
        ws.close();
    }
    connectWS();
}
