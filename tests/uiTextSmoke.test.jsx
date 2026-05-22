import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

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
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
    collection: vi.fn(() => ({})),
    query: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    startAfter: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({ docs: [], empty: true })),
    addDoc: vi.fn(async () => ({ id: 'planner-1' })),
    setDoc: vi.fn(async () => ({})),
    updateDoc: vi.fn(async () => {}),
    deleteDoc: vi.fn(async () => {}),
    writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn(async () => {}) }))
}));

vi.mock('../src/components/features/SketchCanvas', () => ({
    SketchCanvas: () => React.createElement('div', null, 'SketchCanvasMock')
}));

vi.mock('../src/components/features/SketchConfig', () => ({
    SketchConfig: () => React.createElement('div', null, 'SketchConfigMock'),
    SketchSetupPanel: () => React.createElement('div', null, 'SketchSetupPanelMock'),
    SketchInspectorPanel: () => React.createElement('div', null, 'SketchInspectorPanelMock')
}));

vi.mock('../src/components/features/SketchBom', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        SketchReviewPanel: () => React.createElement('div', null, 'SketchReviewPanelMock')
    };
});

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

vi.mock('../src/components/features/PricingTable', () => ({
    PricingTable: () => React.createElement('div', null, 'PricingTableMock')
}));

