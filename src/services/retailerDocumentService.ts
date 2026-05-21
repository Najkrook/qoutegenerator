import { getCatalogLineName } from '../data/catalogLookup';
import type {
    GetRetailerDocumentsForLinesInput,
    GetRetailerLineDocumentsInput,
    RawRetailerLineDocument,
    RawRetailerLineDocumentsDoc,
    RetailerDocumentKind,
    RetailerDocumentService,
    RetailerLineDocument,
    RetailerLineDocumentsRecord,
    SaveRetailerLineDocumentsInput,
    UnknownRecord
} from '../types/contracts';
import {
    collection,
    db,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    setDoc
} from './firebase';
import { safeLogActivity } from './activityLogService';
import { readSnapshotData } from '../utils/runtime';

const RETAILER_LINE_DOCUMENTS_COLLECTION = 'retailer_line_documents';
export const RETAILER_DOCUMENT_KIND_VALUES = ['color-chart', 'installation-instructions'] as const;

interface RetailerDocumentServiceDeps {
    db?: unknown;
    doc?: (db: unknown, ...segments: string[]) => { path?: string };
    getDoc?: (ref: { path?: string }) => Promise<{ exists(): boolean; data(): RawRetailerLineDocumentsDoc | undefined }>;
    setDoc?: (ref: { path?: string }, payload: UnknownRecord, options?: { merge?: boolean }) => Promise<unknown>;
    collection?: (db: unknown, ...segments: string[]) => unknown;
    getDocs?: (ref: unknown) => Promise<{ docs: Array<{ id?: string; data(): RawRetailerLineDocumentsDoc | undefined }> }>;
    query?: (collectionRef: unknown, ...constraints: unknown[]) => unknown;
    orderBy?: (field: string, direction?: 'asc' | 'desc') => unknown;
}

function isObject(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function slugify(value: string): string {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase();
}

function getFileNameFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const pathName = parsed.pathname.split('/').filter(Boolean).pop() || '';
        return decodeURIComponent(pathName);
    } catch {
        return '';
    }
}

function ensurePdfFileName(value: string, title: string, url: string): string {
    const explicitName = String(value || '').trim();
    if (explicitName) {
        return explicitName;
    }

    const fromUrl = getFileNameFromUrl(url);
    if (fromUrl) {
        return fromUrl;
    }

    const fallbackBase = slugify(title) || 'produktdokument';
    return `${fallbackBase}.pdf`;
}

export function normalizeRetailerDocumentKind(value: unknown): RetailerDocumentKind {
    const normalized = String(value || '').trim().toLowerCase();
    return RETAILER_DOCUMENT_KIND_VALUES.find((kind) => kind === normalized) || 'color-chart';
}

export function getRetailerDocumentKindLabel(kind: RetailerDocumentKind | string): string {
    switch (normalizeRetailerDocumentKind(kind)) {
        case 'installation-instructions':
            return 'Installationsinstruktion';
        case 'color-chart':
        default:
            return 'Färgkarta';
    }
}

function normalizeRetailerLineDocument(value: unknown, index: number): RetailerLineDocument | null {
    const raw = isObject(value) ? value as RawRetailerLineDocument : {};
    const title = String(raw.title || '').trim();
    const url = String(raw.url || '').trim();

    if (!title || !url) {
        return null;
    }

    const sortOrder = Math.max(0, toNumber(raw.sortOrder, index));
    const fileName = ensurePdfFileName(String(raw.fileName || ''), title, url);
    const id = String(raw.id || '').trim() || `${slugify(title) || 'dokument'}-${index + 1}`;
    const description = String(raw.description || '').trim();

    return {
        id,
        title,
        kind: normalizeRetailerDocumentKind(raw.kind),
        url,
        fileName,
        description,
        sortOrder
    };
}

function sortRetailerLineDocuments(documents: RetailerLineDocument[]): RetailerLineDocument[] {
    return [...documents].sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
        }

        return left.title.localeCompare(right.title, 'sv');
    });
}

function createEmptyRetailerLineDocumentsRecord(lineId: string): RetailerLineDocumentsRecord {
    return {
        lineId: String(lineId || '').trim(),
        documents: [],
        updatedAt: 0,
        updatedBy: '',
        updatedByUid: ''
    };
}

export function normalizeRetailerLineDocumentsRecord(
    source: { id?: unknown; data?: (() => RawRetailerLineDocumentsDoc | undefined) | RawRetailerLineDocumentsDoc } | unknown,
    fallbackLineId = ''
): RetailerLineDocumentsRecord {
    const raw = readSnapshotData<RawRetailerLineDocumentsDoc>(source);
    const lineId = String(raw.lineId || (isObject(source) ? source.id : '') || fallbackLineId || '').trim();
    const documents = Array.isArray(raw.documents)
        ? raw.documents
            .map((documentRow, index) => normalizeRetailerLineDocument(documentRow, index))
            .filter(Boolean) as RetailerLineDocument[]
        : [];

    return {
        lineId,
        documents: sortRetailerLineDocuments(documents),
        updatedAt: Math.max(0, toNumber(raw.updatedAt, 0)),
        updatedBy: String(raw.updatedBy || ''),
        updatedByUid: String(raw.updatedByUid || '')
    };
}

