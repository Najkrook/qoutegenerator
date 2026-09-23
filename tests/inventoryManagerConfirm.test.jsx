// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

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
                    qrId: '11111111-1111-4111-8111-111111111111',
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
    confirmChoiceAction: vi.fn(async () => 'cancel'),
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
import { writeClickitupInventoryDraft, createClickitupDraftSnapshot } from '../src/services/clickitupInventoryDraft';
import { createDefaultInventoryData } from '../src/views/inventoryData';

const mountedRoots = [];
let navigateForTest = null;

function RouterProbe() {
    const location = useLocation();
    navigateForTest = useNavigate();
    return <output data-testid="inventory-location">{`${location.pathname}${location.search}`}</output>;
}

const inventoryItem = {
    qrId: '11111111-1111-4111-8111-111111111111',
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
            <MemoryRouter initialEntries={['/inventory']}>
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
                        <RouterProbe />
                    </QuoteContext.Provider>
                </AuthContext.Provider>
            </MemoryRouter>
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
    window.localStorage.clear();
    navigateForTest = null;
    firebaseMocks.batchSet.mockReset();
    firebaseMocks.batchCommit.mockClear();
    firebaseMocks.getDoc.mockClear();
    notificationMocks.confirmAction.mockReset();
    notificationMocks.confirmAction.mockResolvedValue(false);
    notificationMocks.confirmChoiceAction.mockReset();
    notificationMocks.confirmChoiceAction.mockResolvedValue('cancel');
    notificationMocks.notifyError.mockReset();
    notificationMocks.notifyInfo.mockReset();
    notificationMocks.notifySuccess.mockReset();
    notificationMocks.notifyWarn.mockReset();
});

