/**
 * Timer display updates — the main UI update orchestrator.
 */

import { DEFAULT_VISIBLE_SPLITS, DEFAULT_ICON, DEFAULT_TITLE, SPLIT_ROW_HEIGHT } from './config.js';
import {
    predefinedSplits,
    currentTimerState,
    hasReceivedInitialState,
    setPredefinedSplits,
    setTimerTitle,
    setCurrentTimerState,
    setHasReceivedInitialState,
    markAsModified,
    updateSaveIndicator,
} from './state.js';
import { formatTime, updateSplits, updatePredefinedList } from './splits.js';
import { showToast } from './utils.js';
import { checkForAutoSavedData } from './modals.js';

/** Tracks the last predefined splits JSON to detect changes. */
let lastPredefinedSplitsJSON = '';

/** Tracks the last timer title to detect changes. */
let lastTimerTitle = '';

/**
 * Helper to set textContent only when it has changed.
 * @param {HTMLElement} el - The element to update.
 * @param {string} text - The desired text content.
 */
function setTextIfChanged(el, text) {
    if (el.textContent !== text) {
        el.textContent = text;
    }
}

/**
 * Helper to set an element's style.display only when it has changed.
 * @param {HTMLElement} el - The element to update.
 * @param {string} value - The desired display value.
 */
function setDisplayIfChanged(el, value) {
    if (el.style.display !== value) {
        el.style.display = value;
    }
}

/**
 * Main UI update function — called on every WebSocket message.
 * Updates all display elements to reflect the current server state.
 * @param {Object} state - The timer state from the server.
 */
