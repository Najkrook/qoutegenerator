import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dashboard } from '../src/views/Dashboard';
import {
    ProductLineSelection,
    buildProductLineOptions,
    getFirstEnabledProductLineId
} from '../src/views/ProductLineSelection';
import { Pricing } from '../src/views/Pricing';
import { QuoteContext } from '../src/store/QuoteContext';
import { AuthContext } from '../src/store/AuthContext';

vi.mock('../src/services/firebase', () => ({
    db: {},
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
    setDoc: vi.fn(async () => ({})),
    updateDoc: vi.fn(async () => ({})),
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({ docs: [], empty: true }))
}));

vi.mock('../src/components/features/PricingTable', () => ({
    PricingTable: () => React.createElement('div', null, 'PricingTableMock')
}));

vi.mock('../src/components/features/CustomCosts', () => ({
    CustomCosts: () => React.createElement('div', null, 'CustomCostsMock')
}));

function renderWithProviders(node, overrides = {}) {
    const quoteValue = {
        state: {
            selectedLines: ['BaHaMa'],
            builderItems: [],
            gridSelections: {},
            customCosts: [],
            includesVat: false,
            globalDiscountPct: 12,
            prevGlobalDiscountPct: 12,
            exchangeRate: 12.2,
            customerInfo: {
                name: '',
                company: '',
                email: '',
                reference: '',
                customerReference: '',
                date: '',
                validity: '30 dagar',
                extraNotes: ''
            },
            step: 1,
            inventoryData: { bahama: [], clickitup: {} },
            cloudInventoryData: { bahama: [], clickitup: {} },
            sketchDraft: null,
            sketchMeta: { addedBahamaLine: false },
            ...overrides.state
        },
        dispatch: vi.fn(),
        ...overrides.quote
    };

    const authValue = {
        user: { uid: 'retailer-1', email: 'retailer@example.com' },
        loading: false,
        accessLevel: 'retailer',
        canViewEverything: false,
        canStartQuote: true,
        canAccessSketch: false,
        canAccessQuoteHistory: true,
        canExportSketchToQuote: false,
        login: vi.fn(),
        logout: vi.fn(),
        retailer: {
            id: 'retailer_1',
            name: 'Markishuset',
            email: 'retailer@example.com',
            notes: 'Priority partner',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 12 },
                ClickitUp: { enabled: false, discountPct: 0 }
            }
        },
        isRetailer: true,
        ...overrides.auth
    };

    return renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
            <QuoteContext.Provider value={quoteValue}>
                {node}
            </QuoteContext.Provider>
        </AuthContext.Provider>
    );
}

describe('Retailer workspace', () => {
    it('renders a retailer-specific dashboard overview with quote and history CTAs', () => {
        const html = renderWithProviders(
            <Dashboard
                onStartQuote={() => {}}
                onOpenHistory={() => {}}
                onOpenInventory={() => {}}
                onOpenSketch={() => {}}
                onOpenRetailerDocuments={() => {}}
            />
        );

        expect(html).toContain('Retailer Workspace');
        expect(html).toContain('Välkommen, Markishuset');
        expect(html).toContain('Aktiva produktlinjer');
        expect(html).toContain('12% rabatt');
        expect(html).toContain('Starta Ny Offert');
        expect(html).toContain('Mina Offerter');
        expect(html).toContain('Produktdokument');
        expect(html).not.toContain('Hantera Lagersaldo');
        expect(html).not.toContain('Senaste Händelser');
    });

    it('renders retailer product line selection with only active lines and discount preview', () => {
        const html = renderWithProviders(<ProductLineSelection onNext={() => {}} />);

        expect(html).toContain('Retailer Scope');
        expect(html).toContain('BaHaMa');
        expect(html).not.toContain('ClickitUp');
        expect(html).toContain('12% rabatt');
        expect(html).not.toContain('Ingår inte i ert retailer-avtal.');
        expect(html).not.toContain('Ej tillgänglig');
        expect(html).toContain('Förhandsvisning: 12% retailer-rabatt');
        expect((html.match(/type="radio"/g) || []).length).toBe(1);
        expect(html).not.toContain('disabled=""');
    });

    it('shows a retailer empty state when no product lines are enabled', () => {
        const html = renderWithProviders(
            <ProductLineSelection onNext={() => {}} />,
            {
                auth: {
                    retailer: {
                        id: 'retailer_1',
                        name: 'Markishuset',
                        email: 'retailer@example.com',
                        notes: 'Priority partner',
                        productLines: {
                            BaHaMa: { enabled: false, discountPct: 0 },
                            ClickitUp: { enabled: false, discountPct: 0 }
                        }
                    }
                },
                state: {
                    selectedLines: []
                }
            }
        );

        expect(html).toContain('Inga produktlinjer är tillgängliga för ert retailer-konto ännu.');
        expect(html).not.toContain('BaHaMa');
        expect(html).not.toContain('ClickitUp');
        expect(html).toContain('cursor-not-allowed');
    });

    it('renders retailer pricing guidance with global and row discounts capped by the retailer agreement', () => {
        const html = renderWithProviders(
            <Pricing onNext={() => {}} onPrev={() => {}} />,
            {
                state: {
                    step: 3,
                    selectedLines: ['BaHaMa'],
                    globalDiscountPct: 12
                }
            }
        );

        expect(html).toContain('Retailer-prissättning');
        expect(html).toContain('Vald produktlinje: BaHaMa');
        expect(html).toContain('Avtalad retailer-rabatt');
        expect(html).toContain('MAX 12%');
        expect(html).toContain('CustomCostsMock');
        expect(html).toContain('PricingTableMock');
        expect(html).toContain('både övergripande och per rad');
        expect(html).toContain('max="12"');
        expect(html).not.toContain('disabled=""');
        expect(html).not.toContain('Växelkurs (EUR → SEK)');
    });

    it('builds retailer line options using only enabled lines with a stable default selection', () => {
        const retailer = {
            name: 'Markishuset',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 12 },
                ClickitUp: { enabled: false, discountPct: 0 }
            }
        };

        const options = buildProductLineOptions(true, retailer);

        expect(options.map((option) => option.id)).toEqual(['BaHaMa']);
        expect(options.find((option) => option.id === 'BaHaMa')).toMatchObject({ enabled: true, retailerDiscountPct: 12 });
        expect(getFirstEnabledProductLineId(options)).toBe('BaHaMa');
    });
});
