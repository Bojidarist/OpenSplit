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
    display.textContent = time;
    display.className = 'timer ' + (state.status === 'paused' ? 'paused' : '');

    // Sync predefined splits and title from server
    if (state.predefinedSplits && Array.isArray(state.predefinedSplits)) {
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
    } else {
        setPredefinedSplits([]);
    }

    setTimerTitle(state.timerTitle || DEFAULT_TITLE);
    document.getElementById('game-title').textContent = state.timerTitle || DEFAULT_TITLE;
    updatePredefinedList();

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
        splitDisplay.textContent = `${predefinedSplits[state.currentSplitIndex].name}`;

        const currentSplit = predefinedSplits[state.currentSplitIndex];
        if (currentSplit.notes && currentSplit.notes.trim()) {
            notesText.textContent = currentSplit.notes;
            notesDisplay.classList.add('show');
        } else {
            notesDisplay.classList.remove('show');
        }
    } else {
        if (predefinedSplits.length > 0) {
            splitDisplay.textContent = 'Ready to start';
        } else {
            splitDisplay.textContent = 'No splits defined';
        }
        notesDisplay.classList.remove('show');
    }

    // Update previous segment display
    const prevSegmentDisplay = document.getElementById('previous-segment');
    if (state.splits && state.splits.length > 0) {
        const lastSplit = state.splits[state.splits.length - 1];
        prevSegmentDisplay.textContent = `Previous Segment: ${formatTime(lastSplit.segmentTime)}`;
    } else {
        prevSegmentDisplay.textContent = 'Previous Segment: --';
    }

    // Update PB, SoB, and WR displays
    const pbDisplay = document.getElementById('pb-time');
    const sobDisplay = document.getElementById('sob-time');
    const wrDisplay = document.getElementById('wr-time');

    pbDisplay.textContent = (state.personalBest && state.personalBest > 0) ? formatTime(state.personalBest) : '--';
    sobDisplay.textContent = (state.sumOfBest && state.sumOfBest > 0) ? formatTime(state.sumOfBest) : '--';
    wrDisplay.textContent = (state.worldRecord && state.worldRecord > 0) ? formatTime(state.worldRecord) : '--';

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
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resetBtn.style.display = 'inline-block';
    } else if (atStartingPosition) {
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        resetBtn.style.display = 'none';
    } else if (state.status === 'stopped') {
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        resetBtn.style.display = 'inline-block';
    } else {
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        resetBtn.style.display = 'inline-block';
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
