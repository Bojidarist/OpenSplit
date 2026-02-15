let ws;
let serverIP = localStorage.getItem('timerServerIP') || 'localhost:8080';
let visibleSplits = 5;
let theme = localStorage.getItem('theme') || 'dark'; // Default to dark mode
let predefinedSplits = [];
let timerTitle = 'OpenSplit';
let currentIconPreview = '🏃';
let editingIconPreview = '🏃'; // Track icon during edit
let editingSplitIndex = -1; // Track which split is being edited
let editingNotes = ''; // Track notes during edit
let containerWidth = parseInt(localStorage.getItem('containerWidth')) || 600;
const MIN_CONTAINER_WIDTH = 400;
const MAX_CONTAINER_WIDTH = 600;
let currentTimerState = null; // Store the latest timer state for export
let hasReceivedInitialState = false; // Track if we've received first state update

// Dirty state tracking for unsaved changes
let dirtyState = {
    hasUnsavedChanges: false,
    lastModifiedTime: null,
    lastExportTime: localStorage.getItem('lastExportTime') ? parseInt(localStorage.getItem('lastExportTime')) : null,
    changeCount: 0,
    changeTypes: [],
    hasInteracted: false, // Track if user has done anything yet
    skipRecoveryCheck: false // Skip recovery dialog (set after import/restore)
};

// Mark data as modified
function markAsModified(changeType) {
    dirtyState.hasUnsavedChanges = true;
    dirtyState.lastModifiedTime = Date.now();
    dirtyState.changeCount++;
    dirtyState.hasInteracted = true; // User has done something
    if (changeType) {
        dirtyState.changeTypes.push(changeType);
    }
    updateSaveIndicator();
    debouncedAutoSave();
}

// Mark data as saved
function markAsSaved() {
    dirtyState.hasUnsavedChanges = false;
    dirtyState.lastExportTime = Date.now();
    dirtyState.changeCount = 0;
    dirtyState.changeTypes = [];
    dirtyState.hasInteracted = true; // User has exported, show indicator
    localStorage.setItem('lastExportTime', dirtyState.lastExportTime.toString());
    updateSaveIndicator();
}

// Update save status indicator
function updateSaveIndicator() {
    const indicator = document.getElementById('save-indicator');
    if (!indicator) return;
    
    // Only show indicator after user has interacted (made changes or imported)
    if (!dirtyState.hasInteracted) {
        indicator.classList.remove('visible');
        return;
    }
    
    indicator.classList.add('visible');
    
    if (dirtyState.hasUnsavedChanges) {
        indicator.textContent = '⚠️ Unsaved';
        indicator.className = 'save-indicator visible unsaved';
        indicator.title = `${dirtyState.changeCount} unsaved change(s)`;
    } else if (dirtyState.lastExportTime) {
        const timeAgo = formatTimeAgo(dirtyState.lastExportTime);
        indicator.textContent = `💾 Saved ${timeAgo}`;
        indicator.className = 'save-indicator visible saved';
        indicator.title = `Last exported: ${new Date(dirtyState.lastExportTime).toLocaleString()}`;
    } else {
        indicator.textContent = '💾 Not saved';
        indicator.className = 'save-indicator visible saved';
        indicator.title = 'No exports yet';
    }
}

