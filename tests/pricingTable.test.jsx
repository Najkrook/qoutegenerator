import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PricingTable, clampPricingRowDiscount } from '../src/components/features/PricingTable';
import { QuoteContext } from '../src/store/QuoteContext';
import { AuthContext } from '../src/store/AuthContext';

function renderPricingTable(stateOverrides = {}, authOverrides = {}) {
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
            selectedLines: ['BaHaMa'],
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
        isRetailer: false,
        ...authOverrides
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

    it('renders editable retailer row discounts with the retailer discount as max', () => {
        const html = renderPricingTable(
            {
                globalDiscountPct: 12
            },
            {
                accessLevel: 'retailer',
                canViewEverything: false,
                canAccessSketch: false,
                canExportSketchToQuote: false,
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 30 }
                    }
                },
                isRetailer: true
            }
        );

        const discountInputs = html.match(/<input type="number" step="1" min="0" max="30"[^>]*>/g) || [];

        expect(discountInputs.length).toBeGreaterThan(0);
        expect(discountInputs.every((input) => !input.includes('disabled=""'))).toBe(true);
    });
});

describe('PricingTable retailer discount bounds', () => {
    it('clamps retailer row discounts to the retailer maximum', () => {
        expect(clampPricingRowDiscount('18', true, 30)).toBe(18);
        expect(clampPricingRowDiscount('35', true, 30)).toBe(30);
    });

    it('keeps non-retailer row discounts on the normal 0-100 scale', () => {
        expect(clampPricingRowDiscount('35', false, 30)).toBe(35);
        expect(clampPricingRowDiscount('140', false, 30)).toBe(100);
    });
});

describe('PricingTable priceUponRequest rendering', () => {
    it('renders "Pris på förfrågan" instead of numeric prices and displays the totals-exclusion footnote', () => {
        const html = renderPricingTable({
            builderItems: [
                {
                    id: 'builder_outside_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella outSide',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [
                        {
                            id: 'outside_classic_light_4',
                            qty: 1,
                            discountPct: 0
                        }
                    ]
                }
            ]
        });

        // The accessory outside_classic_light_4 is a request-based item and has priceUponRequest: true
        expect(html).toContain('Pris på förfrågan');
        // The discount percentage field should render a "-" for that row
        expect(html).toContain('<span class="text-text-secondary italic text-xs">-</span>');
        // Footnote should be displayed
        expect(html).toContain('* Totalsumman exkluderar artiklar med pris på förfrågan');
    });
});

describe('PricingTable ClickitUp export language rendering', () => {
    it('translates only ClickitUp article content while keeping pricing controls Swedish', () => {
        const html = renderPricingTable({
            builderItems: [],
            selectedLines: ['ClickitUp'],
            exportLanguage: 'en',
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Sektion|1000': { qty: 1, discountPct: 0 }
                    },
                    addons: {
                        frakt_glas: { qty: 1, discountPct: 0 }
                    },
                    customAddonsByCategory: {}
                }
            }
        });

        expect(html).toContain('ClickitUp section');
        expect(html).toContain('Add-on: Glass freight – special pallet');
        expect(html).toContain('Modell/Beskrivning');
        expect(html).toContain('Rabatt %');
        expect(html).toContain('Summa brutto');
        expect(html).not.toContain('Model/Description');
    });
});
