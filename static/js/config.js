/**
 * Application-wide constants and configuration.
 * All magic numbers and hardcoded values are centralized here.
 */

// Default values
export const DEFAULT_SERVER_IP = 'localhost:8080';
export const DEFAULT_VISIBLE_SPLITS = 5;
export const DEFAULT_THEME = 'dark';
export const DEFAULT_TITLE = 'OpenSplit';
export const DEFAULT_ICON = '\u{1F3C3}'; // 🏃
export const DEFAULT_CONTAINER_WIDTH = 600;
export const MIN_CONTAINER_WIDTH = 400;
export const MAX_CONTAINER_WIDTH = 600;

// WebSocket
export const WS_RECONNECT_DELAY = 1000; // ms

// Auto-save
export const AUTO_SAVE_DEBOUNCE = 2000; // ms
export const MAX_AUTO_SAVE_BACKUPS = 3;
export const MAX_AUTO_SAVE_AGE_MINUTES = 1440; // 24 hours
export const RECENTLY_SAVED_THRESHOLD = 30000; // 30 seconds

// UI timing
export const SAVE_INDICATOR_INTERVAL = 60000; // 1 minute
export const SPLIT_ROW_HEIGHT = 40; // px

// Data format
export const DATA_VERSION = '1.0';

// Toast
export const TOAST_DEFAULT_DURATION = 3000; // ms

// localStorage keys
export const STORAGE_KEYS = {
    SERVER_IP: 'timerServerIP',
    THEME: 'theme',
    CONTAINER_WIDTH: 'containerWidth',
    LAST_EXPORT_TIME: 'lastExportTime',
    AUTO_SAVES: 'opensplit_autosaves',
    DISMISSED_RECOVERY: 'dismissedRecoveryTimestamp',
    SESSION_ACTIVE: 'opensplit_session_active', // sessionStorage
};
