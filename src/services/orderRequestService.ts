import type {
    AccessUser,
    CreateOrderRequestInput,
    GetOrderRequestByQuoteVersionInput,
    ListOrderRequestsInput,
    OrderRequestRecord,
    OrderRequestService,
    OrderRequestStatus,
    QuoteState,
    QuoteSummary,
    QuoteTotalsResult,
    RawOrderRequestDoc,
    RetailerRecord,
    SubscribeOrderRequestByIdInput,
    SubscribeOwnOrderRequestsInput,
    UpdateOrderRequestStatusInput,
    UnknownRecord
} from '../types/contracts';
import {
    collection,
    db,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
    where
} from './firebase';
import { safeLogActivity } from './activityLogService';
import { readSnapshotData } from '../utils/runtime';

const ORDER_REQUEST_COLLECTION = 'order_requests';
const ORDER_REQUEST_STATUS_VALUES: OrderRequestStatus[] = ['new', 'reviewing', 'completed'];

interface OrderRequestServiceDeps {
    db?: unknown;
    doc?: (db: unknown, ...segments: string[]) => { path?: string };
    getDoc?: (ref: { path?: string }) => Promise<{ exists(): boolean; data(): RawOrderRequestDoc | undefined }>;
    setDoc?: (ref: { path?: string }, payload: UnknownRecord, options?: { merge?: boolean }) => Promise<unknown>;
    updateDoc?: (ref: { path?: string }, payload: UnknownRecord) => Promise<unknown>;
    collection?: (db: unknown, ...segments: string[]) => unknown;
    getDocs?: (ref: unknown) => Promise<{ docs: Array<{ id?: string; data(): RawOrderRequestDoc | undefined }> }>;
    query?: (collectionRef: unknown, ...constraints: unknown[]) => unknown;
    orderBy?: (field: string, direction?: 'asc' | 'desc') => unknown;
    where?: (field: string, op: string, value: unknown) => unknown;
    limit?: (size: number) => unknown;
    onSnapshot?: (
        ref: unknown,
        onNext: (snap: {
            exists?: () => boolean;
            empty?: boolean;
            id?: string;
            data?: () => RawOrderRequestDoc | undefined;
            docs?: Array<{ id?: string; data(): RawOrderRequestDoc | undefined }>;
        }) => void,
        onError?: (error: unknown) => void
    ) => () => void;
}

