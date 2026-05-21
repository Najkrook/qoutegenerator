import type {
    AccessUser,
    CustomerInfo,
    FirestoreDocRef,
    GetQuoteRevisionByVersionInput,
    GetAllUsersQuotesInput,
    GetQuoteLatestRevisionInput,
    GetQuoteRevisionsInput,
    GetUserQuotesInput,
    QuoteFilters,
    QuoteLatestRevisionResult,
    QuoteMetadata,
    QuoteRepository,
    QuoteRepositoryDeps,
    QuoteRevision,
    QuoteRevisionSaveInput,
    QuoteStatus,
    RawPersistedCustomerInfo,
    RawQuoteMetadataDoc,
    RawQuoteRevisionDoc,
    RawQuoteSummary,
    RepositoryQuoteStatePayload,
    RepositoryQuoteSummaryPayload,
    ScriveMetadata,
    ScrivePatchInput,
    ScriveStatus,
    UnknownRecord,
    UpdateQuoteScriveInput,
    UpdateQuoteStatusInput
} from '../types/contracts';

export const QUOTE_STATUS_VALUES: QuoteStatus[] = ['draft', 'sent', 'won', 'lost', 'archived'];
export const SCRIVE_STATUS_VALUES: ScriveStatus[] = ['not_sent', 'preparation', 'pending', 'closed', 'rejected', 'canceled', 'timedout', 'failed'];

const EMPTY_SUMMARY: RawQuoteSummary = {
    finalTotalSek: 0,
    grossTotalSek: 0,
    totalDiscountSek: 0
};

const QUOTE_COUNTER_COLLECTION = 'quote_counters';
const QUOTE_NUMBER_TIME_ZONE = 'Europe/Stockholm';

interface QuoteSearchSource extends UnknownRecord {
    customerName?: unknown;
    company?: unknown;
    reference?: unknown;
    customerReference?: unknown;
    status?: unknown;
}

interface QuoteCounterDoc extends UnknownRecord {
    lastSequence?: unknown;
    updatedAtMs?: unknown;
}

interface BuildQuoteMetadataInput {
    quoteId: string;
    customerInfo?: Partial<CustomerInfo> | unknown;
    summary?: Partial<RawQuoteSummary> | unknown;
    status?: QuoteStatus | string;
    scrive?: ScrivePatchInput | unknown;
    nowMs: number;
    user?: AccessUser | null;
    latestVersion: number;
    latestRevisionId: string;
    existing?: Partial<QuoteMetadata> | unknown;
    retailerName?: string | null;
    quoteNumber?: string | null;
    quoteDateKey?: string | null;
    quoteSequence?: number | null;
}

type RevisionSaveContext = QuoteRevisionSaveInput & { retailerName?: string | null };
type NormalizedRevisionRecord = Omit<QuoteRevision, 'revisionId'>;

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toRecord<T extends UnknownRecord = UnknownRecord>(value: unknown): T {
    return (isObject(value) ? value : {}) as T;
}

function toStatePayload(value: unknown): RepositoryQuoteStatePayload {
    return isObject(value) ? clone(value) as RepositoryQuoteStatePayload : {};
}

function toSummaryPayload(value: unknown): RepositoryQuoteSummaryPayload {
    return isObject(value) ? clone(value) as RepositoryQuoteSummaryPayload : { ...EMPTY_SUMMARY };
}

function toNumber(value: unknown, fallback: number): number;
function toNumber(value: unknown, fallback: null): number | null;
function toNumber(value: unknown, fallback: number | null = 0): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatQuoteDateKey(nowMs: number): string {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: QUOTE_NUMBER_TIME_ZONE,
        year: '2-digit',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date(nowMs));
    const year = parts.find((part) => part.type === 'year')?.value || '00';
    const month = parts.find((part) => part.type === 'month')?.value || '00';
    const day = parts.find((part) => part.type === 'day')?.value || '00';
    return `${year}${month}${day}`;
}

function buildQuoteNumber(dateKey: string, quoteSequence: number): string {
    return `BRIXX - ${dateKey}-${String(quoteSequence).padStart(3, '0')}`;
}

function normalizeQuoteSequence(value: unknown): number | null {
    const parsed = toNumber(value, null);
    return parsed != null && parsed >= 0 ? parsed : null;
}

function getNextQuoteSequence(counter: QuoteCounterDoc | unknown): number {
    const current = Math.max(100, toNumber(toRecord<QuoteCounterDoc>(counter).lastSequence, 100) || 100);
    return current + 1;
}

export function normalizeQuoteStatus(status: unknown): QuoteStatus {
    const normalized = String(status || '').toLowerCase();
    return QUOTE_STATUS_VALUES.includes(normalized as QuoteStatus) ? (normalized as QuoteStatus) : 'draft';
}

