let ws;
let serverIP = localStorage.getItem('timerServerIP') || 'localhost:8080';
let visibleSplits = parseInt(localStorage.getItem('visibleSplits')) || 5;
let theme = localStorage.getItem('theme') || 'light';
let predefinedSplits = [];

function applyTheme() {
    if (theme === 'dark') {
        document.body.classList.add('dark');
        document.getElementById('theme-toggle-btn').textContent = '☀️';
    } else {
        document.body.classList.remove('dark');
        document.getElementById('theme-toggle-btn').textContent = '🌙';
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

    // Sync predefined splits from server
    predefinedSplits = state.predefinedSplits || [];
    updatePredefinedList();

    // Update current split display
    const splitDisplay = document.getElementById('current-split-display');
    if (predefinedSplits.length > 0 && state.currentSplitIndex >= 0 && state.currentSplitIndex < predefinedSplits.length) {
        splitDisplay.textContent = `Split ${state.currentSplitIndex + 1}: ${predefinedSplits[state.currentSplitIndex]}`;
    } else if (predefinedSplits.length > 0) {
        splitDisplay.textContent = 'Ready to start';
    } else {
        splitDisplay.textContent = 'No splits defined';
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
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((durationMs % 1000000000) / 1000000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function updateSplits(splits, predefinedSplits, currentSplitIndex) {
    const list = document.getElementById('splits-body');
    list.innerHTML = '';
    if (predefinedSplits && predefinedSplits.length > 0) {
        predefinedSplits.forEach((name, index) => {
            const row = document.createElement('div');
            row.className = 'split-row';
            const nameDiv = document.createElement('div');
            nameDiv.textContent = name;
            const segmentDiv = document.createElement('div');
            const cumulativeDiv = document.createElement('div');
            if (index <= currentSplitIndex && index < splits.length) {
                segmentDiv.textContent = formatTime(splits[index].segmentTime);
                cumulativeDiv.textContent = formatTime(splits[index].cumulativeTime);
            } else {
                segmentDiv.textContent = '--';
                cumulativeDiv.textContent = '--';
            }
            row.appendChild(nameDiv);
            row.appendChild(segmentDiv);
            row.appendChild(cumulativeDiv);
            list.appendChild(row);
        });
    } else {
        // Fallback, but since we have predefined, perhaps not needed
        splits.forEach(split => {
            const row = document.createElement('div');
            row.className = 'split-row';
            const nameDiv = document.createElement('div');
            nameDiv.textContent = split.name;
            const segmentDiv = document.createElement('div');
            segmentDiv.textContent = formatTime(split.segmentTime);
            const cumulativeDiv = document.createElement('div');
            cumulativeDiv.textContent = formatTime(split.cumulativeTime);
            row.appendChild(nameDiv);
            row.appendChild(segmentDiv);
            row.appendChild(cumulativeDiv);
            list.appendChild(row);
        });
    }
    updateTableHeight();
}

function updateTableHeight() {
    const container = document.querySelector('.splits-container');
    const rowHeight = 40; // Approximate height per row based on CSS
    container.style.maxHeight = (visibleSplits * rowHeight) + 'px';
}

// Settings modal
const modal = document.getElementById('settings-modal');
const settingsBtn = document.getElementById('settings-btn');
const closeBtn = document.getElementsByClassName('close')[0];
const saveSettingsBtn = document.getElementById('save-settings');
const wsIpInput = document.getElementById('ws-ip');

settingsBtn.onclick = () => {
    wsIpInput.value = serverIP;
    document.getElementById('visible-splits').value = visibleSplits;
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
    const newVisible = parseInt(document.getElementById('visible-splits').value);
    if (newIP && newVisible > 0) {
        serverIP = newIP;
        visibleSplits = newVisible;
        localStorage.setItem('timerServerIP', serverIP);
        localStorage.setItem('visibleSplits', visibleSplits);
        modal.style.display = 'none';
        updateTableHeight();
        // Reconnect with new IP
        ws.close();
connectWS();
updateTableHeight();
    }
};

// Splits modal
const splitsModal = document.getElementById('splits-modal');
const splitsBtn = document.getElementById('splits-btn');
const splitsCloseBtn = document.getElementsByClassName('splits-close')[0];

splitsBtn.onclick = () => {
    updatePredefinedList();
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
    predefinedSplits.forEach((name, index) => {
        const item = document.createElement('div');
        item.className = 'split-item';
        item.textContent = `${index + 1}. ${name}`;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Delete';
        removeBtn.onclick = () => {
            predefinedSplits.splice(index, 1);
            sendCommand('setSplits', { splits: predefinedSplits });
        };
        item.appendChild(removeBtn);
        list.appendChild(item);
    });
}

document.getElementById('add-predefined-btn').onclick = () => {
    const name = document.getElementById('predefined-name').value.trim();
    if (name) {
        predefinedSplits.push(name);
        sendCommand('setSplits', { splits: predefinedSplits });
        document.getElementById('predefined-name').value = '';
    }
};

document.getElementById('export-splits-btn').onclick = () => {
    const dataStr = JSON.stringify(predefinedSplits, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'splits.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
};

document.getElementById('import-splits-btn').onclick = () => {
    document.getElementById('import-splits-file').click();
};

document.getElementById('import-splits-file').onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported) && imported.every(item => typeof item === 'string')) {
                    predefinedSplits = imported;
                    sendCommand('setSplits', { splits: predefinedSplits });
                } else {
                    alert('Invalid JSON format. Expected an array of strings.');
                }
            } catch (err) {
                alert('Error parsing JSON file.');
            }
        };
        reader.readAsText(file);
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