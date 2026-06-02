import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { MarginSummaryPanel } from '../src/components/features/MarginSummaryPanel';
import { Header } from '../src/components/layout/Header';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function createSummaryData() {
    return {
        totals: [
            {
                model: 'BaHaMa Jumbrella',
                size: '3x3',
                unitPrice: 10000,
                qty: 1,
                gross: 10000,
                discountPct: 10,
                discountSek: 1000,
                net: 9000,
                isAddon: false,
                source: { type: 'builder', itemId: 'builder-1' },
                line: 'BaHaMa',
                sortModel: 'BaHaMa Jumbrella',
                sortSizeRaw: '3x3',
                sortKind: 'text',
                sortDimensions: [],
                originalIndex: 0
            }
        ],
        grossTotalSek: 10000,
        totalDiscountSek: 1000,
        finalTotalSek: 9000,
        globalDiscountAmt: 0
    };
}

function renderPanel(authOverrides = {}) {
    const authValue = {
        user: { uid: 'user-1', email: 'sales@example.com' },
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
        isRetailer: false,
        ...authOverrides
    };

    return renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
            <MarginSummaryPanel summaryData={createSummaryData()} />
        </AuthContext.Provider>
    );
}

function renderHeader(authOverrides = {}) {
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: vi.fn(() => 'portal-dark'),
            setItem: vi.fn()
        },
        configurable: true
    });

    const authValue = {
        user: { uid: 'user-1', email: 'sales@example.com' },
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
        isRetailer: false,
        ...authOverrides
    };

    return renderToStaticMarkup(
        <MemoryRouter initialEntries={['/']}>
            <AuthContext.Provider value={authValue}>
                <QuoteContext.Provider value={{ state: createInitialQuoteState(), dispatch: vi.fn() }}>
                    <Header />
                </QuoteContext.Provider>
            </AuthContext.Provider>
        </MemoryRouter>
    );
}

describe('MarginSummaryPanel visibility', () => {
    it('renders internal margin metrics for admins', () => {
        const html = renderPanel({
            accessLevel: 'full',
            canViewEverything: true,
            canAccessSketch: true,
            canExportSketchToQuote: true
        });

        expect(html).toContain('Intern marginal');
        expect(html).toContain('Estimerad kostnad');
        expect(html).toContain('Estimerad bruttovinst');
        expect(html).toContain('Aktuell marginal');
    });

    it('does not render margin metrics for non-admin users or retailers', () => {
        expect(renderPanel()).toBe('');
        expect(renderPanel({
            accessLevel: 'retailer',
            canStartQuote: true,
            canAccessQuoteHistory: true,
            retailer: { id: 'retailer-1', name: 'Nordvind' },
            isRetailer: true
        })).toBe('');
    });
});

describe('admin settings gear visibility', () => {
    it('renders the admin settings gear only for admins', () => {
        const adminHtml = renderHeader({
            accessLevel: 'full',
            canViewEverything: true,
            canAccessSketch: true,
            canExportSketchToQuote: true
        });
        const retailerHtml = renderHeader({
            accessLevel: 'retailer',
            canAccessQuoteHistory: true,
            retailer: { id: 'retailer-1', name: 'Nordvind' },
            isRetailer: true
        });

        expect(adminHtml).toContain('aria-label="Öppna admininställningar"');
        expect(retailerHtml).not.toContain('aria-label="Öppna admininställningar"');
    });
});
