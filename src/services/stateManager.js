import {
    QUOTE_STATE_STORAGE_KEY,
    createInitialQuoteState,
    hydrateQuoteState
} from '../store/quoteStateSchema.js';

export const state = createInitialQuoteState();

let saveDebounceMs = 750;
let saveTimer = null;
let persistenceInitialized = false;

export function saveState() {
    try {
        localStorage.setItem(QUOTE_STATE_STORAGE_KEY, JSON.stringify(hydrateQuoteState(state)));
    } catch (e) {
        // Silently fail if storage is full
    }
}

export function flushStateNow() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    saveState();
}

export function markStateDirty() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveState();
    }, saveDebounceMs);
}

export function initStatePersistence({ debounceMs = 750 } = {}) {
    saveDebounceMs = debounceMs;
    if (persistenceInitialized) return;

    window.addEventListener('beforeunload', () => {
        flushStateNow();
    });

    persistenceInitialized = true;
}

export function loadState() {
    try {
        const saved = localStorage.getItem(QUOTE_STATE_STORAGE_KEY);
        if (saved) {
            Object.assign(state, hydrateQuoteState(JSON.parse(saved)));
        }
    } catch (e) {
        console.warn('Failed to load persisted quote state, using defaults.', e);
        Object.assign(state, createInitialQuoteState());
    }
}

export function clearState() {
    localStorage.removeItem(QUOTE_STATE_STORAGE_KEY);
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    Object.assign(state, createInitialQuoteState());
    location.reload();
}
