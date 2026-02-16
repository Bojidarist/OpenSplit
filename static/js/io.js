/**
 * Import and export functionality for splits data.
 */

import { DEFAULT_ICON, DEFAULT_TITLE, DATA_VERSION, STORAGE_KEYS } from './config.js';
import {
    predefinedSplits,
    timerTitle,
    containerWidth,
    currentTimerState,
    markAsModified,
    markAsSaved,
    dirtyState,
    setPredefinedSplits,
    setTimerTitle,
    setContainerWidth,
} from './state.js';
import { sendCommand } from './websocket.js';
import { showToast, formatTimeForInput } from './utils.js';

/**
 * Exports splits + PB data to a downloadable JSON file.
 */
export function exportSplits() {
    if (!currentTimerState) {
        showToast('No timer state available to export', 'warning');
        return;
    }

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
    const safeTitle = (timerTitle || 'splits').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeTitle}_${timestamp}.json`;

    const exportData = {
        version: DATA_VERSION,
        exportedAt: now.toISOString(),
        title: timerTitle,
        splits: predefinedSplits,
        containerWidth: containerWidth,
        bestSplitTimes: currentTimerState?.bestSplitTimes || [],
        bestCumulativeTimes: currentTimerState?.bestCumulativeTimes || [],
        personalBest: currentTimerState?.personalBest || 0,
        sumOfBest: currentTimerState?.sumOfBest || 0,
        pbSplitTimes: currentTimerState?.pbSplitTimes || [],
        worldRecord: currentTimerState?.worldRecord || 0,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', filename);
    linkElement.click();

    markAsSaved();
    showToast(`\u2705 Splits exported: ${filename}`, 'success');
    console.log(`Exported ${predefinedSplits.length} splits to ${filename}`);
}

/**
 * Handles the import of splits from a JSON file.
 * @param {File} file - The file to import.
 * @param {HTMLElement} container - The main container element.
 * @param {HTMLElement} splitsModal - The splits modal element.
 */
export function importSplitsFromFile(file, container, splitsModal) {
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const text = e.target.result.trim().replace(/^\ufeff/, '');
            if (!text.startsWith('{') && !text.startsWith('[')) {
                alert('Invalid file format: expected JSON object or array');
                return;
            }
            const imported = JSON.parse(text);

            if (Array.isArray(imported)) {
                // Old format: array of strings or objects
                setPredefinedSplits(imported.map(name => ({
                    name: typeof name === 'string' ? name : name.name || '',
                    icon: typeof name === 'object' ? (name.icon || DEFAULT_ICON) : DEFAULT_ICON,
                    notes: typeof name === 'object' ? (name.notes || '') : '',
                })));
                setTimerTitle(DEFAULT_TITLE);
            } else if (imported.splits && Array.isArray(imported.splits)) {
                // New format: object with title and splits
                setTimerTitle(imported.title || DEFAULT_TITLE);
                setPredefinedSplits(imported.splits.map(split => ({
                    name: split.name || '',
                    icon: split.icon || DEFAULT_ICON,
                    notes: split.notes || '',
                })));
                if (imported.containerWidth) {
                    setContainerWidth(imported.containerWidth);
                    container.style.width = imported.containerWidth + 'px';
                    if (splitsModal.style.display === 'block') {
                        document.getElementById('container-width').value = imported.containerWidth;
                    }
                }
            } else {
                alert('Invalid JSON format. Expected an array or an object with "splits" array.');
                return;
            }

            // Send splits first
            sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });

            // If PB data exists, send it separately
            if (imported.bestSplitTimes || imported.personalBest || imported.pbSplitTimes) {
                sendCommand('restorePBData', {
                    bestSplitTimes: imported.bestSplitTimes || [],
                    bestCumulativeTimes: imported.bestCumulativeTimes || [],
                    personalBest: imported.personalBest || 0,
                    sumOfBest: imported.sumOfBest || 0,
                    pbSplitTimes: imported.pbSplitTimes || [],
                    worldRecord: imported.worldRecord || 0,
                });
            }

            dirtyState.hasInteracted = true;
            dirtyState.skipRecoveryCheck = true;
            markAsModified('splits_imported');

            document.getElementById('timer-title').value = timerTitle;

            // Update world record input field if modal is open
            if (splitsModal.style.display === 'block') {
                if (imported.worldRecord && imported.worldRecord > 0) {
                    document.getElementById('world-record').value = formatTimeForInput(imported.worldRecord);
                } else {
                    document.getElementById('world-record').value = '';
                }
            }

            document.getElementById('import-splits-file').value = '';
        } catch (err) {
            alert('Error parsing JSON: ' + err.name + ' - ' + err.message);
        }
    };

    reader.onerror = (e) => {
        alert('File read error: ' + (e.target.error ? e.target.error.message : 'Unknown error'));
    };

    reader.readAsText(file);
}