async function logRetailerDocumentsUpdated(record: RetailerLineDocumentsRecord, user: SaveRetailerLineDocumentsInput['user']): Promise<void> {
    await safeLogActivity({
        user,
        eventType: 'retailer_documents_updated',
        system: 'retailer',
        targetType: 'retailer_line_documents',
        targetId: record.lineId,
        details: `Produktdokument uppdaterade för ${getCatalogLineName(record.lineId) || record.lineId}.`,
        metadata: {
            lineId: record.lineId,
            retailerDocumentCount: record.documents.length
        }
    });
}

export function createRetailerDocumentService(deps: RetailerDocumentServiceDeps = {}): RetailerDocumentService {
    const {
        db: dbRef,
        doc: makeDoc,
        getDoc: readDoc,
        setDoc: writeDoc,
        collection: makeCollection,
        getDocs: readDocs,
        query: makeQuery,
        orderBy: makeOrderBy
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
                case 'collection':
                    return typeof makeCollection !== 'function';
                case 'getDocs':
                    return typeof readDocs !== 'function';
                case 'query':
                    return typeof makeQuery !== 'function';
                case 'orderBy':
                    return typeof makeOrderBy !== 'function';
                default:
                    return true;
            }
        });

        if (missing.length > 0) {
            throw new Error(`retailerDocumentService requires Firestore dependencies: ${missing.join(', ')}`);
        }
    }

    async function getRetailerLineDocuments({ lineId }: GetRetailerLineDocumentsInput): Promise<RetailerLineDocumentsRecord> {
        assertDeps(['db', 'doc', 'getDoc']);
        const normalizedLineId = String(lineId || '').trim();
        if (!normalizedLineId) {
            return createEmptyRetailerLineDocumentsRecord('');
        }

        const ref = makeDoc(dbRef, RETAILER_LINE_DOCUMENTS_COLLECTION, normalizedLineId);
        const snap = await readDoc(ref);

        if (!snap.exists()) {
            return createEmptyRetailerLineDocumentsRecord(normalizedLineId);
        }

        return normalizeRetailerLineDocumentsRecord({ id: normalizedLineId, data: () => snap.data() }, normalizedLineId);
    }

    async function getRetailerDocumentsForLines({ lineIds }: GetRetailerDocumentsForLinesInput): Promise<RetailerLineDocumentsRecord[]> {
        const normalizedLineIds = [...new Set((lineIds || []).map((lineId) => String(lineId || '').trim()).filter(Boolean))];
        return Promise.all(normalizedLineIds.map((lineId) => getRetailerLineDocuments({ lineId })));
    }

    async function listRetailerLineDocuments(): Promise<RetailerLineDocumentsRecord[]> {
        assertDeps(['db', 'collection', 'getDocs', 'query', 'orderBy']);
        const ref = makeCollection(dbRef, RETAILER_LINE_DOCUMENTS_COLLECTION);
        const snap = await readDocs(makeQuery(ref, makeOrderBy('lineId', 'asc')));
        return snap.docs
            .map((docSnap) => normalizeRetailerLineDocumentsRecord(docSnap, String(docSnap.id || '')))
            .sort((left, right) => left.lineId.localeCompare(right.lineId, 'sv'));
    }

    async function saveRetailerLineDocuments({
        lineId,
        documents,
        user
    }: SaveRetailerLineDocumentsInput): Promise<RetailerLineDocumentsRecord> {
        assertDeps(['db', 'doc', 'setDoc']);

        const normalizedLineId = String(lineId || '').trim();
        if (!normalizedLineId) {
            throw new Error('Product line id is required.');
        }
        if (!user?.uid) {
            throw new Error('Saving retailer documents requires an authenticated user.');
        }

        const normalizedDocuments = sortRetailerLineDocuments(
            (documents || [])
                .map((documentRow, index) => normalizeRetailerLineDocument(documentRow, index))
                .filter(Boolean) as RetailerLineDocument[]
        );
        const nowMs = Date.now();
        const payload: RetailerLineDocumentsRecord = {
            lineId: normalizedLineId,
            documents: normalizedDocuments,
            updatedAt: nowMs,
            updatedBy: String(user.email || ''),
            updatedByUid: String(user.uid || '')
        };

        const ref = makeDoc(dbRef, RETAILER_LINE_DOCUMENTS_COLLECTION, normalizedLineId);
        await writeDoc(ref, payload as unknown as UnknownRecord);
        await logRetailerDocumentsUpdated(payload, user);
        return payload;
    }

    return {
        getRetailerLineDocuments,
        getRetailerDocumentsForLines,
        listRetailerLineDocuments,
        saveRetailerLineDocuments
    };
}

export const retailerDocumentService = createRetailerDocumentService({
    db,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    query,
    orderBy
});
