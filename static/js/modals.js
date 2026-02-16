/**
 * Modal management — settings, splits, edit split, and recovery modals.
 * Also handles theme switching and keyboard shortcuts.
 */

import {
    DEFAULT_ICON,
    DEFAULT_TITLE,
    MIN_CONTAINER_WIDTH,
    MAX_CONTAINER_WIDTH,
    STORAGE_KEYS,
    MAX_AUTO_SAVE_AGE_MINUTES,
    RECENTLY_SAVED_THRESHOLD,
} from './config.js';
import {
    serverIP,
    theme,
    predefinedSplits,
    timerTitle,
    containerWidth,
    currentTimerState,
    currentIconPreview,
    editingIconPreview,
    editingSplitIndex,
    editingNotes,
    dirtyState,
    setServerIP,
    setTheme,
    setPredefinedSplits,
    setTimerTitle,
    setContainerWidth,
    setCurrentIconPreview,
    setEditingIconPreview,
    setEditingSplitIndex,
    setEditingNotes,
    markAsModified,
} from './state.js';
import { sendCommand, reconnectWS } from './websocket.js';
import { showToast, formatTimeAgo, parseTimeInput, formatTimeForInput } from './utils.js';
import { exportSplits, importSplitsFromFile } from './io.js';

// --- Theme ---

/**
 * Applies the current theme to the document.
 */
export function applyTheme() {
    document.body.classList.remove('dark', 'light');

    if (theme === 'light') {
        document.body.classList.add('light');
        document.getElementById('theme-toggle-btn').textContent = '\uD83C\uDF19'; // 🌙
    } else {
        document.body.classList.add('dark');
        document.getElementById('theme-toggle-btn').textContent = '\u2600\uFE0F'; // ☀️
    }
}

// --- Keyboard Shortcuts ---

/**
 * Initializes global keyboard shortcuts.
 */
export function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const activeElement = document.activeElement;
        const isInputField = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA'
        );

        // Ctrl+S / Cmd+S - Export splits
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            exportSplits();
            return false;
        }
    });
}

// --- Recovery ---

/**
 * Checks for auto-saved data from a previous session and shows recovery dialog if appropriate.
 */
export function checkForAutoSavedData() {
    try {
        if (dirtyState.skipRecoveryCheck) {
            return;
        }

        const backups = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTO_SAVES) || '[]');
        if (backups.length === 0) return;

        const latestBackup = backups[0];
        const ageMinutes = (Date.now() - latestBackup.timestamp) / 1000 / 60;

        const dismissedTimestamp = localStorage.getItem(STORAGE_KEYS.DISMISSED_RECOVERY);
        if (dismissedTimestamp && parseInt(dismissedTimestamp) === latestBackup.timestamp) {
            return;
        }

        const isNewSession = !sessionStorage.getItem(STORAGE_KEYS.SESSION_ACTIVE);
        if (isNewSession) {
            sessionStorage.setItem(STORAGE_KEYS.SESSION_ACTIVE, 'true');
        }

        const recentlySaved = dirtyState.lastExportTime && (Date.now() - dirtyState.lastExportTime) < RECENTLY_SAVED_THRESHOLD;

        const backupHasData = latestBackup.data.splits && latestBackup.data.splits.length > 0;
        const backupHasProgress = latestBackup.data.personalBest > 0 ||
            (latestBackup.data.bestSplitTimes && latestBackup.data.bestSplitTimes.length > 0);

        const ageCheck = isNewSession || ageMinutes > 1;

        if (ageMinutes < MAX_AUTO_SAVE_AGE_MINUTES && !recentlySaved && (backupHasData || backupHasProgress) && ageCheck) {
            showRecoveryModal(latestBackup);
        }
    } catch (e) {
        console.error('Error checking for auto-saved data:', e);
    }
}

/**
 * Shows the recovery modal with backup details.
 * @param {Object} backup - The backup data object.
 */
