/**
 * Container resize handle logic.
 */

import { MIN_CONTAINER_WIDTH, MAX_CONTAINER_WIDTH, STORAGE_KEYS } from './config.js';
import { containerWidth, setContainerWidth } from './state.js';

let isResizing = false;
let currentHandle = null;
let startX = 0;
let startWidth = 0;

/**
 * Initializes resize handles and observers on the container element.
 * @param {HTMLElement} container - The main container element.
 */
export function initResize(container) {
    const leftHandle = container.querySelector('.resize-handle.left');
    const rightHandle = container.querySelector('.resize-handle.right');

    function startResize(e, handle) {
        isResizing = true;
        currentHandle = handle;
        startX = e.clientX;
        startWidth = container.offsetWidth;
        e.preventDefault();
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';
    }

    function doResize(e) {
        if (!isResizing) return;

        let newWidth;
        if (currentHandle === 'left') {
            const delta = e.clientX - startX;
            newWidth = startWidth - delta;
        } else {
            const delta = e.clientX - startX;
            newWidth = startWidth + delta;
        }

        newWidth = Math.max(MIN_CONTAINER_WIDTH, Math.min(MAX_CONTAINER_WIDTH, newWidth));
        container.style.width = newWidth + 'px';
        setContainerWidth(newWidth);
    }

    function stopResize() {
        if (isResizing) {
            isResizing = false;
            currentHandle = null;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
    }

    leftHandle.addEventListener('mousedown', (e) => startResize(e, 'left'));
    rightHandle.addEventListener('mousedown', (e) => startResize(e, 'right'));
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);

    // Observe container size changes
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            const newWidth = Math.round(entry.contentRect.width);
            if (newWidth !== containerWidth) {
                setContainerWidth(newWidth);
            }
        }
    });
    resizeObserver.observe(container);
}