export function normalizeScriveStatus(status: unknown): ScriveStatus {
    const normalized = String(status || '').toLowerCase();
    return SCRIVE_STATUS_VALUES.includes(normalized as ScriveStatus) ? (normalized as ScriveStatus) : 'not_sent';
}

function normalizeScriveMetadata(
    raw: RawQuoteMetadataDoc | unknown = {},
    fallbackCustomer: Partial<CustomerInfo> | RawPersistedCustomerInfo | UnknownRecord = {}
): ScriveMetadata {
    const safeRaw = toRecord<RawQuoteMetadataDoc>(raw);
    const safeFallbackCustomer = toRecord<RawPersistedCustomerInfo>(fallbackCustomer);

    return {
        scriveEnabled: Boolean(safeRaw.scriveEnabled),
        scriveStatus: normalizeScriveStatus(safeRaw.scriveStatus),
        scriveDocumentId: safeRaw.scriveDocumentId ? String(safeRaw.scriveDocumentId) : null,
        scriveSignerName: String(safeRaw.scriveSignerName || safeFallbackCustomer.name || ''),
        scriveSignerEmail: String(safeRaw.scriveSignerEmail || safeFallbackCustomer.email || ''),
        scriveLastError: safeRaw.scriveLastError ? String(safeRaw.scriveLastError) : null,
        scriveSentAtMs: safeRaw.scriveSentAtMs == null ? null : toNumber(safeRaw.scriveSentAtMs, null),
        scriveLastEventAtMs: safeRaw.scriveLastEventAtMs == null ? null : toNumber(safeRaw.scriveLastEventAtMs, null),
        scriveCompletedAtMs: safeRaw.scriveCompletedAtMs == null ? null : toNumber(safeRaw.scriveCompletedAtMs, null)
    };
}

export function buildQuoteSearchText({
    customerName = '',
    company = '',
    reference = '',
    customerReference = '',
    status = 'draft'
}: QuoteSearchSource = {}): string {
    return [customerName, company, reference, customerReference, normalizeQuoteStatus(status)]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
}

export function normalizeQuoteMetadata(quoteId: string, raw: RawQuoteMetadataDoc | unknown = {}): QuoteMetadata {
    const safeRaw = toRecord<RawQuoteMetadataDoc>(raw);
    const fallbackState = toRecord(safeRaw.state);
    const fallbackCustomer = toRecord<RawPersistedCustomerInfo>(fallbackState.customerInfo);
    const quoteNumber = safeRaw.quoteNumber ? String(safeRaw.quoteNumber) : null;
    const quoteDateKey = safeRaw.quoteDateKey ? String(safeRaw.quoteDateKey) : null;
    const quoteSequence = normalizeQuoteSequence(safeRaw.quoteSequence);
    const customerName = String(safeRaw.customerName || fallbackCustomer.company || fallbackCustomer.name || 'Okand kund');
    const company = String(safeRaw.company || fallbackCustomer.company || '');
    const reference = String(safeRaw.reference || fallbackCustomer.reference || '-');
    const customerReference = String(safeRaw.customerReference || fallbackCustomer.customerReference || '');
    const totalSek = toNumber(safeRaw.totalSek, toNumber(toRecord<RawQuoteSummary>(safeRaw.summary).finalTotalSek, 0)) || 0;
    const timestampMs = toNumber(Date.parse(String(safeRaw.timestamp || '')), 0) || 0;
    const createdAtMs = toNumber(safeRaw.createdAtMs, timestampMs || Date.now()) || 0;
    const updatedAtMs = toNumber(safeRaw.updatedAtMs, timestampMs || createdAtMs) || createdAtMs;
    const latestVersion = Math.max(1, toNumber(safeRaw.latestVersion, safeRaw.state ? 1 : 0) || 0);
    const status = normalizeQuoteStatus(safeRaw.status);
    const latestRevisionId = String(safeRaw.latestRevisionId || '');
    const scrive = normalizeScriveMetadata(safeRaw, fallbackCustomer);

    return {
        quoteId,
        quoteNumber,
        quoteDateKey,
        quoteSequence,
        customerName,
        company,
        reference,
        customerReference,
        status,
        createdAtMs,
        updatedAtMs,
        savedBy: String(safeRaw.savedBy || ''),
        savedByUid: String(safeRaw.savedByUid || ''),
        latestVersion,
        latestRevisionId,
        totalSek,
        retailerName: safeRaw.retailerName != null ? String(safeRaw.retailerName) : null,
        ...scrive,
        searchText: String(
            safeRaw.searchText ||
            buildQuoteSearchText({ customerName, company, reference, customerReference, status })
        ),
        state: safeRaw.state ?? null,
        summary: safeRaw.summary ?? null
    };
}

