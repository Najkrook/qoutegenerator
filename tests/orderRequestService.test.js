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

function buildService(initialDocs = {}) {
    const mock = createFirestoreMock(initialDocs);
    const service = createOrderRequestService(mock);
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

describe('orderRequestService', () => {
    it('creates a deterministic order request snapshot for a saved quote version', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-21T08:00:00.000Z'));

        const { service, mock } = buildService();
        const record = await service.createOrderRequest({
            user,
            retailer,
            state: createSavedQuoteState(),
            summary: { finalTotalSek: 12345, grossTotalSek: 15000, totalDiscountSek: 2655 }
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

    it('returns the existing request when the same quote version is submitted again', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-21T08:00:00.000Z'));

        const { service } = buildService();
        const first = await service.createOrderRequest({
            user,
            retailer,
            state: createSavedQuoteState(),
            summary: { finalTotalSek: 12345, grossTotalSek: 15000, totalDiscountSek: 2655 }
        });

        const second = await service.createOrderRequest({
            user,
            retailer,
            state: createSavedQuoteState(),
            summary: { finalTotalSek: 12345, grossTotalSek: 15000, totalDiscountSek: 2655 }
        });

        expect(second).toEqual(first);

        vi.useRealTimers();
    });

    it('creates a request without requiring a pre-read of the document', async () => {
        const mock = createFirestoreMock();
        const getDocSpy = vi.fn(async () => {
            throw new Error('getDoc should not run before create');
        });
        const service = createOrderRequestService({
            ...mock,
            getDoc: getDocSpy
        });

        const record = await service.createOrderRequest({
            user,
            retailer,
            state: createSavedQuoteState(),
            summary: { finalTotalSek: 12345, grossTotalSek: 15000, totalDiscountSek: 2655 }
        });

        expect(record.id).toBe(buildOrderRequestId('quote_1', 2));
        expect(getDocSpy).not.toHaveBeenCalled();
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
