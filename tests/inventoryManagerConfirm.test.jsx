// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const firebaseMocks = vi.hoisted(() => ({
    db: {},
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(async () => ({
        exists: () => true,
        data: () => ({
            bahama: [{
                ID: '3.5.1',
                TYP: 'JUMB',
                STORLEK: '4x4',
                TEXTIL: '',
                BESKRIVNING: 'Testartikel',
                Kommentar: ''
            }],
            clickitup: {},
            notes: ''
        })
    })),
    collection: vi.fn(() => ({})),
    writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn(async () => {}) }))
}));

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

async function renderInventoryManager() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const dispatch = vi.fn();
    const inventoryItem = {
        ID: '3.5.1',
        TYP: 'JUMB',
        STORLEK: '4x4',
        TEXTIL: '',
        BESKRIVNING: 'Testartikel',
        Kommentar: ''
    };

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
                    state: {
                        ...createInitialQuoteState(),
                        inventoryData: { bahama: [inventoryItem], clickitup: {}, notes: '' },
                        cloudInventoryData: { bahama: [inventoryItem], clickitup: {}, notes: '' }
                    },
                    dispatch
                }}>
                    <InventoryManager onBack={() => {}} />
                </QuoteContext.Provider>
            </AuthContext.Provider>
        );
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return { container };
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
    notificationMocks.confirmAction.mockReset();
    notificationMocks.confirmAction.mockResolvedValue(false);
    notificationMocks.notifyError.mockReset();
    notificationMocks.notifyInfo.mockReset();
    notificationMocks.notifySuccess.mockReset();
    notificationMocks.notifyWarn.mockReset();
});

describe('InventoryManager delete confirmation', () => {
    it('uses confirmAction before removing a BaHaMa item', async () => {
        const { container } = await renderInventoryManager();
        const sectionToggle = Array.from(container.querySelectorAll('button')).find((button) => (
            button.textContent?.includes('BaHaMa lagersaldo')
        ));

        await act(async () => {
            sectionToggle.click();
            await Promise.resolve();
        });

        const deleteButton = Array.from(container.querySelectorAll('button')).find((button) => (
            button.textContent === 'Del'
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
});