function buildRevisionData({
    quoteId,
    version,
    nowMs,
    user,
    state,
    summary,
    changeNote = ''
}: QuoteRevisionSaveInput & { version: number; nowMs: number }): NormalizedRevisionRecord {
    const safeSummary = toRecord<RawQuoteSummary>(summary);

    return {
        quoteId,
        version,
        savedAtMs: nowMs,
        savedBy: String(user?.email || ''),
        savedByUid: String(user?.uid || ''),
        state: toStatePayload(state),
        summary: {
            finalTotalSek: toNumber(safeSummary.finalTotalSek, 0) || 0,
            grossTotalSek: toNumber(safeSummary.grossTotalSek, 0) || 0,
            totalDiscountSek: toNumber(safeSummary.totalDiscountSek, 0) || 0
        },
        changeNote: String(changeNote || '')
    };
}

function buildQuoteMetadata({
    quoteId,
    customerInfo = {},
    summary = {},
    status = 'draft',
    scrive = {},
    nowMs,
    user,
    latestVersion,
    latestRevisionId,
    existing = {},
    retailerName = null,
    quoteNumber,
    quoteDateKey,
    quoteSequence
}: BuildQuoteMetadataInput): QuoteMetadata {
    const safeCustomerInfo = toRecord<RawPersistedCustomerInfo>(customerInfo);
    const safeSummary = toRecord<RawQuoteSummary>(summary);
    const existingMetadata = toRecord<Partial<QuoteMetadata>>(existing);
    const safeScrive = toRecord<ScrivePatchInput>(scrive);
    const normalizedStatus = normalizeQuoteStatus(status || existingMetadata.status);
    const company = String(safeCustomerInfo.company || existingMetadata.company || '');
    const customerName = String(company || safeCustomerInfo.name || existingMetadata.customerName || existingMetadata.company || 'Okand kund');
    const normalizedQuoteNumber = quoteNumber !== undefined
        ? (quoteNumber ? String(quoteNumber) : null)
        : (existingMetadata.quoteNumber ? String(existingMetadata.quoteNumber) : null);
    const normalizedQuoteDateKey = quoteDateKey !== undefined
        ? (quoteDateKey ? String(quoteDateKey) : null)
        : (existingMetadata.quoteDateKey ? String(existingMetadata.quoteDateKey) : null);
    const normalizedQuoteSequence = quoteSequence !== undefined
        ? normalizeQuoteSequence(quoteSequence)
        : normalizeQuoteSequence(existingMetadata.quoteSequence);
    const reference = String(safeCustomerInfo.reference || existingMetadata.reference || '-');
    const customerReference = String(safeCustomerInfo.customerReference || existingMetadata.customerReference || '');
    const existingScrive = normalizeScriveMetadata(existingMetadata, safeCustomerInfo);
    const normalizedScriveStatus = normalizeScriveStatus(safeScrive.status || existingScrive.scriveStatus || 'not_sent');
    const scriveDocumentId = safeScrive.documentId !== undefined
        ? (safeScrive.documentId ? String(safeScrive.documentId) : null)
        : existingScrive.scriveDocumentId;
    const scriveEnabled = typeof safeScrive.enabled === 'boolean'
        ? safeScrive.enabled
        : existingScrive.scriveEnabled;
    const scriveSignerName = String(
        safeScrive.signerName ||
        safeCustomerInfo.name ||
        existingScrive.scriveSignerName ||
        customerName
    );
    const scriveSignerEmail = String(
        safeScrive.signerEmail ||
        safeCustomerInfo.email ||
        existingScrive.scriveSignerEmail ||
        ''
    );
    const scriveLastError = safeScrive.lastError !== undefined
        ? (safeScrive.lastError ? String(safeScrive.lastError) : null)
        : (existingScrive.scriveLastError || null);
    const scriveSentAtMs = safeScrive.sentAtMs !== undefined
        ? (safeScrive.sentAtMs == null ? null : toNumber(safeScrive.sentAtMs, existingScrive.scriveSentAtMs || null))
        : existingScrive.scriveSentAtMs;
    const scriveLastEventAtMs = safeScrive.lastEventAtMs !== undefined
        ? (safeScrive.lastEventAtMs == null ? null : toNumber(safeScrive.lastEventAtMs, existingScrive.scriveLastEventAtMs || null))
        : existingScrive.scriveLastEventAtMs;
    const scriveCompletedAtMs = safeScrive.completedAtMs !== undefined
        ? (safeScrive.completedAtMs == null ? null : toNumber(safeScrive.completedAtMs, existingScrive.scriveCompletedAtMs || null))
        : existingScrive.scriveCompletedAtMs;

    return {
        quoteId,
        quoteNumber: normalizedQuoteNumber,
        quoteDateKey: normalizedQuoteDateKey,
        quoteSequence: normalizedQuoteSequence,
        customerName,
        company,
        reference,
        customerReference,
        status: normalizedStatus,
        createdAtMs: toNumber(existingMetadata.createdAtMs, nowMs) || nowMs,
        updatedAtMs: nowMs,
        savedBy: String(user?.email || existingMetadata.savedBy || ''),
        savedByUid: String(user?.uid || existingMetadata.savedByUid || ''),
        latestVersion: Math.max(1, toNumber(latestVersion, 1) || 1),
        latestRevisionId: String(latestRevisionId || existingMetadata.latestRevisionId || ''),
        totalSek: toNumber(safeSummary.finalTotalSek, existingMetadata.totalSek || 0) || 0,
        retailerName: retailerName != null ? String(retailerName) : (existingMetadata.retailerName || null),
        scriveEnabled,
        scriveStatus: normalizedScriveStatus,
        scriveDocumentId,
        scriveSignerName,
        scriveSignerEmail,
        scriveLastError,
        scriveSentAtMs,
        scriveLastEventAtMs,
        scriveCompletedAtMs,
        searchText: buildQuoteSearchText({
            customerName,
            company,
            reference,
            customerReference,
            status: normalizedStatus
        })
    };
}

