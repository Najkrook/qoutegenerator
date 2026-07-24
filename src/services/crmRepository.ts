import type {
    CrmActivity,
    CrmActivityListOptions,
    CrmActivityStatus,
    CrmActivityType,
    CrmActor,
    CrmAddress,
    CrmArchiveActivityInput,
    CrmArchiveCompanyInput,
    CrmArchiveContactInput,
    CrmArchiveDealInput,
    CrmArchiveMemberInput,
    CrmChangeDealStageInput,
    CrmCompany,
    CrmCompanyDuplicateQuery,
    CrmCompleteActivityInput,
    CrmContact,
    CrmContactDuplicateQuery,
    CrmContactListOptions,
    CrmCreateActivityInput,
    CrmCreateCompanyInput,
    CrmCreateContactInput,
    CrmCreateDealInput,
    CrmCreateMemberInput,
    CrmDeal,
    CrmDealListOptions,
    CrmDealStage,
    CrmLinkDealToQuoteInput,
    CrmListOptions,
    CrmMember,
    CrmPage,
    CrmPageCursor,
    CrmQuoteLinkFields,
    CrmRescheduleActivityInput,
    CrmRepository,
    CrmSearchFields,
    CrmSearchOptions,
    CrmSearchResults,
    CrmSyncDealFromQuoteInput,
    CrmUnlinkDealFromQuoteInput,
    CrmUpdateActivityInput,
    CrmUpdateCompanyInput,
    CrmUpdateContactInput,
    CrmUpdateDealInput,
    CrmUpdateMemberInput
} from '../types/crm';
import {
    collection,
    db,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    runTransaction,
    setDoc
} from './firebase';
import { safeLogActivity } from './activityLogService';
import { buildQuoteSearchText, normalizeQuoteStatus } from './quoteRepository';

export const CRM_COLLECTIONS = {
    companies: 'crm_companies',
    contacts: 'crm_contacts',
    deals: 'crm_deals',
    activities: 'crm_activities',
    members: 'crm_members'
} as const;

export const DEFAULT_CRM_PAGE_SIZE = 50;
export const MAX_CRM_PAGE_SIZE = 500;
export const CRM_SCHEMA_VERSION = 1 as const;
export const MAX_CRM_TAGS = 20;
export const MAX_CRM_TAG_LENGTH = 40;

type UnknownRecord = Record<string, unknown>;

interface CrmDocRef {
    path?: string;
}

interface CrmDocSnapshot {
    id?: string;
    exists(): boolean;
    data(): UnknownRecord | undefined;
}

interface CrmQuerySnapshot {
    docs: CrmDocSnapshot[];
}

interface CrmTransaction {
    get(ref: CrmDocRef): Promise<CrmDocSnapshot>;
    set(ref: CrmDocRef, payload: UnknownRecord, options?: { merge?: boolean }): void;
}

export interface CrmAuditEntry {
    actor: CrmActor;
    eventType: string;
    targetType: string;
    targetId: string;
    details: string;
    metadata?: UnknownRecord;
}

export interface CrmRepositoryDeps {
    db?: unknown;
    doc?: (db: unknown, ...segments: string[]) => CrmDocRef;
    collection?: (db: unknown, ...segments: string[]) => unknown;
    getDoc?: (ref: CrmDocRef) => Promise<CrmDocSnapshot>;
    getDocs?: (ref: unknown) => Promise<CrmQuerySnapshot>;
    setDoc?: (ref: CrmDocRef, payload: UnknownRecord, options?: { merge?: boolean }) => Promise<unknown>;
    query?: (source: unknown, ...constraints: unknown[]) => unknown;
    orderBy?: (field: string, direction?: 'asc' | 'desc') => unknown;
    runTransaction?: <T>(db: unknown, callback: (transaction: CrmTransaction) => Promise<T>) => Promise<T>;
    now?: () => number;
    createId?: (prefix: string) => string;
    logAudit?: (entry: CrmAuditEntry) => void | Promise<unknown>;
}

const EMPTY_ADDRESS: CrmAddress = {
    street: '',
    postalCode: '',
    city: '',
    country: 'Sverige'
};

function isRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toRecord(value: unknown): UnknownRecord {
    if (isRecord(value) && typeof value.data === 'function') {
        return toRecord(value.data());
    }
    return isRecord(value) ? value : {};
}

function toStringValue(value: unknown): string {
    return String(value ?? '').trim();
}

function toNullableString(value: unknown): string | null {
    const text = toStringValue(value);
    return text || null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableEpochMs(value: unknown): number | null {
    if (value == null || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(Math.max(0, value));
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (isRecord(value) && typeof value.toMillis === 'function') {
        const parsed = Number(value.toMillis());
        return Number.isFinite(parsed) ? Math.trunc(Math.max(0, parsed)) : null;
    }
    if (isRecord(value) && Number.isFinite(Number(value.seconds))) {
        return Math.trunc(Math.max(
            0,
            Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1_000_000)
        ));
    }
    return null;
}

export function normalizeCrmTags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const tags: string[] = [];
    const normalizedTags = new Set<string>();
    for (const item of value) {
        const tag = Array.from(toStringValue(item)).slice(0, MAX_CRM_TAG_LENGTH).join('').trim();
        if (!tag) continue;
        const normalized = tag.toLocaleLowerCase('sv-SE');
        if (normalizedTags.has(normalized)) continue;
        normalizedTags.add(normalized);
        tags.push(tag);
        if (tags.length >= MAX_CRM_TAGS) break;
    }
    return tags;
}

function requiredId(value: unknown, label: string): string {
    const id = toStringValue(value);
    if (!id) throw new Error(`${label} is required.`);
    return id;
}

function requiredActor(actor: CrmActor | null | undefined): CrmActor {
    if (!actor?.uid) throw new Error('CRM mutations require an authenticated user.');
    return {
        uid: toStringValue(actor.uid),
        name: toStringValue(actor.name),
        email: toStringValue(actor.email)
    };
}

function actorName(actor: CrmActor): string {
    return toStringValue(actor.name) || toStringValue(actor.email) || toStringValue(actor.uid);
}

function normalizeAddress(value: unknown): CrmAddress {
    const raw = toRecord(value);
    return {
        street: toStringValue(raw.street),
        postalCode: toStringValue(raw.postalCode),
        city: toStringValue(raw.city),
        country: toStringValue(raw.country) || EMPTY_ADDRESS.country
    };
}

function normalizePageSize(value: unknown): number {
    const parsed = Math.floor(toFiniteNumber(value, DEFAULT_CRM_PAGE_SIZE));
    return Math.max(1, Math.min(MAX_CRM_PAGE_SIZE, parsed));
}

