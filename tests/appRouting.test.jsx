// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class TestRequest {
    constructor(input, init = {}) {
        this.url = String(input);
        this.signal = init.signal ?? null;
        this.method = init.method || 'GET';
        this.headers = new Headers(init.headers || {});
    }
}

globalThis.Request = TestRequest;

if (typeof window !== 'undefined') {
    window.AbortController = globalThis.AbortController;
    window.AbortSignal = globalThis.AbortSignal;
    window.Request = TestRequest;
    window.fetch = globalThis.fetch;
}

const firebaseMocks = vi.hoisted(() => ({
    db: {},
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
    onSnapshot: vi.fn(() => () => {})
}));

const notificationMocks = vi.hoisted(() => ({
    confirmAction: vi.fn(async () => true),
    confirmChoiceAction: vi.fn(async () => 'confirm'),
    notifyWarn: vi.fn()
}));

const crmMocks = vi.hoisted(() => ({
    getDeal: vi.fn(async () => null),
    getCompany: vi.fn(async () => null),
    getContact: vi.fn(async () => null)
}));

vi.mock('../src/services/firebase', () => firebaseMocks);
vi.mock('../src/services/notificationService', () => notificationMocks);
vi.mock('../src/services/crmRepository', () => ({
    crmRepository: crmMocks
}));

vi.mock('../src/views/Dashboard', () => ({
    Dashboard: ({
        onStartQuote,
        onContinueQuote,
        onOpenCrm,
        onOpenInventory,
        onOpenPlanner,
        onOpenPriceList
    }) => (
        <div>
            <div>DashboardView</div>
            <button type="button" onClick={() => onStartQuote?.()}>Starta Ny Offert</button>
            {onContinueQuote && (
                <button type="button" onClick={() => onContinueQuote()}>Fortsätt offert</button>
            )}
            <button type="button" onClick={() => onOpenCrm?.()}>Öppna CRM</button>
            <button type="button" onClick={() => onOpenInventory?.()}>Öppna lager</button>
            <button type="button" onClick={() => onOpenPlanner?.()}>Öppna planering</button>
            <button type="button" onClick={() => onOpenPriceList?.()}>Öppna prislistan</button>
        </div>
    )
}));

vi.mock('../src/views/ProductLineSelection', () => ({
    ProductLineSelection: () => <div>ProductLinesView</div>
}));

vi.mock('../src/views/Configuration', () => ({
    Configuration: () => <div>ConfigurationView</div>
}));

vi.mock('../src/views/Pricing', () => ({
    Pricing: () => <div>PricingView</div>
}));

vi.mock('../src/views/Login', () => ({
    Login: () => <div>LoginView</div>
}));

vi.mock('../src/views/SummaryExport', () => ({
    SummaryExport: () => <div>SummaryView</div>
}));

vi.mock('../src/views/PriceList', () => ({
    PriceList: () => <div>PriceListView</div>
}));

vi.mock('../src/views/InventoryManager', () => ({
    InventoryManager: () => <div>InventoryView</div>
}));

vi.mock('../src/views/InventoryQrGenerator', () => ({
    InventoryQrGenerator: () => <div>InventoryQrView</div>
}));

vi.mock('../src/views/QrScanner', () => ({
    QrScanner: () => <div>QrScannerView</div>
}));

vi.mock('../src/views/QrParasolDetail', () => ({
    QrParasolDetail: () => <div>QrParasolDetailView</div>
}));

vi.mock('../src/views/Planner', () => ({
    Planner: () => <div>PlannerView</div>
}));

vi.mock('../src/views/crm/CrmDashboard', () => ({
    CrmDashboardPage: () => <div>CrmDashboardView</div>
}));

vi.mock('../src/views/crm/CrmPipeline', () => ({
    CrmPipelinePage: () => <div>CrmPipelineView</div>
}));

vi.mock('../src/views/crm/CrmCustomers', () => ({
    CrmCustomersPage: () => <div>CrmCustomersView</div>
}));

