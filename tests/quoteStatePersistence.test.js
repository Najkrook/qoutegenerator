import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CURRENT_STATE_VERSION,
    createInitialQuoteState
} from '../src/store/quoteStateSchema';
import {
    clearPersistedQuoteState,
    getQuoteStateStorageKey,
    loadPersistedQuoteState,
    persistQuoteState
} from '../src/store/quoteStatePersistence';

const OWNER_UID = 'user-a';

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
        }, OWNER_UID, storage);

        const loaded = loadPersistedQuoteState(OWNER_UID, storage);

        expect(loaded.sketchMeta).toEqual({
            addedBahamaLine: true,
            addedFiestaLine: true
        });
    });

    it('falls back to initial state when persisted JSON is malformed', () => {
        storage.getItem.mockReturnValueOnce('{broken');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const loaded = loadPersistedQuoteState(OWNER_UID, storage);

        expect(loaded).toEqual(createInitialQuoteState());
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it('clears only the current owner persisted state', () => {
        clearPersistedQuoteState(OWNER_UID, storage);

        expect(storage.removeItem).toHaveBeenCalledWith(getQuoteStateStorageKey(OWNER_UID));
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
        }, OWNER_UID, storage);

        const loaded = loadPersistedQuoteState(OWNER_UID, storage);

        expect(loaded.builderItems[0].displayName).toBe('BaHaMa Jumbrella Merlot');
        expect(loaded.builderItems[0].addons[0].displayName).toBe('Varmare Merlot');
        expect(loaded.builderItems[0].addons[1].displayName).toBe('Speciallack Merlot');
        expect(loaded.builderItems[0].addons.map((addon) => addon.id)).toEqual(['heater', 'custom_1']);
    });

    it('round-trips contracting work through persistence without changing user text', () => {
        persistQuoteState({
            ...createInitialQuoteState(),
            contractingWork: {
                enabled: true,
                projectName: '  Designer Village  ',
                rows: [{
                    id: 'work_1',
                    workPackage: 'Grundarbeten',
                    scope: 'Schaktning\noch gjutning',
                    unit: ' samlat paket ',
                    priceExVatSek: 101600
                }],
                margin: {
                    enabled: true,
                    percent: 15
                },
                ata: {
                    enabled: true,
                    percent: 15
                }
            }
        }, OWNER_UID, storage);

        const loaded = loadPersistedQuoteState(OWNER_UID, storage);

        expect(loaded.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(loaded.contractingWork).toEqual({
            enabled: true,
            projectName: '  Designer Village  ',
            rows: [{
                id: 'work_1',
                workPackage: 'Grundarbeten',
                scope: 'Schaktning\noch gjutning',
                unit: ' samlat paket ',
                priceExVatSek: 101600
            }],
            margin: {
                enabled: true,
                percent: 15
            },
            ata: {
                enabled: true,
                percent: 15
            }
        });
    });

    it('isolates persisted drafts by authenticated owner', () => {
        const initial = createInitialQuoteState();
        persistQuoteState({
            ...initial,
            customerInfo: { ...initial.customerInfo, company: 'User A AB' }
        }, 'user-a', storage);
        persistQuoteState({
            ...initial,
            customerInfo: { ...initial.customerInfo, company: 'User B AB' }
        }, 'user-b', storage);

        expect(loadPersistedQuoteState('user-a', storage).customerInfo.company).toBe('User A AB');
        expect(loadPersistedQuoteState('user-b', storage).customerInfo.company).toBe('User B AB');
        expect(getQuoteStateStorageKey('user-a')).not.toBe(getQuoteStateStorageKey('user-b'));
    });

    it('does not read or write persisted state without an authenticated owner', () => {
        const initial = createInitialQuoteState();

        persistQuoteState(initial, null, storage);

        expect(storage.setItem).not.toHaveBeenCalled();
        expect(loadPersistedQuoteState(null, storage)).toEqual(initial);
    });
});
