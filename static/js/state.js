/**
 * Centralized application state management.
 * All shared mutable state is stored here with getter/setter access.
 */

import {
    DEFAULT_SERVER_IP,
    DEFAULT_THEME,
    DEFAULT_TITLE,
    DEFAULT_ICON,
    DEFAULT_CONTAINER_WIDTH,
    STORAGE_KEYS,
    AUTO_SAVE_DEBOUNCE,
    MAX_AUTO_SAVE_BACKUPS,
    DATA_VERSION,
} from './config.js';
import { debounce, formatTimeAgo } from './utils.js';

// --- Mutable application state ---

/** WebSocket server address. */
export let serverIP = localStorage.getItem(STORAGE_KEYS.SERVER_IP) || DEFAULT_SERVER_IP;

/** Current theme ('dark' or 'light'). */
export let theme = localStorage.getItem(STORAGE_KEYS.THEME) || DEFAULT_THEME;

/** Array of split definitions synced from the server. */
export let predefinedSplits = [];

/** Current timer title. */
export let timerTitle = DEFAULT_TITLE;

/** Icon preview in the "add split" form. */
export let currentIconPreview = DEFAULT_ICON;

/** Icon preview in the "edit split" modal. */
export let editingIconPreview = DEFAULT_ICON;

/** Index of the split currently being edited, or -1. */
export let editingSplitIndex = -1;

/** Notes text during edit. */
export let editingNotes = '';

/** Current container width in pixels. */
export let containerWidth = parseInt(localStorage.getItem(STORAGE_KEYS.CONTAINER_WIDTH)) || DEFAULT_CONTAINER_WIDTH;

/** Latest timer state received from the server. */
export let currentTimerState = null;

/** Whether the initial state from the server has been received. */
export let hasReceivedInitialState = false;

// --- State setters ---

export function setServerIP(ip) {
    serverIP = ip;
    localStorage.setItem(STORAGE_KEYS.SERVER_IP, ip);
}

export function setTheme(newTheme) {
    theme = newTheme;
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
}

export function setPredefinedSplits(splits) {
    predefinedSplits = splits;
}

export function setTimerTitle(title) {
    timerTitle = title;
}

export function setCurrentIconPreview(icon) {
    currentIconPreview = icon;
}

export function setEditingIconPreview(icon) {
    editingIconPreview = icon;
}

export function setEditingSplitIndex(index) {
    editingSplitIndex = index;
}

export function setEditingNotes(notes) {
    editingNotes = notes;
}

export function setContainerWidth(width) {
    containerWidth = width;
    localStorage.setItem(STORAGE_KEYS.CONTAINER_WIDTH, width);
}

export function setCurrentTimerState(state) {
    currentTimerState = state;
}

export function setHasReceivedInitialState(val) {
    hasReceivedInitialState = val;
}

// --- Dirty state tracking ---

export const dirtyState = {
    hasUnsavedChanges: false,
    lastModifiedTime: null,
    lastExportTime: localStorage.getItem(STORAGE_KEYS.LAST_EXPORT_TIME)
        ? parseInt(localStorage.getItem(STORAGE_KEYS.LAST_EXPORT_TIME))
        : null,
    changeCount: 0,
    changeTypes: [],
    hasInteracted: false,
    skipRecoveryCheck: false,
};

/**
 * Update the save status indicator in the UI.
 */
export function updateSaveIndicator() {
    const indicator = document.getElementById('save-indicator');
    if (!indicator) return;

    if (!dirtyState.hasInteracted) {
        indicator.classList.remove('visible');
        return;
    }

    indicator.classList.add('visible');

    if (dirtyState.hasUnsavedChanges) {
        indicator.textContent = '\u26A0\uFE0F Unsaved';
        indicator.className = 'save-indicator visible unsaved';
        indicator.title = `${dirtyState.changeCount} unsaved change(s)`;
    } else if (dirtyState.lastExportTime) {
        const timeAgo = formatTimeAgo(dirtyState.lastExportTime);
        indicator.textContent = `\uD83D\uDCBE Saved ${timeAgo}`;
        indicator.className = 'save-indicator visible saved';
        indicator.title = `Last exported: ${new Date(dirtyState.lastExportTime).toLocaleString()}`;
    } else {
        indicator.textContent = '\uD83D\uDCBE Not saved';
        indicator.className = 'save-indicator visible saved';
        indicator.title = 'No exports yet';
    }
}

/**
 * Auto-save current state to localStorage as a backup.
 */
export function autoSaveToLocalStorage() {
    if (!currentTimerState) return;

    const backupData = {
        timestamp: Date.now(),
        version: DATA_VERSION,
        data: {
            title: timerTitle,
            splits: predefinedSplits,
            containerWidth: containerWidth,
            bestSplitTimes: currentTimerState?.bestSplitTimes || [],
            bestCumulativeTimes: currentTimerState?.bestCumulativeTimes || [],
            personalBest: currentTimerState?.personalBest || 0,
            sumOfBest: currentTimerState?.sumOfBest || 0,
            pbSplitTimes: currentTimerState?.pbSplitTimes || [],
            worldRecord: currentTimerState?.worldRecord || 0,
        },
    };

    try {
        const backups = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTO_SAVES) || '[]');
        backups.unshift(backupData);
        backups.splice(MAX_AUTO_SAVE_BACKUPS);
        localStorage.setItem(STORAGE_KEYS.AUTO_SAVES, JSON.stringify(backups));
        console.log('Auto-saved to localStorage');
    } catch (e) {
        console.error('Auto-save failed:', e);
        if (e.name === 'QuotaExceededError') {
            try {
                localStorage.setItem(STORAGE_KEYS.AUTO_SAVES, JSON.stringify([backupData]));
            } catch (e2) {
                console.error('Auto-save failed even after clearing:', e2);
            }
        }
    }
}

/** Debounced auto-save function. */
export const debouncedAutoSave = debounce(autoSaveToLocalStorage, AUTO_SAVE_DEBOUNCE);

/**
 * Mark data as modified (unsaved changes exist).
 * @param {string} changeType - A label for what changed.
 */
export function markAsModified(changeType) {
    dirtyState.hasUnsavedChanges = true;
    dirtyState.lastModifiedTime = Date.now();
    dirtyState.changeCount++;
    dirtyState.hasInteracted = true;
    if (changeType) {
        dirtyState.changeTypes.push(changeType);
    }
    updateSaveIndicator();
    debouncedAutoSave();
}

/**
 * Mark data as saved (no unsaved changes).
 */
export function markAsSaved() {
    dirtyState.hasUnsavedChanges = false;
    dirtyState.lastExportTime = Date.now();
    dirtyState.changeCount = 0;
    dirtyState.changeTypes = [];
    dirtyState.hasInteracted = true;
    localStorage.setItem(STORAGE_KEYS.LAST_EXPORT_TIME, dirtyState.lastExportTime.toString());
    updateSaveIndicator();
}
