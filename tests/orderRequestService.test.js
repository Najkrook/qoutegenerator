import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/activityLogService', () => ({
    safeLogActivity: vi.fn(async () => ({ ok: true }))
}));

import {
    createOrderRequestService,
    buildOrderRequestId,
    getRetailerOrderRequestStatusLabel,
    normalizeOrderRequestStatus
} from '../src/services/orderRequestService';
import { createFirestoreMock } from './fixtures/firestoreMock';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';
import { computeQuoteTotals } from '../src/services/calculationEngine';
import { createQuoteRepository } from '../src/services/quoteRepository';
import { createQuoteCommercialSnapshot, prepareQuote } from '../src/services/quotePreparation';

function buildService(initialDocs = {}) {
    const mock = createFirestoreMock({
        ...createSavedRevisionDocs(),
        ...initialDocs
    });
    const service = createOrderRequestService({
        ...mock,
        quoteRepository: createQuoteRepository(mock)
    });
    return { service, mock };
}

const user = {
    uid: 'retailer-1',
    email: 'retailer@example.com'
};

const retailer = {
    id: 'retailer_doc_1',
    name: 'Nordvind',
    email: 'retailer@example.com'
};

function createSavedQuoteState(overrides = {}) {
    return {
        ...createInitialQuoteState(),
        activeQuoteId: 'quote_1',
        quoteNumber: 'BRIXX - 260521-101',
        activeQuoteVersion: 2,
        selectedLines: ['BaHaMa'],
        customCosts: [{ description: 'Saved product', price: 12345, qty: 1, discountPct: 0 }],
        customerInfo: {
            ...createInitialQuoteState().customerInfo,
            name: 'Ada',
            company: 'Ada Bistro',
            reference: 'REF-77',
            customerReference: 'ER-88'
        },
        ...overrides
    };
}

function createSavedRevisionDocs(
    state = createSavedQuoteState(),
    audience = { isRetailer: true }
) {
    const totals = computeQuoteTotals({ state, catalogData: {} });
    const prepared = prepareQuote({
        state,
        totals,
        audience,
        fallbackDate: '2026-05-21',
        catalogData: {}
    });
    return {
        'users/retailer-1/quotes/quote_1': {
            quoteNumber: 'BRIXX - 260521-101',
            latestVersion: 2,
            latestRevisionId: 'rev_2',
            status: 'draft'
        },
        'users/retailer-1/quotes/quote_1/revisions/rev_2': {
            quoteId: 'quote_1',
            version: 2,
            savedAtMs: 200,
            savedBy: user.email,
            savedByUid: user.uid,
            state: prepared.persistenceSnapshot,
            summary: prepared.commercial.productTotals,
            commercialSnapshot: createQuoteCommercialSnapshot(prepared),
            changeNote: ''
        }
    };
}

