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
    confirmChoiceAction: vi.fn(async () => 'confirm')
}));

vi.mock('../src/services/firebase', () => firebaseMocks);
vi.mock('../src/services/notificationService', () => notificationMocks);

vi.mock('../src/views/Dashboard', () => ({
    Dashboard: ({ onStartQuote, onOpenHistory, onOpenRetailerOrders, onOpenRetailerOrderHistory, onOpenRetailerDocuments }) => (
        <div>
            <div>DashboardView</div>
            <button type="button" onClick={() => onStartQuote?.()}>Starta Ny Offert</button>
            <button type="button" onClick={() => onOpenHistory?.()}>Mina Offerter</button>
            <button type="button" onClick={() => onOpenRetailerOrders?.()}>Orderförfrågningar</button>
            <button type="button" onClick={() => onOpenRetailerOrderHistory?.()}>Skickade Ordrar</button>
            <button type="button" onClick={() => onOpenRetailerDocuments?.()}>Produktdokument</button>
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

vi.mock('../src/views/InventoryManager', () => ({
    InventoryManager: () => <div>InventoryView</div>
}));

vi.mock('../src/views/Planner', () => ({
    Planner: () => <div>PlannerView</div>
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
    SketchTool: ({ onBack, onExportToQuoteComplete }) => (
        <div>
            <button type="button" onClick={onBack}>Back From Sketch</button>
            <button type="button" onClick={onExportToQuoteComplete}>Export From Sketch</button>
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
});

describe('app routing', () => {
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

    it('returns from sketch using the encoded return target and keeps export-to-quote on configuration', async () => {
        const { container, router } = await renderApp({
            initialEntries: ['/sketch?return=quote-summary'],
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

        await act(async () => {
            await router.navigate('/sketch?return=quote-summary');
            await Promise.resolve();
        });

        await clickButton(container, 'Export From Sketch');
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteConfiguration]);
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
        expect(dispatch).toHaveBeenCalledWith({ type: 'RESET_STATE' });
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
            secondaryText: 'Fortsätt till nuvarande offert'
        }));
        expect(dispatch).toHaveBeenCalledWith({ type: 'RESET_STATE' });
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
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET_STATE' });
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
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET_STATE' });
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteSummary]);
    });

    it('keeps non-retailer start behavior direct without reset confirmation', async () => {
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

        expect(notificationMocks.confirmChoiceAction).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'RESET_STATE' });
        expect(router.state.location.pathname).toBe(APP_PATHS[APP_ROUTE_IDS.quoteProductLines]);
    });
});
