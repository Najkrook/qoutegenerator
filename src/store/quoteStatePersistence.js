import {
    QUOTE_STATE_STORAGE_KEY,
    createInitialQuoteState,
    hydrateQuoteState
} from './quoteStateSchema.js';

export function loadPersistedQuoteState(storage = globalThis.localStorage) {
    if (!storage) {
        return createInitialQuoteState();
    }

    try {
        const saved = storage.getItem(QUOTE_STATE_STORAGE_KEY);
        if (!saved) {
            return createInitialQuoteState();
        }

        return hydrateQuoteState(JSON.parse(saved));
    } catch (error) {
        console.error('Failed to load state from localStorage', error);
        return createInitialQuoteState();
    }
}

export function persistQuoteState(state, storage = globalThis.localStorage) {
    if (!storage) return;

    try {
        storage.setItem(QUOTE_STATE_STORAGE_KEY, JSON.stringify(hydrateQuoteState(state)));
    } catch (error) {
        console.error('Failed to save state to localStorage', error);
    }
}

export function clearPersistedQuoteState(storage = globalThis.localStorage) {
    storage?.removeItem?.(QUOTE_STATE_STORAGE_KEY);
}
