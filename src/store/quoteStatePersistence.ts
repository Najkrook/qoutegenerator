import type { HydratedQuoteStatePayload, QuoteState } from '../types/contracts';
import {
    QUOTE_STATE_STORAGE_KEY,
    createInitialQuoteState,
    hydrateQuoteState
} from './quoteStateSchema';

export function loadPersistedQuoteState(storage: Storage | undefined = globalThis.localStorage): QuoteState {
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

export function persistQuoteState(
    state: QuoteState | HydratedQuoteStatePayload,
    storage: Storage | undefined = globalThis.localStorage
) {
    if (!storage) return;

    try {
        storage.setItem(QUOTE_STATE_STORAGE_KEY, JSON.stringify(hydrateQuoteState(state)));
    } catch (error) {
        console.error('Failed to save state to localStorage', error);
    }
}

export function clearPersistedQuoteState(storage: Storage | undefined = globalThis.localStorage) {
    storage?.removeItem?.(QUOTE_STATE_STORAGE_KEY);
}
