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
    return loadPersistedQuoteWorkspace(ownerUid, storage).state;
}

export function loadPersistedQuoteWorkspace(
    ownerUid: string | null | undefined,
    storage: Storage | undefined = globalThis.localStorage
): { state: QuoteState; savedSignature: string | null } {
    const empty = () => ({ state: createInitialQuoteState(), savedSignature: null });
    const storageKey = getQuoteStateStorageKey(ownerUid);
    if (!storage || !storageKey) {
        return empty();
    }

    try {
        const saved = storage.getItem(storageKey);
        if (!saved) {
            return empty();
        }

        const parsed = JSON.parse(saved);
        if (parsed?.workspaceVersion === 1) {
            return {
                state: hydrateQuoteState(parsed.state),
                savedSignature: typeof parsed.savedSignature === 'string' ? parsed.savedSignature : null
            };
        }
        return { state: hydrateQuoteState(parsed), savedSignature: null };
    } catch (error) {
        console.error('Failed to load state from localStorage', error);
        return empty();
    }
}

export function persistQuoteState(
    state: QuoteState | HydratedQuoteStatePayload,
    ownerUid: string | null | undefined,
    storage: Storage | undefined = globalThis.localStorage,
    savedSignature: string | null = null
) {
    const storageKey = getQuoteStateStorageKey(ownerUid);
    if (!storage || !storageKey) return;

    try {
        storage.setItem(storageKey, JSON.stringify({
            workspaceVersion: 1,
            state: hydrateQuoteState(state),
            savedSignature
        }));
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
