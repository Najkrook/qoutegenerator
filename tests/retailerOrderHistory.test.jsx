// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const subscriptionState = vi.hoisted(() => ({
    ownRecords: [],
    detailRecords: {},
    ownChange: null,
    ownError: null,
    detailChange: null,
    detailError: null,
    subscribeOwnOrderRequests: vi.fn((input, onChange, onError) => {
        subscriptionState.ownChange = onChange;
        subscriptionState.ownError = onError;
        onChange(subscriptionState.ownRecords);
        return vi.fn();
    }),
    subscribeOrderRequestById: vi.fn((input, onChange, onError) => {
        subscriptionState.detailChange = onChange;
        subscriptionState.detailError = onError;
        onChange(subscriptionState.detailRecords[input.id] || null);
        return vi.fn();
    })
}));

vi.mock('../src/services/orderRequestService', () => ({
    getRetailerOrderRequestStatusLabel: (status) => ({
        new: 'Skickad',
        reviewing: 'I väntar',
        completed: 'Accepterad'
    }[status] || 'Skickad'),
    orderRequestService: {
        subscribeOwnOrderRequests: subscriptionState.subscribeOwnOrderRequests,
        subscribeOrderRequestById: subscriptionState.subscribeOrderRequestById
    }
}));

import { RetailerOrderHistory } from '../src/views/RetailerOrderHistory';
import { AuthContext } from '../src/store/AuthContext';

const mountedRoots = [];

function createAuthValue(overrides = {}) {
    return {
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
            id: 'retailer-1',
            name: 'Nordvind',
            email: 'retailer@example.com',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 20 }
            }
        },
        isRetailer: true,
        ...overrides
    };
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

async function flushUi() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function renderRetailerOrderHistory(authOverrides = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <AuthContext.Provider value={createAuthValue(authOverrides)}>
                <RetailerOrderHistory onBack={() => {}} />
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

beforeEach(() => {
    subscriptionState.ownRecords = [createRequest()];
    subscriptionState.detailRecords = {
        'quote-1__v2': createRequest()
    };
    subscriptionState.ownChange = null;
    subscriptionState.ownError = null;
    subscriptionState.detailChange = null;
    subscriptionState.detailError = null;
    subscriptionState.subscribeOwnOrderRequests.mockClear();
    subscriptionState.subscribeOrderRequestById.mockClear();
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

describe('RetailerOrderHistory', () => {
    it('renders retailer order history with retailer-facing statuses', async () => {
        const { container } = await renderRetailerOrderHistory();

        expect(container.textContent).toContain('Mina orderförfrågningar');
        expect(container.textContent).toContain('Skickade ordrar');
        expect(container.textContent).toContain('BRIXX - 260521-101');
        expect(container.textContent).toContain('Ada Bistro');
        expect(container.textContent).toContain('Skickad');
        expect(container.textContent).toContain('Valda produktlinjer');
        expect(container.textContent).toContain('Ordervärde');
    });

    it('updates the selected request status live when admin starts handling it', async () => {
        const { container } = await renderRetailerOrderHistory();
        const updatedRecord = createRequest({ status: 'reviewing', updatedAtMs: 200 });

        await act(async () => {
            subscriptionState.ownChange?.([updatedRecord]);
            subscriptionState.detailChange?.(updatedRecord);
            await Promise.resolve();
        });

        expect(container.textContent).toContain('I väntar');
        expect(container.textContent).not.toContain('Accepterad');
    });

    it('shows a load more button and increases the live query limit in steps of 25', async () => {
        subscriptionState.ownRecords = Array.from({ length: 26 }, (_, index) => createRequest({
            id: `quote-${index + 1}__v2`,
            quoteId: `quote-${index + 1}`,
            quoteNumber: `BRIXX - 260521-${String(index + 1).padStart(3, '0')}`,
            company: `Kund ${index + 1}`,
            createdAtMs: 1000 - index
        }));
        subscriptionState.detailRecords = {
            [subscriptionState.ownRecords[0].id]: subscriptionState.ownRecords[0]
        };

        const { container } = await renderRetailerOrderHistory();

        expect(subscriptionState.subscribeOwnOrderRequests).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 26 }),
            expect.any(Function),
            expect.any(Function)
        );
        expect(findButton(container, 'Ladda fler')).toBeTruthy();

        await act(async () => {
            findButton(container, 'Ladda fler').click();
        });
        await flushUi();

        expect(subscriptionState.subscribeOwnOrderRequests).toHaveBeenLastCalledWith(
            expect.objectContaining({ limit: 51 }),
            expect.any(Function),
            expect.any(Function)
        );
    });

    it('switches detail view when another request is selected', async () => {
        const secondRequest = createRequest({
            id: 'quote-2__v4',
            quoteId: 'quote-2',
            quoteNumber: 'BRIXX - 260521-202',
            quoteVersion: 4,
            company: 'Soltorget',
            status: 'completed'
        });
        subscriptionState.ownRecords = [createRequest(), secondRequest];
        subscriptionState.detailRecords = {
            'quote-1__v2': createRequest(),
            'quote-2__v4': secondRequest
        };

        const { container } = await renderRetailerOrderHistory();

        await act(async () => {
            findButton(container, 'BRIXX - 260521-202').click();
        });
        await flushUi();

        expect(subscriptionState.subscribeOrderRequestById).toHaveBeenLastCalledWith(
            { id: 'quote-2__v4' },
            expect.any(Function),
            expect.any(Function)
        );
        expect(container.textContent).toContain('Soltorget');
        expect(container.textContent).toContain('Accepterad');
    });
});
