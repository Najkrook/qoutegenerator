import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';
import {
    clearPersistedQuoteState,
    loadPersistedQuoteState,
    persistQuoteState
} from '../src/store/quoteStatePersistence';

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

    it('round-trips builder displayName overrides through persistence', () => {
        persistQuoteState({
            ...createInitialQuoteState(),
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    displayName: 'BaHaMa Jumbrella Merlot',
                    addons: [
                        {
                            id: 'heater',
                            qty: 1,
                            discountPct: 0,
                            displayName: 'Varmare Merlot'
                        },
                        {
                            id: 'custom_1',
                            qty: 2,
                            discountPct: 0,
                            isCustom: true,
                            name: 'Speciallack',
                            displayName: 'Speciallack Merlot',
                            price: 900,
                            categoryId: 'installation'
                        }
                    ]
                }
            ]
        }, storage);

        const loaded = loadPersistedQuoteState(storage);

        expect(loaded.builderItems[0].displayName).toBe('BaHaMa Jumbrella Merlot');
        expect(loaded.builderItems[0].addons[0].displayName).toBe('Varmare Merlot');
        expect(loaded.builderItems[0].addons[1].displayName).toBe('Speciallack Merlot');
        expect(loaded.builderItems[0].addons.map((addon) => addon.id)).toEqual(['heater', 'custom_1']);
    });
});
