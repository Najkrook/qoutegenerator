import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const authState = vi.hoisted(() => ({
    value: {
        canViewEverything: false,
        canStartQuote: false,
        canAccessSketch: false,
        canExportSketchToQuote: false
    }
}));

const quoteState = vi.hoisted(() => ({
    value: {
        state: {
            selectedLines: [],
            builderItems: [],
            gridSelections: {},
            customCosts: [],
            includesVat: false,
            globalDiscountPct: 0,
            prevGlobalDiscountPct: 0,
            exchangeRate: 12.2,
            customerInfo: {
                name: '',
                company: '',
                email: '',
                reference: '',
                date: '',
                validity: '30 dagar'
            },
            inventoryData: { bahama: [], clickitup: {} },
            cloudInventoryData: { bahama: [], clickitup: {} },
            sketchDraft: null,
            sketchMeta: { addedBahamaLine: false }
        },
        dispatch: vi.fn()
    }
}));

vi.mock('../src/store/AuthContext.jsx', () => ({
    useAuth: () => authState.value
}));

vi.mock('../src/store/QuoteContext.jsx', () => ({
    useQuote: () => quoteState.value
}));

vi.mock('../src/services/firebase', () => ({
    db: {},
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({ docs: [] }))
}));

vi.mock('../src/components/features/SketchCanvas.jsx', () => ({
    SketchCanvas: () => React.createElement('div', null, 'SketchCanvasMock')
}));

vi.mock('../src/components/features/SketchConfig.jsx', () => ({
    SketchConfig: () => React.createElement('div', null, 'SketchConfigMock')
}));

vi.mock('../src/components/features/StockComparisonModal.jsx', () => ({
    StockComparisonModal: () => null
}));

vi.mock('react-hot-toast', () => ({
    default: {
        error: vi.fn(),
        success: vi.fn(),
        loading: vi.fn(() => 'toast-id'),
        dismiss: vi.fn()
    }
}));

import { Dashboard } from '../src/views/Dashboard.jsx';
import { SketchBom } from '../src/components/features/SketchBom.jsx';
import { SketchTool } from '../src/views/SketchTool.jsx';

describe('UI text smoke', () => {
    beforeEach(() => {
        authState.value = {
            canViewEverything: false,
            canStartQuote: false,
            canAccessSketch: false,
            canExportSketchToQuote: false
        };
        quoteState.value = {
            state: {
                selectedLines: [],
                builderItems: [],
                gridSelections: {},
                customCosts: [],
                includesVat: false,
                globalDiscountPct: 0,
                prevGlobalDiscountPct: 0,
                exchangeRate: 12.2,
                customerInfo: {
                    name: '',
                    company: '',
                    email: '',
                    reference: '',
                    date: '',
                    validity: '30 dagar'
                },
                inventoryData: { bahama: [], clickitup: {} },
                cloudInventoryData: { bahama: [], clickitup: {} },
                sketchDraft: null,
                sketchMeta: { addedBahamaLine: false }
            },
            dispatch: vi.fn()
        };
    });

    it('renders quote-only dashboard copy correctly', () => {
        authState.value = {
            canViewEverything: false,
            canStartQuote: true,
            canAccessSketch: false,
            canExportSketchToQuote: false
        };

        const html = renderToStaticMarkup(
            <Dashboard onStartQuote={() => {}} onOpenInventory={() => {}} onOpenSketch={() => {}} />
        );

        expect(html).toContain('Skapa Ny Offert');
        expect(html).not.toContain('Rita Uteservering');
    });

    it('renders sketch-only dashboard copy correctly', () => {
        authState.value = {
            canViewEverything: false,
            canStartQuote: false,
            canAccessSketch: true,
            canExportSketchToQuote: false
        };

        const html = renderToStaticMarkup(
            <Dashboard onStartQuote={() => {}} onOpenInventory={() => {}} onOpenSketch={() => {}} />
        );

        expect(html).toContain('Rita Uteservering');
        expect(html).not.toContain('Skapa Ny Offert');
    });

    it('renders full-access dashboard header copy correctly', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canExportSketchToQuote: true
        };

        const html = renderToStaticMarkup(
            <Dashboard onStartQuote={() => {}} onOpenInventory={() => {}} onOpenSketch={() => {}} />
        );

        expect(html).toContain('Välkommen till Brixx portal');
        expect(html).toContain('Skapa Ny Offert');
        expect(html).toContain('Rita Uteservering');
    });

    it('renders SketchBom labels and restricted export copy correctly', () => {
        const html = renderToStaticMarkup(
            <SketchBom
                counts={{ '1600': 2 }}
                totalGlassLength={3200}
                slimlineCount={1}
                stodbenCount={1}
                hasInvalidEdges
                invalidEdges={[['left']]}
                autoAdjustedEdges={[]}
                parasols={[{ label: '3x3 Kvadrat' }]}
                parasolWarnings={[{ text: 'För nära vägg' }]}
                canExportToQuote={false}
                onExport={() => {}}
                onExportImage={() => {}}
            />
        );

        expect(html).toContain('Materialförteckning');
        expect(html).toContain('Kräver kontroll');
        expect(html).toContain('Varning (Parasoll)');
        expect(html).toContain('Ladda ner Bild');
        expect(html).toContain('Export till Offert ej tillgänglig');
    });

    it('renders SketchTool header copy correctly', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canExportSketchToQuote: true
        };

        const html = renderToStaticMarkup(<SketchTool onBack={() => {}} />);

        expect(html).toContain('Rita Uteservering');
        expect(html).toContain('Återställ vy');
        expect(html).toContain('Tillbaka');
        expect(html).toContain('Förslag');
    });
});
