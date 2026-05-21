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
    orderRequestService: {
        listOrderRequests: orderRequestMocks.listOrderRequests,
        updateOrderRequestStatus: orderRequestMocks.updateOrderRequestStatus
    }
}));

vi.mock('../src/services/quoteRepositoryClient', () => ({
    quoteRepository: {
        getQuoteRevisionByVersion: vi.fn(async () => null)
    }
}));

vi.mock('../src/services/quotePdfService', () => ({
    createQuotePdfBlob: vi.fn(async () => new Blob(['pdf']))
}));

vi.mock('../src/services/calculationEngine', () => ({
    computeQuoteTotals: vi.fn(() => ({
        totals: [],
        finalTotalSek: 12345,
        grossTotalSek: 14000,
        totalDiscountSek: 1655
    }))
}));

vi.mock('../src/services/notificationService', () => notificationMocks);
vi.mock('../src/utils/fileUtils', () => ({
    downloadBlob: vi.fn(),
    saveBlobWithPicker: vi.fn(async () => 'saved')
}));

import { RetailerOrderRequests } from '../src/views/RetailerOrderRequests';
import { AuthContext } from '../src/store/AuthContext';

const mountedRoots = [];

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
        await Promise.resolve();
    });

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

beforeEach(() => {
    orderRequestMocks.listOrderRequests.mockReset();
    orderRequestMocks.listOrderRequests.mockResolvedValue([{
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
        statusUpdatedByEmail: 'retailer@example.com'
    }]);
    orderRequestMocks.updateOrderRequestStatus.mockClear();
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
    it('renders the inbox list and request details', async () => {
        const { container } = await renderRetailerOrders();

        expect(container.textContent).toContain('Retailer Orderförfrågningar');
        expect(container.textContent).toContain('BRIXX - 260521-101');
        expect(container.textContent).toContain('Nordvind');
        expect(container.textContent).toContain('Ada Bistro');
        expect(container.textContent).toContain('Exportera PDF');
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
});