function buildRevisionWriteDoc(revision: NormalizedRevisionRecord): RawQuoteRevisionDoc {
    return {
        quoteId: revision.quoteId,
        version: revision.version,
        savedAtMs: revision.savedAtMs,
        savedBy: revision.savedBy,
        savedByUid: revision.savedByUid,
        state: revision.state,
        summary: revision.summary,
        changeNote: revision.changeNote
    };
}

function buildMetadataWriteDoc(metadata: QuoteMetadata): RawQuoteMetadataDoc {
    return {
        quoteNumber: metadata.quoteNumber,
        quoteDateKey: metadata.quoteDateKey,
        quoteSequence: metadata.quoteSequence,
        customerName: metadata.customerName,
        company: metadata.company,
        reference: metadata.reference,
        customerReference: metadata.customerReference,
        status: metadata.status,
        createdAtMs: metadata.createdAtMs,
        updatedAtMs: metadata.updatedAtMs,
        savedBy: metadata.savedBy,
        savedByUid: metadata.savedByUid,
        latestVersion: metadata.latestVersion,
        latestRevisionId: metadata.latestRevisionId,
        totalSek: metadata.totalSek,
        retailerName: metadata.retailerName,
        searchText: metadata.searchText,
        scriveEnabled: metadata.scriveEnabled,
        scriveStatus: metadata.scriveStatus,
        scriveDocumentId: metadata.scriveDocumentId,
        scriveSignerName: metadata.scriveSignerName,
        scriveSignerEmail: metadata.scriveSignerEmail,
        scriveLastError: metadata.scriveLastError,
        scriveSentAtMs: metadata.scriveSentAtMs,
        scriveLastEventAtMs: metadata.scriveLastEventAtMs,
        scriveCompletedAtMs: metadata.scriveCompletedAtMs
    };
}

function normalizeQuoteRevision(
    quoteId: string,
    revisionId: string,
    raw: RawQuoteRevisionDoc | unknown = {},
    fallback: Partial<QuoteMetadata> = {}
): QuoteRevision {
    const safeRaw = toRecord<RawQuoteRevisionDoc>(raw);
    const safeFallback = toRecord<Partial<QuoteMetadata>>(fallback);

    return {
        revisionId,
        quoteId,
        version: Math.max(1, toNumber(safeRaw.version, safeFallback.latestVersion || 1) || 1),
        savedAtMs: toNumber(safeRaw.savedAtMs, toNumber(safeRaw.createdAt, safeFallback.updatedAtMs || Date.now())) || Date.now(),
        savedBy: String(safeRaw.savedBy || safeFallback.savedBy || ''),
        savedByUid: String(safeRaw.savedByUid || safeFallback.savedByUid || ''),
        state: safeRaw.state ? toStatePayload(safeRaw.state) : toStatePayload(safeFallback.state),
        summary: safeRaw.summary ? toSummaryPayload(safeRaw.summary) : toSummaryPayload(safeFallback.summary || {
            finalTotalSek: safeFallback.totalSek || 0,
            grossTotalSek: 0,
            totalDiscountSek: 0
        }),
        changeNote: String(safeRaw.changeNote || '')
    };
}

type QuoteFilterableRow = Pick<QuoteMetadata, 'status' | 'searchText' | 'customerName' | 'reference' | 'customerReference'>;

