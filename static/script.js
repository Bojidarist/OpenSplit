let ws;
let serverIP = localStorage.getItem('timerServerIP') || 'localhost:8080';
let visibleSplits = 5;
let theme = localStorage.getItem('theme') || 'dark'; // Default to dark mode
let predefinedSplits = [];
let timerTitle = 'OpenSplit';
let currentIconPreview = '🏃';

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

function sendCommand(command, extra = {}) {
    const msg = { command, ...extra };
    ws.send(JSON.stringify(msg));
}

function updateTimer(state) {
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
                return { name: split, icon: '🏃' };
            } else if (split && typeof split === 'object') {
                // New format
                return { 
                    name: split.name || 'Unnamed', 
                    icon: split.icon || '🏃' 
                };
            }
            return { name: 'Unnamed', icon: '🏃' };
        });
    } else {
        predefinedSplits = [];
    }
    
    timerTitle = state.timerTitle || 'OpenSplit';
    document.getElementById('game-title').textContent = timerTitle;
    updatePredefinedList();

    // Update current split display
    const splitDisplay = document.getElementById('current-split-display');
    if (predefinedSplits.length > 0 && state.currentSplitIndex >= 0 && state.currentSplitIndex < predefinedSplits.length) {
        splitDisplay.textContent = `${predefinedSplits[state.currentSplitIndex].name}`;
    } else if (predefinedSplits.length > 0) {
        splitDisplay.textContent = 'Ready to start';
    } else {
        splitDisplay.textContent = 'No splits defined';
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

    // Show/hide next split button
    const nextBtn = document.getElementById('next-split-btn');
    nextBtn.style.display = (state.status === 'running' && predefinedSplits.length > 0) ? 'inline-block' : 'none';

    updateSplits(state.splits, state.predefinedSplits, state.currentSplitIndex);

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

function updateSplits(splits, predefinedSplits, currentSplitIndex) {
    const list = document.getElementById('splits-body');
    list.innerHTML = '';
    if (predefinedSplits && predefinedSplits.length > 0) {
        predefinedSplits.forEach((splitDef, index) => {
            const row = document.createElement('div');
            row.className = 'split-row';
            if (index === currentSplitIndex) {
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
            
            // Cumulative time (right-aligned)
            const cumulativeDiv = document.createElement('div');
            cumulativeDiv.className = 'split-time';
            if (index < currentSplitIndex && index < splits.length) {
                cumulativeDiv.textContent = formatTime(splits[index].cumulativeTime);
            } else if (index === currentSplitIndex && index < splits.length) {
                // Show current running time
                cumulativeDiv.textContent = formatTime(splits[index].cumulativeTime);
            } else {
                cumulativeDiv.textContent = '--';
            }
            
            row.appendChild(iconSpan);
            row.appendChild(nameDiv);
            row.appendChild(cumulativeDiv);
            list.appendChild(row);
        });
    } else {
        // Fallback, but since we have predefined, perhaps not needed
        splits.forEach(split => {
            const row = document.createElement('div');
            row.className = 'split-row';
            
            const iconSpan = document.createElement('span');
            iconSpan.className = 'split-icon';
            iconSpan.textContent = '🏃';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'split-name';
            nameDiv.textContent = split.name;
            
            const cumulativeDiv = document.createElement('div');
            cumulativeDiv.className = 'split-time';
            cumulativeDiv.textContent = formatTime(split.cumulativeTime);
            
            row.appendChild(iconSpan);
            row.appendChild(nameDiv);
            row.appendChild(cumulativeDiv);
            list.appendChild(row);
        });
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

// Update predefined list display
function updatePredefinedList() {
    const list = document.getElementById('predefined-list');
    list.innerHTML = '';
    predefinedSplits.forEach((splitDef, index) => {
        const item = document.createElement('div');
        item.className = 'split-item';
        
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
        
        content.appendChild(iconDiv);
        content.appendChild(textSpan);
        
        const actions = document.createElement('div');
        actions.className = 'split-item-actions';
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Delete';
        removeBtn.style.backgroundColor = '#dc3545';
        removeBtn.style.color = 'white';
        removeBtn.style.padding = '5px 10px';
        removeBtn.style.fontSize = '0.8em';
        removeBtn.onclick = () => {
            predefinedSplits.splice(index, 1);
            sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
        };
        
        actions.appendChild(removeBtn);
        item.appendChild(content);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

document.getElementById('add-predefined-btn').onclick = () => {
    const name = document.getElementById('predefined-name').value.trim();
    if (name) {
        predefinedSplits.push({
            name: name,
            icon: currentIconPreview
        });
        const title = document.getElementById('timer-title').value.trim();
        timerTitle = title || 'OpenSplit';
        sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
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

document.getElementById('export-splits-btn').onclick = () => {
    const exportData = {
        title: timerTitle,
        splits: predefinedSplits
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'splits.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
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
                        icon: typeof name === 'object' ? (name.icon || '🏃') : '🏃'
                    }));
                    timerTitle = 'OpenSplit';
                } else if (imported.splits && Array.isArray(imported.splits)) {
                    // New format: object with title and splits
                    timerTitle = imported.title || 'OpenSplit';
                    predefinedSplits = imported.splits.map(split => ({
                        name: split.name || '',
                        icon: split.icon || '🏃'
                    }));
                } else {
                    alert('Invalid JSON format. Expected an array or an object with "splits" array.');
                    isImporting = false;
                    return;
                }
                
                sendCommand('setSplits', { splits: predefinedSplits, title: timerTitle });
                document.getElementById('timer-title').value = timerTitle;
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