// Format relative time
function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// Debounce function
function debounce(func, wait) {
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

// Auto-save to localStorage
function autoSaveToLocalStorage() {
    if (!currentTimerState) return;
    
    const backupData = {
        timestamp: Date.now(),
        version: "1.0",
        data: {
            title: timerTitle,
            splits: predefinedSplits,
            containerWidth: containerWidth,
            bestSplitTimes: currentTimerState?.bestSplitTimes || [],
            bestCumulativeTimes: currentTimerState?.bestCumulativeTimes || [],
            personalBest: currentTimerState?.personalBest || 0,
            sumOfBest: currentTimerState?.sumOfBest || 0,
            pbSplitTimes: currentTimerState?.pbSplitTimes || [],
            worldRecord: currentTimerState?.worldRecord || 0
        }
    };
    
    try {
        // Keep last 3 backups
        const backups = JSON.parse(localStorage.getItem('opensplit_autosaves') || '[]');
        backups.unshift(backupData);
        backups.splice(3); // Keep only last 3
        localStorage.setItem('opensplit_autosaves', JSON.stringify(backups));
        console.log('Auto-saved to localStorage');
    } catch (e) {
        console.error('Auto-save failed:', e);
        if (e.name === 'QuotaExceededError') {
            // Try to clear old backups and retry
            try {
                localStorage.setItem('opensplit_autosaves', JSON.stringify([backupData]));
            } catch (e2) {
                console.error('Auto-save failed even after clearing:', e2);
            }
        }
    }
}

// Debounced auto-save (2 seconds after last change)
const debouncedAutoSave = debounce(autoSaveToLocalStorage, 2000);

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
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

// Enhanced export function
function exportSplits() {
    if (!currentTimerState) {
        showToast('No timer state available to export', 'warning');
        return;
    }
    
    // Generate filename with title and timestamp
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
    const safeTitle = (timerTitle || 'splits').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeTitle}_${timestamp}.json`;
    
    // Prepare export data
    const exportData = {
        version: "1.0",
        exportedAt: now.toISOString(),
        title: timerTitle,
        splits: predefinedSplits,
        containerWidth: containerWidth,
        bestSplitTimes: currentTimerState?.bestSplitTimes || [],
        bestCumulativeTimes: currentTimerState?.bestCumulativeTimes || [],
        personalBest: currentTimerState?.personalBest || 0,
        sumOfBest: currentTimerState?.sumOfBest || 0,
        pbSplitTimes: currentTimerState?.pbSplitTimes || [],
        worldRecord: currentTimerState?.worldRecord || 0
    };
    
    // Create download
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', filename);
    linkElement.click();
    
    // Update state
    markAsSaved();
    
    // Show success notification
    showToast(`✅ Splits exported: ${filename}`, 'success');
    
    console.log(`Exported ${predefinedSplits.length} splits to ${filename}`);
}

// Keyboard shortcuts
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if user is typing in an input field
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

// Recovery dialog for auto-saved data
function checkForAutoSavedData() {
    try {
        // Skip if explicitly disabled (after import or restore)
        if (dirtyState.skipRecoveryCheck) {
            return;
        }
        
        const backups = JSON.parse(localStorage.getItem('opensplit_autosaves') || '[]');
        if (backups.length === 0) return;
        
        const latestBackup = backups[0];
        const ageMinutes = (Date.now() - latestBackup.timestamp) / 1000 / 60;
        
        // Check if this backup has been dismissed
        const dismissedTimestamp = localStorage.getItem('dismissedRecoveryTimestamp');
        if (dismissedTimestamp && parseInt(dismissedTimestamp) === latestBackup.timestamp) {
            return; // User already dismissed this backup
        }
        
        // Detect if this is a new browser session (browser was closed/reopened)
        // sessionStorage clears when browser closes, localStorage persists
        const isNewSession = !sessionStorage.getItem('opensplit_session_active');
        if (isNewSession) {
            sessionStorage.setItem('opensplit_session_active', 'true');
        }
        
        // Check if user recently saved (within 30 seconds)
        const recentlySaved = dirtyState.lastExportTime && (Date.now() - dirtyState.lastExportTime) < 30000;
        
        // Check if backup has meaningful data (splits or progress)
        const backupHasData = latestBackup.data.splits && latestBackup.data.splits.length > 0;
        const backupHasProgress = latestBackup.data.personalBest > 0 || 
                                  (latestBackup.data.bestSplitTimes && latestBackup.data.bestSplitTimes.length > 0);
        
        // Show recovery dialog if:
        // 1. Backup is recent (< 24 hours)
        // 2. User hasn't explicitly saved recently
        // 3. Backup has splits or progress data
        // 4a. This is a new session (browser restart) - show immediately, OR
        // 4b. Backup is older than 1 minute (to avoid showing right after auto-save in same session)
        const ageCheck = isNewSession || ageMinutes > 1;
        
        if (ageMinutes < 1440 && !recentlySaved && (backupHasData || backupHasProgress) && ageCheck) {
            showRecoveryModal(latestBackup);
        }
    } catch (e) {
        console.error('Error checking for auto-saved data:', e);
    }
}

// Show recovery modal
function showRecoveryModal(backup) {
    const modal = document.getElementById('recovery-modal');
    const message = document.getElementById('recovery-message');
    const title = document.getElementById('recovery-title');
    const splitsCount = document.getElementById('recovery-splits-count');
    const timeAgo = document.getElementById('recovery-time-ago');
    
    const timeAgoStr = formatTimeAgo(backup.timestamp);
    const dateStr = new Date(backup.timestamp).toLocaleString();
    
    message.textContent = 'We found auto-saved splits from a previous session. Would you like to recover them?';
    title.textContent = backup.data.title || 'OpenSplit';
    splitsCount.textContent = backup.data.splits.length;
    timeAgo.textContent = `${timeAgoStr} (${dateStr})`;
    
    modal.style.display = 'block';
    
    // Store backup reference for button handlers
    modal.dataset.backupTimestamp = backup.timestamp;
}

// Restore from backup
function restoreFromBackup(data) {
    timerTitle = data.title || 'OpenSplit';
    predefinedSplits = data.splits || [];
    containerWidth = data.containerWidth || containerWidth;
    
    // Update UI
    container.style.width = containerWidth + 'px';
    localStorage.setItem('containerWidth', containerWidth);
    
    // Send to server
    sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
    
    // If PB data exists, restore it
    if (data.bestSplitTimes || data.personalBest || data.pbSplitTimes) {
        sendCommand('restorePBData', {
            bestSplitTimes: data.bestSplitTimes || [],
            bestCumulativeTimes: data.bestCumulativeTimes || [],
            personalBest: data.personalBest || 0,
            sumOfBest: data.sumOfBest || 0,
            pbSplitTimes: data.pbSplitTimes || [],
            worldRecord: data.worldRecord || 0
        });
    }
    
    // Mark as interacted and modified since we just restored
    dirtyState.hasInteracted = true;
    dirtyState.skipRecoveryCheck = true; // Don't show recovery dialog again this session
    markAsModified('restored_from_backup');
}

// Warn before closing with unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (dirtyState.hasUnsavedChanges && dirtyState.changeCount > 0) {
        const message = 'You have unsaved changes. Export your splits before leaving?';
        e.preventDefault();
        e.returnValue = message;
        return message;
    }
});

// Update save indicator every minute
setInterval(updateSaveIndicator, 60000);

function applyTheme() {
    // Remove both classes first
    document.body.classList.remove('dark', 'light');
    
    if (theme === 'light') {
        document.body.classList.add('light');
        document.getElementById('theme-toggle-btn').textContent = '🌙';
    } else {
        document.body.classList.add('dark');
        document.getElementById('theme-toggle-btn').textContent = '☀️';
    }
}

function connectWS() {
    ws = new WebSocket(`ws://${serverIP}/ws`);

    ws.onopen = () => {
        console.log('Connected to timer server');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateTimer(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('Disconnected from timer server');
        // Attempt to reconnect after 1 second
        setTimeout(connectWS, 1000);
    };
}

connectWS();
applyTheme();

const container = document.querySelector('.container');
container.style.width = containerWidth + 'px';

// Resize handles functionality
let isResizing = false;
let currentHandle = null;
let startX = 0;
let startWidth = 0;

const leftHandle = document.querySelector('.resize-handle.left');
const rightHandle = document.querySelector('.resize-handle.right');

function startResize(e, handle) {
    isResizing = true;
    currentHandle = handle;
    startX = e.clientX;
    startWidth = container.offsetWidth;
    
    // Prevent text selection during resize
    e.preventDefault();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
}

function doResize(e) {
    if (!isResizing) return;
    
    let newWidth;
    if (currentHandle === 'left') {
        // Dragging left edge - subtract the delta to resize
        const delta = e.clientX - startX;
        newWidth = startWidth - delta;
    } else {
        // Dragging right edge - add the delta to resize
        const delta = e.clientX - startX;
        newWidth = startWidth + delta;
    }
    
    // Constrain width between min and max
    newWidth = Math.max(MIN_CONTAINER_WIDTH, Math.min(MAX_CONTAINER_WIDTH, newWidth));
    
    container.style.width = newWidth + 'px';
    containerWidth = newWidth;
}

function stopResize() {
    if (isResizing) {
        isResizing = false;
        currentHandle = null;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // Save the final width
        localStorage.setItem('containerWidth', containerWidth);
    }
}

leftHandle.addEventListener('mousedown', (e) => startResize(e, 'left'));
rightHandle.addEventListener('mousedown', (e) => startResize(e, 'right'));
document.addEventListener('mousemove', doResize);
document.addEventListener('mouseup', stopResize);

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        const newWidth = Math.round(entry.contentRect.width);
        if (newWidth !== containerWidth) {
            containerWidth = newWidth;
            localStorage.setItem('containerWidth', containerWidth);
        }
    }
});
resizeObserver.observe(container);