function isObject(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildOrderRequestId(quoteId: string, quoteVersion: number): string {
    return `${String(quoteId || '').trim()}__v${Math.max(1, toNumber(quoteVersion, 1))}`;
}

export function normalizeOrderRequestStatus(value: unknown): OrderRequestStatus {
    const normalized = String(value || '').trim().toLowerCase();
    return ORDER_REQUEST_STATUS_VALUES.find((status) => status === normalized) || 'new';
}

export function getOrderRequestStatusLabel(status: OrderRequestStatus | string): string {
    switch (normalizeOrderRequestStatus(status)) {
        case 'reviewing':
            return 'Under behandling';
        case 'completed':
            return 'Slutförd';
        case 'new':
        default:
            return 'Ny';
    }
}

export function getRetailerOrderRequestStatusLabel(status: OrderRequestStatus | string): string {
    switch (normalizeOrderRequestStatus(status)) {
        case 'reviewing':
            return 'I väntar';
        case 'completed':
            return 'Accepterad';
        case 'new':
        default:
            return 'Skickad';
    }
}

export function normalizeOrderRequestRecord(source: { id?: unknown; data?: (() => RawOrderRequestDoc | undefined) | RawOrderRequestDoc } | unknown, fallbackId = ''): OrderRequestRecord {
    const raw = readSnapshotData<RawOrderRequestDoc>(source);
    const docId = isObject(source) ? String(source.id || fallbackId || '') : String(fallbackId || '');

    return {
        id: docId,
        quoteOwnerUid: String(raw.quoteOwnerUid || ''),
        quoteId: String(raw.quoteId || ''),
        quoteNumber: String(raw.quoteNumber || ''),
        quoteVersion: Math.max(1, toNumber(raw.quoteVersion, 1)),
        retailerId: String(raw.retailerId || ''),
        retailerName: String(raw.retailerName || ''),
        retailerEmail: String(raw.retailerEmail || ''),
        customerName: String(raw.customerName || ''),
        company: String(raw.company || ''),
        reference: String(raw.reference || ''),
        customerReference: String(raw.customerReference || ''),
        selectedLines: Array.isArray(raw.selectedLines) ? raw.selectedLines.map((line) => String(line || '')) : [],
        totalSek: toNumber(raw.totalSek, 0),
        status: normalizeOrderRequestStatus(raw.status),
        createdAtMs: Math.max(0, toNumber(raw.createdAtMs, 0)),
        updatedAtMs: Math.max(0, toNumber(raw.updatedAtMs, 0)),
        createdByUid: String(raw.createdByUid || ''),
        createdByEmail: String(raw.createdByEmail || ''),
        statusUpdatedByUid: String(raw.statusUpdatedByUid || ''),
        statusUpdatedByEmail: String(raw.statusUpdatedByEmail || '')
    };
}

function buildOrderRequestPayload({
    user,
    retailer,
    state,
    summary,
    nowMs
}: {
    user: AccessUser;
    retailer: RetailerRecord;
    state: QuoteState;
    summary: QuoteSummary | QuoteTotalsResult;
    nowMs: number;
}): OrderRequestRecord {
    const quoteId = String(state.activeQuoteId || '').trim();
    const quoteNumber = String(state.quoteNumber || '').trim();
    const quoteVersion = Math.max(1, toNumber(state.activeQuoteVersion, 1));
    const retailerId = String(retailer.id || '').trim();
    const retailerName = String(retailer.name || '').trim();
    const retailerEmail = String(retailer.email || user.email || '').trim().toLowerCase();

    if (!quoteId || !quoteNumber || !quoteVersion) {
        throw new Error('Order request requires a saved quote version.');
    }
    if (!user?.uid) {
        throw new Error('Order request requires an authenticated user.');
    }
    if (!retailerId || !retailerName || !retailerEmail) {
        throw new Error('Order request requires a valid retailer profile.');
    }

    const id = buildOrderRequestId(quoteId, quoteVersion);
    const customerName = String(state.customerInfo.name || state.customerInfo.company || '').trim();

    return {
        id,
        quoteOwnerUid: String(user.uid),
        quoteId,
        quoteNumber,
        quoteVersion,
        retailerId,
        retailerName,
        retailerEmail,
        customerName,
        company: String(state.customerInfo.company || '').trim(),
        reference: String(state.customerInfo.reference || '').trim(),
        customerReference: String(state.customerInfo.customerReference || '').trim(),
        selectedLines: Array.isArray(state.selectedLines) ? [...state.selectedLines].map((line) => String(line || '')) : [],
        totalSek: toNumber(summary.finalTotalSek, 0),
        status: 'new',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        createdByUid: String(user.uid),
        createdByEmail: String(user.email || ''),
        statusUpdatedByUid: String(user.uid),
        statusUpdatedByEmail: String(user.email || '')
    };
}

async function logOrderRequestSubmitted(record: OrderRequestRecord, user: AccessUser | null): Promise<void> {
    await safeLogActivity({
        user,
        eventType: 'order_request_submitted',
        system: 'order_request',
        targetType: 'order_request',
        targetId: record.id,
        details: `Orderförfrågan registrerad för ${record.quoteNumber}.`,
        metadata: {
            customerName: record.company || record.customerName,
            reference: record.reference,
            version: record.quoteVersion,
            retailerName: record.retailerName
        }
    });
}

async function logOrderRequestStatusUpdated(record: OrderRequestRecord, user: AccessUser | null): Promise<void> {
    await safeLogActivity({
        user,
        eventType: 'order_request_status_updated',
        system: 'order_request',
        targetType: 'order_request',
        targetId: record.id,
        details: `Orderförfrågan ${record.quoteNumber} uppdaterad till ${getOrderRequestStatusLabel(record.status).toLowerCase()}.`,
        metadata: {
            customerName: record.company || record.customerName,
            reference: record.reference,
            version: record.quoteVersion,
            retailerName: record.retailerName,
            orderRequestStatus: record.status
        }
    });
}

export function createOrderRequestService(deps: OrderRequestServiceDeps = {}): OrderRequestService {
    const {
        db: dbRef,
        doc: makeDoc,
        getDoc: readDoc,
        setDoc: writeDoc,
        updateDoc: patchDoc,
        collection: makeCollection,
        getDocs: readDocs,
        query: makeQuery,
        orderBy: makeOrderBy,
        where: makeWhere,
        limit: makeLimit,
        onSnapshot: subscribeToSnapshot
    } = deps;

    function assertDeps(names: string[]): void {
        const missing = names.filter((name) => {
            switch (name) {
                case 'db':
                    return !dbRef;
                case 'doc':
                    return typeof makeDoc !== 'function';
                case 'getDoc':
                    return typeof readDoc !== 'function';
                case 'setDoc':
                    return typeof writeDoc !== 'function';
                case 'updateDoc':
                    return typeof patchDoc !== 'function';
                case 'collection':
                    return typeof makeCollection !== 'function';
                case 'getDocs':
                    return typeof readDocs !== 'function';
                case 'query':
                    return typeof makeQuery !== 'function';
                case 'orderBy':
                    return typeof makeOrderBy !== 'function';
                case 'where':
                    return typeof makeWhere !== 'function';
                case 'limit':
                    return typeof makeLimit !== 'function';
                case 'onSnapshot':
                    return typeof subscribeToSnapshot !== 'function';
                default:
                    return true;
            }
        });

        if (missing.length > 0) {
            throw new Error(`orderRequestService requires Firestore dependencies: ${missing.join(', ')}`);
        }
    }

    async function getOrderRequestByQuoteVersion({
        quoteId,
        quoteVersion
    }: GetOrderRequestByQuoteVersionInput): Promise<OrderRequestRecord | null> {
        assertDeps(['db', 'doc', 'getDoc']);
        if (!quoteId || !quoteVersion) {
            return null;
        }

        const requestId = buildOrderRequestId(quoteId, quoteVersion);
        const ref = makeDoc(dbRef, ORDER_REQUEST_COLLECTION, requestId);
        const snap = await readDoc(ref);

        if (!snap.exists()) {
            return null;
        }

        return normalizeOrderRequestRecord({ id: requestId, data: () => snap.data() }, requestId);
    }

    async function createOrderRequest({
        user,
        retailer,
        state,
        summary
    }: CreateOrderRequestInput): Promise<OrderRequestRecord> {
        assertDeps(['db', 'doc', 'getDoc', 'setDoc']);
        if (!user?.uid) {
            throw new Error('Order request requires an authenticated user.');
        }
        if (!retailer) {
            throw new Error('Order request requires a retailer profile.');
        }

        const nowMs = Date.now();
        const record = buildOrderRequestPayload({
            user,
            retailer,
            state,
            summary,
            nowMs
        });
        const ref = makeDoc(dbRef, ORDER_REQUEST_COLLECTION, record.id);
        await writeDoc(ref, { ...record });
        await logOrderRequestSubmitted(record, user);
        return record;
    }

    async function listWithLimit(maxRows: number): Promise<OrderRequestRecord[]> {
        assertDeps(['db', 'collection', 'getDocs', 'query', 'orderBy', 'limit']);
        const rows = Math.max(1, Math.min(200, toNumber(maxRows, 20)));
        const ref = makeCollection(dbRef, ORDER_REQUEST_COLLECTION);
        const snap = await readDocs(makeQuery(ref, makeOrderBy('createdAtMs', 'desc'), makeLimit(rows)));
        return snap.docs.map((docSnap) => normalizeOrderRequestRecord(docSnap, String(docSnap.id || '')));
    }

    async function listRecentOrderRequests(input: ListOrderRequestsInput = {}): Promise<OrderRequestRecord[]> {
        return listWithLimit(input.limit ?? 5);
    }

    async function listOrderRequests(input: ListOrderRequestsInput = {}): Promise<OrderRequestRecord[]> {
        return listWithLimit(input.limit ?? 100);
    }

    function subscribeOwnOrderRequests(
        {
            user,
            limit: maxRows = 25
        }: SubscribeOwnOrderRequestsInput,
        onChange: (records: OrderRequestRecord[]) => void,
        onError?: (error: unknown) => void
    ): () => void {
        assertDeps(['db', 'collection', 'query', 'where', 'orderBy', 'limit', 'onSnapshot']);
        if (!user?.uid) {
            onChange([]);
            return () => {};
        }

        const rows = Math.max(1, Math.min(200, toNumber(maxRows, 25)));
        const ref = makeCollection(dbRef, ORDER_REQUEST_COLLECTION);
        const liveQuery = makeQuery(
            ref,
            makeWhere('createdByUid', '==', String(user.uid)),
            makeOrderBy('createdAtMs', 'desc'),
            makeLimit(rows)
        );

        return subscribeToSnapshot(
            liveQuery,
            (snap) => {
                const docs = Array.isArray(snap?.docs) ? snap.docs : [];
                onChange(docs.map((docSnap) => normalizeOrderRequestRecord(docSnap, String(docSnap.id || ''))));
            },
            onError
        );
    }

    function subscribeOrderRequestById(
        { id }: SubscribeOrderRequestByIdInput,
        onChange: (record: OrderRequestRecord | null) => void,
        onError?: (error: unknown) => void
    ): () => void {
        assertDeps(['db', 'doc', 'onSnapshot']);
        if (!id) {
            onChange(null);
            return () => {};
        }

        const ref = makeDoc(dbRef, ORDER_REQUEST_COLLECTION, id);
        return subscribeToSnapshot(
            ref,
            (snap) => {
                if (typeof snap?.exists === 'function' && !snap.exists()) {
                    onChange(null);
                    return;
                }

                onChange(normalizeOrderRequestRecord({ id, data: () => snap?.data?.() }, id));
            },
            onError
        );
    }

    async function updateOrderRequestStatus({
        id,
        status,
        user
    }: UpdateOrderRequestStatusInput): Promise<OrderRequestRecord> {
        assertDeps(['db', 'doc', 'getDoc', 'setDoc']);
        if (!id) {
            throw new Error('Order request id is required.');
        }
        if (!user?.uid) {
            throw new Error('Updating order request status requires an authenticated user.');
        }

        const ref = makeDoc(dbRef, ORDER_REQUEST_COLLECTION, id);
        const snap = await readDoc(ref);

        if (!snap.exists()) {
            throw new Error('Order request not found.');
        }

        const existing = normalizeOrderRequestRecord({ id, data: () => snap.data() }, id);
        const nextStatus = normalizeOrderRequestStatus(status);
        const updatedAtMs = Date.now();
        const updates = {
            status: nextStatus,
            updatedAtMs,
            statusUpdatedByUid: String(user.uid),
            statusUpdatedByEmail: String(user.email || '')
        };

        if (typeof patchDoc === 'function') {
            await patchDoc(ref, updates);
        } else {
            await writeDoc(ref, updates, { merge: true });
        }

        const nextRecord: OrderRequestRecord = {
            ...existing,
            ...updates
        };
        await logOrderRequestStatusUpdated(nextRecord, user);
        return nextRecord;
    }

    return {
        createOrderRequest,
        getOrderRequestByQuoteVersion,
        listRecentOrderRequests,
        listOrderRequests,
        updateOrderRequestStatus,
        subscribeOwnOrderRequests,
        subscribeOrderRequestById
    };
}

export const orderRequestService = createOrderRequestService({
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    orderBy,
    where,
    limit,
    onSnapshot
});