export function applyQuoteFilters<T extends QuoteFilterableRow>(quotes: T[] = [], { status = '', search = '' }: QuoteFilters = {}): T[] {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const normalizedSearch = String(search || '').trim().toLowerCase();

    return quotes.filter((quote) => {
        if (normalizedStatus && quote.status !== normalizedStatus) return false;
        if (!normalizedSearch) return true;
        const haystack = `${quote.searchText || ''} ${quote.customerName || ''} ${quote.reference || ''} ${quote.customerReference || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
    });
}

export function createQuoteRepository(deps: QuoteRepositoryDeps = {} as QuoteRepositoryDeps): QuoteRepository {
    const {
        db,
        doc,
        getDoc,
        setDoc,
        updateDoc,
        deleteDoc,
        collection,
        collectionGroup,
        getDocs,
        query,
        orderBy,
        limit,
        writeBatch,
        runTransaction
    } = deps || {};

    if (!db || !doc || !getDoc || !setDoc || !collection || !getDocs || !query || !orderBy || !limit) {
        throw new Error('quoteRepository requires Firestore dependencies.');
    }

    const quoteDocRef = (userId: string, quoteId: string): FirestoreDocRef => doc(db, 'users', userId, 'quotes', quoteId);
    const revisionsCollectionRef = (userId: string, quoteId: string) =>
        collection(db, 'users', userId, 'quotes', quoteId, 'revisions');

    const saveRevisionFallback = async ({
        user,
        quoteId,
        state,
        summary,
        customerInfo = {},
        status = 'draft',
        scrive = {},
        changeNote,
        retailerName = null
    }: RevisionSaveContext): Promise<{ metadata: QuoteMetadata; revision: QuoteRevision }> => {
        const quoteRef = quoteDocRef(String(user.uid), quoteId);
        const nowMs = Date.now();
        const quoteSnap = await getDoc(quoteRef);
        const existing = quoteSnap.exists()
            ? normalizeQuoteMetadata(quoteId, quoteSnap.data())
            : undefined;

        const version = Math.max(1, (toNumber(existing?.latestVersion, 0) || 0) + 1);
        const revisionId = `v${String(version).padStart(4, '0')}_${nowMs}`;
        const revisionRef = doc(db, 'users', String(user.uid), 'quotes', quoteId, 'revisions', revisionId);
        const revisionData = buildRevisionData({
            quoteId,
            version,
            nowMs,
            user,
            state,
            summary,
            changeNote
        });
        const metadata = buildQuoteMetadata({
            quoteId,
            customerInfo,
            summary,
            status,
            scrive,
            nowMs,
            user,
            latestVersion: version,
            latestRevisionId: revisionId,
            existing,
            retailerName
        });
        const revisionWriteDoc = buildRevisionWriteDoc(revisionData);
        const metadataWriteDoc = buildMetadataWriteDoc(metadata);

        await setDoc(revisionRef, revisionWriteDoc);
        await setDoc(quoteRef, metadataWriteDoc, { merge: true });

        return { metadata, revision: { revisionId, ...revisionData } };
    };

    async function saveQuoteRevision({
        user,
        quoteId,
        state,
        summary,
        customerInfo = {},
        status = 'draft',
        scrive = {},
        changeNote = '',
        retailerName = null
    }: QuoteRevisionSaveInput): Promise<{ metadata: QuoteMetadata; revision: QuoteRevision }> {
        if (!user?.uid) throw new Error('Missing authenticated user.');
        if (!quoteId) throw new Error('quoteId is required.');

        const revisionInput: RevisionSaveContext = {
            user,
            quoteId,
            state,
            summary,
            customerInfo,
            status,
            scrive,
            changeNote,
            retailerName
        };

        if (typeof runTransaction !== 'function') {
            return saveRevisionFallback(revisionInput);
        }

        const quoteRef = quoteDocRef(String(user.uid), quoteId);

        return runTransaction<{ metadata: QuoteMetadata; revision: QuoteRevision }>(db, async (transaction) => {
            const nowMs = Date.now();
            const snap = await transaction.get(quoteRef);
            const existing = snap.exists()
                ? normalizeQuoteMetadata(quoteId, snap.data())
                : undefined;

            const version = Math.max(1, (toNumber(existing?.latestVersion, 0) || 0) + 1);
            const revisionId = `v${String(version).padStart(4, '0')}_${nowMs}`;
            const revisionRef = doc(db, 'users', String(user.uid), 'quotes', quoteId, 'revisions', revisionId);

            const revisionData = buildRevisionData({
                quoteId,
                version,
                nowMs,
                user,
                state,
                summary,
                changeNote
            });
            const metadata = buildQuoteMetadata({
                quoteId,
                customerInfo,
                summary,
                status,
                scrive,
                nowMs,
                user,
                latestVersion: version,
                latestRevisionId: revisionId,
                existing,
                retailerName
            });
            const revisionWriteDoc = buildRevisionWriteDoc(revisionData);
            const metadataWriteDoc = buildMetadataWriteDoc(metadata);

            transaction.set(revisionRef, revisionWriteDoc);
            transaction.set(quoteRef, metadataWriteDoc, { merge: true });

            return { metadata, revision: { revisionId, ...revisionData } };
        });
    }

    async function createQuote({
        user,
        state,
        summary,
        customerInfo = {},
        status = 'draft',
        scrive = {},
        changeNote = 'Initial save',
        retailerName = null
    }: QuoteRevisionSaveInput): Promise<{ quoteId: string; metadata: QuoteMetadata; revision: QuoteRevision }> {
        if (!user?.uid) throw new Error('Missing authenticated user.');
        const quoteId = `quote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const quoteRef = quoteDocRef(String(user.uid), quoteId);
        const nowMs = Date.now();
        const dateKey = formatQuoteDateKey(nowMs);
        const counterRef = doc(db, QUOTE_COUNTER_COLLECTION, dateKey);

        const buildCreatePayload = (quoteSequence: number) => {
            const quoteNumber = buildQuoteNumber(dateKey, quoteSequence);
            const revisionId = `v0001_${nowMs}`;
            const revisionRef = doc(db, 'users', String(user.uid), 'quotes', quoteId, 'revisions', revisionId);
            const revisionData = buildRevisionData({
                quoteId,
                version: 1,
                nowMs,
                user,
                state,
                summary,
                changeNote
            });
            const metadata = buildQuoteMetadata({
                quoteId,
                customerInfo,
                summary,
                status,
                scrive,
                nowMs,
                user,
                latestVersion: 1,
                latestRevisionId: revisionId,
                retailerName,
                quoteNumber,
                quoteDateKey: dateKey,
                quoteSequence
            });

            return {
                quoteNumber,
                revisionId,
                revisionRef,
                revisionData,
                metadata,
                metadataWriteDoc: buildMetadataWriteDoc(metadata),
                revisionWriteDoc: buildRevisionWriteDoc(revisionData)
            };
        };

        if (typeof runTransaction !== 'function') {
            const counterSnap = await getDoc(counterRef);
            const quoteSequence = getNextQuoteSequence(counterSnap.exists() ? counterSnap.data() : {});
            const payload = buildCreatePayload(quoteSequence);

            await setDoc(counterRef, {
                lastSequence: quoteSequence,
                updatedAtMs: nowMs
            }, { merge: true });
            await setDoc(payload.revisionRef, payload.revisionWriteDoc);
            await setDoc(quoteRef, payload.metadataWriteDoc, { merge: true });

            return {
                quoteId,
                metadata: payload.metadata,
                revision: { revisionId: payload.revisionId, ...payload.revisionData }
            };
        }

        return runTransaction<{ quoteId: string; metadata: QuoteMetadata; revision: QuoteRevision }>(db, async (transaction) => {
            const counterSnap = await transaction.get(counterRef);
            const quoteSequence = getNextQuoteSequence(counterSnap.exists() ? counterSnap.data() : {});
            const payload = buildCreatePayload(quoteSequence);

            transaction.set(counterRef, {
                lastSequence: quoteSequence,
                updatedAtMs: nowMs
            }, { merge: true });
            transaction.set(payload.revisionRef, payload.revisionWriteDoc);
            transaction.set(quoteRef, payload.metadataWriteDoc, { merge: true });

            return {
                quoteId,
                metadata: payload.metadata,
                revision: { revisionId: payload.revisionId, ...payload.revisionData }
            };
        });
    }

    async function getUserQuotes({ userId, status = '', search = '' }: GetUserQuotesInput): Promise<QuoteMetadata[]> {
        if (!userId) return [];
        const quotesRef = collection(db, 'users', userId, 'quotes');
        let snap;
        try {
            snap = await getDocs(query(quotesRef, orderBy('updatedAtMs', 'desc')));
        } catch {
            snap = await getDocs(query(quotesRef, orderBy('timestamp', 'desc')));
        }

        const mapped = snap.docs.map((docSnap) =>
            normalizeQuoteMetadata(docSnap.id || '', docSnap.data() || {})
        );

        const filtered = applyQuoteFilters<QuoteMetadata>(mapped, { status, search });
        filtered.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        return filtered;
    }

    async function getAllUsersQuotes({ status = '', search = '' }: GetAllUsersQuotesInput = {}): Promise<Array<QuoteMetadata & { ownerUid: string }>> {
        if (typeof collectionGroup !== 'function') {
            throw new Error('collectionGroup is required for cross-user quote queries.');
        }
        const quotesGroup = collectionGroup(db, 'quotes');
        const snap = await getDocs(quotesGroup);

        const mapped = snap.docs.map((docSnap) => {
            const ownerUid = docSnap.ref?.parent?.parent?.id || 'unknown';
            const meta = normalizeQuoteMetadata(docSnap.id || '', docSnap.data() || {});
            return { ...meta, ownerUid };
        });

        const filtered = applyQuoteFilters<QuoteMetadata & { ownerUid: string }>(mapped, { status, search });
        filtered.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        return filtered;
    }

    async function getQuoteRevisions({ userId, quoteId, limit: limitRows = 5 }: GetQuoteRevisionsInput): Promise<QuoteRevision[]> {
        if (!userId || !quoteId) return [];
        const maxRows = Math.max(1, Math.min(100, toNumber(limitRows, 5) || 5));
        const revisionsRef = revisionsCollectionRef(userId, quoteId);
        let snap;

        try {
            snap = await getDocs(query(revisionsRef, orderBy('version', 'desc'), limit(maxRows)));
        } catch {
            snap = await getDocs(query(revisionsRef, orderBy('savedAtMs', 'desc'), limit(maxRows)));
        }

        const rows = snap.docs.map((docSnap) =>
            normalizeQuoteRevision(quoteId, docSnap.id || '', docSnap.data() || {})
        );

        rows.sort((a, b) => b.version - a.version);
        return rows;
    }

    async function getQuoteLatestRevision({ userId, quoteId }: GetQuoteLatestRevisionInput): Promise<QuoteLatestRevisionResult | null> {
        if (!userId || !quoteId) return null;
        const quoteRef = quoteDocRef(userId, quoteId);
        const quoteSnap = await getDoc(quoteRef);
        if (!quoteSnap.exists()) return null;

        const metadata = normalizeQuoteMetadata(quoteId, quoteSnap.data() || {});

        if (metadata.latestRevisionId) {
            const revisionRef = doc(
                db,
                'users',
                userId,
                'quotes',
                quoteId,
                'revisions',
                metadata.latestRevisionId
            );
            const revisionSnap = await getDoc(revisionRef);
            if (revisionSnap.exists()) {
                return {
                    metadata,
                    revision: normalizeQuoteRevision(
                        quoteId,
                        revisionSnap.id || metadata.latestRevisionId,
                        revisionSnap.data() || {},
                        metadata
                    )
                };
            }
        }

        const rows = await getQuoteRevisions({ userId, quoteId, limit: 1 });
        if (rows.length > 0) return { metadata, revision: rows[0] };

        if (metadata.state) {
            return {
                metadata,
                revision: {
                    revisionId: 'legacy',
                    quoteId,
                    version: metadata.latestVersion || 1,
                    savedAtMs: metadata.updatedAtMs || metadata.createdAtMs || Date.now(),
                    savedBy: metadata.savedBy || '',
                    savedByUid: metadata.savedByUid || '',
                    state: toStatePayload(metadata.state),
                    summary: toSummaryPayload(metadata.summary || {
                        finalTotalSek: metadata.totalSek || 0,
                        grossTotalSek: 0,
                        totalDiscountSek: 0
                    }),
                    changeNote: 'Legacy snapshot'
                }
            };
        }

        return { metadata, revision: null };
    }

    async function getQuoteRevisionByVersion({
        userId,
        quoteId,
        version
    }: GetQuoteRevisionByVersionInput): Promise<QuoteRevision | null> {
        if (!userId || !quoteId) return null;

        const revisionsRef = revisionsCollectionRef(userId, quoteId);
        let snap;

        try {
            snap = await getDocs(query(revisionsRef, orderBy('version', 'desc')));
        } catch {
            snap = await getDocs(query(revisionsRef, orderBy('savedAtMs', 'desc')));
        }

        const match = snap.docs.find((docSnap) => {
            const raw = toRecord<RawQuoteRevisionDoc>(docSnap.data() || {});
            return Math.max(1, toNumber(raw.version, 0) || 0) === Math.max(1, toNumber(version, 1) || 1);
        });

        if (!match) {
            return null;
        }

        return normalizeQuoteRevision(quoteId, match.id || '', match.data() || {});
    }

    async function updateQuoteStatus({ userId, quoteId, status }: UpdateQuoteStatusInput): Promise<QuoteMetadata> {
        if (!userId || !quoteId) throw new Error('userId and quoteId are required.');
        const quoteRef = quoteDocRef(userId, quoteId);
        const snap = await getDoc(quoteRef);
        if (!snap.exists()) throw new Error('Quote not found.');

        const existing = normalizeQuoteMetadata(quoteId, snap.data() || {});
        const normalizedStatus = normalizeQuoteStatus(status);
        const updatedAtMs = Date.now();
        const searchText = buildQuoteSearchText({
            customerName: existing.customerName,
            company: existing.company,
            reference: existing.reference,
            customerReference: existing.customerReference,
            status: normalizedStatus
        });

        if (typeof updateDoc === 'function') {
            await updateDoc(quoteRef, {
                status: normalizedStatus,
                updatedAtMs,
                searchText
            });
        } else {
            await setDoc(
                quoteRef,
                {
                    status: normalizedStatus,
                    updatedAtMs,
                    searchText
                },
                { merge: true }
            );
        }

        return {
            ...existing,
            status: normalizedStatus,
            updatedAtMs,
            searchText
        };
    }

    async function updateQuoteScrive({ userId, quoteId, scrive = {} }: UpdateQuoteScriveInput): Promise<QuoteMetadata> {
        if (!userId || !quoteId) throw new Error('userId and quoteId are required.');
        const quoteRef = quoteDocRef(userId, quoteId);
        const snap = await getDoc(quoteRef);
        if (!snap.exists()) throw new Error('Quote not found.');

        const existing = normalizeQuoteMetadata(quoteId, snap.data() || {});
        const updatedAtMs = Date.now();
        const scriveInput = toRecord<ScrivePatchInput>(scrive);
        const scrivePatch = {
            scriveEnabled: typeof scriveInput.enabled === 'boolean' ? scriveInput.enabled : existing.scriveEnabled,
            scriveStatus: normalizeScriveStatus(scriveInput.status || existing.scriveStatus),
            scriveDocumentId: scriveInput.documentId !== undefined
                ? (scriveInput.documentId ? String(scriveInput.documentId) : null)
                : existing.scriveDocumentId,
            scriveSignerName: String(scriveInput.signerName || existing.scriveSignerName || existing.customerName || ''),
            scriveSignerEmail: String(scriveInput.signerEmail || existing.scriveSignerEmail || ''),
            scriveLastError: scriveInput.lastError !== undefined
                ? (scriveInput.lastError ? String(scriveInput.lastError) : null)
                : existing.scriveLastError,
            scriveSentAtMs: scriveInput.sentAtMs !== undefined
                ? (scriveInput.sentAtMs == null ? null : toNumber(scriveInput.sentAtMs, existing.scriveSentAtMs || null))
                : existing.scriveSentAtMs,
            scriveLastEventAtMs: scriveInput.lastEventAtMs !== undefined
                ? (scriveInput.lastEventAtMs == null ? null : toNumber(scriveInput.lastEventAtMs, existing.scriveLastEventAtMs || null))
                : existing.scriveLastEventAtMs,
            scriveCompletedAtMs: scriveInput.completedAtMs !== undefined
                ? (scriveInput.completedAtMs == null ? null : toNumber(scriveInput.completedAtMs, existing.scriveCompletedAtMs || null))
                : existing.scriveCompletedAtMs,
            updatedAtMs
        };

        if (typeof updateDoc === 'function') {
            await updateDoc(quoteRef, scrivePatch);
        } else {
            await setDoc(quoteRef, scrivePatch, { merge: true });
        }

        return {
            ...existing,
            ...scrivePatch
        };
    }

    async function deleteQuote({ userId, quoteId }: { userId: string; quoteId: string }): Promise<void> {
        if (!userId || !quoteId) throw new Error('userId and quoteId are required.');
        const quoteRef = quoteDocRef(userId, quoteId);
        const revisionsRef = revisionsCollectionRef(userId, quoteId);
        const revisionsSnap = await getDocs(revisionsRef);

        if (typeof writeBatch === 'function') {
            const batch = writeBatch(db);
            revisionsSnap.forEach?.((docSnap) => {
                if (docSnap.ref) {
                    batch.delete(docSnap.ref);
                }
            });
            batch.delete(quoteRef);
            await batch.commit();
            return;
        }

        if (typeof deleteDoc === 'function') {
            for (const docSnap of revisionsSnap.docs) {
                if (docSnap.ref) {
                    await deleteDoc(docSnap.ref);
                }
            }
            await deleteDoc(quoteRef);
            return;
        }

        await setDoc(quoteRef, { deletedAtMs: Date.now() }, { merge: true });
    }

    return {
        createQuote,
        saveQuoteRevision,
        getUserQuotes,
        getQuoteLatestRevision,
        getQuoteRevisionByVersion,
        getQuoteRevisions,
        deleteQuote,
        updateQuoteStatus,
        updateQuoteScrive,
        getAllUsersQuotes
    };
}