vi.mock('../src/views/crm/CrmCompanyDetail', () => ({
    CrmCompanyDetailPage: () => <div>CrmCompanyDetailView</div>
}));

vi.mock('../src/views/crm/CrmContactDetail', () => ({
    CrmContactDetailPage: () => <div>CrmContactDetailView</div>
}));

vi.mock('../src/views/crm/CrmDealDetail', () => ({
    CrmDealDetailPage: () => <div>CrmDealDetailView</div>
}));

vi.mock('../src/views/crm/CrmActivities', () => ({
    CrmActivitiesPage: () => <div>CrmActivitiesView</div>
}));

vi.mock('../src/views/RetailerManager', () => ({
    RetailerManager: () => <div>RetailersView</div>
}));

vi.mock('../src/views/RetailerOrderRequests', () => ({
    RetailerOrderRequests: () => <div>RetailerOrdersView</div>
}));

vi.mock('../src/views/RetailerOrderHistory', () => ({
    RetailerOrderHistory: () => <div>RetailerOrderHistoryView</div>
}));

vi.mock('../src/views/RetailerDocuments', () => ({
    RetailerDocuments: () => <div>RetailerDocumentsView</div>
}));

vi.mock('../src/views/History', () => ({
    History: ({ onOpenQuote }) => (
        <div>
            <button
                type="button"
                onClick={() => onOpenQuote?.({
                    selectedLines: ['BaHaMa'],
                    customerInfo: { name: 'Ada' },
                    activeQuoteId: 'quote-1',
                    activeQuoteVersion: 2,
                    quoteStatus: 'draft'
                })}
            >
                Open History Quote
            </button>
            <button
                type="button"
                onClick={() => onOpenQuote?.({
                    selectedLines: ['BaHaMa'],
                    builderItems: [{
                        id: 'item-1',
                        line: 'BaHaMa',
                        model: 'Jumbrella',
                        size: '4x4 Kvadrat',
                        qty: 1,
                        discountPct: 0,
                        addons: []
                    }],
                    customerInfo: { name: 'Ada' },
                    activeQuoteId: 'quote-2',
                    activeQuoteVersion: 3,
                    quoteStatus: 'draft'
                })}
            >
                Open Configured History Quote
            </button>
            <button
                type="button"
                onClick={() => onOpenQuote?.({
                    selectedLines: ['BaHaMa'],
                    builderItems: [{
                        id: 'item-owned',
                        line: 'BaHaMa',
                        model: 'Jumbrella',
                        size: '4x4 Kvadrat',
                        qty: 1,
                        discountPct: 0,
                        addons: []
                    }],
                    customerInfo: { name: 'Ada' },
                    activeQuoteId: 'quote-owned',
                    activeQuoteVersion: 1,
                    quoteStatus: 'draft'
                }, { quoteOwnerUid: 'other-owner' })}
            >
                Open Other Owner Quote
            </button>
            <button
                type="button"
                onClick={() => onOpenQuote?.({
                    selectedLines: [],
                    builderItems: [],
                    gridSelections: {},
                    contractingWork: {
                        enabled: true,
                        projectName: 'Designer Village',
                        rows: [{
                            id: 'work-1',
                            workPackage: 'Markarbete',
                            scope: 'Schaktning och fundament',
                            unit: 'Samlat arbetspaket',
                            priceExVatSek: 101600
                        }],
                        ata: { enabled: true, percent: 15 }
                    },
                    customerInfo: { name: 'Ada' },
                    activeQuoteId: 'quote-contracting',
                    activeQuoteVersion: 1,
                    quoteStatus: 'draft'
                })}
            >
                Open Contracting History Quote
            </button>
        </div>
    )
}));

vi.mock('../src/views/SketchTool', () => ({
    SketchTool: ({ onBack, onExportToQuoteComplete, onOpenVisualization }) => (
        <div>
            <button type="button" onClick={onBack}>Back From Sketch</button>
            <button type="button" onClick={onExportToQuoteComplete}>Export From Sketch</button>
            <button type="button" onClick={onOpenVisualization}>Open 3D Visualization</button>
        </div>
    )
}));