vi.mock('../src/components/features/CustomCosts', () => ({
    CustomCosts: () => React.createElement('div', null, 'CustomCostsMock')
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

vi.mock('../src/services/retailerDocumentService', () => ({
    getRetailerDocumentKindLabel: vi.fn((kind) => (
        kind === 'installation-instructions' ? 'Installationsinstruktion' : 'Färgkarta'
    )),
    retailerDocumentService: {
        getRetailerDocumentsForLines: vi.fn(async () => []),
        listRetailerLineDocuments: vi.fn(async () => [])
    }
}));

vi.mock('../src/services/activityLogService', () => ({
    ACTIVITY_EVENT_DEFINITIONS: {
        quote_created: { label: 'Offert skapad' }
    },
    formatActivityMetadata: vi.fn(() => ''),
    getActivityEventDefinition: vi.fn(() => ({ label: 'Offert skapad' })),
    getActivityLogVisual: vi.fn(() => ({ icon: '??', color: 'var(--color-primary)', label: 'Offert skapad' })),
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

import { Dashboard } from '../src/views/Dashboard';
import { ActivityLogs, getActivityLogsEmptyStateMessage } from '../src/views/ActivityLogs';
import { InventoryLogs } from '../src/views/InventoryLogs';
import { InventoryManager } from '../src/views/InventoryManager';
import { Pricing } from '../src/views/Pricing';
import { RetailerManager } from '../src/views/RetailerManager';
import { History } from '../src/views/History';
import { BuilderConfig } from '../src/components/features/BuilderConfig';
import { Planner } from '../src/views/Planner';
import { Header } from '../src/components/layout/Header';
import { SketchBom } from '../src/components/features/SketchBom';
import { SketchTool } from '../src/views/SketchTool';
import { RetailerDocuments } from '../src/views/RetailerDocuments';
import { SummaryExport, getPdfExportBlockReason } from '../src/views/SummaryExport';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';

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
        retailer: null,
        isRetailer: false,
        ...authState.value,
        ...(overrides.auth || {})
    };
    const quoteValue = {
        ...quoteState.value,
        ...(overrides.quote || {})
    };
    const routeEntries = [overrides.route || '/'];

    return renderToStaticMarkup(
        <MemoryRouter initialEntries={routeEntries}>
            <AuthContext.Provider value={authValue}>
                <QuoteContext.Provider value={quoteValue}>
                    {node}
                </QuoteContext.Provider>
            </AuthContext.Provider>
        </MemoryRouter>
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
            <Dashboard
                onStartQuote={() => {}}
                onOpenHistory={() => {}}
                onOpenInventory={() => {}}
                onOpenSketch={() => {}}
                onOpenPlanner={() => {}}
                onOpenActivity={() => {}}
                onOpenRetailers={() => {}}
            />
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
            <Dashboard
                onStartQuote={() => {}}
                onOpenHistory={() => {}}
                onOpenInventory={() => {}}
                onOpenSketch={() => {}}
                onOpenPlanner={() => {}}
                onOpenActivity={() => {}}
                onOpenRetailers={() => {}}
            />
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
            <Dashboard
                onStartQuote={() => {}}
                onOpenHistory={() => {}}
                onOpenInventory={() => {}}
                onOpenSketch={() => {}}
                onOpenPlanner={() => {}}
                onOpenActivity={() => {}}
                onOpenRetailers={() => {}}
            />
        );

        expect(html).toContain('Välkommen till Brixx portal');
        expect(html).toContain('📄');
        expect(html).toContain('📦');
        expect(html).toContain('✏️');
        expect(html).toContain('🕘');
        expect(html).toContain('📋');
        expect(html).toContain('🏪');
        expect(html).not.toContain('aria-hidden="true">Dok<');
        expect(html).not.toContain('aria-hidden="true">Inv<');
        expect(html).not.toContain('aria-hidden="true">Pen<');
        expect(html).not.toContain('aria-hidden="true">Log<');
        expect(html).not.toContain('aria-hidden="true">Plan<');
        expect(html).not.toContain('aria-hidden="true">AF<');
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

    it('renders inventory logs filters and empty state for admin users', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: true,
            user: { uid: 'admin-1', email: 'admin@example.com' }
        };

        const html = renderWithProviders(<InventoryLogs onBack={() => {}} />);

        expect(html).toContain('Från datum');
        expect(html).toContain('Kategori');
        expect(html).toContain('Inga loggar matchar filtret.');
    });

    it('renders inventory manager loading state copy', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: true,
            user: { uid: 'admin-1', email: 'admin@example.com' }
        };

        const html = renderWithProviders(<InventoryManager onBack={() => {}} />);

        expect(html).toContain('Laddar lagersaldo...');
    });

    it('renders retailer manager loading state copy', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: true,
            user: { uid: 'admin-1', email: 'admin@example.com' }
        };

        const html = renderWithProviders(<RetailerManager onBack={() => {}} />);

        expect(html).toContain('Återförsäljare');
        expect(html).toContain('Laddar återförsäljare...');
    });

    it('renders retailer documents loading state copy', () => {
        authState.value = {
            canViewEverything: false,
            canStartQuote: true,
            canAccessSketch: false,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: false,
            user: { uid: 'retailer-1', email: 'retailer@example.com' },
            retailer: {
                id: 'retailer_1',
                name: 'Markishuset',
                email: 'retailer@example.com',
                productLines: {
                    BaHaMa: { enabled: true, discountPct: 12 }
                }
            },
            isRetailer: true
        };

        const html = renderWithProviders(<RetailerDocuments onBack={() => {}} />);

        expect(html).toContain('Produktdokument');
        expect(html).toContain('Laddar dokument...');
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
        const html = renderWithProviders(<Header />, { route: '/quote/new/product-lines' });

        expect(html).toContain('🏠');
        expect(html).toContain('🗑️');
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
        expect(html).toContain('Till offert');
        expect(html).toContain('SketchSetupPanelMock');
        expect(html).toContain('SketchReviewPanelMock');
        expect(html).toContain('animate-slide-in flex flex-col w-full');
        expect(html).toContain('flex-1 flex overflow-hidden relative bg-panel-bg');
        expect(html).toContain('hidden xl:flex w-[350px] flex-none');
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
        expect(html).toContain('Offerten saknar offertnummer');
        expect(html).toContain('Exportera ändå');
        expect(html).toContain('Exportera som Excel');
    });

    it('returns a clear save-first message when PDF export is attempted before quote numbering', () => {
        expect(getPdfExportBlockReason(null)).toBe('Offerten saknar offertnummer. Spara offerten för att tilldela ett nummer, eller exportera ändå utan nummer.');
        expect(getPdfExportBlockReason('BRIXX - 260422-101')).toBeNull();
    });

    it('renders Pricing labels for discounts and quote review', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: false,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: false
        };
        quoteState.value = {
            state: {
                ...quoteState.value.state,
                step: 3,
                globalDiscountPct: 10
            },
            dispatch: vi.fn()
        };

        const html = renderWithProviders(<Pricing onNext={() => {}} onPrev={() => {}} />);

        expect(html).toContain('Priser &amp; Rabatter');
        expect(html).toContain('Övergripande offertrabatt (%)');
        expect(html).toContain('Växelkurs (EUR → SEK)');
        expect(html).toContain('Granska Offert');
    });

    it('renders History labels for filters and loading state', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: false,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: false,
            user: { uid: 'admin-1', email: 'admin@example.com' }
        };

        const html = renderWithProviders(<History onBack={() => {}} onOpenQuote={() => {}} />);

        expect(html).toContain('Alla statusar');
        expect(html).toContain('Alla datum');
        expect(html).toContain('Senast uppdaterad');
        expect(html).toContain('Sök företag eller referens');
        expect(html).toContain('Laddar offerter...');
    });

    it('renders Planner labels for empty state and form controls', () => {
        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: true,
            user: { uid: 'admin-1', email: 'admin@example.com' }
        };

        const html = renderWithProviders(<Planner onBack={() => {}} />);

        expect(html).toContain('Projektplanerare');
        expect(html).toContain('Ingen etablerare');
        expect(html).toContain('Lägg till');
        expect(html).toContain('Laddar projekt...');
    });

    it('renders a scrollable planner week list while hiding empty historical weeks', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-22T12:00:00.000Z'));

        authState.value = {
            canViewEverything: true,
            canStartQuote: true,
            canAccessSketch: true,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: true,
            user: { uid: 'admin-1', email: 'admin@example.com' }
        };

        const html = renderWithProviders(<Planner onBack={() => {}} />);

        expect(html).toContain('overflow-y-auto');
        expect(html).not.toContain('2025-W43');
        expect(html).toContain('Denna vecka (2026-W17)');
        expect(html).toContain('2026-W25');

        vi.useRealTimers();
    });

    it('renders BuilderConfig empty state labels for selected builder lines', () => {
        quoteState.value = {
            state: {
                ...quoteState.value.state,
                selectedLines: ['BaHaMa'],
                builderItems: []
            },
            dispatch: vi.fn()
        };

        const html = renderWithProviders(<BuilderConfig />);

        expect(html).toContain('Inga produkter valda ännu');
        expect(html).toContain('Lägg till produkt');
    });
});
