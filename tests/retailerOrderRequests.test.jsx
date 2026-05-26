// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const orderRequestMocks = vi.hoisted(() => ({
    listOrderRequests: vi.fn(async () => []),
    updateOrderRequestStatus: vi.fn(async (input) => ({
        id: 'quote-1__v2',
        quoteOwnerUid: 'retailer-1',
        quoteId: 'quote-1',
        quoteNumber: 'BRIXX - 260521-101',
        quoteVersion: 2,
        retailerId: 'retailer-doc-1',
        retailerName: 'Nordvind',
        retailerEmail: 'retailer@example.com',
        customerName: 'Ada',
        company: 'Ada Bistro',
        reference: 'REF-77',
        customerReference: 'ER-88',
        selectedLines: ['BaHaMa'],
        totalSek: 12345,
        status: input.status,
        createdAtMs: 100,
        updatedAtMs: 200,
        createdByUid: 'retailer-1',
        createdByEmail: 'retailer@example.com',
        statusUpdatedByUid: 'admin-1',
        statusUpdatedByEmail: 'admin@example.com'
    }))
}));

const quoteRepositoryMocks = vi.hoisted(() => ({
    getQuoteRevisionByVersion: vi.fn(async () => null)
}));

const calculationMocks = vi.hoisted(() => ({
    computeQuoteTotals: vi.fn(() => ({
        totals: [],
        finalTotalSek: 12345,
        grossTotalSek: 14000,
        totalDiscountSek: 1655,
        globalDiscountAmt: 0
    }))
}));

const notificationMocks = vi.hoisted(() => ({
    notifyError: vi.fn(),
    notifyInfo: vi.fn(),
    notifySuccess: vi.fn(),
    notifyWarn: vi.fn()
}));

vi.mock('../src/services/orderRequestService', () => ({
    getOrderRequestStatusLabel: (status) => ({
        new: 'Ny',
        reviewing: 'Under behandling',
        completed: 'Slutförd'
    }[status] || 'Ny'),
    getRetailerOrderRequestStatusLabel: (status) => ({
        new: 'Skickad',
        reviewing: 'I väntar',
        completed: 'Accepterad'
    }[status] || 'Skickad'),
    orderRequestService: {
        listOrderRequests: orderRequestMocks.listOrderRequests,
        updateOrderRequestStatus: orderRequestMocks.updateOrderRequestStatus
    }
}));

vi.mock('../src/services/quoteRepositoryClient', () => ({
    quoteRepository: {
        getQuoteRevisionByVersion: quoteRepositoryMocks.getQuoteRevisionByVersion
    }
}));

vi.mock('../src/services/quotePdfService', () => ({
    createQuotePdfBlob: vi.fn(async () => new Blob(['pdf']))
}));

vi.mock('../src/services/calculationEngine', () => ({
    computeQuoteTotals: calculationMocks.computeQuoteTotals
}));

vi.mock('../src/services/notificationService', () => notificationMocks);
vi.mock('../src/utils/fileUtils', () => ({
    downloadBlob: vi.fn(),
    saveBlobWithPicker: vi.fn(async () => 'saved')
}));
vi.mock('../src/views/historyPayload', () => ({
    buildHistoryOpenQuotePayload: (state, quoteId, quoteNumber, quoteVersion, quoteStatus) => ({
        ...state,
        activeQuoteId: quoteId,
        quoteNumber,
        activeQuoteVersion: quoteVersion,
        quoteStatus
    })
}));
vi.mock('../src/store/quoteStateSchema', () => ({
    hydrateQuoteState: (input) => input
}));

import { RetailerOrderRequests } from '../src/views/RetailerOrderRequests';
import { AuthContext } from '../src/store/AuthContext';

const mountedRoots = [];

function formatSek(value) {
    return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        maximumFractionDigits: 0
    }).format(value);
}

function createAuthValue(overrides = {}) {
    return {
        user: { uid: 'admin-1', email: 'admin@example.com' },
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
        ...overrides
    };
}

async function flushUi() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function renderRetailerOrders(authOverrides = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <AuthContext.Provider value={createAuthValue(authOverrides)}>
                <RetailerOrderRequests onBack={() => {}} />
            </AuthContext.Provider>
        );
    });
    await flushUi();

    mountedRoots.push({ root, container });
    return { container };
}

function findButton(container, label) {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) => (
        candidate.textContent?.includes(label)
    ));

    expect(button).toBeTruthy();
    return button;
}

function getItemsSection(container) {
    const section = container.querySelector('[data-testid="order-request-items"]');
    expect(section).toBeTruthy();
    return section;
}