vi.mock('../src/views/SketchVisualization', () => ({
    SketchVisualization: ({ onBack }) => (
        <div>
            <div>SketchVisualizationView</div>
            <button type="button" onClick={onBack}>Back From 3D Prototype</button>
        </div>
    )
}));

import { appRoutes } from '../src/App';
import { APP_PATHS, APP_ROUTE_IDS } from '../src/navigation/routes';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

const mountedRoots = [];

function createAuthValue(overrides = {}) {
    return {
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
        isRetailer: false,
        ...overrides
    };
}

async function renderApp({
    initialEntries = ['/'],
    auth = {},
    quoteState = createInitialQuoteState(),
    dispatch = vi.fn()
} = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const router = createMemoryRouter(appRoutes, { initialEntries });
    const authValue = createAuthValue(auth);

    await act(async () => {
        root.render(
            <AuthContext.Provider value={authValue}>
                <QuoteContext.Provider value={{ state: quoteState, dispatch }}>
                    <RouterProvider router={router} />
                </QuoteContext.Provider>
            </AuthContext.Provider>
        );
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return { container, dispatch, router };
}

async function clickButton(container, label) {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) => (
        candidate.textContent?.includes(label)
    ));

    expect(button).toBeTruthy();

    await act(async () => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
    });
}

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }
    vi.clearAllMocks();
    notificationMocks.confirmAction.mockResolvedValue(true);
    notificationMocks.confirmChoiceAction.mockResolvedValue('confirm');
    crmMocks.getDeal.mockResolvedValue(null);
    crmMocks.getCompany.mockResolvedValue(null);
    crmMocks.getContact.mockResolvedValue(null);
});