function showRecoveryModal(backup) {
    const modal = document.getElementById('recovery-modal');
    const message = document.getElementById('recovery-message');
    const title = document.getElementById('recovery-title');
    const splitsCount = document.getElementById('recovery-splits-count');
    const timeAgo = document.getElementById('recovery-time-ago');

    const timeAgoStr = formatTimeAgo(backup.timestamp);
    const dateStr = new Date(backup.timestamp).toLocaleString();

    message.textContent = 'We found auto-saved splits from a previous session. Would you like to recover them?';
    title.textContent = backup.data.title || DEFAULT_TITLE;
    splitsCount.textContent = backup.data.splits.length;
    timeAgo.textContent = `${timeAgoStr} (${dateStr})`;

    modal.style.display = 'block';
    modal.dataset.backupTimestamp = backup.timestamp;
}

/**
 * Restores application state from a backup.
 * @param {Object} data - The backup data to restore.
 * @param {HTMLElement} container - The main container element.
 */
export function restoreFromBackup(data, container) {
    setTimerTitle(data.title || DEFAULT_TITLE);
    setPredefinedSplits(data.splits || []);
    if (data.containerWidth) {
        setContainerWidth(data.containerWidth);
    }

    container.style.width = containerWidth + 'px';

    sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });

    if (data.bestSplitTimes || data.personalBest || data.pbSplitTimes) {
        sendCommand('restorePBData', {
            bestSplitTimes: data.bestSplitTimes || [],
            bestCumulativeTimes: data.bestCumulativeTimes || [],
            personalBest: data.personalBest || 0,
            sumOfBest: data.sumOfBest || 0,
            pbSplitTimes: data.pbSplitTimes || [],
            worldRecord: data.worldRecord || 0,
        });
    }

    dirtyState.hasInteracted = true;
    dirtyState.skipRecoveryCheck = true;
    markAsModified('restored_from_backup');
}

// --- Edit Split Modal ---

/**
 * Opens the edit modal for a specific split.
 * @param {number} index - The index of the split to edit.
 */
export function openEditModal(index) {
    setEditingSplitIndex(index);
    const split = predefinedSplits[index];

    document.getElementById('edit-split-name').value = split.name;
    setEditingIconPreview(split.icon);
    setEditingNotes(split.notes || '');

    document.getElementById('edit-split-notes').value = editingNotes;
    updateCharacterCount();

    const preview = document.getElementById('edit-icon-preview');
    if (split.icon && split.icon.startsWith('data:image')) {
        preview.innerHTML = `<img src="${split.icon}" alt="icon" style="width: 100%; height: 100%; object-fit: contain;">`;
    } else {
        preview.textContent = split.icon || DEFAULT_ICON;
    }

    document.getElementById('edit-split-icon').value = '';
    document.getElementById('edit-split-modal').style.display = 'block';
}

/**
 * Closes the edit split modal and resets editing state.
 */
export function closeEditModal() {
    document.getElementById('edit-split-modal').style.display = 'none';
    setEditingSplitIndex(-1);
    setEditingIconPreview(DEFAULT_ICON);
    setEditingNotes('');
}

/**
 * Saves the currently edited split.
 */
function saveEditedSplit() {
    if (editingSplitIndex === -1) return;

    const name = document.getElementById('edit-split-name').value.trim();
    if (!name) {
        alert('Split name cannot be empty');
        return;
    }

    const notes = document.getElementById('edit-split-notes').value;

    predefinedSplits[editingSplitIndex] = {
        name: name,
        icon: editingIconPreview,
        notes: notes,
    };

    sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
    markAsModified('split_edited');
    closeEditModal();
}

/**
 * Updates the character count display for the notes textarea.
 */
function updateCharacterCount() {
    const textarea = document.getElementById('edit-split-notes');
    const counter = document.getElementById('notes-char-count');
    if (textarea && counter) {
        counter.textContent = textarea.value.length;
    }
}

