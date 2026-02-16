/**
 * Drag and drop reordering for the splits management list.
 */

import { predefinedSplits, timerTitle, markAsModified } from './state.js';
import { sendCommand } from './websocket.js';

/** The DOM element currently being dragged. */
let draggedItem = null;

/** The index of the item currently being dragged. */
let draggedIndex = null;

export function handleDragStart(e) {
    draggedItem = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

export function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    const targetItem = e.target.closest('.split-item');
    if (targetItem && targetItem !== draggedItem) {
        document.querySelectorAll('.split-item').forEach(item => {
            item.classList.remove('drag-over', 'drag-over-bottom');
        });

        const rect = targetItem.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (e.clientY < midpoint) {
            targetItem.classList.add('drag-over');
        } else {
            targetItem.classList.add('drag-over-bottom');
        }
    }

    return false;
}

export function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    const targetItem = e.target.closest('.split-item');
    if (targetItem && targetItem !== draggedItem) {
        const targetIndex = parseInt(targetItem.dataset.index);

        const rect = targetItem.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        let dropIndex = targetIndex;

        if (e.clientY >= midpoint) {
            dropIndex = targetIndex + 1;
        }

        // Reorder the array
        const draggedSplit = predefinedSplits[draggedIndex];
        predefinedSplits.splice(draggedIndex, 1);

        if (draggedIndex < dropIndex) {
            dropIndex--;
        }

        predefinedSplits.splice(dropIndex, 0, draggedSplit);

        sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
        markAsModified('splits_reordered');
    }

    return false;
}

export function handleDragEnd() {
    this.classList.remove('dragging');

    document.querySelectorAll('.split-item').forEach(item => {
        item.classList.remove('drag-over', 'drag-over-bottom');
    });

    draggedItem = null;
    draggedIndex = null;
}

export function handleDragLeave(e) {
    const targetItem = e.target.closest('.split-item');
    if (targetItem) {
        targetItem.classList.remove('drag-over', 'drag-over-bottom');
    }
}
