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
 * Renders split rows in the timer view.
 * @param {Object} state - The timer state from the server.
 */
export function updateSplits(state) {
    const list = document.getElementById('splits-body');
    list.innerHTML = '';
    const splits = state.splits || [];
    const statePredefinedSplits = state.predefinedSplits || [];
    const currentSplitIndex = state.currentSplitIndex;
    const pbSplitTimes = state.pbSplitTimes || [];

    if (statePredefinedSplits && statePredefinedSplits.length > 0) {
        statePredefinedSplits.forEach((splitDef, index) => {
            const row = document.createElement('div');
            row.className = 'split-row';

            // Add highlighting classes
            if (currentSplitIndex === -1 && splits.length > 0) {
                row.classList.add('completed');
            } else if (index < currentSplitIndex) {
                row.classList.add('completed');
            } else if (index === currentSplitIndex && state.status === 'running') {
                row.classList.add('current');
            }

            // Convert old format to new format if needed
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

            // Icon (emoji or image)
            const iconSpan = document.createElement('span');
            iconSpan.className = 'split-icon';
            if (icon && icon.startsWith('data:image')) {
                const img = document.createElement('img');
                img.src = icon;
                img.alt = 'icon';
                iconSpan.innerHTML = '';
                iconSpan.appendChild(img);
            } else {
                iconSpan.textContent = icon;
            }

            // Split name
            const nameDiv = document.createElement('div');
            nameDiv.className = 'split-name';
            nameDiv.textContent = name;

            // Delta
            const deltaDiv = document.createElement('div');
            deltaDiv.className = 'split-delta';
            if (index < splits.length && splits[index].delta !== undefined) {
                const delta = splits[index].delta;
                if (delta !== 0) {
                    deltaDiv.textContent = formatDelta(delta);
                    deltaDiv.classList.add(delta < 0 ? 'ahead' : 'behind');
                } else {
                    deltaDiv.textContent = '--';
                }
            } else {
                deltaDiv.textContent = '--';
            }

            // Cumulative time
            const cumulativeDiv = document.createElement('div');
            cumulativeDiv.className = 'split-time';
            if (index < splits.length) {
                cumulativeDiv.textContent = formatTime(splits[index].cumulativeTime);
            } else {
                cumulativeDiv.textContent = '--';
            }

            // PB time
            const pbDiv = document.createElement('div');
            pbDiv.className = 'split-pb-time';
            if (index < pbSplitTimes.length && pbSplitTimes[index] > 0) {
                pbDiv.textContent = formatTime(pbSplitTimes[index]);
            } else {
                pbDiv.textContent = '--';
            }

            row.appendChild(iconSpan);
            row.appendChild(nameDiv);
            row.appendChild(deltaDiv);
            row.appendChild(cumulativeDiv);
            row.appendChild(pbDiv);
            list.appendChild(row);
        });
    } else {
        // Fallback: render from completed splits array
        splits.forEach((split, index) => {
            const row = document.createElement('div');
            row.className = 'split-row';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'split-icon';
            iconSpan.textContent = DEFAULT_ICON;

            const nameDiv = document.createElement('div');
            nameDiv.className = 'split-name';
            nameDiv.textContent = split.name;

            const deltaDiv = document.createElement('div');
            deltaDiv.className = 'split-delta';
            if (split.delta !== undefined && split.delta !== 0) {
                deltaDiv.textContent = formatDelta(split.delta);
                deltaDiv.classList.add(split.delta < 0 ? 'ahead' : 'behind');
            } else {
                deltaDiv.textContent = '--';
            }

            const cumulativeDiv = document.createElement('div');
            cumulativeDiv.className = 'split-time';
            cumulativeDiv.textContent = formatTime(split.cumulativeTime);

            const pbDiv = document.createElement('div');
            pbDiv.className = 'split-pb-time';
            if (index < pbSplitTimes.length && pbSplitTimes[index] > 0) {
                pbDiv.textContent = formatTime(pbSplitTimes[index]);
            } else {
                pbDiv.textContent = '--';
            }

            row.appendChild(iconSpan);
            row.appendChild(nameDiv);
            row.appendChild(deltaDiv);
            row.appendChild(cumulativeDiv);
            row.appendChild(pbDiv);
            list.appendChild(row);
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