// --- Initialize All Modal Event Handlers ---

/**
 * Wires up all modal event handlers. Should be called once on page load.
 * @param {HTMLElement} container - The main container element.
 */
export function initModals(container) {
    const settingsModal = document.getElementById('settings-modal');
    const splitsModal = document.getElementById('splits-modal');
    const editModal = document.getElementById('edit-split-modal');
    const recoveryModal = document.getElementById('recovery-modal');

    // --- Settings Modal ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsCloseBtn = settingsModal.querySelector('.close');
    const saveSettingsBtn = document.getElementById('save-settings');
    const wsIpInput = document.getElementById('wsip');

    settingsBtn.onclick = () => {
        wsIpInput.value = serverIP;
        settingsModal.style.display = 'block';
    };

    settingsCloseBtn.onclick = () => {
        settingsModal.style.display = 'none';
    };

    saveSettingsBtn.onclick = () => {
        const newIP = wsIpInput.value.trim();
        if (newIP) {
            setServerIP(newIP);
            settingsModal.style.display = 'none';
            reconnectWS();
        }
    };

    // --- Splits Modal ---
    const splitsBtn = document.getElementById('splits-btn');
    const splitsCloseBtn = splitsModal.querySelector('.splits-close');

    splitsBtn.onclick = () => {
        import('./splits.js').then(({ updatePredefinedList }) => {
            updatePredefinedList();
        });
        document.getElementById('timer-title').value = timerTitle;
        document.getElementById('container-width').value = containerWidth;

        if (currentTimerState?.worldRecord && currentTimerState.worldRecord > 0) {
            document.getElementById('world-record').value = formatTimeForInput(currentTimerState.worldRecord);
        } else {
            document.getElementById('world-record').value = '';
        }

        splitsModal.style.display = 'block';
    };

    splitsCloseBtn.onclick = () => {
        splitsModal.style.display = 'none';
    };

    // --- Add Split ---
    document.getElementById('add-predefined-btn').onclick = () => {
        const name = document.getElementById('predefined-name').value.trim();
        if (name) {
            predefinedSplits.push({
                name: name,
                icon: currentIconPreview,
                notes: '',
            });
            const title = document.getElementById('timer-title').value.trim();
            setTimerTitle(title || DEFAULT_TITLE);
            sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
            markAsModified('split_added');
            document.getElementById('predefined-name').value = '';
            setCurrentIconPreview(DEFAULT_ICON);
            const preview = document.getElementById('icon-preview');
            preview.innerHTML = DEFAULT_ICON;
            document.getElementById('split-icon').value = '';
        }
    };

    // --- Save Title ---
    document.getElementById('save-title-btn').onclick = () => {
        const title = document.getElementById('timer-title').value.trim();
        setTimerTitle(title || DEFAULT_TITLE);
        sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
        markAsModified('title_changed');
    };

    // --- Save Width ---
    document.getElementById('save-width-btn').onclick = () => {
        const width = parseInt(document.getElementById('container-width').value);
        if (width >= MIN_CONTAINER_WIDTH && width <= MAX_CONTAINER_WIDTH) {
            setContainerWidth(width);
            container.style.width = width + 'px';
        } else {
            alert(`Width must be between ${MIN_CONTAINER_WIDTH} and ${MAX_CONTAINER_WIDTH} px`);
        }
    };

    // --- Save World Record ---
    document.getElementById('save-wr-btn').onclick = () => {
        const wrInput = document.getElementById('world-record').value.trim();

        if (wrInput === '') {
            sendCommand('setWorldRecord', { worldRecord: 0 });
            markAsModified('world_record_cleared');
        } else {
            const wrDuration = parseTimeInput(wrInput);

            if (wrDuration === null) {
                alert('Invalid time format.\n\nPlease use one of these formats:\n\u2022 M:SS.CS (e.g., "12:34.56")\n\u2022 H:MM:SS (e.g., "1:23:45")\n\u2022 H:MM:SS.CS (e.g., "1:23:45.67")\n\nWhere CS is centiseconds (2 digits)');
            } else if (wrDuration === 0) {
                alert('Time cannot be zero.');
            } else {
                sendCommand('setWorldRecord', { worldRecord: wrDuration });
                markAsModified('world_record_updated');
            }
        }
    };

    // --- Icon File Upload ---
    document.getElementById('split-icon').onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCurrentIconPreview(e.target.result);
                const preview = document.getElementById('icon-preview');
                preview.innerHTML = '';
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Edit Split Icon Change ---
    document.getElementById('edit-split-icon').onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setEditingIconPreview(e.target.result);
                const preview = document.getElementById('edit-icon-preview');
                preview.innerHTML = `<img src="${e.target.result}" alt="icon" style="width: 100%; height: 100%; object-fit: contain;">`;
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Edit Modal Buttons ---
    document.getElementById('save-edit-btn').onclick = () => saveEditedSplit();
    document.getElementById('cancel-edit-btn').onclick = () => closeEditModal();
    document.querySelector('.edit-split-close').onclick = () => closeEditModal();

    // --- Notes Textarea ---
    document.getElementById('edit-split-notes').addEventListener('input', () => {
        updateCharacterCount();
        setEditingNotes(document.getElementById('edit-split-notes').value);
    });

    // --- Export / Import ---
    document.getElementById('export-splits-btn').onclick = () => exportSplits();

    let isImporting = false;
    document.getElementById('import-splits-btn').onclick = () => {
        if (isImporting) return;
        document.getElementById('import-splits-file').click();
    };

    document.getElementById('import-splits-file').onchange = (event) => {
        const file = event.target.files[0];
        if (file && !isImporting) {
            isImporting = true;
            importSplitsFromFile(file, container, splitsModal);
            // Reset flag after a delay to prevent double-import
            setTimeout(() => { isImporting = false; }, 500);
        } else {
            isImporting = false;
        }
    };

    // --- Theme Toggle ---
    document.getElementById('theme-toggle-btn').onclick = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        applyTheme();
    };

    // --- Timer Control Buttons ---
    document.getElementById('start-btn').onclick = () => sendCommand('start');
    document.getElementById('pause-btn').onclick = () => sendCommand('pause');
    document.getElementById('reset-btn').onclick = () => sendCommand('reset');
    document.getElementById('next-split-btn').onclick = () => sendCommand('nextSplit');

    // --- Recovery Modal Buttons ---
    document.getElementById('recovery-cancel-btn').onclick = () => {
        recoveryModal.style.display = 'none';
    };

    document.getElementById('recovery-discard-btn').onclick = () => {
        const timestamp = recoveryModal.dataset.backupTimestamp;
        localStorage.setItem(STORAGE_KEYS.DISMISSED_RECOVERY, timestamp);
        recoveryModal.style.display = 'none';
        showToast('Auto-save backup dismissed', 'info');
    };

    document.getElementById('recovery-recover-btn').onclick = () => {
        const timestamp = parseInt(recoveryModal.dataset.backupTimestamp);
        const backups = JSON.parse(localStorage.getItem(STORAGE_KEYS.AUTO_SAVES) || '[]');
        const backup = backups.find(b => b.timestamp === timestamp);

        if (backup) {
            restoreFromBackup(backup.data, container);
            showToast('\u2705 Splits restored from auto-save', 'success');
        } else {
            showToast('\u274C Could not find backup to restore', 'error');
        }

        recoveryModal.style.display = 'none';
    };

    // --- Close modals on outside click (consolidated, using addEventListener) ---
    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
        if (event.target === splitsModal) {
            splitsModal.style.display = 'none';
        }
        if (event.target === editModal) {
            closeEditModal();
        }
        if (event.target === recoveryModal) {
            recoveryModal.style.display = 'none';
        }
    });
}