describe('InventoryManager BaHaMa V2 workflow', () => {
    it('uses the URL for Lagerkarta, Lista and Grenställ detail so browser back restores the prior view', async () => {
        const { container } = await renderInventoryManager();
        const locationOutput = container.querySelector('[data-testid="inventory-location"]');
        const listTab = Array.from(container.querySelectorAll('[role="tab"]'))
            .find((button) => button.textContent === 'Lista');

        expect(locationOutput.textContent).toBe('/inventory');
        expect(container.textContent).toContain('Lagerkarta');

        await act(async () => {
            listTab.click();
            await Promise.resolve();
        });
        expect(locationOutput.textContent).toBe('/inventory?view=list');
        expect(container.querySelector('[aria-label="BaHaMa lagerlista"]')).toBeTruthy();

        await act(async () => {
            navigateForTest(-1);
            await Promise.resolve();
        });
        expect(locationOutput.textContent).toBe('/inventory');

        const rackButton = Array.from(container.querySelectorAll('button')).find((button) => (
            button.getAttribute('aria-label') === 'Öppna Grenställ 1, 0/10 platser'
        ));
        await act(async () => {
            rackButton.click();
            await Promise.resolve();
        });
        expect(locationOutput.textContent).toBe('/inventory?view=rack&rack=1');
        expect(container.textContent).toContain('Till lagerkartan');

        await act(async () => {
            navigateForTest(-1);
            await Promise.resolve();
        });
        expect(locationOutput.textContent).toBe('/inventory');
    });

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
        const { container, dispatch } = await renderInventoryManager();
        const clickitupButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'ClickitUp');

        await act(async () => {
            clickitupButton.click();
            await Promise.resolve();
        });

        expect(container.textContent).toContain('ClickitUp lagersaldo');
        expect(container.textContent).toContain('Sektion');
        expect(container.textContent).toContain('Dörr H');
        expect(container.textContent).toContain('0 av 32 rader räknade');
        const openingAction = dispatch.mock.calls.map(([action]) => action).find((action) => action.type === 'SET_INVENTORY_DATA');
        expect(Object.values(openingAction.payload.clickitupAccessories).reduce((sum, value) => sum + value, 0)).toBe(843);

        const accessoriesTab = Array.from(container.querySelectorAll('[role="tab"]')).find((button) => button.textContent === 'Tillbehör');
        await act(async () => {
            accessoriesTab.click();
            await Promise.resolve();
        });
        expect(container.querySelector('[data-testid="inventory-location"]').textContent).toBe('/inventory?line=clickitup&tab=accessories');
        expect(container.textContent).toContain('Stickfötter');
        expect(container.textContent).toContain('Stolpe och smådelar');
    });

    it('offers local draft recovery after fetching cloud stock', async () => {
        const baseline = createDefaultInventoryData();
        const local = { ...baseline, clickitupAccessories: { stolpe: 30 } };
        writeClickitupInventoryDraft('admin-1', createClickitupDraftSnapshot(baseline), createClickitupDraftSnapshot(local));
        notificationMocks.confirmChoiceAction.mockResolvedValue('confirm');
        const { dispatch } = await renderInventoryManager();
        expect(firebaseMocks.getDoc).toHaveBeenCalled();
        expect(notificationMocks.confirmChoiceAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Återuppta inventering?' }));
        const draftAction = dispatch.mock.calls.map(([action]) => action).find((action) => action.type === 'SET_INVENTORY_DATA');
        expect(draftAction.payload.clickitupAccessories.stolpe).toBe(30);
    });

    it('saves accessory quantities with a delta log and counted markers in the inventory document', async () => {
        const base = createDefaultInventoryData();
        const cloud = { ...base, clickitupAccessories: { stolpe: 26 } };
        const local = { ...cloud, clickitupAccessories: { stolpe: 27 }, clickitupCounted: { 'accessory:stolpe': true } };
        const { container } = await renderInventoryManager({ inventoryData: local, cloudInventoryData: cloud });
        const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Spara ändringar');
        await act(async () => {
            saveButton.click();
            await Promise.resolve();
        });
        expect(firebaseMocks.batchCommit).toHaveBeenCalledTimes(1);
        expect(firebaseMocks.batchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            clickitupAccessories: { stolpe: 27 },
            clickitupCounted: { 'accessory:stolpe': true }
        }));
        expect(firebaseMocks.batchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            category: 'clickitup', targetType: 'accessory', targetId: 'stolpe', delta: 1
        }));
    });

    it('resets counted markers after confirmation while retaining balances', async () => {
        notificationMocks.confirmAction.mockResolvedValue(true);
        const base = createDefaultInventoryData();
        const local = { ...base, clickitupAccessories: { stolpe: 26 }, clickitupCounted: { 'accessory:stolpe': true } };
        const { container, dispatch } = await renderInventoryManager({ inventoryData: local, cloudInventoryData: local });
        const clickitupButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'ClickitUp');
        await act(async () => { clickitupButton.click(); await Promise.resolve(); });
        const resetButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Ny inventeringsrunda');
        dispatch.mockClear();
        await act(async () => { resetButton.click(); await Promise.resolve(); });
        expect(notificationMocks.confirmAction).toHaveBeenCalledWith(expect.objectContaining({ title: 'Starta ny inventeringsrunda' }));
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'SET_INVENTORY_DATA',
            payload: expect.objectContaining({ clickitupAccessories: { stolpe: 26 }, clickitupCounted: {} })
        }));
    });

    it('writes BaHaMa V2 inventory logs on save', async () => {
        const localItem = { ...inventoryItem, comment: 'Uppdaterad' };
        const { container, dispatch } = await renderInventoryManager({
            inventoryData: { bahama: [], bahamaV2: [localItem], clickitup: {}, notes: '' },
            cloudInventoryData: { bahama: [], bahamaV2: [], clickitup: {}, notes: '' }
        });
        const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Spara ändringar');
        dispatch.mockClear();
        firebaseMocks.writeBatch.mockClear();

        await act(async () => {
            saveButton.click();
            await Promise.resolve();
        });

        expect(firebaseMocks.writeBatch).toHaveBeenCalledTimes(1);
        expect(firebaseMocks.batchCommit).toHaveBeenCalledTimes(1);
        expect(firebaseMocks.batchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            bahamaV2: [expect.objectContaining({ qrId: inventoryItem.qrId })]
        }));
        expect(firebaseMocks.batchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            schemaVersion: 1, qrId: inventoryItem.qrId, active: true
        }));
        expect(firebaseMocks.batchSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            category: 'bahama',
            targetId: 'BA-001',
            details: expect.stringContaining('Parasoll')
        }));
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_CLOUD_INVENTORY_DATA' }));
        expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_INVENTORY_DATA' }));
    });
});
