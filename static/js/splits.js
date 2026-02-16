/**
 * Split rendering for the timer view and the splits management modal.
 */

import { DEFAULT_ICON } from './config.js';
import { predefinedSplits, timerTitle, markAsModified } from './state.js';
import { sendCommand } from './websocket.js';
import {
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleDragLeave,
} from './dragdrop.js';

/**
 * Formats a Go nanosecond duration to display format.
 * Shows M:SS.CC for sub-hour, H:MM:SS for hour+.
 * @param {number} durationNs - Duration in nanoseconds.
 * @returns {string} Formatted time string.
 */
export function formatTime(durationNs) {
    const totalSeconds = Math.floor(durationNs / 1000000000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((durationNs % 1000000000) / 1000000);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0').substring(0, 2)}`;
    }
}

/**
 * Formats a delta duration with +/- sign.
 * @param {number} durationNs - Delta in nanoseconds.
 * @returns {string} Formatted delta string.
 */
export function formatDelta(durationNs) {
    const sign = durationNs >= 0 ? '+' : '-';
    const absDuration = Math.abs(durationNs);
    const totalSeconds = Math.floor(absDuration / 1000000000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((absDuration % 1000000000) / 1000000);

    if (minutes > 0) {
        return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0').substring(0, 2)}`;
    } else {
        return `${sign}${seconds}.${milliseconds.toString().padStart(3, '0').substring(0, 2)}`;
    }
}

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
 * Helper to set className only when it has changed.
 * @param {HTMLElement} el - The element to update.
 * @param {string} cls - The desired className.
 */
function setClassIfChanged(el, cls) {
    if (el.className !== cls) {
        el.className = cls;
    }
}

/**
 * Creates a new split row DOM element with the expected child structure.
 * @returns {HTMLElement} A div.split-row with icon, name, delta, time, and pb children.
 */
function createSplitRow() {
    const row = document.createElement('div');
    row.className = 'split-row';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'split-icon';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'split-name';

    const deltaDiv = document.createElement('div');
    deltaDiv.className = 'split-delta';

    const cumulativeDiv = document.createElement('div');
    cumulativeDiv.className = 'split-time';

    const pbDiv = document.createElement('div');
    pbDiv.className = 'split-pb-time';

    row.appendChild(iconSpan);
    row.appendChild(nameDiv);
    row.appendChild(deltaDiv);
    row.appendChild(cumulativeDiv);
    row.appendChild(pbDiv);
    return row;
}

/**
 * Updates the icon span to display the given icon (emoji text or base64 image).
 * Only modifies the DOM if the icon has actually changed.
 * @param {HTMLElement} iconSpan - The .split-icon element.
 * @param {string} icon - Emoji text or a data:image URI.
 */
function updateIcon(iconSpan, icon) {
    if (icon && icon.startsWith('data:image')) {
        const existingImg = iconSpan.querySelector('img');
        if (existingImg) {
            if (existingImg.src !== icon) {
                existingImg.src = icon;
            }
        } else {
            iconSpan.textContent = '';
            const img = document.createElement('img');
            img.src = icon;
            img.alt = 'icon';
            iconSpan.appendChild(img);
        }
    } else {
        setTextIfChanged(iconSpan, icon);
    }
}

/**
 * Renders split rows in the timer view.
 * Uses DOM diffing: reuses existing row elements and only updates
 * changed properties to avoid flickering and layout thrashing.
 * @param {Object} state - The timer state from the server.
 */
export function updateSplits(state) {
    const list = document.getElementById('splits-body');
    const splits = state.splits || [];
    const statePredefinedSplits = state.predefinedSplits || [];
    const currentSplitIndex = state.currentSplitIndex;
    const pbSplitTimes = state.pbSplitTimes || [];

    // Determine the data source and row count
    const usePredefined = statePredefinedSplits && statePredefinedSplits.length > 0;
    const rowCount = usePredefined ? statePredefinedSplits.length : splits.length;

    // Adjust DOM row count: add or remove rows as needed
    const existingRows = list.children;
    while (existingRows.length > rowCount) {
        list.removeChild(list.lastChild);
    }
    while (existingRows.length < rowCount) {
        list.appendChild(createSplitRow());
    }

    if (usePredefined) {
        statePredefinedSplits.forEach((splitDef, index) => {
            const row = existingRows[index];

            // Compute desired className
            let rowClass = 'split-row';
            if (currentSplitIndex === -1 && splits.length > 0) {
                rowClass += ' completed';
            } else if (index < currentSplitIndex) {
                rowClass += ' completed';
            } else if (index === currentSplitIndex && state.status === 'running') {
                rowClass += ' current';
            }
            setClassIfChanged(row, rowClass);

            // Resolve name and icon from split definition
            let name, icon;
            if (typeof splitDef === 'string') {
                name = splitDef;
                icon = DEFAULT_ICON;
            } else if (splitDef && typeof splitDef === 'object') {
                name = splitDef.name || 'Unnamed';
                icon = splitDef.icon || DEFAULT_ICON;
            } else {
                name = 'Unnamed';
                icon = DEFAULT_ICON;
            }

            // Update children: icon, name, delta, cumulative time, PB
            const iconSpan = row.children[0];
            const nameDiv = row.children[1];
            const deltaDiv = row.children[2];
            const cumulativeDiv = row.children[3];
            const pbDiv = row.children[4];

            updateIcon(iconSpan, icon);
            setTextIfChanged(nameDiv, name);

            // Delta
            let deltaText = '--';
            let deltaClass = 'split-delta';
            if (index < splits.length && splits[index].delta !== undefined) {
                const delta = splits[index].delta;
                if (delta !== 0) {
                    deltaText = formatDelta(delta);
                    deltaClass += delta < 0 ? ' ahead' : ' behind';
                }
            }
            setTextIfChanged(deltaDiv, deltaText);
            setClassIfChanged(deltaDiv, deltaClass);

            // Cumulative time
            const cumText = index < splits.length ? formatTime(splits[index].cumulativeTime) : '--';
            setTextIfChanged(cumulativeDiv, cumText);

            // PB time
            const pbText = (index < pbSplitTimes.length && pbSplitTimes[index] > 0) ? formatTime(pbSplitTimes[index]) : '--';
            setTextIfChanged(pbDiv, pbText);
        });
    } else {
        // Fallback: render from completed splits array
        splits.forEach((split, index) => {
            const row = existingRows[index];
            setClassIfChanged(row, 'split-row');

            const iconSpan = row.children[0];
            const nameDiv = row.children[1];
            const deltaDiv = row.children[2];
            const cumulativeDiv = row.children[3];
            const pbDiv = row.children[4];

            updateIcon(iconSpan, DEFAULT_ICON);
            setTextIfChanged(nameDiv, split.name);

            // Delta
            let deltaText = '--';
            let deltaClass = 'split-delta';
            if (split.delta !== undefined && split.delta !== 0) {
                deltaText = formatDelta(split.delta);
                deltaClass += split.delta < 0 ? ' ahead' : ' behind';
            }
            setTextIfChanged(deltaDiv, deltaText);
            setClassIfChanged(deltaDiv, deltaClass);

            setTextIfChanged(cumulativeDiv, formatTime(split.cumulativeTime));

            const pbText = (index < pbSplitTimes.length && pbSplitTimes[index] > 0) ? formatTime(pbSplitTimes[index]) : '--';
            setTextIfChanged(pbDiv, pbText);
        });
    }
}

/**
 * Renders the predefined splits list in the management modal.
 * Includes drag-and-drop handles and edit/delete buttons.
 */
export function updatePredefinedList() {
    const list = document.getElementById('predefined-list');
    list.innerHTML = '';

    predefinedSplits.forEach((splitDef, index) => {
        const item = document.createElement('div');
        item.className = 'split-item';
        item.draggable = true;
        item.dataset.index = index;

        const content = document.createElement('div');
        content.className = 'split-item-content';

        // Icon display
        const iconDiv = document.createElement('div');
        iconDiv.className = 'split-item-icon';
        if (splitDef.icon && splitDef.icon.startsWith('data:image')) {
            const img = document.createElement('img');
            img.src = splitDef.icon;
            img.alt = 'icon';
            iconDiv.appendChild(img);
        } else {
            iconDiv.textContent = splitDef.icon || DEFAULT_ICON;
        }

        const textSpan = document.createElement('span');
        textSpan.textContent = `${index + 1}. ${splitDef.name}`;

        // Add notes indicator if split has notes
        if (splitDef.notes && splitDef.notes.trim()) {
            const noteIndicator = document.createElement('span');
            noteIndicator.className = 'split-item-note-indicator';
            noteIndicator.textContent = '\uD83D\uDCDD'; // 📝
            noteIndicator.title = 'This split has notes';
            textSpan.appendChild(noteIndicator);
        }

        content.appendChild(iconDiv);
        content.appendChild(textSpan);

        const actions = document.createElement('div');
        actions.className = 'split-item-actions';

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'edit-btn';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            // Import dynamically to avoid circular dependency
            import('./modals.js').then(({ openEditModal }) => {
                openEditModal(index);
            });
        };

        // Delete button
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Delete';
        removeBtn.className = 'delete-btn';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            predefinedSplits.splice(index, 1);
            sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
            markAsModified('split_deleted');
        };

        // Drag event handlers
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragleave', handleDragLeave);

        actions.appendChild(editBtn);
        actions.appendChild(removeBtn);
        item.appendChild(content);
        item.appendChild(actions);
        list.appendChild(item);
    });
}