function createRequest(overrides = {}) {
    return {
        id: 'quote-1__v2',
        quoteOwnerUid: 'retailer-1',
        quoteId: 'quote-1',
        quoteNumber: 'BRIXX - 260521-101',
        quoteVersion: 2,
        retailerId: 'retailer-doc-1',
        retailerName: 'Nordvind',
        retailerEmail: 'retailer@example.com',
        customerName: 'Ada',
        company: 'Ada Bistro',
        reference: 'REF-77',
        customerReference: 'ER-88',
        selectedLines: ['BaHaMa'],
        totalSek: 12345,
        status: 'new',
        createdAtMs: 100,
        updatedAtMs: 100,
        createdByUid: 'retailer-1',
        createdByEmail: 'retailer@example.com',
        statusUpdatedByUid: 'retailer-1',
        statusUpdatedByEmail: 'retailer@example.com',
        ...overrides
    };
}

beforeEach(() => {
    orderRequestMocks.listOrderRequests.mockReset();
    orderRequestMocks.listOrderRequests.mockResolvedValue([createRequest()]);
    orderRequestMocks.updateOrderRequestStatus.mockClear();
    quoteRepositoryMocks.getQuoteRevisionByVersion.mockReset();
    quoteRepositoryMocks.getQuoteRevisionByVersion.mockImplementation(async ({ quoteId, version }) => {
        if (quoteId === 'missing-quote') {
            return null;
        }

        return {
            revisionId: `${quoteId}-revision-${version}`,
            quoteId,
            version,
            state: { quoteId, version },
            summary: {},
            savedAtMs: 100,
            savedBy: 'admin@example.com',
            savedByUid: 'admin-1',
            changeNote: ''
        };
    });
    calculationMocks.computeQuoteTotals.mockReset();
    calculationMocks.computeQuoteTotals.mockImplementation(({ state }) => {
        if (state.activeQuoteId === 'quote-2') {
            return {
                totals: [{
                    model: 'Solero',
                    size: '4x4',
                    qty: 2,
                    net: 18400,
                    gross: 21000,
                    unitPrice: 9200,
                    discountPct: 12,
                    discountSek: 5000,
                    isAddon: false,
                    isCustom: false,
                    line: 'Solero',
                    sortModel: 'Solero',
                    sortSizeRaw: '4x4',
                    sortKind: 'dimension',
                    sortDimensions: [4, 4],
                    originalIndex: 0,
                    source: { type: 'builder', itemId: 'builder-2' }
                }],
                finalTotalSek: 18400,
                grossTotalSek: 21000,
                totalDiscountSek: 5000,
                globalDiscountAmt: 0
            };
        }

        return {
            totals: [{
                model: 'BaHaMa Jumbrella',
                size: '3x3',
                qty: 1,
                net: 16200,
                gross: 20000,
                unitPrice: 16200,
                discountPct: 19,
                discountSek: 3800,
                isAddon: false,
                isCustom: false,
                line: 'BaHaMa',
                sortModel: 'BaHaMa Jumbrella',
                sortSizeRaw: '3x3',
                sortKind: 'dimension',
                sortDimensions: [3, 3],
                originalIndex: 0,
                source: { type: 'builder', itemId: 'builder-1' }
            }, {
                model: 'Gjuthylsa',
                size: '-',
                qty: 1,
                net: 2200,
                gross: 2500,
                unitPrice: 2200,
                discountPct: 0,
                discountSek: 0,
                isAddon: true,
                isCustom: false,
                line: 'BaHaMa',
                sortModel: 'Gjuthylsa',
                sortSizeRaw: '',
                sortKind: 'text',
                sortDimensions: [],
                originalIndex: 1,
                source: { type: 'builder-addon', itemId: 'builder-1', addonId: 'addon-1' }
            }, {
                model: 'Montering på plats',
                size: '-',
                qty: 1,
                net: 1800,
                gross: 1800,
                unitPrice: 1800,
                discountPct: 0,
                discountSek: 0,
                isAddon: false,
                isCustom: true,
                line: 'Custom',
                sortModel: 'Montering på plats',
                sortSizeRaw: '',
                sortKind: 'text',
                sortDimensions: [],
                originalIndex: 2,
                source: { type: 'custom', index: 0 }
            }],
            finalTotalSek: 20200,
            grossTotalSek: 24300,
            totalDiscountSek: 4100,
            globalDiscountAmt: 0
        };
    });
    notificationMocks.notifySuccess.mockReset();
});

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }
    vi.clearAllMocks();
});

