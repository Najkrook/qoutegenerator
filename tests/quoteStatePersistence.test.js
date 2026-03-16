import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialQuoteState } from '../src/store/quoteStateSchema.js';
import {
    clearPersistedQuoteState,
    loadPersistedQuoteState,
    persistQuoteState
} from '../src/store/quoteStatePersistence.js';

function createStorage() {
    const store = new Map();
    return {
        getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
        setItem: vi.fn((key, value) => {
            store.set(key, value);
        }),
        removeItem: vi.fn((key) => {
            store.delete(key);
        })
    };
}

describe('quoteStatePersistence', () => {
    let storage;

    beforeEach(() => {
        storage = createStorage();
    });

    it('hydrates before persisting so sketch meta stays normalized', () => {
        persistQuoteState({
            ...createInitialQuoteState(),
            sketchMeta: {
                addedBahamaLine: 1,
                addedFiestaLine: 'yes'
            }
        }, storage);

        const loaded = loadPersistedQuoteState(storage);

        expect(loaded.sketchMeta).toEqual({
            addedBahamaLine: true,
            addedFiestaLine: true
        });
    });

    it('falls back to initial state when persisted JSON is malformed', () => {
        storage.getItem.mockReturnValueOnce('{broken');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const loaded = loadPersistedQuoteState(storage);

        expect(loaded).toEqual(createInitialQuoteState());
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it('clears persisted state through the same storage boundary', () => {
        clearPersistedQuoteState(storage);

        expect(storage.removeItem).toHaveBeenCalledTimes(1);
    });
});