function sendCommand(command, extra = {}) {
    const msg = { command, ...extra };
    ws.send(JSON.stringify(msg));
}

function updateTimer(state) {
    // Store the previous PB to detect changes
    const previousPB = currentTimerState?.personalBest || 0;
    
    // Store the current state for export
    currentTimerState = state;
    
    // Check if PB was achieved
    if (state.personalBest && state.personalBest > 0 && state.personalBest !== previousPB && previousPB !== 0) {
        markAsModified('personal_best_achieved');
        showToast('🎉 New Personal Best! Consider exporting your splits.', 'success', 5000);
    }
    
    const time = formatTime(state.currentTime);
    const display = document.getElementById('timer-display');
    display.textContent = time;
    display.className = 'timer ' + (state.status === 'paused' ? 'paused' : '');

    // Sync predefined splits and title from server
    // Convert old format (array of strings) to new format (array of objects)
    if (state.predefinedSplits && Array.isArray(state.predefinedSplits)) {
        predefinedSplits = state.predefinedSplits.map(split => {
            if (typeof split === 'string') {
                // Old format compatibility
                return { name: split, icon: '🏃', notes: '' };
            } else if (split && typeof split === 'object') {
                // New format
                return { 
                    name: split.name || 'Unnamed', 
                    icon: split.icon || '🏃',
                    notes: split.notes || ''
                };
            }
            return { name: 'Unnamed', icon: '🏃', notes: '' };
        });
    } else {
        predefinedSplits = [];
    }
    
    timerTitle = state.timerTitle || 'OpenSplit';
    document.getElementById('game-title').textContent = timerTitle;
    updatePredefinedList();
    
    // Check for auto-saved data after receiving initial state from server
    // This ensures we know what the current state is before offering recovery
    if (!hasReceivedInitialState) {
        hasReceivedInitialState = true;
        // Small delay to ensure DOM is fully ready
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
        
        // Show notes if current split has them
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
        // Hide notes when not in a run
        notesDisplay.classList.remove('show');
    }

    // Update previous segment display
    const prevSegmentDisplay = document.getElementById('previous-segment');
    if (state.splits && state.splits.length > 0) {
        const lastSplit = state.splits[state.splits.length - 1];
        const segTime = formatTime(lastSplit.segmentTime);
        prevSegmentDisplay.textContent = `Previous Segment: ${segTime}`;
    } else {
        prevSegmentDisplay.textContent = 'Previous Segment: --';
    }

    // Update PB and Sum of Best displays
    const pbDisplay = document.getElementById('pb-time');
    const sobDisplay = document.getElementById('sob-time');
    const wrDisplay = document.getElementById('wr-time');
    
    if (state.personalBest && state.personalBest > 0) {
        pbDisplay.textContent = formatTime(state.personalBest);
    } else {
        pbDisplay.textContent = '--';
    }
    
    if (state.sumOfBest && state.sumOfBest > 0) {
        sobDisplay.textContent = formatTime(state.sumOfBest);
    } else {
        sobDisplay.textContent = '--';
    }
    
    // Display world record (always show, use -- if not set)
    if (state.worldRecord && state.worldRecord > 0) {
        wrDisplay.textContent = formatTime(state.worldRecord);
    } else {
        wrDisplay.textContent = '--';
    }

    // Show/hide next split button
    const nextBtn = document.getElementById('next-split-btn');
    nextBtn.style.display = (state.status === 'running' && predefinedSplits.length > 0) ? 'inline-block' : 'none';
    
    // Determine if run is completed (stopped with all splits completed)
    const runCompleted = state.status === 'stopped' && state.currentSplitIndex === -1 && state.splits && state.splits.length > 0;
    
    // Determine if at starting position (stopped with no splits recorded)
    const atStartingPosition = state.status === 'stopped' && (!state.splits || state.splits.length === 0);
    
    // Show/hide buttons based on status
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    if (runCompleted) {
        // Run is complete - only show reset button
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resetBtn.style.display = 'inline-block';
    } else if (atStartingPosition) {
        // At starting position - only show start button
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        resetBtn.style.display = 'none';
    } else if (state.status === 'stopped') {
        // Stopped but has some splits (partial run) - show start and reset
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        resetBtn.style.display = 'inline-block';
    } else {
        // Running or paused - hide start, show pause and reset
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
        resetBtn.style.display = 'inline-block';
    }

    updateSplits(state);

    // Auto-scroll to keep current split visible
    const container = document.querySelector('.splits-container');
    if (predefinedSplits.length > 0 && state.currentSplitIndex >= 0) {
        const rowHeight = 40;
        container.scrollTop = Math.max(0, (state.currentSplitIndex - visibleSplits + 1) * rowHeight);
    } else if (state.status === "stopped" && state.currentSplitIndex < 0) {
        // Reset: scroll to top
        container.scrollTop = 0;
    }
}