describe('RetailerOrderRequests', () => {
    it('renders the inbox list, request details, and compact product overview', async () => {
        const { container } = await renderRetailerOrders();
        const itemsSection = getItemsSection(container);

        expect(container.textContent).toContain('Retailer Orderförfrågningar');
        expect(container.textContent).toContain('BRIXX - 260521-101');
        expect(container.textContent).toContain('Nordvind');
        expect(container.textContent).toContain('Ada Bistro');
        expect(container.textContent).toContain('Exportera PDF');
        expect(itemsSection.textContent).toContain('Produkter i orderförfrågan');
        expect(itemsSection.textContent).toContain('BaHaMa Jumbrella');
        expect(itemsSection.textContent).toContain('3x3');
        expect(itemsSection.textContent).toContain('BaHaMa');
        expect(itemsSection.textContent).toContain(formatSek(16200));
    });

    it('persists status transitions through the admin controls', async () => {
        const { container } = await renderRetailerOrders();

        await act(async () => {
            findButton(container, 'Under behandling').click();
            await Promise.resolve();
        });

        expect(orderRequestMocks.updateOrderRequestStatus).toHaveBeenCalledWith(expect.objectContaining({
            id: 'quote-1__v2',
            status: 'reviewing'
        }));
        expect(notificationMocks.notifySuccess).toHaveBeenCalled();
    });

    it('renders addon and custom rows with the intended quick-overview styling', async () => {
        const { container } = await renderRetailerOrders();
        const itemsSection = getItemsSection(container);
        const addonCell = Array.from(itemsSection.querySelectorAll('td')).find((cell) => cell.textContent?.includes('Gjuthylsa'));
        const customCell = Array.from(itemsSection.querySelectorAll('td')).find((cell) => cell.textContent?.includes('Montering på plats'));

        expect(addonCell).toBeTruthy();
        expect(addonCell.className).toContain('pl-8');
        expect(addonCell.closest('tr')?.className).toContain('italic');

        expect(customCell).toBeTruthy();
        expect(customCell.closest('tr')?.className).toContain('italic');
        expect(itemsSection.textContent).toContain(formatSek(2200));
        expect(itemsSection.textContent).toContain(formatSek(1800));
    });

    it('shows a fallback message when the saved quote revision is missing', async () => {
        orderRequestMocks.listOrderRequests.mockResolvedValue([
            createRequest({
                id: 'missing-quote__v4',
                quoteId: 'missing-quote',
                quoteNumber: 'BRIXX - 260521-404',
                quoteVersion: 4
            })
        ]);

        const { container } = await renderRetailerOrders();
        const itemsSection = getItemsSection(container);

        expect(itemsSection.textContent).toContain('Den sparade offertversionen kunde inte hittas');
        expect(itemsSection.textContent).toContain('PDF-export finns fortfarande kvar som fallback');
    });

    it('updates the compact item list when switching between order requests', async () => {
        orderRequestMocks.listOrderRequests.mockResolvedValue([
            createRequest(),
            createRequest({
                id: 'quote-2__v5',
                quoteId: 'quote-2',
                quoteNumber: 'BRIXX - 260521-202',
                quoteVersion: 5,
                retailerName: 'Sydbris',
                company: 'Soltorget'
            })
        ]);

        const { container } = await renderRetailerOrders();
        const itemsSection = getItemsSection(container);

        expect(itemsSection.textContent).toContain('BaHaMa Jumbrella');
        expect(itemsSection.textContent).not.toContain('Solero');

        await act(async () => {
            findButton(container, 'BRIXX - 260521-202').click();
        });
        await flushUi();

        expect(itemsSection.textContent).toContain('Solero');
        expect(itemsSection.textContent).toContain('4x4');
        expect(itemsSection.textContent).toContain(formatSek(18400));
        expect(itemsSection.textContent).not.toContain('BaHaMa Jumbrella');
    });

    it('renders "Pris på förfrågan" on request-based rows and displays the totals-exclusion footnote in the quick overview', async () => {
        calculationMocks.computeQuoteTotals.mockImplementation(({ state }) => {
            return {
                totals: [
                    {
                        model: 'BaHaMa Jumbrella outSide',
                        size: '3x3',
                        qty: 1,
                        net: 75900,
                        gross: 75900,
                        unitPrice: 75900,
                        discountPct: 0,
                        discountSek: 0,
                        isAddon: false,
                        isCustom: false,
                        line: 'BaHaMa',
                        source: { type: 'builder', itemId: 'builder-1' }
                    },
                    {
                        model: 'LED-Lighting with 4 RGBW-LED strips',
                        size: '-',
                        qty: 1,
                        net: 0,
                        gross: 0,
                        unitPrice: 0,
                        discountPct: 0,
                        discountSek: 0,
                        isAddon: true,
                        isCustom: false,
                        priceUponRequest: true,
                        line: 'BaHaMa',
                        source: { type: 'builder-addon', itemId: 'builder-1', addonId: 'outside_classic_light_4' }
                    }
                ],
                finalTotalSek: 75900,
                grossTotalSek: 75900,
                totalDiscountSek: 0,
                globalDiscountAmt: 0
            };
        });

        const { container } = await renderRetailerOrders();
        const itemsSection = getItemsSection(container);

        expect(itemsSection.textContent).toContain('LED-Lighting with 4 RGBW-LED strips');
        expect(itemsSection.textContent).toContain('Pris på förfrågan');
        expect(itemsSection.textContent).toContain('* Totalsumman exkluderar artiklar med pris på förfrågan');
    });
});
