/**
 * Shared utility functions used across modules.
 */

import { TOAST_DEFAULT_DURATION } from './config.js';

/**
 * Creates a debounced version of a function that delays invocation
 * until after the specified wait time has elapsed since the last call.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - Delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Formats a timestamp into a human-readable relative time string.
 * @param {number} timestamp - Unix timestamp in milliseconds.
 * @returns {string} Relative time string (e.g., "5m ago").
 */
export function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Displays an animated toast notification.
 * @param {string} message - The message to display.
 * @param {'info'|'success'|'error'|'warning'} type - Toast variant.
 * @param {number} duration - How long to show the toast in ms.
 */
export function showToast(message, type = 'info', duration = TOAST_DEFAULT_DURATION) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Auto-remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Parses a time string in timer format to Go nanoseconds.
 * Supported formats: M:SS, M:SS.CS, H:MM:SS, H:MM:SS.CS
 * @param {string} input - The time string to parse.
 * @returns {number|null} Duration in nanoseconds, or null if invalid.
 */
export function parseTimeInput(input) {
    if (!input || input.trim() === '') return 0;

    const trimmed = input.trim();
    const timeRegex = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/;
    const match = trimmed.match(timeRegex);

    if (!match) {
        return null;
    }

    let hours = 0, minutes = 0, seconds = 0, centiseconds = 0;

    if (match[1] !== undefined) {
        hours = parseInt(match[1]) || 0;
        minutes = parseInt(match[2]) || 0;
        seconds = parseInt(match[3]) || 0;
        centiseconds = match[4] ? parseInt(match[4]) || 0 : 0;
    } else {
        minutes = parseInt(match[2]) || 0;
        seconds = parseInt(match[3]) || 0;
        centiseconds = match[4] ? parseInt(match[4]) || 0 : 0;
    }

    if (minutes >= 60 || seconds >= 60 || centiseconds >= 100) {
        return null;
    }

    const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10;
    return totalMs * 1000000; // Convert milliseconds to nanoseconds
}

/**
 * Formats nanoseconds to a timer-friendly input string.
 * @param {number} durationNs - Duration in nanoseconds.
 * @returns {string} Formatted time string.
 */
export function formatTimeForInput(durationNs) {
    if (!durationNs || durationNs === 0) return '';

    const totalSeconds = Math.floor(durationNs / 1000000000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((durationNs % 1000000000) / 10000000);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
}
