import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PricingTable } from '../src/components/features/PricingTable';
import { QuoteContext } from '../src/store/QuoteContext';
import { AuthContext } from '../src/store/AuthContext';

function renderPricingTable(stateOverrides = {}) {
    const quoteValue = {
        state: {
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [
                        { id: 'heater', qty: 1, discountPct: 0 }
                    ]
                }
            ],
            gridSelections: {},
            customCosts: [],
            globalDiscountPct: 0,
            exchangeRate: 12.2,
            includesVat: false,
            ...stateOverrides
        },
        dispatch: vi.fn()
    };

    const authValue = {
        user: null,
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
    };

    return renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
            <QuoteContext.Provider value={quoteValue}>
                <PricingTable />
            </QuoteContext.Provider>
        </AuthContext.Provider>
    );
}

describe('PricingTable name editing UX', () => {
    it('renders the current builder row text as the input value when no override exists', () => {
        const html = renderPricingTable();

        expect(html).toContain('value="BaHaMa Jumbrella"');
        expect(html).toContain('value="Tillval: heater"');
        expect(html).not.toContain('placeholder="BaHaMa Jumbrella"');
    });

    it('renders the saved override directly in the input value', () => {
        const html = renderPricingTable({
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    displayName: 'BaHaMa Jumbrella RAL 7016',
                    addons: [
                        { id: 'heater', qty: 1, discountPct: 0, displayName: '  + Tillval: Varmare RAL 7016' }
                    ]
                }
            ]
        });

        expect(html).toContain('value="BaHaMa Jumbrella RAL 7016"');
        expect(html).toContain('value="  + Tillval: Varmare RAL 7016"');
    });

    it('renders drag handles for builder rows and removes the old arrow buttons', () => {
        const html = renderPricingTable({
            customCosts: [
                { description: 'Transport', price: 1000, qty: 1, discountPct: 0 }
            ]
        });

        const productHandles = html.match(/aria-label="Dra och flytta produkt"/g) || [];
        const addonHandles = html.match(/aria-label="Dra och flytta tillval"/g) || [];

        expect(productHandles).toHaveLength(1);
        expect(addonHandles).toHaveLength(1);
        expect(html).not.toContain('aria-label="Flytta upp"');
        expect(html).not.toContain('aria-label="Flytta ner"');
    });
});
