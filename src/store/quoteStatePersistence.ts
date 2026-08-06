import type { HydratedQuoteStatePayload, QuoteState } from '../types/contracts';
import {
    QUOTE_STATE_STORAGE_KEY,
    createInitialQuoteState,
    hydrateQuoteState
} from './quoteStateSchema';

export function getQuoteStateStorageKey(ownerUid: string | null | undefined): string | null {
    const normalizedOwnerUid = String(ownerUid ?? '').trim();
    return normalizedOwnerUid ? `${QUOTE_STATE_STORAGE_KEY}:${normalizedOwnerUid}` : null;
}

export function loadPersistedQuoteState(
    ownerUid: string | null | undefined,
    storage: Storage | undefined = globalThis.localStorage
): QuoteState {
    const storageKey = getQuoteStateStorageKey(ownerUid);
    if (!storage || !storageKey) {
        return createInitialQuoteState();
    }

    try {
        const saved = storage.getItem(storageKey);
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
    ownerUid: string | null | undefined,
    storage: Storage | undefined = globalThis.localStorage
) {
    const storageKey = getQuoteStateStorageKey(ownerUid);
    if (!storage || !storageKey) return;

    try {
        storage.setItem(storageKey, JSON.stringify(hydrateQuoteState(state)));
    } catch (error) {
        console.error('Failed to save state to localStorage', error);
    }
}

export function clearPersistedQuoteState(
    ownerUid: string | null | undefined,
    storage: Storage | undefined = globalThis.localStorage
) {
    const storageKey = getQuoteStateStorageKey(ownerUid);
    if (storageKey) {
        storage?.removeItem?.(storageKey);
    }
}
