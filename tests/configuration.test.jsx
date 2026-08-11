// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';
import { Configuration } from '../src/views/Configuration';

vi.mock('../src/components/features/BuilderConfig', () => ({
    BuilderConfig: () => <div>Builder configuration</div>
}));

vi.mock('../src/components/features/GridConfig', () => ({
    GridConfig: () => <div>Grid configuration</div>
}));

vi.mock('../src/components/features/ContractingWorkEditor', () => ({
    ContractingWorkEditor: () => <div>Contracting work</div>
}));

const auth = {
    user: { uid: 'user-1', email: 'user@example.com' },
    loading: false,
    accessLevel: 'quote-only',
    canViewEverything: false,
    canStartQuote: true,
    canAccessSketch: false,
    canAccessQuoteHistory: true,
    canExportSketchToQuote: false,
    login: vi.fn(),
    logout: vi.fn(),
    retailer: null,
    isRetailer: false
};

function renderConfiguration(gridSelection) {
    const state = {
        ...createInitialQuoteState(),
        selectedLines: ['ClickitUp'],
        gridSelections: { ClickitUp: gridSelection }
    };

    return render(
        <AuthContext.Provider value={auth}>
            <QuoteContext.Provider value={{ state, dispatch: vi.fn() }}>
                <Configuration onNext={vi.fn()} onPrev={vi.fn()} />
            </QuoteContext.Provider>
        </AuthContext.Provider>
    );
}

function continueButton() {
    return screen.getByRole('button', { name: /priss/i });
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('Configuration custom grid content', () => {
    it('enables Continue for either custom collection while empty collections remain disabled', () => {
        const customItemsRender = renderConfiguration({
            items: {},
            addons: {},
            customAddonsByCategory: {},
            customItems: [{
                id: 'custom-item-1',
                name: 'Custom item',
                size: 'Special size',
                price: 12000,
                qty: 1,
                discountPct: 0
            }]
        });
        expect(continueButton().disabled).toBe(false);
        expect(screen.queryByText(/Inga produkter/i)).toBeNull();
        customItemsRender.unmount();

        const customAddonsRender = renderConfiguration({
            items: {},
            addons: {},
            customItems: [],
            customAddonsByCategory: {
                special: [{
                    id: 'custom-addon-1',
                    name: 'Custom add-on',
                    price: 2500,
                    qty: 1,
                    discountPct: 0
                }]
            }
        });
        expect(continueButton().disabled).toBe(false);
        expect(screen.queryByText(/Inga produkter/i)).toBeNull();
        customAddonsRender.unmount();

        renderConfiguration({
            items: {},
            addons: {},
            customItems: [],
            customAddonsByCategory: { special: [] }
        });
        expect(continueButton().disabled).toBe(true);
        expect(screen.getByText(/Inga produkter/i)).toBeTruthy();
    });
});
