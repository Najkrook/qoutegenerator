// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const firebaseMocks = vi.hoisted(() => {
    const batchSet = vi.fn();
    const batchCommit = vi.fn(async () => {});
    return {
        db: {},
        doc: vi.fn(() => ({})),
        getDoc: vi.fn(async () => ({
            exists: () => true,
            data: () => ({
                bahama: [{ ID: 'legacy-1', BESKRIVNING: 'Legacyrad' }],
                bahamaV2: [{
                    id: 'BA-001',
                    type: 'Parasoll',
                    size: '4x4',
                    status: 'available',
                    location: 'Grenställ 3',
                    properties: {
                        stativ: 'RAL 7016',
                        textil: 'MUSHROOM',
                        fot: 'TIPP',
                        belysning: '',
                        varme: ''
                    },
                    comment: '',
                    createdAt: '2026-06-01T10:00:00.000Z',
                    updatedAt: '2026-06-01T10:00:00.000Z',
                    updatedByUid: 'admin-1',
                    updatedByEmail: 'admin@example.com'
                }],
                clickitup: {},
                notes: ''
            })
        })),
        collection: vi.fn(() => ({})),
        writeBatch: vi.fn(() => ({ set: batchSet, commit: batchCommit })),
        batchSet,
        batchCommit
    };
});

const notificationMocks = vi.hoisted(() => ({
    confirmAction: vi.fn(async () => false),
    notifyError: vi.fn(),
    notifyInfo: vi.fn(),
    notifySuccess: vi.fn(),
    notifyWarn: vi.fn()
}));

vi.mock('../src/services/firebase', () => firebaseMocks);
vi.mock('../src/services/notificationService', () => notificationMocks);

import { InventoryManager } from '../src/views/InventoryManager';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

const mountedRoots = [];

const inventoryItem = {
    id: 'BA-001',
    type: 'Parasoll',
    size: '4x4',
    status: 'available',
    location: 'Grenställ 3',
    properties: {
        stativ: 'RAL 7016',
        textil: 'MUSHROOM',
        fot: 'TIPP',
        belysning: '',
        varme: ''
    },
    comment: '',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    updatedByUid: 'admin-1',
    updatedByEmail: 'admin@example.com'
};

function createStateOverrides(overrides = {}) {
    return {
        ...createInitialQuoteState(),
        inventoryData: { bahama: [], bahamaV2: [inventoryItem], clickitup: {}, notes: '' },
        cloudInventoryData: { bahama: [], bahamaV2: [inventoryItem], clickitup: {}, notes: '' },
        ...overrides
    };
}

async function renderInventoryManager(stateOverrides = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const dispatch = vi.fn();

    await act(async () => {
        root.render(
            <AuthContext.Provider value={{
                user: { uid: 'admin-1', email: 'admin@example.com' },
                loading: false,
                accessLevel: 'full',
                canViewEverything: true,
                canStartQuote: true,
                canAccessSketch: true,
                canAccessQuoteHistory: true,
                canExportSketchToQuote: true,
                login: vi.fn(),
                logout: vi.fn(),
                retailer: null,
                isRetailer: false
            }}>
                <QuoteContext.Provider value={{
                    state: createStateOverrides(stateOverrides),
                    dispatch
                }}>
                    <InventoryManager onBack={() => {}} />
                </QuoteContext.Provider>
            </AuthContext.Provider>
        );
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return { container, dispatch };
}

function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }
});

beforeEach(() => {
    firebaseMocks.batchSet.mockReset();
    firebaseMocks.batchCommit.mockClear();
    notificationMocks.confirmAction.mockReset();
    notificationMocks.confirmAction.mockResolvedValue(false);
    notificationMocks.notifyError.mockReset();
    notificationMocks.notifyInfo.mockReset();
    notificationMocks.notifySuccess.mockReset();
    notificationMocks.notifyWarn.mockReset();
});

describe('InventoryManager BaHaMa V2 workflow', () => {
    it('uses confirmAction before removing a BaHaMa V2 item', async () => {
        const { container } = await renderInventoryManager();
        const deleteButton = Array.from(container.querySelectorAll('button')).find((button) => (
            button.textContent === 'Ta bort'
        ));

        expect(deleteButton).toBeTruthy();

        await act(async () => {
            deleteButton.click();
            await Promise.resolve();
        });

        expect(notificationMocks.confirmAction).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Ta bort artikel',
            confirmText: 'Ta bort',
            cancelText: 'Avbryt'
        }));
    });

    it('creates a manual BaHaMa V2 row through the inspector', async () => {
        const { container, dispatch } = await renderInventoryManager({
            inventoryData: { bahama: [], bahamaV2: [], clickitup: {}, notes: '' },
            cloudInventoryData: { bahama: [], bahamaV2: [], clickitup: {}, notes: '' }
        });
        const newButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Ny artikel');

        await act(async () => {
            newButton.click();
            await Promise.resolve();
        });

        const idInput = container.querySelector('input[placeholder="BA-001"]');
        const typeInput = container.querySelector('input[placeholder="Pure"]');
        const form = container.querySelector('form');

        await act(async () => {
            setInputValue(idInput, ' BA-002 ');
            setInputValue(typeInput, ' Parasoll ');
            await Promise.resolve();
        });

        await act(async () => {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            await Promise.resolve();
        });

        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'SET_INVENTORY_DATA',
            payload: expect.objectContaining({
                bahamaV2: [expect.objectContaining({
                    id: 'BA-002',
                    type: 'Parasoll',
                    updatedByUid: 'admin-1',
                    updatedByEmail: 'admin@example.com'
                })]
            })
        }));
    });

    it('switches between BaHaMa and ClickitUp without changing ClickitUp grid flow', async () => {
        const { container } = await renderInventoryManager();
        const clickitupButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'ClickitUp');

        await act(async () => {
            clickitupButton.click();
            await Promise.resolve();
        });

        expect(container.textContent).toContain('ClickitUp lagersaldo');
        expect(container.textContent).toContain('Sektion');
        expect(container.textContent).toContain('Dörr H');
    });

    it('writes BaHaMa V2 inventory logs on save', async () => {
        const localItem = { ...inventoryItem, comment: 'Uppdaterad' };
        const { container } = await renderInventoryManager({
            inventoryData: { bahama: [], bahamaV2: [localItem], clickitup: {}, notes: '' },
            cloudInventoryData: { bahama: [], bahamaV2: [], clickitup: {}, notes: '' }
        });
        const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Spara ändringar');

        await act(async () => {
            saveButton.click();
            await Promise.resolve();
        });

        expect(firebaseMocks.batchCommit).toHaveBeenCalled();
        expect(firebaseMocks.batchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            category: 'bahama',
            targetId: 'BA-001',
            details: expect.stringContaining('Parasoll')
        }));
    });
});