describe('app routing', () => {
    it.each(['quote-only', 'retailer'])('denies both 3D URLs to %s', async (accessLevel) => {
        for (const path of ['/sketch/3d', '/sketch/3d-prototype']) {
            const view = await renderApp({ initialEntries: [path], auth: { accessLevel } });
            expect(view.router.state.location.pathname).toBe('/');
            expect(view.container.textContent).not.toContain('SketchVisualizationView');
        }
    });

    it('requires login before opening the 3D route and preserves the return target', async () => {
        const view = await renderApp({
            initialEntries: ['/sketch/3d?return=quote-summary'],
            auth: { user: null, accessLevel: 'guest' }
        });
        expect(view.router.state.location.pathname).toBe('/login');
        expect(new URLSearchParams(view.router.state.location.search).get('next')).toBe('/sketch/3d?return=quote-summary');
    });
    it('redirects the old 3D URL while preserving query context and direct-entry return', async () => {
        const view = await renderApp({
            initialEntries: ['/sketch/3d-prototype?return=quote-summary&crmDealId=deal-1'],
            auth: { accessLevel: 'sketch-only', canAccessSketch: true }
        });
        expect(view.router.state.location.pathname).toBe('/sketch/3d');
        expect(view.router.state.location.search).toBe('?return=quote-summary&crmDealId=deal-1');
        await clickButton(view.container, 'Back From 3D Prototype');
        expect(view.router.state.location.pathname).toBe('/sketch');
        expect(view.router.state.location.search).toBe('?return=quote-summary&crmDealId=deal-1');
    });
    it('opens 3D in the same tab and returns with the original sketch context', async () => {
        const sketch = await renderApp({
            initialEntries: ['/sketch?return=quote-summary&crmDealId=deal-1'],
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            }
        });

        await clickButton(sketch.container, 'Open 3D Visualization');

        expect(sketch.router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.sketchVisualization]);
        expect(sketch.router.state.location.search).toBe('?return=quote-summary&crmDealId=deal-1');
        await clickButton(sketch.container, 'Back From 3D Prototype');
        expect(sketch.router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.sketch]);
        expect(sketch.router.state.location.search).toBe('?return=quote-summary&crmDealId=deal-1');
    });

    it('uses the focus shell without global navigation on sketch routes', async () => {
        const sketch = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.sketch]],
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            }
        });

        const focusShell = sketch.container.querySelector('[data-app-shell="focus"]');
        expect(focusShell).toBeTruthy();
        expect(focusShell.classList.contains('h-dvh')).toBe(true);
        expect(focusShell.classList.contains('min-h-0')).toBe(true);
        expect(focusShell.classList.contains('overflow-hidden')).toBe(true);
        expect(focusShell.firstElementChild.classList.contains('max-w-[1920px]')).toBe(true);
        expect(focusShell.querySelector('header')).toBeNull();
        expect(focusShell.querySelector('#main-content').classList.contains('overflow-hidden')).toBe(true);

        const prototype = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.sketchVisualization]],
            auth: {
                accessLevel: 'sketch-only',
                canAccessSketch: true
            }
        });
        expect(prototype.container.textContent).toContain('SketchVisualizationView');
        expect(prototype.container.querySelector('[data-app-shell="focus"]')).toBeTruthy();

        const dashboard = await renderApp({
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            }
        });

        const defaultShell = dashboard.container.querySelector('[data-app-shell="default"]');
        expect(defaultShell).toBeTruthy();
        expect(defaultShell.classList.contains('min-h-dvh')).toBe(true);
        expect(defaultShell.classList.contains('h-dvh')).toBe(false);
        expect(defaultShell.querySelector('header')).toBeTruthy();
        expect(defaultShell.firstElementChild.classList.contains('max-w-[1400px]')).toBe(true);
    });

    it('only bootstraps shared inventory for full-access users', async () => {
        await renderApp();
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(firebaseMocks.getDoc).not.toHaveBeenCalled();

        await renderApp({
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            }
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(firebaseMocks.getDoc).toHaveBeenCalledTimes(1);
    });

    it('allows full admins to open CRM and redirects quote-only users', async () => {
        const admin = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.crmDashboard]],
            auth: {
                accessLevel: 'full',
                canViewEverything: true
            }
        });

        expect(admin.router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.crmDashboard]);
        expect(admin.container.textContent).toContain('CrmDashboardView');

        const quoteOnly = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.crmDashboard]]
        });

        expect(quoteOnly.router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(quoteOnly.container.textContent).toContain('DashboardView');
    });

    it('allows quote users and retailers to open the price list without a quote draft', async () => {
        const quoteOnly = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.priceList]]
        });

        expect(quoteOnly.router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.priceList]);
        expect(quoteOnly.container.textContent).toContain('PriceListView');

        const retailer = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.priceList]],
            auth: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: {
                    id: 'retailer-1',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 20 }
                    }
                }
            }
        });

        expect(retailer.router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.priceList]);
        expect(retailer.container.textContent).toContain('PriceListView');
    });

    it.each([
        [APP_PATHS[APP_ROUTE_IDS.inventoryQr], 'InventoryQrView'],
        [APP_PATHS[APP_ROUTE_IDS.qrScanner], 'QrScannerView'],
        ['/p/d1d3ba1f-bdee-4f45-8f63-04b379e3d45b', 'QrParasolDetailView']
    ])('allows admins to open the QR route %s and redirects quote-only users', async (path, expectedView) => {
        const admin = await renderApp({
            initialEntries: [path],
            auth: {
                accessLevel: 'full',
                canViewEverything: true
            }
        });

        expect(admin.router.state.location.pathname).toBe(path);
        expect(admin.container.textContent).toContain(expectedView);

        const quoteOnly = await renderApp({ initialEntries: [path] });

        expect(quoteOnly.router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(quoteOnly.container.textContent).toContain('DashboardView');
    });

    it.each([
        ['Öppna CRM', APP_PATHS[APP_ROUTE_IDS.crmDashboard], 'CrmDashboardView'],
        ['Öppna lager', APP_PATHS[APP_ROUTE_IDS.inventory], 'InventoryView'],
        ['Öppna planering', APP_PATHS[APP_ROUTE_IDS.planner], 'PlannerView'],
        ['Öppna prislistan', APP_PATHS[APP_ROUTE_IDS.priceList], 'PriceListView']
    ])('wires the admin dashboard action %s to its route', async (
        actionLabel,
        expectedPath,
        expectedView
    ) => {
        const { container, router } = await renderApp({
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            }
        });

        await clickButton(container, actionLabel);

        expect(router.state.location.pathname).toBe(expectedPath);
        expect(container.textContent).toContain(expectedView);
    });

    it('opens dynamic CRM detail routes for full admins', async () => {
        const { container, router } = await renderApp({
            initialEntries: ['/crm/deals/deal-1'],
            auth: {
                accessLevel: 'full',
                canViewEverything: true
            }
        });

        expect(router.state.location.pathname).toBe('/crm/deals/deal-1');
        expect(container.textContent).toContain('CrmDealDetailView');
    });

    it('redirects unauthenticated users to login and preserves the full next URL', async () => {
        const { container, router } = await renderApp({
            initialEntries: ['/sketch?return=quote-summary'],
            auth: {
                user: null,
                accessLevel: 'guest',
                canStartQuote: false,
                canAccessSketch: false,
                canAccessQuoteHistory: false
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.login]);
        expect(router.state.location.search).toBe('?next=%2Fsketch%3Freturn%3Dquote-summary');
        expect(container.textContent).toContain('LoginView');
    });

    it('redirects unauthorized admin routes back to the dashboard', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.inventory]]
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(container.textContent).toContain('DashboardView');
    });

    it('allows admins to open the retailer order request inbox route', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.retailerOrders]],
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.retailerOrders]);
        expect(container.textContent).toContain('RetailerOrdersView');
    });

    it('allows retailers to open the retailer documents route', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.retailerDocuments]],
            auth: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 20 }
                    }
                },
                isRetailer: true
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.retailerDocuments]);
        expect(container.textContent).toContain('RetailerDocumentsView');
    });

    it('allows retailers to open the retailer order history route', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.retailerOrderHistory]],
            auth: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 20 }
                    }
                },
                isRetailer: true
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.retailerOrderHistory]);
        expect(container.textContent).toContain('RetailerOrderHistoryView');
    });

    it('redirects quote-only users away from the retailer documents route', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.retailerDocuments]]
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(container.textContent).toContain('DashboardView');
    });

    it('redirects quote-only users away from the retailer order history route', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.retailerOrderHistory]]
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
        expect(container.textContent).toContain('DashboardView');
    });

    it('redirects quote configuration to product lines when no line is selected', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quoteConfiguration]]
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
        expect(container.textContent).toContain('ProductLinesView');
    });

    it('redirects quote pricing to configuration when the draft has no configured selections', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quotePricing]],
            quoteState: {
                ...createInitialQuoteState(),
                selectedLines: ['BaHaMa']
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteConfiguration]);
        expect(container.textContent).toContain('ConfigurationView');
    });

    it('allows direct loads of valid quote-step routes', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quoteSummary]],
            quoteState: {
                ...createInitialQuoteState(),
                selectedLines: ['BaHaMa'],
                builderItems: [{
                    id: 'item-1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }]
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
        expect(container.textContent).toContain('SummaryView');
    });

    it('allows a non-retailer to load a configured contracting-only quote route', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quoteSummary]],
            quoteState: {
                ...createInitialQuoteState(),
                contractingWork: {
                    enabled: true,
                    projectName: 'Designer Village',
                    rows: [{
                        id: 'work-1',
                        workPackage: 'Markarbete',
                        scope: 'Schaktning och fundament',
                        unit: 'Samlat arbetspaket',
                        priceExVatSek: 101600
                    }],
                    margin: { enabled: false, percent: 15 },
                    ata: { enabled: false, percent: 15 }
                }
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
        expect(container.textContent).toContain('SummaryView');
    });

    it('ignores stale contracting work when guarding retailer quote routes', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quoteSummary]],
            auth: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {}
                }
            },
            quoteState: {
                ...createInitialQuoteState(),
                contractingWork: {
                    enabled: true,
                    projectName: 'Ska ignoreras',
                    rows: [{
                        id: 'work-1',
                        workPackage: 'Markarbete',
                        scope: '',
                        unit: '',
                        priceExVatSek: 1000
                    }],
                    margin: { enabled: false, percent: 15 },
                    ata: { enabled: false, percent: 15 }
                }
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
        expect(container.textContent).toContain('ProductLinesView');
    });

    it('uses the current URL instead of persisted draft step when choosing the visible screen', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quotes]],
            quoteState: {
                ...createInitialQuoteState(),
                step: 4,
                selectedLines: ['BaHaMa'],
                builderItems: [{
                    id: 'item-1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }]
            }
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quotes]);
        expect(container.textContent).toContain('Open History Quote');
        expect(container.textContent).not.toContain('SummaryView');
    });

    it('reopens unconfigured history quotes into the first quote step', async () => {
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quotes]],
            dispatch
        });

        await clickButton(container, 'Open History Quote');

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'HYDRATE_STATE',
            payload: expect.objectContaining({
                activeQuoteId: 'quote-1',
                activeQuoteVersion: 2,
                step: 1
            })
        }));
    });

    it('reopens configured history quotes into summary', async () => {
        const dispatch = vi.fn();
        const configuredState = {
            ...createInitialQuoteState(),
            selectedLines: ['BaHaMa'],
            builderItems: [{
                id: 'existing-item',
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '4x4 Kvadrat',
                qty: 1,
                discountPct: 0,
                addons: []
            }]
        };
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quotes]],
            quoteState: configuredState,
            dispatch
        });

        await clickButton(container, 'Open Configured History Quote');

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'HYDRATE_STATE',
            payload: expect.objectContaining({
                activeQuoteId: 'quote-2',
                activeQuoteVersion: 3,
                step: 4
            })
        }));
    });

    it('preserves the stable owner reference for an unlinked quote opened by an admin', async () => {
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quotes]],
            quoteState: {
                ...createInitialQuoteState(),
                selectedLines: ['BaHaMa'],
                builderItems: [{
                    id: 'existing-item',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }]
            },
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            }
        });

        await clickButton(container, 'Open Other Owner Quote');

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
        expect(router.state.location.search).toBe('?quoteOwnerUid=other-owner');
    });

    it('keeps the current draft when opening a history quote is cancelled', async () => {
        notificationMocks.confirmAction.mockResolvedValueOnce(false);
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quotes]],
            quoteState: {
                ...createInitialQuoteState(),
                selectedLines: ['BaHaMa']
            },
            dispatch
        });

        await clickButton(container, 'Open Configured History Quote');

        expect(notificationMocks.confirmAction).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Öppna sparad offert?',
            cancelText: 'Behåll utkast'
        }));
        expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'HYDRATE_STATE'
        }));
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quotes]);
    });

    it('reopens configured contracting-only history quotes into summary for non-retailers', async () => {
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quotes]],
            quoteState: {
                ...createInitialQuoteState(),
                contractingWork: {
                    enabled: true,
                    projectName: 'Designer Village',
                    rows: [{
                        id: 'work-1',
                        workPackage: 'Markarbete',
                        scope: 'Schaktning och fundament',
                        unit: 'Samlat arbetspaket',
                        priceExVatSek: 101600
                    }],
                    margin: { enabled: false, percent: 15 },
                    ata: { enabled: true, percent: 15 }
                }
            },
            dispatch
        });

        await clickButton(container, 'Open Contracting History Quote');

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'HYDRATE_STATE',
            payload: expect.objectContaining({
                activeQuoteId: 'quote-contracting',
                step: 4
            })
        }));
    });

    it('does not reopen contracting-only history content as a retailer quote', async () => {
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.quotes]],
            auth: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {}
                }
            },
            dispatch
        });

        await clickButton(container, 'Open Contracting History Quote');

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
            type: 'HYDRATE_STATE',
            payload: expect.objectContaining({ step: 1 })
        }));
    });

    it('returns sketch saves and transfers to their quote origin while preserving CRM context', async () => {
        const { container, router } = await renderApp({
            initialEntries: ['/sketch?return=quote-summary&crmDealId=deal-1&quoteOwnerUid=owner-1'],
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            },
            quoteState: {
                ...createInitialQuoteState(),
                selectedLines: ['BaHaMa'],
                builderItems: [{
                    id: 'item-1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }]
            }
        });

        await clickButton(container, 'Back From Sketch');
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
        expect(router.state.location.search).toBe('?crmDealId=deal-1&quoteOwnerUid=owner-1');

        await act(async () => {
            await router.navigate('/sketch?return=quote-summary&crmDealId=deal-1&quoteOwnerUid=owner-1');
            await Promise.resolve();
        });

        await clickButton(container, 'Export From Sketch');
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
        expect(router.state.location.search).toBe('?crmDealId=deal-1&quoteOwnerUid=owner-1');
    });

    it('starts a retailer quote immediately when there is no draft data to clear', async () => {
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.dashboard]],
            auth: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 20 }
                    }
                },
                isRetailer: true
            },
            quoteState: createInitialQuoteState(),
            dispatch
        });

        await clickButton(container, 'Starta Ny Offert');

        expect(notificationMocks.confirmChoiceAction).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
    });

    it('asks retailers to confirm before clearing an existing draft', async () => {
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.dashboard]],
            auth: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 20 }
                    }
                },
                isRetailer: true
            },
            quoteState: {
                ...createInitialQuoteState(),
                selectedLines: ['BaHaMa']
            },
            dispatch
        });

        await clickButton(container, 'Starta Ny Offert');

        expect(notificationMocks.confirmChoiceAction).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Starta ny offert?',
            confirmText: 'Starta ny offert',
            cancelText: 'Avbryt',
            secondaryText: 'Fortsätt utkast'
        }));
        expect(dispatch).toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
    });

    it('keeps retailer dashboard state unchanged when the reset confirmation is cancelled', async () => {
        notificationMocks.confirmChoiceAction.mockResolvedValueOnce('cancel');
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.dashboard]],
            auth: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 20 }
                    }
                },
                isRetailer: true
            },
            quoteState: {
                ...createInitialQuoteState(),
                customerInfo: {
                    ...createInitialQuoteState().customerInfo,
                    name: 'Ada'
                }
            },
            dispatch
        });

        await clickButton(container, 'Starta Ny Offert');

        expect(notificationMocks.confirmChoiceAction).toHaveBeenCalledTimes(1);
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.dashboard]);
    });

    it('continues retailer draft from the latest valid quote step without clearing state', async () => {
        notificationMocks.confirmChoiceAction.mockResolvedValueOnce('secondary');
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.dashboard]],
            auth: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer_1',
                    name: 'Roslagen',
                    email: 'retailer@example.com',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 20 }
                    }
                },
                isRetailer: true
            },
            quoteState: {
                ...createInitialQuoteState(),
                step: 4,
                selectedLines: ['BaHaMa'],
                builderItems: [{
                    id: 'item-1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }]
            },
            dispatch
        });

        await clickButton(container, 'Starta Ny Offert');

        expect(notificationMocks.confirmChoiceAction).toHaveBeenCalledTimes(1);
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
    });

    it('asks non-retailers to confirm before replacing an existing draft', async () => {
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.dashboard]],
            auth: {
                accessLevel: 'quote-only',
                isRetailer: false
            },
            quoteState: {
                ...createInitialQuoteState(),
                selectedLines: ['BaHaMa']
            },
            dispatch
        });

        await clickButton(container, 'Starta Ny Offert');

        expect(notificationMocks.confirmChoiceAction).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Starta ny offert?',
            secondaryText: 'Fortsätt utkast'
        }));
        expect(dispatch).toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
    });

    it('lets non-retailers continue the latest valid draft without clearing it', async () => {
        const dispatch = vi.fn();
        const { container, router } = await renderApp({
            initialEntries: [APP_PATHS[APP_ROUTE_IDS.dashboard]],
            auth: {
                accessLevel: 'quote-only',
                isRetailer: false
            },
            quoteState: {
                ...createInitialQuoteState(),
                step: 4,
                selectedLines: ['BaHaMa'],
                builderItems: [{
                    id: 'item-1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }]
            },
            dispatch
        });

        await clickButton(container, 'Fortsätt offert');

        expect(notificationMocks.confirmChoiceAction).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
    });

    it('starts a clean quote from a CRM deal and prefills the customer without persisting the CRM id in quote state', async () => {
        crmMocks.getDeal.mockResolvedValueOnce({
            id: 'deal-1',
            title: 'Uteservering Stortorget',
            companyId: 'company-1',
            primaryContactId: 'contact-1'
        });
        crmMocks.getCompany.mockResolvedValueOnce({
            id: 'company-1',
            name: 'Testbolaget AB',
            email: 'info@testbolaget.se'
        });
        crmMocks.getContact.mockResolvedValueOnce({
            id: 'contact-1',
            name: 'Ada Andersson',
            email: 'ada@testbolaget.se'
        });
        const dispatch = vi.fn();
        const { router } = await renderApp({
            initialEntries: ['/quote/new/product-lines?crmDealId=deal-1&start=1'],
            auth: {
                accessLevel: 'full',
                canViewEverything: true
            },
            quoteState: {
                ...createInitialQuoteState(),
                activeQuoteId: 'old-quote',
                customerInfo: {
                    ...createInitialQuoteState().customerInfo,
                    company: 'Gammal kund'
                }
            },
            dispatch
        });

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(notificationMocks.confirmChoiceAction).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Starta offert från CRM-affären?',
            confirmText: 'Ersätt utkast',
            secondaryText: 'Fortsätt utkast'
        }));
        expect(dispatch).toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_CUSTOMER_INFO',
            payload: {
                company: 'Testbolaget AB',
                name: 'Ada Andersson',
                email: 'ada@testbolaget.se',
                reference: 'Uteservering Stortorget',
                customerReference: 'Ada Andersson'
            }
        });
        expect(router.state.location.search).toBe('?crmDealId=deal-1');
        expect(dispatch.mock.calls.some(([action]) => action?.payload?.crmDealId)).toBe(false);
    });

    it('continues the current draft instead of replacing it from a CRM start link', async () => {
        notificationMocks.confirmChoiceAction.mockResolvedValueOnce('secondary');
        const dispatch = vi.fn();
        const { router } = await renderApp({
            initialEntries: ['/quote/new/product-lines?crmDealId=deal-1&start=1'],
            auth: {
                accessLevel: 'full',
                canViewEverything: true
            },
            quoteState: {
                ...createInitialQuoteState(),
                step: 4,
                selectedLines: ['BaHaMa'],
                builderItems: [{
                    id: 'item-1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }]
            },
            dispatch
        });

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
        expect(router.state.location.search).toBe('');
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(crmMocks.getDeal).not.toHaveBeenCalled();
    });

    it('returns to the CRM deal when replacing a current draft is cancelled', async () => {
        notificationMocks.confirmChoiceAction.mockResolvedValueOnce('cancel');
        const dispatch = vi.fn();
        const { router } = await renderApp({
            initialEntries: ['/quote/new/product-lines?crmDealId=deal-1&start=1'],
            auth: {
                accessLevel: 'full',
                canViewEverything: true
            },
            quoteState: {
                ...createInitialQuoteState(),
                selectedLines: ['BaHaMa']
            },
            dispatch
        });

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(router.state.location.pathname).toBe('/crm/deals/deal-1');
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
        expect(crmMocks.getDeal).not.toHaveBeenCalled();
    });
});