function createDefaultId(prefix: string): string {
    const randomId = globalThis.crypto?.randomUUID?.();
    if (randomId) return `${prefix}_${randomId}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeCrmSearchText(value: unknown): string {
    return String(value ?? '')
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLocaleLowerCase('sv-SE')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

export function normalizeCrmWebsite(value: unknown): string {
    const raw = toStringValue(value);
    if (!raw) return '';
    if (/^(?:javascript|data|vbscript):/i.test(raw)) return '';
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    try {
        const parsed = new URL(candidate);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
}

export function buildCrmSearchPrefixes(values: unknown[], maxPrefixes = 240): string[] {
    const result = new Set<string>();
    const addPrefixes = (text: string) => {
        const maxLength = Math.min(text.length, 64);
        for (let length = 1; length <= maxLength && result.size < maxPrefixes; length += 1) {
            result.add(text.slice(0, length));
        }
    };

    for (const value of values) {
        const normalized = normalizeCrmSearchText(value);
        if (!normalized) continue;
        addPrefixes(normalized);
        for (const token of normalized.split(' ')) {
            if (token) addPrefixes(token);
        }
        if (result.size >= maxPrefixes) break;
    }

    return [...result];
}

export function buildCrmSearchFields(values: unknown[]): CrmSearchFields {
    const normalizedValues = values.map(normalizeCrmSearchText).filter(Boolean);
    return {
        searchText: normalizedValues.join(' '),
        searchPrefixes: buildCrmSearchPrefixes(values)
    };
}

export function matchesCrmSearch(
    entity: Pick<CrmSearchFields, 'searchText' | 'searchPrefixes'>,
    search: unknown
): boolean {
    const normalized = normalizeCrmSearchText(search);
    if (!normalized) return true;
    return entity.searchPrefixes.includes(normalized) || entity.searchText.includes(normalized);
}

export function normalizeCrmDealStage(value: unknown): CrmDealStage {
    const normalized = toStringValue(value).toLowerCase();
    return normalized === 'quote' || normalized === 'won' || normalized === 'lost' ? normalized : 'lead';
}

export function normalizeCrmActivityType(value: unknown): CrmActivityType {
    const normalized = toStringValue(value).toLowerCase();
    return normalized === 'call'
        || normalized === 'email'
        || normalized === 'meeting'
        || normalized === 'task'
        ? normalized
        : 'note';
}

export function normalizeCrmActivityStatus(value: unknown, type: CrmActivityType = 'note'): CrmActivityStatus {
    if (type !== 'task') return 'completed';
    const normalized = toStringValue(value).toLowerCase();
    return normalized === 'completed' ? 'completed' : 'open';
}

export function getCrmStageForQuoteStatus(value: unknown): CrmDealStage | null {
    const normalized = toStringValue(value).toLowerCase();
    if (normalized === 'draft' || normalized === 'sent') return 'quote';
    if (normalized === 'won') return 'won';
    if (normalized === 'lost') return 'lost';
    return null;
}

export function buildCrmQuoteLink(input: {
    quoteOwnerUid: unknown;
    quoteId: unknown;
    quoteNumber?: unknown;
    quoteRevisionId?: unknown;
    quoteVersion?: unknown;
    valueSek?: unknown;
}): CrmQuoteLinkFields {
    const version = toFiniteNumber(input.quoteVersion, 0);
    return {
        quoteOwnerUid: requiredId(input.quoteOwnerUid, 'quoteOwnerUid'),
        quoteId: requiredId(input.quoteId, 'quoteId'),
        quoteNumber: toNullableString(input.quoteNumber),
        quoteRevisionId: toNullableString(input.quoteRevisionId),
        quoteVersion: version > 0 ? Math.floor(version) : null,
        valueSek: Math.max(0, toFiniteNumber(input.valueSek, 0))
    };
}

function normalizeAudit(raw: UnknownRecord) {
    const createdAtMs = toNullableEpochMs(raw.createdAtMs) || 0;
    const updatedAtMs = toNullableEpochMs(raw.updatedAtMs) || createdAtMs;
    return {
        schemaVersion: CRM_SCHEMA_VERSION,
        archived: raw.archived === true,
        archivedAtMs: toNullableEpochMs(raw.archivedAtMs),
        archivedByUid: toStringValue(raw.archivedByUid),
        createdAtMs,
        updatedAtMs,
        createdByUid: toStringValue(raw.createdByUid),
        createdByName: toStringValue(raw.createdByName),
        updatedByUid: toStringValue(raw.updatedByUid),
        updatedByName: toStringValue(raw.updatedByName)
    };
}

export function normalizeCrmCompany(id: string, value: unknown): CrmCompany {
    const raw = toRecord(value);
    const name = toStringValue(raw.name);
    const address = normalizeAddress(raw.address);
    const tags = normalizeCrmTags(raw.tags);
    const fields = {
        id: toStringValue(id || raw.id),
        name,
        normalizedName: normalizeCrmSearchText(name),
        orgNumber: toStringValue(raw.orgNumber),
        email: toStringValue(raw.email),
        phone: toStringValue(raw.phone),
        website: normalizeCrmWebsite(raw.website),
        address,
        tags,
        notes: toStringValue(raw.notes)
    };
    return {
        ...fields,
        ...buildCrmSearchFields([
            fields.name,
            fields.orgNumber,
            fields.email,
            fields.phone,
            fields.website,
            address.street,
            address.postalCode,
            address.city,
            ...tags
        ]),
        ...normalizeAudit(raw)
    };
}

export function normalizeCrmContact(id: string, value: unknown): CrmContact {
    const raw = toRecord(value);
    const firstName = toStringValue(raw.firstName);
    const lastName = toStringValue(raw.lastName);
    const email = toStringValue(raw.email);
    const name = toStringValue(raw.name) || [firstName, lastName].filter(Boolean).join(' ') || email;
    const tags = normalizeCrmTags(raw.tags);
    const fields = {
        id: toStringValue(id || raw.id),
        companyId: toNullableString(raw.companyId),
        name,
        normalizedName: normalizeCrmSearchText(name),
        firstName,
        lastName,
        email,
        normalizedEmail: email.toLocaleLowerCase('sv-SE'),
        phone: toStringValue(raw.phone),
        role: toStringValue(raw.role),
        tags,
        notes: toStringValue(raw.notes)
    };
    return {
        ...fields,
        ...buildCrmSearchFields([
            fields.name,
            fields.firstName,
            fields.lastName,
            fields.email,
            fields.phone,
            fields.role,
            ...tags
        ]),
        ...normalizeAudit(raw)
    };
}

export function normalizeCrmDeal(id: string, value: unknown): CrmDeal {
    const raw = toRecord(value);
    const tags = normalizeCrmTags(raw.tags);
    const fields = {
        id: toStringValue(id || raw.id),
        title: toStringValue(raw.title),
        companyId: toNullableString(raw.companyId),
        primaryContactId: toNullableString(raw.primaryContactId),
        ownerId: toNullableString(raw.ownerId),
        ownerName: toStringValue(raw.ownerName),
        stage: normalizeCrmDealStage(raw.stage),
        valueSek: Math.max(0, toFiniteNumber(raw.valueSek, 0)),
        expectedCloseAtMs: toNullableEpochMs(raw.expectedCloseAtMs),
        lostReason: toStringValue(raw.lostReason),
        quoteOwnerUid: toNullableString(raw.quoteOwnerUid),
        quoteId: toNullableString(raw.quoteId),
        quoteNumber: toNullableString(raw.quoteNumber),
        quoteRevisionId: toNullableString(raw.quoteRevisionId),
        quoteVersion: (() => {
            const version = toFiniteNumber(raw.quoteVersion, 0);
            return version > 0 ? Math.floor(version) : null;
        })(),
        lastActivityAtMs: toNullableEpochMs(raw.lastActivityAtMs),
        nextActivityAtMs: toNullableEpochMs(raw.nextActivityAtMs),
        tags
    };
    return {
        ...fields,
        ...buildCrmSearchFields([
            fields.title,
            fields.ownerName,
            fields.quoteNumber,
            fields.lostReason,
            fields.stage,
            ...tags
        ]),
        ...normalizeAudit(raw)
    };
}

export function normalizeCrmActivity(id: string, value: unknown): CrmActivity {
    const raw = toRecord(value);
    const type = normalizeCrmActivityType(raw.type);
    const status = normalizeCrmActivityStatus(raw.status, type);
    const completedAtMs = status === 'completed'
        ? (toNullableEpochMs(raw.completedAtMs) || toNullableEpochMs(raw.updatedAtMs))
        : null;
    const fields = {
        id: toStringValue(id || raw.id),
        type,
        status,
        subject: toStringValue(raw.subject),
        notes: toStringValue(raw.notes),
        companyId: toNullableString(raw.companyId),
        contactId: toNullableString(raw.contactId),
        dealId: toNullableString(raw.dealId),
        assignedToId: toNullableString(raw.assignedToId),
        assignedToName: toStringValue(raw.assignedToName),
        occurredAtMs: toNullableEpochMs(raw.occurredAtMs) || toNullableEpochMs(raw.createdAtMs) || 0,
        dueAtMs: type === 'task' ? toNullableEpochMs(raw.dueAtMs) : null,
        completedAtMs
    };
    return {
        ...fields,
        ...buildCrmSearchFields([
            fields.subject,
            fields.notes,
            fields.assignedToName,
            fields.type,
            fields.status
        ]),
        ...normalizeAudit(raw)
    };
}

export function normalizeCrmMember(id: string, value: unknown): CrmMember {
    const raw = toRecord(value);
    const email = toStringValue(raw.email);
    const fields = {
        id: toStringValue(id || raw.id),
        name: toStringValue(raw.name),
        email,
        normalizedEmail: email.toLocaleLowerCase('sv-SE'),
        phone: toStringValue(raw.phone),
        title: toStringValue(raw.title)
    };
    return {
        ...fields,
        ...buildCrmSearchFields([fields.name, fields.email, fields.phone, fields.title]),
        ...normalizeAudit(raw)
    };
}

export function deriveDealActivityDates(
    activities: Array<Pick<
        CrmActivity,
        'archived' | 'type' | 'status' | 'occurredAtMs' | 'createdAtMs' | 'dueAtMs'
    >>
): Pick<CrmDeal, 'lastActivityAtMs' | 'nextActivityAtMs'> {
    let lastActivityAtMs: number | null = null;
    let nextActivityAtMs: number | null = null;

    for (const activity of activities) {
        if (activity.archived) continue;
        const occurredAtMs = activity.occurredAtMs || activity.createdAtMs || 0;
        if (occurredAtMs > 0 && (lastActivityAtMs == null || occurredAtMs > lastActivityAtMs)) {
            lastActivityAtMs = occurredAtMs;
        }
        if (
            activity.type === 'task'
            && activity.status === 'open'
            && activity.dueAtMs != null
            && (nextActivityAtMs == null || activity.dueAtMs < nextActivityAtMs)
        ) {
            nextActivityAtMs = activity.dueAtMs;
        }
    }

    return { lastActivityAtMs, nextActivityAtMs };
}

function buildCreateAudit(actor: CrmActor, nowMs: number) {
    const name = actorName(actor);
    return {
        schemaVersion: CRM_SCHEMA_VERSION,
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        createdByUid: actor.uid,
        createdByName: name,
        updatedByUid: actor.uid,
        updatedByName: name
    };
}

function buildUpdateAudit(actor: CrmActor, nowMs: number) {
    return {
        updatedAtMs: nowMs,
        updatedByUid: actor.uid,
        updatedByName: actorName(actor)
    };
}

function buildArchiveAudit(actor: CrmActor, nowMs: number, archived: boolean) {
    return {
        archived,
        archivedAtMs: archived ? nowMs : null,
        archivedByUid: archived ? actor.uid : '',
        ...buildUpdateAudit(actor, nowMs)
    };
}

function pageRecords<T extends { id: string }>(
    records: T[],
    options: CrmListOptions,
    getSortValue: (record: T) => number
): CrmPage<T> {
    const sorted = [...records].sort((left, right) => {
        const valueDiff = getSortValue(right) - getSortValue(left);
        return valueDiff || right.id.localeCompare(left.id);
    });
    const cursor = options.cursor;
    let startIndex = 0;
    if (cursor) {
        const exactIndex = sorted.findIndex((record) => record.id === cursor.id);
        if (exactIndex >= 0) {
            startIndex = exactIndex + 1;
        } else {
            startIndex = sorted.findIndex((record) => {
                const value = getSortValue(record);
                return value < cursor.sortValue || (value === cursor.sortValue && record.id < cursor.id);
            });
            if (startIndex < 0) startIndex = sorted.length;
        }
    }

    const pageSize = normalizePageSize(options.pageSize);
    const items = sorted.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < sorted.length;
    const last = items[items.length - 1];
    const nextCursor: CrmPageCursor | null = hasMore && last
        ? { sortValue: getSortValue(last), id: last.id }
        : null;
    return { items, nextCursor };
}

export function createCrmRepository(deps: CrmRepositoryDeps = {}): CrmRepository {
    const dbRef = deps.db;
    const makeDoc = deps.doc;
    const makeCollection = deps.collection;
    const readDoc = deps.getDoc;
    const readDocs = deps.getDocs;
    const writeDoc = deps.setDoc;
    const makeQuery = deps.query;
    const makeOrderBy = deps.orderBy;
    const transact = deps.runTransaction;
    const logAudit = deps.logAudit;
    const now = deps.now || (() => Date.now());
    const generateId = deps.createId || createDefaultId;

    const emitAudit = (entry: CrmAuditEntry): void => {
        if (!logAudit) return;
        void Promise.resolve(logAudit(entry)).catch((error) => {
            console.error('Failed to write CRM audit event:', error);
        });
    };

    if (!dbRef || !makeDoc || !makeCollection || !readDoc || !readDocs || !writeDoc || !makeQuery || !makeOrderBy) {
        throw new Error('crmRepository requires Firestore dependencies.');
    }

    const entityRef = (collectionName: string, id: string) =>
        makeDoc(dbRef, collectionName, requiredId(id, 'CRM record id'));

    async function readCollection<T>(
        collectionName: string,
        normalize: (id: string, value: unknown) => T,
        sortField = 'updatedAtMs'
    ): Promise<T[]> {
        const source = makeCollection(dbRef, collectionName);
        const snapshot = await readDocs(makeQuery(source, makeOrderBy(sortField, 'desc')));
        return snapshot.docs.map((snap) => normalize(toStringValue(snap.id), snap.data() || {}));
    }

    async function readEntity<T>(
        collectionName: string,
        id: string,
        normalize: (id: string, value: unknown) => T
    ): Promise<T | null> {
        const normalizedId = requiredId(id, 'CRM record id');
        const snapshot = await readDoc(entityRef(collectionName, normalizedId));
        return snapshot.exists() ? normalize(normalizedId, snapshot.data() || {}) : null;
    }

    async function requireEntity<T>(
        collectionName: string,
        id: string,
        normalize: (id: string, value: unknown) => T,
        label: string
    ): Promise<T> {
        const entity = await readEntity(collectionName, id, normalize);
        if (!entity) throw new Error(`${label} not found.`);
        return entity;
    }

    async function persist(collectionName: string, id: string, entity: unknown): Promise<void> {
        await writeDoc(entityRef(collectionName, id), entity as UnknownRecord, { merge: true });
    }

    async function getCompany(companyId: string): Promise<CrmCompany | null> {
        return readEntity(CRM_COLLECTIONS.companies, companyId, normalizeCrmCompany);
    }

    async function listCompanies(options: CrmListOptions = {}): Promise<CrmPage<CrmCompany>> {
        const records = (await readCollection(CRM_COLLECTIONS.companies, normalizeCrmCompany))
            .filter((record) => (options.includeArchived || !record.archived) && matchesCrmSearch(record, options.search));
        return pageRecords(records, options, (record) => record.updatedAtMs);
    }

    async function findCompanyDuplicates(input: CrmCompanyDuplicateQuery): Promise<CrmCompany[]> {
        const normalizedName = normalizeCrmSearchText(input.name);
        const normalizedOrgNumber = toStringValue(input.orgNumber).toLocaleLowerCase('sv-SE');
        if (!normalizedName && !normalizedOrgNumber) return [];
        const excludedId = toStringValue(input.excludeCompanyId);
        return (await readCollection(CRM_COLLECTIONS.companies, normalizeCrmCompany))
            .filter((company) => (
                (input.includeArchived || !company.archived)
                && (!excludedId || company.id !== excludedId)
                && (
                    (normalizedOrgNumber !== ''
                        && company.orgNumber.toLocaleLowerCase('sv-SE') === normalizedOrgNumber)
                    || (normalizedName !== '' && company.normalizedName === normalizedName)
                )
            ));
    }

    async function createCompany(input: CrmCreateCompanyInput): Promise<CrmCompany> {
        const actor = requiredActor(input.actor);
        const id = toStringValue(input.id) || generateId('company');
        if (input.id && await getCompany(id)) {
            throw new Error('CRM company already exists.');
        }
        const nowMs = now();
        const company = normalizeCrmCompany(id, {
            id,
            name: input.name,
            orgNumber: input.orgNumber,
            email: input.email,
            phone: input.phone,
            website: input.website,
            address: { ...EMPTY_ADDRESS, ...toRecord(input.address) },
            tags: input.tags,
            notes: input.notes,
            ...buildCreateAudit(actor, nowMs)
        });
        if (!company.name) throw new Error('Company name is required.');
        await persist(CRM_COLLECTIONS.companies, id, company);
        emitAudit({
            actor,
            eventType: 'crm_company_created',
            targetType: 'company',
            targetId: id,
            details: `CRM-kund skapad: ${company.name}.`
        });
        return company;
    }

    async function updateCompany(input: CrmUpdateCompanyInput): Promise<CrmCompany> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(
            CRM_COLLECTIONS.companies,
            input.companyId,
            normalizeCrmCompany,
            'CRM company'
        );
        const patch = toRecord(input.patch);
        const company = normalizeCrmCompany(current.id, {
            ...current,
            ...patch,
            address: patch.address ? { ...current.address, ...toRecord(patch.address) } : current.address,
            ...buildUpdateAudit(actor, now())
        });
        if (!company.name) throw new Error('Company name is required.');
        await persist(CRM_COLLECTIONS.companies, current.id, company);
        return company;
    }

    async function setCompanyArchived(input: CrmArchiveCompanyInput, archived: boolean): Promise<CrmCompany> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(
            CRM_COLLECTIONS.companies,
            input.companyId,
            normalizeCrmCompany,
            'CRM company'
        );
        const company = normalizeCrmCompany(current.id, {
            ...current,
            ...buildArchiveAudit(actor, now(), archived)
        });
        await persist(CRM_COLLECTIONS.companies, current.id, company);
        return company;
    }

    async function getContact(contactId: string): Promise<CrmContact | null> {
        return readEntity(CRM_COLLECTIONS.contacts, contactId, normalizeCrmContact);
    }

    async function listContacts(options: CrmContactListOptions = {}): Promise<CrmPage<CrmContact>> {
        const companyFilter = options.companyId === undefined ? undefined : toNullableString(options.companyId);
        const records = (await readCollection(CRM_COLLECTIONS.contacts, normalizeCrmContact))
            .filter((record) => (
                (options.includeArchived || !record.archived)
                && (companyFilter === undefined || record.companyId === companyFilter)
                && matchesCrmSearch(record, options.search)
            ));
        return pageRecords(records, options, (record) => record.updatedAtMs);
    }

    async function findContactDuplicates(input: CrmContactDuplicateQuery): Promise<CrmContact[]> {
        const normalizedEmail = toStringValue(input.email).toLocaleLowerCase('sv-SE');
        const suppliedName = toStringValue(input.name)
            || [toStringValue(input.firstName), toStringValue(input.lastName)].filter(Boolean).join(' ');
        const normalizedName = normalizeCrmSearchText(suppliedName);
        if (!normalizedEmail && !normalizedName) return [];
        const companyId = toNullableString(input.companyId);
        const excludedId = toStringValue(input.excludeContactId);
        return (await readCollection(CRM_COLLECTIONS.contacts, normalizeCrmContact))
            .filter((contact) => (
                (input.includeArchived || !contact.archived)
                && (!excludedId || contact.id !== excludedId)
                && (
                    (normalizedEmail !== '' && contact.normalizedEmail === normalizedEmail)
                    || (
                        normalizedName !== ''
                        && contact.companyId === companyId
                        && contact.normalizedName === normalizedName
                    )
                )
            ));
    }

    async function createContact(input: CrmCreateContactInput): Promise<CrmContact> {
        const actor = requiredActor(input.actor);
        const id = toStringValue(input.id) || generateId('contact');
        if (input.id && await getContact(id)) {
            throw new Error('CRM contact already exists.');
        }
        const contact = normalizeCrmContact(id, {
            id,
            companyId: input.companyId,
            name: input.name,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            role: input.role,
            tags: input.tags,
            notes: input.notes,
            ...buildCreateAudit(actor, now())
        });
        if (!contact.name) throw new Error('Contact name or email is required.');
        await persist(CRM_COLLECTIONS.contacts, id, contact);
        emitAudit({
            actor,
            eventType: 'crm_contact_created',
            targetType: 'contact',
            targetId: id,
            details: `CRM-kontakt skapad: ${contact.name}.`,
            metadata: { companyId: contact.companyId }
        });
        return contact;
    }

    async function updateContact(input: CrmUpdateContactInput): Promise<CrmContact> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(
            CRM_COLLECTIONS.contacts,
            input.contactId,
            normalizeCrmContact,
            'CRM contact'
        );
        const contact = normalizeCrmContact(current.id, {
            ...current,
            ...input.patch,
            ...buildUpdateAudit(actor, now())
        });
        if (!contact.name) throw new Error('Contact name or email is required.');
        await persist(CRM_COLLECTIONS.contacts, current.id, contact);
        return contact;
    }

    async function setContactArchived(input: CrmArchiveContactInput, archived: boolean): Promise<CrmContact> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(
            CRM_COLLECTIONS.contacts,
            input.contactId,
            normalizeCrmContact,
            'CRM contact'
        );
        const contact = normalizeCrmContact(current.id, {
            ...current,
            ...buildArchiveAudit(actor, now(), archived)
        });
        await persist(CRM_COLLECTIONS.contacts, current.id, contact);
        return contact;
    }

    async function getDeal(dealId: string): Promise<CrmDeal | null> {
        return readEntity(CRM_COLLECTIONS.deals, dealId, normalizeCrmDeal);
    }

    async function listDeals(options: CrmDealListOptions = {}): Promise<CrmPage<CrmDeal>> {
        const companyFilter = options.companyId === undefined ? undefined : toNullableString(options.companyId);
        const ownerFilter = options.ownerId === undefined ? undefined : toNullableString(options.ownerId);
        const records = (await readCollection(CRM_COLLECTIONS.deals, normalizeCrmDeal))
            .filter((record) => (
                (options.includeArchived || !record.archived)
                && (companyFilter === undefined || record.companyId === companyFilter)
                && (ownerFilter === undefined || record.ownerId === ownerFilter)
                && (!options.stage || record.stage === options.stage)
                && matchesCrmSearch(record, options.search)
            ));
        return pageRecords(records, options, (record) => record.updatedAtMs);
    }

    async function createDeal(input: CrmCreateDealInput): Promise<CrmDeal> {
        const actor = requiredActor(input.actor);
        const id = toStringValue(input.id) || generateId('deal');
        if (input.id && await getDeal(id)) {
            throw new Error('CRM deal already exists.');
        }
        const deal = normalizeCrmDeal(id, {
            id,
            title: input.title,
            companyId: input.companyId,
            primaryContactId: input.primaryContactId,
            ownerId: input.ownerId,
            ownerName: input.ownerName,
            stage: input.stage,
            valueSek: input.valueSek,
            expectedCloseAtMs: input.expectedCloseAtMs,
            lostReason: input.lostReason,
            tags: input.tags,
            quoteOwnerUid: input.quoteOwnerUid,
            quoteId: input.quoteId,
            quoteNumber: input.quoteNumber,
            quoteRevisionId: input.quoteRevisionId,
            quoteVersion: input.quoteVersion,
            lastActivityAtMs: null,
            nextActivityAtMs: null,
            ...buildCreateAudit(actor, now())
        });
        if (!deal.title) throw new Error('Deal title is required.');
        if (deal.stage === 'quote' || deal.quoteId || deal.quoteOwnerUid) {
            throw new Error('Create the deal first, then use linkDealToQuote to attach a quote.');
        }
        await persist(CRM_COLLECTIONS.deals, id, deal);
        emitAudit({
            actor,
            eventType: 'crm_deal_created',
            targetType: 'deal',
            targetId: id,
            details: `CRM-affär skapad: ${deal.title}.`,
            metadata: { stage: deal.stage, valueSek: deal.valueSek }
        });
        return deal;
    }

    async function updateDeal(input: CrmUpdateDealInput): Promise<CrmDeal> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(CRM_COLLECTIONS.deals, input.dealId, normalizeCrmDeal, 'CRM deal');
        const deal = normalizeCrmDeal(current.id, {
            ...current,
            title: input.patch.title ?? current.title,
            companyId: input.patch.companyId === undefined ? current.companyId : input.patch.companyId,
            primaryContactId: input.patch.primaryContactId === undefined
                ? current.primaryContactId
                : input.patch.primaryContactId,
            ownerId: input.patch.ownerId === undefined ? current.ownerId : input.patch.ownerId,
            ownerName: input.patch.ownerName ?? current.ownerName,
            valueSek: input.patch.valueSek ?? current.valueSek,
            expectedCloseAtMs: input.patch.expectedCloseAtMs === undefined
                ? current.expectedCloseAtMs
                : input.patch.expectedCloseAtMs,
            tags: input.patch.tags ?? current.tags,
            ...buildUpdateAudit(actor, now())
        });
        if (!deal.title) throw new Error('Deal title is required.');
        await persist(CRM_COLLECTIONS.deals, current.id, deal);
        return deal;
    }

    async function setDealArchived(input: CrmArchiveDealInput, archived: boolean): Promise<CrmDeal> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(CRM_COLLECTIONS.deals, input.dealId, normalizeCrmDeal, 'CRM deal');
        const deal = normalizeCrmDeal(current.id, {
            ...current,
            ...buildArchiveAudit(actor, now(), archived)
        });
        await persist(CRM_COLLECTIONS.deals, current.id, deal);
        return deal;
    }

    async function writeDealStage(input: CrmChangeDealStageInput): Promise<CrmDeal> {
        const actor = requiredActor(input.actor);
        const dealId = requiredId(input.dealId, 'dealId');
        const stage = normalizeCrmDealStage(input.stage);
        const dealRef = entityRef(CRM_COLLECTIONS.deals, dealId);

        const apply = async (
            reader: (ref: CrmDocRef) => Promise<CrmDocSnapshot>,
            writer: (ref: CrmDocRef, payload: UnknownRecord, options?: { merge?: boolean }) => void | Promise<unknown>
        ): Promise<CrmDeal> => {
            const snapshot = await reader(dealRef);
            if (!snapshot.exists()) throw new Error('CRM deal not found.');
            const current = normalizeCrmDeal(dealId, snapshot.data() || {});
            if (stage === 'quote' && !current.quoteId) {
                throw new Error('Link a quote before moving the CRM deal to quote.');
            }
            const deal = normalizeCrmDeal(dealId, {
                ...current,
                stage,
                lostReason: stage === 'lost' ? toStringValue(input.lostReason ?? current.lostReason) : '',
                ...buildUpdateAudit(actor, now())
            });

            let quoteWrite: { ref: CrmDocRef; payload: UnknownRecord } | null = null;
            if ((stage === 'won' || stage === 'lost') && deal.quoteOwnerUid && deal.quoteId) {
                const quoteRef = makeDoc(dbRef, 'users', deal.quoteOwnerUid, 'quotes', deal.quoteId);
                const quoteSnapshot = await reader(quoteRef);
                if (quoteSnapshot.exists()) {
                    const quoteRaw = toRecord(quoteSnapshot.data());
                    quoteWrite = {
                        ref: quoteRef,
                        payload: {
                            status: stage,
                            crmDealId: deal.id,
                            searchText: buildQuoteSearchText({ ...quoteRaw, status: stage }),
                            updatedAtMs: deal.updatedAtMs
                        }
                    };
                }
            }

            await writer(dealRef, deal as unknown as UnknownRecord, { merge: true });
            if (quoteWrite) {
                await writer(quoteWrite.ref, quoteWrite.payload, { merge: true });
            }
            return deal;
        };

        const deal = transact
            ? await transact(dbRef, (transaction) => apply(
                (ref) => transaction.get(ref),
                (ref, payload, options) => transaction.set(ref, payload, options)
            ))
            : await apply(readDoc, (ref, payload, options) => writeDoc(ref, payload, options));
        emitAudit({
            actor,
            eventType: 'crm_deal_stage_changed',
            targetType: 'deal',
            targetId: deal.id,
            details: `CRM-affärens steg ändrades till ${deal.stage}.`,
            metadata: { stage: deal.stage, quoteId: deal.quoteId }
        });
        return deal;
    }

    async function getActivity(activityId: string): Promise<CrmActivity | null> {
        return readEntity(CRM_COLLECTIONS.activities, activityId, normalizeCrmActivity);
    }

    async function listActivities(options: CrmActivityListOptions = {}): Promise<CrmPage<CrmActivity>> {
        const companyFilter = options.companyId === undefined ? undefined : toNullableString(options.companyId);
        const contactFilter = options.contactId === undefined ? undefined : toNullableString(options.contactId);
        const dealFilter = options.dealId === undefined ? undefined : toNullableString(options.dealId);
        const dueBefore = toNullableEpochMs(options.dueBeforeMs);
        const dueAfter = toNullableEpochMs(options.dueAfterMs);
        const records = (await readCollection(CRM_COLLECTIONS.activities, normalizeCrmActivity, 'occurredAtMs'))
            .filter((record) => (
                (options.includeArchived || !record.archived)
                && (companyFilter === undefined || record.companyId === companyFilter)
                && (contactFilter === undefined || record.contactId === contactFilter)
                && (dealFilter === undefined || record.dealId === dealFilter)
                && (!options.type || record.type === options.type)
                && (!options.status || record.status === options.status)
                && (dueBefore == null || (record.dueAtMs != null && record.dueAtMs <= dueBefore))
                && (dueAfter == null || (record.dueAtMs != null && record.dueAtMs >= dueAfter))
                && matchesCrmSearch(record, options.search)
            ));
        return pageRecords(records, options, (record) => record.occurredAtMs || record.createdAtMs);
    }

    async function refreshDealActivityDates(dealId: string | null, actor: CrmActor): Promise<void> {
        if (!dealId) return;
        const deal = await getDeal(dealId);
        if (!deal) return;
        const activities = (await readCollection(CRM_COLLECTIONS.activities, normalizeCrmActivity, 'occurredAtMs'))
            .filter((activity) => activity.dealId === dealId);
        const dates = deriveDealActivityDates(activities);
        const updatedDeal = normalizeCrmDeal(dealId, {
            ...deal,
            ...dates,
            ...buildUpdateAudit(actor, now())
        });
        await persist(CRM_COLLECTIONS.deals, dealId, updatedDeal);
    }

    async function refreshDealActivityDatesSafely(dealId: string | null, actor: CrmActor): Promise<void> {
        try {
            await refreshDealActivityDates(dealId, actor);
        } catch (error) {
            console.error('Failed to refresh CRM deal activity dates; scheduling retry:', error);
            if (typeof setTimeout === 'function' && dealId) {
                setTimeout(() => {
                    void refreshDealActivityDates(dealId, actor).catch((retryError) => {
                        console.error('Failed to retry CRM deal activity date refresh:', retryError);
                    });
                }, 1500);
            }
        }
    }

    async function createActivity(input: CrmCreateActivityInput): Promise<CrmActivity> {
        const actor = requiredActor(input.actor);
        const id = toStringValue(input.id) || generateId('activity');
        if (input.id && await getActivity(id)) {
            throw new Error('CRM activity already exists.');
        }
        const nowMs = now();
        const type = normalizeCrmActivityType(input.type);
        const status = normalizeCrmActivityStatus(input.status, type);
        const activity = normalizeCrmActivity(id, {
            id,
            type,
            status,
            subject: input.subject,
            notes: input.notes,
            companyId: input.companyId,
            contactId: input.contactId,
            dealId: input.dealId,
            assignedToId: input.assignedToId,
            assignedToName: input.assignedToName,
            occurredAtMs: input.occurredAtMs || nowMs,
            dueAtMs: input.dueAtMs,
            completedAtMs: status === 'completed' ? (input.completedAtMs || nowMs) : null,
            ...buildCreateAudit(actor, nowMs)
        });
        if (!activity.subject) throw new Error('Activity subject is required.');
        if (activity.type === 'task' && activity.status === 'open' && activity.dueAtMs == null) {
            throw new Error('Open CRM tasks require a due date.');
        }
        await persist(CRM_COLLECTIONS.activities, id, activity);
        await refreshDealActivityDatesSafely(activity.dealId, actor);
        emitAudit({
            actor,
            eventType: 'crm_activity_created',
            targetType: 'activity',
            targetId: id,
            details: `CRM-aktivitet skapad: ${activity.subject}.`,
            metadata: { type: activity.type, dealId: activity.dealId }
        });
        return activity;
    }

    async function updateActivity(input: CrmUpdateActivityInput): Promise<CrmActivity> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(
            CRM_COLLECTIONS.activities,
            input.activityId,
            normalizeCrmActivity,
            'CRM activity'
        );
        const nextType = normalizeCrmActivityType(input.patch.type ?? current.type);
        const nextStatus = normalizeCrmActivityStatus(input.patch.status ?? current.status, nextType);
        const activity = normalizeCrmActivity(current.id, {
            ...current,
            ...input.patch,
            type: nextType,
            status: nextStatus,
            completedAtMs: nextStatus === 'completed'
                ? (input.patch.completedAtMs ?? current.completedAtMs ?? now())
                : null,
            ...buildUpdateAudit(actor, now())
        });
        if (!activity.subject) throw new Error('Activity subject is required.');
        if (activity.type === 'task' && activity.status === 'open' && activity.dueAtMs == null) {
            throw new Error('Open CRM tasks require a due date.');
        }
        await persist(CRM_COLLECTIONS.activities, current.id, activity);
        await Promise.all([
            refreshDealActivityDatesSafely(current.dealId, actor),
            activity.dealId !== current.dealId
                ? refreshDealActivityDatesSafely(activity.dealId, actor)
                : Promise.resolve()
        ]);
        return activity;
    }

    async function setActivityCompleted(
        input: CrmCompleteActivityInput,
        completed: boolean
    ): Promise<CrmActivity> {
        const activity = await updateActivity({
            activityId: input.activityId,
            actor: input.actor,
            patch: {
                status: completed ? 'completed' : 'open',
                completedAtMs: completed ? now() : null
            }
        });
        if (completed) {
            emitAudit({
                actor: input.actor,
                eventType: 'crm_activity_completed',
                targetType: 'activity',
                targetId: activity.id,
                details: `CRM-uppföljning slutförd: ${activity.subject}.`,
                metadata: { dealId: activity.dealId }
            });
        }
        return activity;
    }

    async function rescheduleActivity(input: CrmRescheduleActivityInput): Promise<CrmActivity> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(
            CRM_COLLECTIONS.activities,
            input.activityId,
            normalizeCrmActivity,
            'CRM activity'
        );
        if (current.archived || current.type !== 'task' || current.status !== 'open') {
            throw new Error('Only open CRM tasks can be rescheduled.');
        }
        const nowMs = now();
        const dueAtMs = toNullableEpochMs(input.dueAtMs);
        if (dueAtMs == null || dueAtMs <= nowMs) {
            throw new Error('The new CRM task due date must be a valid future time.');
        }
        const activity = normalizeCrmActivity(current.id, {
            ...current,
            dueAtMs,
            ...buildUpdateAudit(actor, nowMs)
        });
        await persist(CRM_COLLECTIONS.activities, current.id, activity);
        await refreshDealActivityDatesSafely(activity.dealId, actor);
        emitAudit({
            actor,
            eventType: 'crm_activity_rescheduled',
            targetType: 'activity',
            targetId: activity.id,
            details: `CRM-uppgift flyttad: ${activity.subject}.`,
            metadata: {
                dealId: activity.dealId,
                previousDueAtMs: current.dueAtMs,
                dueAtMs: activity.dueAtMs
            }
        });
        return activity;
    }

    async function setActivityArchived(
        input: CrmArchiveActivityInput,
        archived: boolean
    ): Promise<CrmActivity> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(
            CRM_COLLECTIONS.activities,
            input.activityId,
            normalizeCrmActivity,
            'CRM activity'
        );
        const activity = normalizeCrmActivity(current.id, {
            ...current,
            ...buildArchiveAudit(actor, now(), archived)
        });
        await persist(CRM_COLLECTIONS.activities, current.id, activity);
        await refreshDealActivityDatesSafely(activity.dealId, actor);
        return activity;
    }

    async function getMember(memberId: string): Promise<CrmMember | null> {
        return readEntity(CRM_COLLECTIONS.members, memberId, normalizeCrmMember);
    }

    async function listMembers(options: CrmListOptions = {}): Promise<CrmPage<CrmMember>> {
        const records = (await readCollection(CRM_COLLECTIONS.members, normalizeCrmMember))
            .filter((record) => (options.includeArchived || !record.archived) && matchesCrmSearch(record, options.search));
        return pageRecords(records, options, (record) => record.updatedAtMs);
    }

    async function createMember(input: CrmCreateMemberInput): Promise<CrmMember> {
        const actor = requiredActor(input.actor);
        const id = toStringValue(input.id) || generateId('member');
        const existing = input.id ? await getMember(id) : null;
        if (existing) return existing;
        const member = normalizeCrmMember(id, {
            id,
            name: input.name,
            email: input.email,
            phone: input.phone,
            title: input.title,
            ...buildCreateAudit(actor, now())
        });
        if (!member.name) throw new Error('Member name is required.');
        await persist(CRM_COLLECTIONS.members, id, member);
        return member;
    }

    async function updateMember(input: CrmUpdateMemberInput): Promise<CrmMember> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(CRM_COLLECTIONS.members, input.memberId, normalizeCrmMember, 'CRM member');
        const member = normalizeCrmMember(current.id, {
            ...current,
            ...input.patch,
            ...buildUpdateAudit(actor, now())
        });
        if (!member.name) throw new Error('Member name is required.');
        await persist(CRM_COLLECTIONS.members, current.id, member);
        return member;
    }

    async function setMemberArchived(input: CrmArchiveMemberInput, archived: boolean): Promise<CrmMember> {
        const actor = requiredActor(input.actor);
        const current = await requireEntity(CRM_COLLECTIONS.members, input.memberId, normalizeCrmMember, 'CRM member');
        const member = normalizeCrmMember(current.id, {
            ...current,
            ...buildArchiveAudit(actor, now(), archived)
        });
        await persist(CRM_COLLECTIONS.members, current.id, member);
        return member;
    }

    async function searchAll(options: CrmSearchOptions): Promise<CrmSearchResults> {
        const listOptions: CrmListOptions = {
            search: options.query,
            includeArchived: options.includeArchived,
            pageSize: options.pageSize
        };
        const [companies, contacts, deals] = await Promise.all([
            listCompanies(listOptions),
            listContacts(listOptions),
            listDeals(listOptions)
        ]);
        return { companies, contacts, deals };
    }

    async function writeQuoteLink(
        input: CrmLinkDealToQuoteInput,
        options: {
            quoteStage: CrmDealStage | null;
            quoteStatus?: string;
            syncStageFromQuote?: boolean;
        }
    ): Promise<CrmDeal> {
        const user = requiredActor(input.user);
        const dealId = requiredId(input.dealId, 'dealId');
        const link = buildCrmQuoteLink(input);
        const dealRef = entityRef(CRM_COLLECTIONS.deals, dealId);
        const quoteRef = makeDoc(dbRef, 'users', link.quoteOwnerUid, 'quotes', link.quoteId);

        const apply = async (
            reader: (ref: CrmDocRef) => Promise<CrmDocSnapshot>,
            writer: (ref: CrmDocRef, payload: UnknownRecord, options?: { merge?: boolean }) => void | Promise<unknown>
        ): Promise<CrmDeal> => {
            const [dealSnapshot, quoteSnapshot] = await Promise.all([reader(dealRef), reader(quoteRef)]);
            if (!dealSnapshot.exists()) throw new Error('CRM deal not found.');
            if (!quoteSnapshot.exists()) throw new Error('Quote not found.');

            const current = normalizeCrmDeal(dealId, dealSnapshot.data() || {});
            const quoteRaw = toRecord(quoteSnapshot.data());
            const existingDealId = toNullableString(quoteRaw.crmDealId);
            if (existingDealId && existingDealId !== dealId) {
                throw new Error('Quote is already linked to another CRM deal.');
            }

            if (
                current.quoteOwnerUid
                && current.quoteId
                && (current.quoteOwnerUid !== link.quoteOwnerUid || current.quoteId !== link.quoteId)
            ) {
                const oldQuoteRef = makeDoc(dbRef, 'users', current.quoteOwnerUid, 'quotes', current.quoteId);
                const oldQuoteSnapshot = await reader(oldQuoteRef);
                if (oldQuoteSnapshot.exists() && toStringValue(toRecord(oldQuoteSnapshot.data()).crmDealId) === dealId) {
                    await writer(oldQuoteRef, { crmDealId: null }, { merge: true });
                }
            }

            const deal = normalizeCrmDeal(dealId, {
                ...current,
                ...link,
                valueSek: input.valueSek == null ? current.valueSek : link.valueSek,
                stage: options.syncStageFromQuote
                    ? (options.quoteStage || current.stage)
                    : (current.stage === 'lead' ? 'quote' : current.stage),
                lostReason: options.quoteStage && options.quoteStage !== 'lost' ? '' : current.lostReason,
                ...buildUpdateAudit(user, now())
            });
            await writer(dealRef, deal as unknown as UnknownRecord, { merge: true });
            const quoteStatus = options.quoteStatus !== undefined
                ? normalizeQuoteStatus(options.quoteStatus)
                : (deal.stage === 'won' || deal.stage === 'lost' ? deal.stage : null);
            if (quoteStatus) {
                const status = quoteStatus;
                await writer(quoteRef, {
                    crmDealId: dealId,
                    status,
                    searchText: buildQuoteSearchText({ ...quoteRaw, status }),
                    updatedAtMs: deal.updatedAtMs
                }, { merge: true });
            } else {
                await writer(quoteRef, { crmDealId: dealId }, { merge: true });
            }
            return deal;
        };

        const deal = transact
            ? await transact(dbRef, (transaction) => apply(
                (ref) => transaction.get(ref),
                (ref, payload, options) => transaction.set(ref, payload, options)
            ))
            : await apply(readDoc, (ref, payload, options) => writeDoc(ref, payload, options));
        emitAudit({
            actor: user,
            eventType: 'crm_deal_stage_changed',
            targetType: 'deal',
            targetId: deal.id,
            details: `CRM-affär kopplad till offert ${deal.quoteNumber || deal.quoteId || ''}.`,
            metadata: { stage: deal.stage, quoteId: deal.quoteId, valueSek: deal.valueSek }
        });
        return deal;
    }

    async function unlinkDealFromQuote(input: CrmUnlinkDealFromQuoteInput): Promise<CrmDeal> {
        const user = requiredActor(input.user);
        const dealId = requiredId(input.dealId, 'dealId');
        const dealRef = entityRef(CRM_COLLECTIONS.deals, dealId);

        const apply = async (
            reader: (ref: CrmDocRef) => Promise<CrmDocSnapshot>,
            writer: (ref: CrmDocRef, payload: UnknownRecord, options?: { merge?: boolean }) => void | Promise<unknown>
        ): Promise<CrmDeal> => {
            const dealSnapshot = await reader(dealRef);
            if (!dealSnapshot.exists()) throw new Error('CRM deal not found.');
            const current = normalizeCrmDeal(dealId, dealSnapshot.data() || {});

            if (current.quoteOwnerUid && current.quoteId) {
                const quoteRef = makeDoc(dbRef, 'users', current.quoteOwnerUid, 'quotes', current.quoteId);
                const quoteSnapshot = await reader(quoteRef);
                if (quoteSnapshot.exists() && toStringValue(toRecord(quoteSnapshot.data()).crmDealId) === dealId) {
                    await writer(quoteRef, { crmDealId: null }, { merge: true });
                }
            }

            const deal = normalizeCrmDeal(dealId, {
                ...current,
                stage: current.stage === 'quote' ? 'lead' : current.stage,
                quoteOwnerUid: null,
                quoteId: null,
                quoteNumber: null,
                quoteRevisionId: null,
                quoteVersion: null,
                ...buildUpdateAudit(user, now())
            });
            await writer(dealRef, deal as unknown as UnknownRecord, { merge: true });
            return deal;
        };

        if (transact) {
            return transact(dbRef, (transaction) => apply(
                (ref) => transaction.get(ref),
                (ref, payload, options) => transaction.set(ref, payload, options)
            ));
        }
        return apply(readDoc, (ref, payload, options) => writeDoc(ref, payload, options));
    }

    return {
        getCompany,
        listCompanies,
        createCompany,
        updateCompany,
        archiveCompany: (input) => setCompanyArchived(input, true),
        restoreCompany: (input) => setCompanyArchived(input, false),
        findCompanyDuplicates,
        getContact,
        listContacts,
        createContact,
        updateContact,
        archiveContact: (input) => setContactArchived(input, true),
        restoreContact: (input) => setContactArchived(input, false),
        findContactDuplicates,
        getDeal,
        listDeals,
        createDeal,
        updateDeal,
        archiveDeal: (input) => setDealArchived(input, true),
        restoreDeal: (input) => setDealArchived(input, false),
        changeDealStage: writeDealStage,
        getActivity,
        listActivities,
        createActivity,
        updateActivity,
        completeActivity: (input) => setActivityCompleted(input, true),
        reopenActivity: (input) => setActivityCompleted(input, false),
        rescheduleActivity,
        archiveActivity: (input) => setActivityArchived(input, true),
        restoreActivity: (input) => setActivityArchived(input, false),
        getMember,
        listMembers,
        createMember,
        updateMember,
        archiveMember: (input) => setMemberArchived(input, true),
        restoreMember: (input) => setMemberArchived(input, false),
        searchAll,
        linkDealToQuote: (input) => writeQuoteLink(input, { quoteStage: null }),
        syncDealFromQuote: (input: CrmSyncDealFromQuoteInput) =>
            writeQuoteLink(input, {
                quoteStage: getCrmStageForQuoteStatus(input.quoteStatus),
                quoteStatus: input.quoteStatus,
                syncStageFromQuote: true
            }),
        unlinkDealFromQuote
    };
}

export const crmRepository = createCrmRepository({
    db,
    doc,
    collection,
    getDoc,
    getDocs,
    setDoc,
    query,
    orderBy,
    runTransaction,
    logAudit: ({ actor, ...entry }) => safeLogActivity({
        user: {
            uid: actor.uid,
            email: actor.email || null,
            displayName: actor.name || ''
        },
        system: 'crm',
        ...entry
    })
});