function formatTime(durationMs) {
    const totalSeconds = Math.floor(durationMs / 1000000000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((durationMs % 1000000000) / 1000000);
    
    // Format like LiveSplit: show hours only if > 0
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0').substring(0, 2)}`;
    }
}

function updateSplits(state) {
    const list = document.getElementById('splits-body');
    list.innerHTML = '';
    const splits = state.splits || [];
    const predefinedSplits = state.predefinedSplits || [];
    const currentSplitIndex = state.currentSplitIndex;
    const pbSplitTimes = state.pbSplitTimes || [];
    
    if (predefinedSplits && predefinedSplits.length > 0) {
        predefinedSplits.forEach((splitDef, index) => {
            const row = document.createElement('div');
            row.className = 'split-row';
            
            // Add highlighting classes
            // If currentSplitIndex is -1, all splits are completed (run finished)
            if (currentSplitIndex === -1 && splits.length > 0) {
                // All splits completed
                row.classList.add('completed');
            } else if (index < currentSplitIndex) {
                // Past splits that have been completed
                row.classList.add('completed');
            } else if (index === currentSplitIndex && state.status === 'running') {
                // Current active split
                row.classList.add('current');
            }
            
            // Convert old format to new format if needed
            let name, icon;
            if (typeof splitDef === 'string') {
                name = splitDef;
                icon = '🏃';
            } else if (splitDef && typeof splitDef === 'object') {
                name = splitDef.name || 'Unnamed';
                icon = splitDef.icon || '🏃';
            } else {
                name = 'Unnamed';
                icon = '🏃';
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
            
            // Delta (left of cumulative time)
            const deltaDiv = document.createElement('div');
            deltaDiv.className = 'split-delta';
            if (index < splits.length && splits[index].delta !== undefined) {
                const delta = splits[index].delta;
                if (delta !== 0) {
                    const deltaStr = formatDelta(delta);
                    deltaDiv.textContent = deltaStr;
                    if (delta < 0) {
                        deltaDiv.classList.add('ahead');
                    } else {
                        deltaDiv.classList.add('behind');
                    }
                } else {
                    deltaDiv.textContent = '--';
                }
            } else {
                deltaDiv.textContent = '--';
            }
            
            // Cumulative time (right-aligned)
            const cumulativeDiv = document.createElement('div');
            cumulativeDiv.className = 'split-time';
            // Show time if split is completed (index < splits.length)
            if (index < splits.length) {
                cumulativeDiv.textContent = formatTime(splits[index].cumulativeTime);
            } else {
                cumulativeDiv.textContent = '--';
            }
            
            // PB time (far right)
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
        // Fallback, but since we have predefined, perhaps not needed
        splits.forEach((split, index) => {
            const row = document.createElement('div');
            row.className = 'split-row';
            
            const iconSpan = document.createElement('span');
            iconSpan.className = 'split-icon';
            iconSpan.textContent = '🏃';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'split-name';
            nameDiv.textContent = split.name;
            
            const deltaDiv = document.createElement('div');
            deltaDiv.className = 'split-delta';
            if (split.delta !== undefined && split.delta !== 0) {
                const deltaStr = formatDelta(split.delta);
                deltaDiv.textContent = deltaStr;
                if (split.delta < 0) {
                    deltaDiv.classList.add('ahead');
                } else {
                    deltaDiv.classList.add('behind');
                }
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

// Format delta with + or - sign
function formatDelta(durationMs) {
    const sign = durationMs >= 0 ? '+' : '-';
    const absDuration = Math.abs(durationMs);
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

// Settings modal
const modal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeBtn = document.getElementsByClassName('close')[0];
const saveSettingsBtn = document.getElementById('save-settings');
const wsIpInput = document.getElementById('wsip');

settingsBtn.onclick = () => {
    wsIpInput.value = serverIP;
    modal.style.display = 'block';
};

closeBtn.onclick = () => {
    modal.style.display = 'none';
};

window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};

saveSettingsBtn.onclick = () => {
    const newIP = wsIpInput.value.trim();
    if (newIP) {
        serverIP = newIP;
        localStorage.setItem('timerServerIP', serverIP);
        modal.style.display = 'none';
        // Reconnect with new IP
        ws.close();
        connectWS();
    }
};

// Splits modal
const splitsModal = document.getElementById('splits-modal');
const splitsBtn = document.getElementById('splits-btn');
const splitsCloseBtn = document.getElementsByClassName('splits-close')[0];

splitsBtn.onclick = () => {
    updatePredefinedList();
    document.getElementById('timer-title').value = timerTitle;
    document.getElementById('container-width').value = containerWidth;
    
    // Populate world record field if available
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

window.onclick = (event) => {
    if (event.target == splitsModal) {
        splitsModal.style.display = 'none';
    }
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};

// Drag and drop variables
let draggedItem = null;
let draggedIndex = null;

// Drag event handlers
function handleDragStart(e) {
    draggedItem = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const targetItem = e.target.closest('.split-item');
    if (targetItem && targetItem !== draggedItem) {
        // Remove all drag-over classes first
        document.querySelectorAll('.split-item').forEach(item => {
            item.classList.remove('drag-over', 'drag-over-bottom');
        });
        
        // Determine if we should place above or below
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

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    const targetItem = e.target.closest('.split-item');
    if (targetItem && targetItem !== draggedItem) {
        const targetIndex = parseInt(targetItem.dataset.index);
        
        // Determine drop position
        const rect = targetItem.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        let dropIndex = targetIndex;
        
        if (e.clientY >= midpoint) {
            dropIndex = targetIndex + 1;
        }
        
        // Reorder the array
        const draggedSplit = predefinedSplits[draggedIndex];
        predefinedSplits.splice(draggedIndex, 1);
        
        // Adjust drop index if dragging from earlier position
        if (draggedIndex < dropIndex) {
            dropIndex--;
        }
        
        predefinedSplits.splice(dropIndex, 0, draggedSplit);
        
        // Sync with server and update UI
        sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
        markAsModified('splits_reordered');
    }
    
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Remove all drag-over classes
    document.querySelectorAll('.split-item').forEach(item => {
        item.classList.remove('drag-over', 'drag-over-bottom');
    });
    
    draggedItem = null;
    draggedIndex = null;
}

function handleDragLeave(e) {
    const targetItem = e.target.closest('.split-item');
    if (targetItem) {
        targetItem.classList.remove('drag-over', 'drag-over-bottom');
    }
}

// Update predefined list display
function updatePredefinedList() {
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
            iconDiv.textContent = splitDef.icon || '🏃';
        }
        
        const textSpan = document.createElement('span');
        textSpan.textContent = `${index + 1}. ${splitDef.name}`;
        
        // Add notes indicator if split has notes
        if (splitDef.notes && splitDef.notes.trim()) {
            const noteIndicator = document.createElement('span');
            noteIndicator.className = 'split-item-note-indicator';
            noteIndicator.textContent = '📝';
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
            e.stopPropagation(); // Prevent drag events
            openEditModal(index);
        };
        
        // Delete button
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Delete';
        removeBtn.style.backgroundColor = '#dc3545';
        removeBtn.style.color = 'white';
        removeBtn.style.padding = '5px 10px';
        removeBtn.style.fontSize = '0.8em';
        removeBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent drag events
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

// Open edit modal with split data
function openEditModal(index) {
    editingSplitIndex = index;
    const split = predefinedSplits[index];
    
    // Pre-fill form with current data
    document.getElementById('edit-split-name').value = split.name;
    editingIconPreview = split.icon;
    editingNotes = split.notes || '';
    
    // Pre-fill notes
    document.getElementById('edit-split-notes').value = editingNotes;
    updateCharacterCount();
    
    // Update icon preview
    const preview = document.getElementById('edit-icon-preview');
    if (split.icon && split.icon.startsWith('data:image')) {
        preview.innerHTML = `<img src="${split.icon}" alt="icon" style="width: 100%; height: 100%; object-fit: contain;">`;
    } else {
        preview.textContent = split.icon || '🏃';
    }
    
    // Clear file input
    document.getElementById('edit-split-icon').value = '';
    
    // Show modal
    document.getElementById('edit-split-modal').style.display = 'block';
}

// Close edit modal
function closeEditModal() {
    document.getElementById('edit-split-modal').style.display = 'none';
    editingSplitIndex = -1;
    editingIconPreview = '🏃';
    editingNotes = '';
}

// Save edited split
function saveEditedSplit() {
    if (editingSplitIndex === -1) return;
    
    const name = document.getElementById('edit-split-name').value.trim();
    if (!name) {
        alert('Split name cannot be empty');
        return;
    }
    
    const notes = document.getElementById('edit-split-notes').value;
    
    // Update split in array
    predefinedSplits[editingSplitIndex] = {
        name: name,
        icon: editingIconPreview,
        notes: notes
    };
    
    // Send to server
    sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
    markAsModified('split_edited');
    
    // Close modal
    closeEditModal();
}

// Update character count for notes textarea
function updateCharacterCount() {
    const textarea = document.getElementById('edit-split-notes');
    const counter = document.getElementById('notes-char-count');
    if (textarea && counter) {
        counter.textContent = textarea.value.length;
    }
}

document.getElementById('add-predefined-btn').onclick = () => {
    const name = document.getElementById('predefined-name').value.trim();
    if (name) {
        predefinedSplits.push({
            name: name,
            icon: currentIconPreview,
            notes: '' // New splits start with empty notes
        });
        const title = document.getElementById('timer-title').value.trim();
        timerTitle = title || 'OpenSplit';
        sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
        markAsModified('split_added');
        document.getElementById('predefined-name').value = '';
        // Reset icon preview
        currentIconPreview = '🏃';
        const preview = document.getElementById('icon-preview');
        preview.innerHTML = '🏃';
        document.getElementById('split-icon').value = '';
    }
};

// Save title button
document.getElementById('save-title-btn').onclick = () => {
    const title = document.getElementById('timer-title').value.trim();
    timerTitle = title || 'OpenSplit';
    sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
    markAsModified('title_changed');
};

// Save width button
document.getElementById('save-width-btn').onclick = () => {
    const width = parseInt(document.getElementById('container-width').value);
    if (width >= MIN_CONTAINER_WIDTH && width <= MAX_CONTAINER_WIDTH) {
        containerWidth = width;
        container.style.width = width + 'px';
        localStorage.setItem('containerWidth', containerWidth);
    } else {
        alert(`Width must be between ${MIN_CONTAINER_WIDTH} and ${MAX_CONTAINER_WIDTH} px`);
    }
};

// Parse time input matching timer format (H:MM:SS or M:SS.CS where CS is centiseconds)
function parseTimeInput(input) {
    if (!input || input.trim() === '') return 0;
    
    const trimmed = input.trim();
    
    // Regex to match timer format: optional hours, minutes, seconds, and optional centiseconds
    // Formats: "1:23:45", "23:45", "1:23:45.12", "23:45.12"
    // Timer shows: H:MM:SS (if hours > 0) or M:SS.CS (if hours = 0)
    const timeRegex = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{2}))?$/;
    const match = trimmed.match(timeRegex);
    
    if (!match) {
        return null; // Invalid format
    }
    
    let hours = 0, minutes = 0, seconds = 0, centiseconds = 0;
    
    if (match[1] !== undefined) {
        // Format: H:MM:SS or H:MM:SS.CS
        hours = parseInt(match[1]) || 0;
        minutes = parseInt(match[2]) || 0;
        seconds = parseInt(match[3]) || 0;
        centiseconds = match[4] ? parseInt(match[4]) || 0 : 0;
    } else {
        // Format: M:SS or M:SS.CS
        minutes = parseInt(match[2]) || 0;
        seconds = parseInt(match[3]) || 0;
        centiseconds = match[4] ? parseInt(match[4]) || 0 : 0;
    }
    
    // Validate ranges
    if (minutes >= 60 || seconds >= 60 || centiseconds >= 100) {
        return null; // Invalid time values
    }
    
    // Convert to nanoseconds (Go time.Duration format)
    const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10;
    return totalMs * 1000000; // Convert milliseconds to nanoseconds
}

// Format nanoseconds to timer input format string
function formatTimeForInput(durationMs) {
    if (!durationMs || durationMs === 0) return '';
    
    const totalSeconds = Math.floor(durationMs / 1000000000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((durationMs % 1000000000) / 10000000);
    
    // Format like the timer: show hours only if > 0
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
}

// Save world record button
document.getElementById('save-wr-btn').onclick = () => {
    const wrInput = document.getElementById('world-record').value.trim();
    
    if (wrInput === '') {
        // Clear world record if input is empty
        sendCommand('setWorldRecord', { worldRecord: 0 });
        markAsModified('world_record_cleared');
    } else {
        const wrDuration = parseTimeInput(wrInput);
        
        if (wrDuration === null) {
            alert('Invalid time format.\n\nPlease use one of these formats:\n• M:SS.CS (e.g., "12:34.56")\n• H:MM:SS (e.g., "1:23:45")\n• H:MM:SS.CS (e.g., "1:23:45.67")\n\nWhere CS is centiseconds (2 digits)');
        } else if (wrDuration === 0) {
            alert('Time cannot be zero.');
        } else {
            sendCommand('setWorldRecord', { worldRecord: wrDuration });
            markAsModified('world_record_updated');
        }
    }
};

// Handle icon file upload
document.getElementById('split-icon').onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentIconPreview = e.target.result;
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

// Edit split icon change handler
document.getElementById('edit-split-icon').onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            editingIconPreview = e.target.result;
            const preview = document.getElementById('edit-icon-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="icon" style="width: 100%; height: 100%; object-fit: contain;">`;
        };
        reader.readAsDataURL(file);
    }
};

// Save edit button
document.getElementById('save-edit-btn').onclick = () => {
    saveEditedSplit();
};

// Cancel edit button
document.getElementById('cancel-edit-btn').onclick = () => {
    closeEditModal();
};

// Close button (×) for edit modal
document.querySelector('.edit-split-close').onclick = () => {
    closeEditModal();
};

// Close edit modal when clicking outside
window.addEventListener('click', (event) => {
    const editModal = document.getElementById('edit-split-modal');
    if (event.target === editModal) {
        closeEditModal();
    }
});

// Notes textarea character counter
document.getElementById('edit-split-notes').addEventListener('input', () => {
    updateCharacterCount();
    editingNotes = document.getElementById('edit-split-notes').value;
});

document.getElementById('export-splits-btn').onclick = () => {
    exportSplits();
};

let isImporting = false;

document.getElementById('import-splits-btn').onclick = () => {
    if (isImporting) return;
    document.getElementById('import-splits-file').click();
};

document.getElementById('import-splits-file').onchange = (event) => {
    const file = event.target.files[0];
    if (file && !isImporting) {
        isImporting = true;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result.trim().replace(/^\ufeff/, '');
                if (!text.startsWith('{') && !text.startsWith('[')) {
                    alert('Invalid file format: expected JSON object or array');
                    isImporting = false;
                    return;
                }
                const imported = JSON.parse(text);
                
                // Support both old format (array of strings) and new format (object with title and splits)
                if (Array.isArray(imported)) {
                    // Old format: array of strings
                    predefinedSplits = imported.map(name => ({
                        name: typeof name === 'string' ? name : name.name || '',
                        icon: typeof name === 'object' ? (name.icon || '🏃') : '🏃',
                        notes: typeof name === 'object' ? (name.notes || '') : ''
                    }));
                    timerTitle = 'OpenSplit';
                 } else if (imported.splits && Array.isArray(imported.splits)) {
                     // New format: object with title and splits
                     timerTitle = imported.title || 'OpenSplit';
                     predefinedSplits = imported.splits.map(split => ({
                         name: split.name || '',
                         icon: split.icon || '🏃',
                         notes: split.notes || '' // Add empty notes if not present
                     }));
                     if (imported.containerWidth) {
                         containerWidth = imported.containerWidth;
                         container.style.width = containerWidth + 'px';
                         localStorage.setItem('containerWidth', containerWidth);
                         if (splitsModal.style.display === 'block') {
                             document.getElementById('container-width').value = containerWidth;
                         }
                     }
                 } else {
                    alert('Invalid JSON format. Expected an array or an object with "splits" array.');
                    isImporting = false;
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
                        worldRecord: imported.worldRecord || 0
                    });
                }
                
                // Mark as interacted since user imported splits
                dirtyState.hasInteracted = true;
                dirtyState.skipRecoveryCheck = true; // Don't show recovery dialog after import
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
            isImporting = false;
        };
        reader.onerror = (e) => {
            alert('File read error: ' + (e.target.error ? e.target.error.message : 'Unknown error'));
            isImporting = false;
        };
        reader.readAsText(file);
    } else {
        isImporting = false;
    }
};

document.getElementById('theme-toggle-btn').onclick = () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    applyTheme();
};

document.getElementById('start-btn').onclick = () => sendCommand('start');
document.getElementById('pause-btn').onclick = () => sendCommand('pause');
document.getElementById('reset-btn').onclick = () => sendCommand('reset');
document.getElementById('next-split-btn').onclick = () => sendCommand('nextSplit');

// Initialize keyboard shortcuts
initKeyboardShortcuts();

// Recovery modal button handlers
document.getElementById('recovery-cancel-btn').onclick = () => {
    // Simply close the modal
    document.getElementById('recovery-modal').style.display = 'none';
};

document.getElementById('recovery-discard-btn').onclick = () => {
    // Store dismissed timestamp so we don't show this backup again
    const modal = document.getElementById('recovery-modal');
    const timestamp = modal.dataset.backupTimestamp;
    localStorage.setItem('dismissedRecoveryTimestamp', timestamp);
    modal.style.display = 'none';
    showToast('Auto-save backup dismissed', 'info');
};

document.getElementById('recovery-recover-btn').onclick = () => {
    // Get the backup and restore it
    const modal = document.getElementById('recovery-modal');
    const timestamp = parseInt(modal.dataset.backupTimestamp);
    const backups = JSON.parse(localStorage.getItem('opensplit_autosaves') || '[]');
    const backup = backups.find(b => b.timestamp === timestamp);
    
    if (backup) {
        restoreFromBackup(backup.data);
        showToast('✅ Splits restored from auto-save', 'success');
    } else {
        showToast('❌ Could not find backup to restore', 'error');
    }
    
    modal.style.display = 'none';
};

// Click outside recovery modal to close
window.addEventListener('click', (event) => {
    const recoveryModal = document.getElementById('recovery-modal');
    if (event.target === recoveryModal) {
        recoveryModal.style.display = 'none';
    }
});