describe('orderRequestService', () => {
    it('creates a deterministic order request snapshot for a saved quote version', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-21T08:00:00.000Z'));

        const { service, mock } = buildService();
        const record = await service.createOrderRequest({
            user,
            retailer,
            quoteId: 'quote_1',
            quoteVersion: 2
        });

        expect(record.id).toBe(buildOrderRequestId('quote_1', 2));
        expect(record.quoteNumber).toBe('BRIXX - 260521-101');
        expect(record.quoteVersion).toBe(2);
        expect(record.retailerName).toBe('Nordvind');
        expect(record.company).toBe('Ada Bistro');
        expect(record.reference).toBe('REF-77');
        expect(record.selectedLines).toEqual(['BaHaMa']);
        expect(record.status).toBe('new');

        expect(mock.__docs.get(`order_requests/${record.id}`)).toMatchObject({
            quoteId: 'quote_1',
            quoteVersion: 2,
            retailerName: 'Nordvind',
            totalSek: 12345,
            status: 'new'
        });

        vi.useRealTimers();
    });

    it('persists the PDF theme approved at submission instead of the saved but revoked theme', async () => {
        const state = createSavedQuoteState({ pdfThemeId: 'custom' });
        const savedDocs = createSavedRevisionDocs(state, {
            isRetailer: true,
            allowedPdfThemes: ['custom']
        });
        const { service, mock } = buildService(savedDocs);

        const record = await service.createOrderRequest({
            user,
            retailer: { ...retailer, pdfThemes: [] },
            quoteId: 'quote_1',
            quoteVersion: 2
        });

        expect(record.pdfThemeId).toBe('brixx');
        expect(mock.__docs.get(`order_requests/${record.id}`)).toMatchObject({
            pdfThemeId: 'brixx'
        });
    });

    it('returns the existing request when the same quote version is submitted again', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-21T08:00:00.000Z'));

        const { service } = buildService();
        const first = await service.createOrderRequest({
            user,
            retailer,
            quoteId: 'quote_1',
            quoteVersion: 2
        });

        const second = await service.createOrderRequest({
            user,
            retailer,
            quoteId: 'quote_1',
            quoteVersion: 2
        });

        expect(second).toEqual(first);

        vi.useRealTimers();
    });

    it('creates a request without requiring a pre-read of the document', async () => {
        const mock = createFirestoreMock(createSavedRevisionDocs());
        const getDocSpy = vi.fn(async (ref) => {
            if (String(ref?.path || '').startsWith('order_requests/')) {
                throw new Error('order request document should not be read before create');
            }
            return mock.getDoc(ref);
        });
        const repositoryDeps = { ...mock, getDoc: getDocSpy };
        const service = createOrderRequestService({
            ...mock,
            getDoc: getDocSpy,
            quoteRepository: createQuoteRepository(repositoryDeps)
        });

        const record = await service.createOrderRequest({
            user,
            retailer,
            quoteId: 'quote_1',
            quoteVersion: 2
        });

        expect(record.id).toBe(buildOrderRequestId('quote_1', 2));
        expect(getDocSpy).not.toHaveBeenCalledWith(expect.objectContaining({
            path: `order_requests/${record.id}`
        }));
    });

    it('lists recent order requests and updates admin status', async () => {
        const requestId = buildOrderRequestId('quote_1', 2);
        const { service } = buildService({
            [`order_requests/${requestId}`]: {
                quoteOwnerUid: user.uid,
                quoteId: 'quote_1',
                quoteNumber: 'BRIXX - 260521-101',
                quoteVersion: 2,
                retailerId: retailer.id,
                retailerName: retailer.name,
                retailerEmail: retailer.email,
                customerName: 'Ada',
                company: 'Ada Bistro',
                reference: 'REF-77',
                customerReference: 'ER-88',
                selectedLines: ['BaHaMa'],
                totalSek: 12345,
                status: 'new',
                createdAtMs: 100,
                updatedAtMs: 100,
                createdByUid: user.uid,
                createdByEmail: user.email,
                statusUpdatedByUid: user.uid,
                statusUpdatedByEmail: user.email
            }
        });

        const listed = await service.listRecentOrderRequests({ limit: 5 });
        expect(listed).toHaveLength(1);
        expect(listed[0].id).toBe(requestId);

        const updated = await service.updateOrderRequestStatus({
            id: requestId,
            status: 'completed',
            user: { uid: 'admin-1', email: 'admin@example.com' }
        });

        expect(updated.status).toBe('completed');
        expect(updated.statusUpdatedByEmail).toBe('admin@example.com');
    });

    it('subscribes to a retailer user own order requests and specific request by id', async () => {
        const requestId = buildOrderRequestId('quote_1', 2);
        const initialDocs = {
            [`order_requests/${requestId}`]: {
                quoteOwnerUid: user.uid,
                quoteId: 'quote_1',
                quoteNumber: 'BRIXX - 260521-101',
                quoteVersion: 2,
                retailerId: retailer.id,
                retailerName: retailer.name,
                retailerEmail: retailer.email,
                customerName: 'Ada',
                company: 'Ada Bistro',
                reference: 'REF-77',
                customerReference: 'ER-88',
                selectedLines: ['BaHaMa'],
                totalSek: 12345,
                status: 'reviewing',
                createdAtMs: 100,
                updatedAtMs: 100,
                createdByUid: user.uid,
                createdByEmail: user.email,
                statusUpdatedByUid: user.uid,
                statusUpdatedByEmail: user.email
            }
        };
        const mock = createFirestoreMock(initialDocs);
        const service = createOrderRequestService({
            ...mock,
            onSnapshot: (refOrQuery, onNext) => {
                if (refOrQuery?.kind === 'query') {
                    onNext({
                        docs: [{
                            id: requestId,
                            data: () => mock.__docs.get(`order_requests/${requestId}`)
                        }]
                    });
                    return () => {};
                }

                onNext({
                    exists: () => true,
                    data: () => mock.__docs.get(`order_requests/${requestId}`)
                });
                return () => {};
            }
        });

        const ownChange = vi.fn();
        const detailChange = vi.fn();

        const unsubscribeOwn = service.subscribeOwnOrderRequests({ user, limit: 25 }, ownChange);
        const unsubscribeDetail = service.subscribeOrderRequestById({ id: requestId }, detailChange);

        expect(ownChange).toHaveBeenCalledWith([
            expect.objectContaining({ id: requestId, status: 'reviewing' })
        ]);
        expect(detailChange).toHaveBeenCalledWith(expect.objectContaining({ id: requestId, status: 'reviewing' }));

        unsubscribeOwn();
        unsubscribeDetail();
    });

    it('normalizes unknown statuses back to new', () => {
        expect(normalizeOrderRequestStatus('reviewing')).toBe('reviewing');
        expect(normalizeOrderRequestStatus('COMPLETED')).toBe('completed');
        expect(normalizeOrderRequestStatus('bad-status')).toBe('new');
        expect(getRetailerOrderRequestStatusLabel('new')).toBe('Skickad');
        expect(getRetailerOrderRequestStatusLabel('reviewing')).toBe('I väntar');
        expect(getRetailerOrderRequestStatusLabel('completed')).toBe('Accepterad');
    });
});