export function updateTimer(state) {
    const previousPB = currentTimerState?.personalBest || 0;

    setCurrentTimerState(state);

    // Check if PB was achieved
    if (state.personalBest && state.personalBest > 0 && state.personalBest !== previousPB && previousPB !== 0) {
        markAsModified('personal_best_achieved');
        showToast('\uD83C\uDF89 New Personal Best! Consider exporting your splits.', 'success', 5000);
    }

    const time = formatTime(state.currentTime);
    const display = document.getElementById('timer-display');
    setTextIfChanged(display, time);
    const timerClass = 'timer ' + (state.status === 'paused' ? 'paused' : '');
    if (display.className !== timerClass) {
        display.className = timerClass;
    }

    // Sync predefined splits and title from server — only update when changed
    let predefinedSplitsChanged = false;
    if (state.predefinedSplits && Array.isArray(state.predefinedSplits)) {
        const newJSON = JSON.stringify(state.predefinedSplits);
        if (newJSON !== lastPredefinedSplitsJSON) {
            lastPredefinedSplitsJSON = newJSON;
            predefinedSplitsChanged = true;
            setPredefinedSplits(state.predefinedSplits.map(split => {
                if (typeof split === 'string') {
                    return { name: split, icon: DEFAULT_ICON, notes: '' };
                } else if (split && typeof split === 'object') {
                    return {
                        name: split.name || 'Unnamed',
                        icon: split.icon || DEFAULT_ICON,
                        notes: split.notes || '',
                    };
                }
                return { name: 'Unnamed', icon: DEFAULT_ICON, notes: '' };
            }));
        }
    } else {
        if (lastPredefinedSplitsJSON !== '[]') {
            lastPredefinedSplitsJSON = '[]';
            predefinedSplitsChanged = true;
            setPredefinedSplits([]);
        }
    }

    const newTitle = state.timerTitle || DEFAULT_TITLE;
    if (newTitle !== lastTimerTitle) {
        lastTimerTitle = newTitle;
        setTimerTitle(newTitle);
        document.getElementById('game-title').textContent = newTitle;
    }

    // Only rebuild predefined list when the splits actually changed
    if (predefinedSplitsChanged) {
        updatePredefinedList();
    }

    // Check for auto-saved data after receiving initial state
    if (!hasReceivedInitialState) {
        setHasReceivedInitialState(true);
        setTimeout(() => {
            checkForAutoSavedData();
            updateSaveIndicator();
        }, 50);
    }

    // Update current split display
    const splitDisplay = document.getElementById('current-split-display');
    const notesDisplay = document.getElementById('split-notes-display');
    const notesText = notesDisplay.querySelector('.notes-text');

    if (predefinedSplits.length > 0 && state.currentSplitIndex >= 0 && state.currentSplitIndex < predefinedSplits.length) {
        setTextIfChanged(splitDisplay, predefinedSplits[state.currentSplitIndex].name);

        const currentSplit = predefinedSplits[state.currentSplitIndex];
        if (currentSplit.notes && currentSplit.notes.trim()) {
            setTextIfChanged(notesText, currentSplit.notes);
            notesDisplay.classList.add('show');
        } else {
            notesDisplay.classList.remove('show');
        }
    } else {
        if (predefinedSplits.length > 0) {
            setTextIfChanged(splitDisplay, 'Ready to start');
        } else {
            setTextIfChanged(splitDisplay, 'No splits defined');
        }
        notesDisplay.classList.remove('show');
    }

    // Update previous segment display
    const prevSegmentDisplay = document.getElementById('previous-segment');
    if (state.splits && state.splits.length > 0) {
        const lastSplit = state.splits[state.splits.length - 1];
        setTextIfChanged(prevSegmentDisplay, `Previous Segment: ${formatTime(lastSplit.segmentTime)}`);
    } else {
        setTextIfChanged(prevSegmentDisplay, 'Previous Segment: --');
    }

    // Update PB, SoB, and WR displays
    const pbDisplay = document.getElementById('pb-time');
    const sobDisplay = document.getElementById('sob-time');
    const wrDisplay = document.getElementById('wr-time');

    const pbText = (state.personalBest && state.personalBest > 0) ? formatTime(state.personalBest) : '--';
    const sobText = (state.sumOfBest && state.sumOfBest > 0) ? formatTime(state.sumOfBest) : '--';
    const wrText = (state.worldRecord && state.worldRecord > 0) ? formatTime(state.worldRecord) : '--';
    setTextIfChanged(pbDisplay, pbText);
    setTextIfChanged(sobDisplay, sobText);
    setTextIfChanged(wrDisplay, wrText);

    // Show/hide next split button
    const nextBtn = document.getElementById('next-split-btn');
    if (state.status === 'running' && predefinedSplits.length > 0) {
        nextBtn.classList.remove('hidden');
    } else {
        nextBtn.classList.add('hidden');
    }

    // Determine run state
    const runCompleted = state.status === 'stopped' && state.currentSplitIndex === -1 && state.splits && state.splits.length > 0;
    const atStartingPosition = state.status === 'stopped' && (!state.splits || state.splits.length === 0);

    // Show/hide buttons based on status
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');

    if (runCompleted) {
        setDisplayIfChanged(startBtn, 'none');
        setDisplayIfChanged(pauseBtn, 'none');
        setDisplayIfChanged(resetBtn, 'inline-block');
    } else if (atStartingPosition) {
        setDisplayIfChanged(startBtn, 'inline-block');
        setDisplayIfChanged(pauseBtn, 'none');
        setDisplayIfChanged(resetBtn, 'none');
    } else if (state.status === 'stopped') {
        setDisplayIfChanged(startBtn, 'inline-block');
        setDisplayIfChanged(pauseBtn, 'none');
        setDisplayIfChanged(resetBtn, 'inline-block');
    } else {
        setDisplayIfChanged(startBtn, 'none');
        setDisplayIfChanged(pauseBtn, 'inline-block');
        setDisplayIfChanged(resetBtn, 'inline-block');
    }

    updateSplits(state);

    // Auto-scroll to keep current split visible
    const splitsContainer = document.querySelector('.splits-container');
    if (predefinedSplits.length > 0 && state.currentSplitIndex >= 0) {
        splitsContainer.scrollTop = Math.max(0, (state.currentSplitIndex - DEFAULT_VISIBLE_SPLITS + 1) * SPLIT_ROW_HEIGHT);
    } else if (state.status === 'stopped' && state.currentSplitIndex < 0) {
        splitsContainer.scrollTop = 0;
    }
}
