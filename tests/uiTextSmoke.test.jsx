import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const authState = vi.hoisted(() => ({
    value: {
        canViewEverything: false,
        canStartQuote: false,
        canAccessSketch: false,
        canAccessQuoteHistory: false,
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
            step: 0,
            inventoryData: { bahama: [], clickitup: {} },
            cloudInventoryData: { bahama: [], clickitup: {} },
            sketchDraft: null,
            sketchMeta: { addedBahamaLine: false }
        },
        dispatch: vi.fn()
    }
}));

vi.mock('../src/services/firebase', () => ({
    db: {},
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    startAfter: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({ docs: [] }))
}));

vi.mock('../src/components/features/SketchCanvas', () => ({
    SketchCanvas: () => React.createElement('div', null, 'SketchCanvasMock')
}));

vi.mock('../src/components/features/SketchConfig', () => ({
    SketchConfig: () => React.createElement('div', null, 'SketchConfigMock')
}));

vi.mock('../src/components/features/StockComparisonModal', () => ({
    StockComparisonModal: () => null
}));

vi.mock('../src/components/features/CustomerInfoForm', () => ({
    CustomerInfoForm: () => React.createElement('div', null, 'CustomerInfoFormMock')
}));

vi.mock('../src/components/features/FinalSummaryTable', () => ({
    FinalSummaryTable: () => React.createElement('div', null, 'FinalSummaryTableMock')
}));

vi.mock('../src/components/features/TermsAndPaymentPanel', () => ({
    TermsAndPaymentPanel: () => React.createElement('div', null, 'TermsAndPaymentPanelMock')
}));

vi.mock('../src/services/calculationEngine', () => ({
    computeQuoteTotals: () => ({
        totals: [],
        finalTotalSek: 0,
        grossTotalSek: 0,
        totalDiscountSek: 0
    })
}));

vi.mock('../src/utils/fileUtils', () => ({
    downloadBlob: vi.fn(),
    saveBlobWithPicker: vi.fn(async () => 'unavailable')
}));

vi.mock('../src/services/quoteRepositoryClient', () => ({
    quoteRepository: {}
}));

vi.mock('../src/services/quoteSaveService', () => ({
    saveQuoteToRepository: vi.fn()
}));

vi.mock('../src/services/activityLogService', () => ({
    ACTIVITY_EVENT_DEFINITIONS: {
        quote_created: { label: 'Offert skapad' }
    },
    formatActivityMetadata: vi.fn(() => ''),
    getActivityEventDefinition: vi.fn(() => ({ label: 'Offert skapad' })),
    getActivityLogVisual: vi.fn(() => ({ icon: '📄', color: 'var(--color-primary)', label: 'Offert skapad' })),
    getActivitySystemLabel: vi.fn(() => 'Offert'),
    normalizeActivityLog: vi.fn((value) => value),
    safeLogActivity: vi.fn()
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
import { ActivityLogs, getActivityLogsEmptyStateMessage } from '../src/views/ActivityLogs.jsx';
import { Header } from '../src/components/layout/Header.jsx';
import { SketchBom } from '../src/components/features/SketchBom.jsx';
import { SketchTool } from '../src/views/SketchTool.jsx';
import { SummaryExport } from '../src/views/SummaryExport.jsx';
import { AuthContext } from '../src/store/AuthContext.jsx';
import { QuoteContext } from '../src/store/QuoteContext.jsx';

function renderWithProviders(node, overrides = {}) {
    const authValue = {
        user: null,
        loading: false,
        accessLevel: 'guest',
        canViewEverything: false,
        canStartQuote: false,
        canAccessSketch: false,
        canAccessQuoteHistory: false,
        canExportSketchToQuote: false,
        login: vi.fn(),
        logout: vi.fn(),
        ...authState.value,
        ...(overrides.auth || {})
    };
    const quoteValue = {
        ...quoteState.value,
        ...(overrides.quote || {})
    };

    return renderToStaticMarkup(
        <AuthContext.Provider value={authValue}>
            <QuoteContext.Provider value={quoteValue}>
                {node}
            </QuoteContext.Provider>
        </AuthContext.Provider>
    );
}

describe('UI text smoke', () => {
    beforeEach(() => {
        authState.value = {
            canViewEverything: false,
            canStartQuote: false,
            canAccessSketch: false,
            canAccessQuoteHistory: false,
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
                step: 0,
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
            canAccessQuoteHistory: true,
            canExportSketchToQuote: false
        };

        const html = renderWithProviders(
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
            canAccessQuoteHistory: false,
            canExportSketchToQuote: false
        };

        const html = renderWithProviders(
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
            canAccessQuoteHistory: true,
            canExportSketchToQuote: true
        };

        const html = renderWithProviders(
            <Dashboard onStartQuote={() => {}} onOpenInventory={() => {}} onOpenSketch={() => {}} />
        );

        expect(html).toContain('Välkommen till Brixx portal');
        expect(html).toContain('Skapa Ny Offert');
        expect(html).toContain('Rita Uteservering');
        expect(html).toContain('Inga loggade händelser ännu. Nya sparade offerter och exporter visas här.');
    });

    it('renders activity log empty state for an untouched log list', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: true,
            user: { uid: 'admin-1', email: 'admin@example.com' }
        };

        const html = renderWithProviders(<ActivityLogs onBack={() => {}} />);

        expect(html).toContain('Aktivitetslogg');
        expect(html).toContain('Inga loggade händelser ännu.');
    });

    it('returns a filter-specific empty state message for filtered activity views', () => {
        expect(getActivityLogsEmptyStateMessage({
            loading: false,
            hasError: false,
            hasActiveFilters: true
        })).toBe('Inga loggar matchar de aktiva filtren.');
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

    it('renders Mina Offerter for quote-only users without Lagerloggar', () => {
        authState.value = {
            canViewEverything: false,
            canStartQuote: true,
            canAccessSketch: false,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: false,
            user: { email: 'sales@example.com' }
        };
        quoteState.value = {
            state: {
                ...quoteState.value.state,
                step: 1
            },
            dispatch: vi.fn()
        };

        const html = renderWithProviders(<Header />);

        expect(html).toContain('Mina Offerter');
        expect(html).not.toContain('Lagerloggar');
    });

    it('renders SketchTool header copy correctly', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: true
        };

        const html = renderWithProviders(<SketchTool onBack={() => {}} />);

        expect(html).toContain('Rita Uteservering');
        expect(html).toContain('Återställ ritning');
        expect(html).toContain('Tillbaka');
        expect(html).toContain('Förslag');
    });

    it('renders SummaryExport labels for save, preview, and export actions', () => {
        authState.value = {
            canViewEverything: false,
            canStartQuote: true,
            canAccessSketch: false,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: false,
            user: { email: 'sales@example.com' }
        };
        quoteState.value = {
            state: {
                ...quoteState.value.state,
                step: 4,
                customerInfo: {
                    ...quoteState.value.state.customerInfo,
                    name: 'Ada'
                },
                includeTerms: false,
                includePaymentBox: false,
                includeSignatureBlock: false
            },
            dispatch: vi.fn()
        };

        const html = renderWithProviders(<SummaryExport onPrev={() => {}} />);

        expect(html).toContain('Offertsammanställning');
        expect(html).toContain('Spara offert');
        expect(html).toContain('PDF förhandsvisning');
        expect(html).toContain('Exportera som PDF');
        expect(html).toContain('Exportera som Excel');
    });
});
