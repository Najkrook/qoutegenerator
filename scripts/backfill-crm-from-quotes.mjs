#!/usr/bin/env node

/**
 * Builds the initial CRM dataset from saved quotes.
 *
 * The command is read-only unless --apply is explicitly supplied:
 *
 *   node scripts/backfill-crm-from-quotes.mjs
 *   node scripts/backfill-crm-from-quotes.mjs --apply
 *
 * Authentication:
 *   - Preferred: GOOGLE_APPLICATION_CREDENTIALS
 *   - Optional: FIREBASE_SERVICE_ACCOUNT_JSON=<path-to-service-account.json>
 *
 * The exported helpers are deliberately independent of Firebase so the
 * matching and idempotency rules can be tested without credentials.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CRM_COLLECTIONS = Object.freeze({
    companies: 'crm_companies',
    contacts: 'crm_contacts',
    deals: 'crm_deals',
    members: 'crm_members'
});
export const CRM_SCHEMA_VERSION = 1;

// Keep this fallback synchronized with src/config/accessControl.shared.ts and
// firestore.rules. user_roles/{uid}.role == "admin" is added at runtime.
export const FULL_ADMIN_UIDS = Object.freeze([
    'ZPxZusAiyfY6cf2LSn1ynP5A7rG3',
    'XolYJ2aOCdZPgiTg4WKVSOcRPmO2',
    'cNXpQsFClscsPGURl0gedehYcFo2'
]);

const QUOTE_PATH_PATTERN = /^users\/([^/]+)\/quotes\/([^/]+)$/;
const MAX_BATCH_OPERATIONS = 400;

function toRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanText(value) {
    return String(value ?? '')
        .normalize('NFKC')
        .replace(/\s+/gu, ' ')
        .trim();
}

function normalizeLookupText(value) {
    return cleanText(value).toLocaleLowerCase('sv-SE');
}

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toEpochMs(value, fallback = 0) {
    const normalizedFallback = Number.isFinite(Number(fallback))
        ? Math.trunc(Number(fallback))
        : 0;

    if (value instanceof Date) {
        const result = value.getTime();
        return Number.isFinite(result) ? Math.trunc(result) : normalizedFallback;
    }

    if (value && typeof value === 'object') {
        if (typeof value.toMillis === 'function') {
            const result = Number(value.toMillis());
            return Number.isFinite(result) ? Math.trunc(result) : normalizedFallback;
        }

        const seconds = Number(value.seconds ?? value._seconds);
        const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
        if (Number.isFinite(seconds)) {
            return Math.trunc((seconds * 1000) + (Number.isFinite(nanoseconds) ? nanoseconds / 1e6 : 0));
        }
    }

    const result = Number(value);
    return Number.isFinite(result) ? Math.trunc(result) : normalizedFallback;
}

function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, 'sv'));
}

function groupBy(items, getKey) {
    const grouped = new Map();
    for (const item of items) {
        const key = getKey(item);
        if (!key) continue;
        const matches = grouped.get(key) || [];
        matches.push(item);
        grouped.set(key, matches);
    }
    return grouped;
}

function choosePreferredText(...values) {
    return uniqueSorted(values.map(cleanText))
        .sort((left, right) => right.length - left.length || left.localeCompare(right, 'sv'))[0] || '';
}

function mergeDistinctNotes(...values) {
    const notesByKey = new Map();

    for (const value of values.flat()) {
        const entries = String(value ?? '').split(/\r?\n\s*\r?\n/gu);
        for (const entry of entries) {
            const note = cleanText(entry);
            const key = normalizeLookupText(note);
            if (!key || notesByKey.has(key)) continue;
            notesByKey.set(key, note);
        }
    }

    return [...notesByKey.values()].join('\n\n');
}

function sourceQuoteKey(ownerUid, quoteId) {
    return `${cleanText(ownerUid)}\u001f${cleanText(quoteId)}`;
}

function contactMatchKey({ email = '', companyId = null, name = '' } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) return `email:${normalizedEmail}`;

    const normalizedName = normalizeLookupText(name);
    if (!normalizedName) return '';
    return `company:${cleanText(companyId || 'standalone')}\u001fname:${normalizedName}`;
}

function existingDocumentId(value) {
    return cleanText(toRecord(value).id);
}

function documentCandidates(grouped, key) {
    const byId = new Map();
    for (const candidate of grouped.get(key) || []) {
        const id = existingDocumentId(candidate);
        if (id) byId.set(id, candidate);
    }
    return [...byId.values()].sort((left, right) =>
        existingDocumentId(left).localeCompare(existingDocumentId(right), 'sv')
    );
}

function splitPersonName(value) {
    const parts = cleanText(value).split(' ').filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
    };
}

function buildAuditFields(source) {
    const actorUid = cleanText(source.savedByUid || source.ownerUid);
    const actorName = cleanText(source.savedBy || '');
    return {
        createdByUid: actorUid,
        createdByName: actorName,
        updatedByUid: actorUid,
        updatedByName: actorName
    };
}

function mergeLifecycleFields(current, candidate) {
    if (!current) return candidate;

    const currentCreatedAt = toEpochMs(current.createdAtMs);
    const candidateCreatedAt = toEpochMs(candidate.createdAtMs);
    const currentUpdatedAt = toEpochMs(current.updatedAtMs);
    const candidateUpdatedAt = toEpochMs(candidate.updatedAtMs);
    const createdSource = candidateCreatedAt < currentCreatedAt ? candidate : current;
    const updatedSource = candidateUpdatedAt > currentUpdatedAt ? candidate : current;

    return {
        ...current,
        createdAtMs: Math.min(currentCreatedAt, candidateCreatedAt),
        updatedAtMs: Math.max(currentUpdatedAt, candidateUpdatedAt),
        createdByUid: createdSource.createdByUid,
        createdByName: createdSource.createdByName,
        updatedByUid: updatedSource.updatedByUid,
        updatedByName: updatedSource.updatedByName
    };
}

function makeAmbiguity(type, source, matchKey, candidates, message) {
    return {
        type,
        sourceQuotePath: source.quotePath,
        matchKey,
        candidateIds: uniqueSorted(candidates.map((candidate) =>
            typeof candidate === 'string' ? candidate : existingDocumentId(candidate)
        )),
        message
    };
}

export function normalizeCompanyName(value) {
    return normalizeLookupText(value);
}

export function normalizeEmail(value) {
    return cleanText(value).toLocaleLowerCase('en-US');
}

export function mapQuoteStatusToDealStage(value) {
    const status = normalizeLookupText(value);
    if (status === 'archived') return null;
    if (status === 'won') return 'won';
    if (status === 'lost') return 'lost';
    return 'quote';
}

export function createDeterministicId(prefix, ...parts) {
    const safePrefix = cleanText(prefix)
        .toLocaleLowerCase('en-US')
        .replace(/[^a-z0-9_-]+/gu, '_')
        .replace(/^_+|_+$/gu, '') || 'crm';
    const canonicalValue = parts.map((part) => cleanText(part)).join('\u001f');
    const digest = createHash('sha256').update(canonicalValue, 'utf8').digest('hex').slice(0, 24);
    return `${safePrefix}_${digest}`;
}

export function buildSearchIndex(values = []) {
    const normalizedValues = uniqueSorted(
        values
            .map(normalizeLookupText)
            .filter(Boolean)
    );
    const searchText = normalizedValues.join(' ');
    const prefixSources = uniqueSorted([
        ...normalizedValues,
        ...normalizedValues.flatMap((value) => value.split(/[^\p{L}\p{N}@.+-]+/u).filter(Boolean))
    ]);
    const searchPrefixes = new Set();

    for (const value of prefixSources) {
        const maxLength = Math.min(value.length, 64);
        for (let index = 1; index <= maxLength; index += 1) {
            searchPrefixes.add(value.slice(0, index));
        }
    }

    return {
        searchText,
        searchPrefixes: [...searchPrefixes].sort((left, right) => left.localeCompare(right, 'sv')).slice(0, 500)
    };
}

export function parseCliArgs(args = []) {
    const knownFlags = new Set(['--apply', '--help', '-h']);
    const unknown = args.filter((argument) => !knownFlags.has(argument));
    if (unknown.length > 0) {
        throw new Error(`Unknown argument${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`);
    }

    return {
        apply: args.includes('--apply'),
        help: args.includes('--help') || args.includes('-h')
    };
}

export function extractQuoteSource(rawSource = {}) {
    const source = toRecord(rawSource);
    const metadata = toRecord(source.metadata);
    const latestRevision = toRecord(source.latestRevision);
    const revisionState = toRecord(latestRevision.state);
    const metadataState = toRecord(metadata.state);
    const customerInfo = {
        ...toRecord(metadataState.customerInfo),
        ...toRecord(revisionState.customerInfo)
    };
    const revisionSummary = toRecord(latestRevision.summary);
    const metadataSummary = toRecord(metadata.summary);
    const ownerUid = cleanText(source.ownerUid);
    const quoteId = cleanText(source.quoteId || metadata.quoteId);
    const companyName = cleanText(customerInfo.company || metadata.company);
    let contactName = cleanText(customerInfo.name);
    const metadataCustomerName = cleanText(metadata.customerName);

    if (!contactName && (!companyName || normalizeCompanyName(metadataCustomerName) !== normalizeCompanyName(companyName))) {
        contactName = metadataCustomerName;
    }
    if (companyName && normalizeCompanyName(contactName) === normalizeCompanyName(companyName)) {
        contactName = '';
    }

    const email = normalizeEmail(customerInfo.email);
    if (!contactName && email) contactName = email;

    const createdAtMs = toEpochMs(
        metadata.createdAtMs,
        toEpochMs(latestRevision.savedAtMs)
    );
    const updatedAtMs = Math.max(
        createdAtMs,
        toEpochMs(
            metadata.updatedAtMs,
            toEpochMs(latestRevision.savedAtMs, createdAtMs)
        )
    );
    const status = normalizeLookupText(metadata.status || 'draft');
    const quotePath = cleanText(source.quotePath || `users/${ownerUid}/quotes/${quoteId}`);
    const savedBy = cleanText(metadata.savedBy || latestRevision.savedBy);
    const explicitSavedByEmail = normalizeEmail(
        metadata.savedByEmail || latestRevision.savedByEmail
    );
    const savedByEmail = explicitSavedByEmail || (
        savedBy.includes('@') ? normalizeEmail(savedBy) : ''
    );

    return {
        ownerUid,
        quoteId,
        quotePath,
        crmDealId: cleanText(metadata.crmDealId),
        quoteNumber: cleanText(metadata.quoteNumber),
        latestRevisionId: cleanText(
            source.latestRevisionId ||
            latestRevision.id ||
            latestRevision.revisionId ||
            metadata.latestRevisionId
        ),
        latestVersion: Math.max(
            1,
            Math.trunc(toFiniteNumber(latestRevision.version, toFiniteNumber(metadata.latestVersion, 1)))
        ),
        status,
        stage: mapQuoteStatusToDealStage(status),
        companyName,
        normalizedCompanyName: normalizeCompanyName(companyName),
        contactName,
        normalizedContactName: normalizeLookupText(contactName),
        email,
        reference: cleanText(customerInfo.reference || metadata.reference),
        customerReference: cleanText(customerInfo.customerReference || metadata.customerReference),
        totalSek: toFiniteNumber(
            revisionSummary.finalTotalSek,
            toFiniteNumber(metadata.totalSek, toFiniteNumber(metadataSummary.finalTotalSek))
        ),
        createdAtMs,
        updatedAtMs,
        savedBy,
        savedByEmail,
        savedByUid: cleanText(metadata.savedByUid || latestRevision.savedByUid || ownerUid),
        extraNotes: cleanText(customerInfo.extraNotes)
    };
}

function buildCompanyRecord(source, id) {
    const audit = buildAuditFields(source);
    const companyEmail = source.email;
    const search = buildSearchIndex([source.companyName, companyEmail]);

    return {
        schemaVersion: CRM_SCHEMA_VERSION,
        id,
        name: source.companyName,
        normalizedName: source.normalizedCompanyName,
        orgNumber: '',
        email: companyEmail,
        phone: '',
        website: '',
        address: {
            street: '',
            postalCode: '',
            city: '',
            country: ''
        },
        tags: [],
        notes: source.extraNotes,
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: source.createdAtMs,
        updatedAtMs: source.updatedAtMs,
        ...audit,
        ...search
    };
}

function mergeCompanyRecord(current, candidate) {
    const merged = mergeLifecycleFields(current, candidate);
    const name = choosePreferredText(current?.name, candidate.name);
    const email = choosePreferredText(current?.email, candidate.email);
    const notes = mergeDistinctNotes(current?.notes, candidate.notes);
    return {
        ...merged,
        name,
        normalizedName: normalizeCompanyName(name),
        email,
        notes,
        ...buildSearchIndex([name, email])
    };
}

function buildContactRecord(source, id, companyId) {
    const audit = buildAuditFields(source);
    const personName = splitPersonName(source.contactName);
    const search = buildSearchIndex([source.contactName, source.email, source.companyName]);

    return {
        schemaVersion: CRM_SCHEMA_VERSION,
        id,
        companyId,
        name: source.contactName,
        normalizedName: source.normalizedContactName,
        firstName: personName.firstName,
        lastName: personName.lastName,
        email: source.email,
        normalizedEmail: source.email,
        phone: '',
        role: '',
        tags: [],
        notes: companyId ? '' : source.extraNotes,
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: source.createdAtMs,
        updatedAtMs: source.updatedAtMs,
        ...audit,
        ...search
    };
}

function mergeContactRecord(current, candidate) {
    const merged = mergeLifecycleFields(current, candidate);
    const name = choosePreferredText(current?.name, candidate.name);
    const email = choosePreferredText(current?.email, candidate.email);
    const notes = mergeDistinctNotes(current?.notes, candidate.notes);
    const personName = splitPersonName(name);
    return {
        ...merged,
        name,
        normalizedName: normalizeLookupText(name),
        firstName: personName.firstName,
        lastName: personName.lastName,
        email,
        normalizedEmail: normalizeEmail(email),
        notes,
        ...buildSearchIndex([name, email])
    };
}

function buildMemberRecord(source, id) {
    const email = source.savedByEmail;
    const name = cleanText(source.savedBy) || email || id;
    const audit = buildAuditFields(source);

    return {
        schemaVersion: CRM_SCHEMA_VERSION,
        id,
        name,
        email,
        normalizedEmail: normalizeEmail(email),
        phone: '',
        title: '',
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: source.createdAtMs,
        updatedAtMs: source.updatedAtMs,
        ...audit,
        ...buildSearchIndex([name, email])
    };
}

function mergeMemberRecord(current, candidate) {
    const merged = mergeLifecycleFields(current, candidate);
    const name = choosePreferredText(current?.name, candidate.name);
    const email = choosePreferredText(current?.email, candidate.email);

    return {
        ...merged,
        name,
        email,
        normalizedEmail: normalizeEmail(email),
        ...buildSearchIndex([name, email])
    };
}

function buildDealRecord(source, id, companyId, primaryContactId, ownerId) {
    const customerLabel = source.companyName || source.contactName || 'Okänd kund';
    const quoteLabel = source.quoteNumber || source.quoteId;
    const title = quoteLabel
        ? `Offert ${quoteLabel} – ${customerLabel}`
        : `Affär – ${customerLabel}`;
    const audit = buildAuditFields(source);
    const search = buildSearchIndex([
        title,
        customerLabel,
        source.contactName,
        source.email,
        source.quoteNumber,
        source.reference,
        source.customerReference
    ]);

    return {
        schemaVersion: CRM_SCHEMA_VERSION,
        id,
        title,
        companyId,
        primaryContactId,
        ownerId,
        ownerName: source.savedBy,
        stage: source.stage,
        valueSek: Math.max(0, toFiniteNumber(source.totalSek)),
        expectedCloseAtMs: null,
        lostReason: '',
        quoteOwnerUid: source.ownerUid || null,
        quoteId: source.quoteId || null,
        quoteNumber: source.quoteNumber || null,
        quoteRevisionId: source.latestRevisionId || null,
        quoteVersion: source.latestVersion || null,
        lastActivityAtMs: null,
        nextActivityAtMs: null,
        tags: [],
        archived: false,
        archivedAtMs: null,
        archivedByUid: '',
        createdAtMs: source.createdAtMs,
        updatedAtMs: source.updatedAtMs,
        ...audit,
        ...search
    };
}

function resolveExistingDeal(source, existingDealsById, existingDealsByQuote) {
    const quoteKey = sourceQuoteKey(source.ownerUid, source.quoteId);
    const linkedCandidates = documentCandidates(existingDealsByQuote, quoteKey);
    const explicitDeal = source.crmDealId ? existingDealsById.get(source.crmDealId) : null;

    if (linkedCandidates.length > 1) {
        return {
            ambiguity: makeAmbiguity(
                'multiple_deals_for_quote',
                source,
                quoteKey,
                linkedCandidates,
                'Flera befintliga CRM-affärer pekar på samma offert.'
            )
        };
    }

    if (source.crmDealId) {
        if (!explicitDeal) {
            return {
                ambiguity: makeAmbiguity(
                    'missing_linked_deal',
                    source,
                    source.crmDealId,
                    [],
                    'Offerten har crmDealId men motsvarande CRM-affär saknas.'
                )
            };
        }

        if (explicitDeal.archived === true) {
            return {
                ambiguity: makeAmbiguity(
                    'archived_deal_match',
                    source,
                    source.crmDealId,
                    [explicitDeal],
                    'Offertens länkade CRM-affär är arkiverad och måste hanteras manuellt.'
                )
            };
        }

        if (linkedCandidates.length === 1 && existingDocumentId(linkedCandidates[0]) !== source.crmDealId) {
            return {
                ambiguity: makeAmbiguity(
                    'conflicting_deal_links',
                    source,
                    quoteKey,
                    [source.crmDealId, existingDocumentId(linkedCandidates[0])],
                    'Offertens crmDealId och affärens offertlänk pekar på olika dokument.'
                )
            };
        }

        const explicitOwnerUid = cleanText(explicitDeal.quoteOwnerUid);
        const explicitQuoteId = cleanText(explicitDeal.quoteId);
        if (
            (explicitOwnerUid && explicitOwnerUid !== source.ownerUid) ||
            (explicitQuoteId && explicitQuoteId !== source.quoteId)
        ) {
            return {
                ambiguity: makeAmbiguity(
                    'linked_deal_belongs_to_other_quote',
                    source,
                    source.crmDealId,
                    [source.crmDealId],
                    'Offertens crmDealId används av en annan offert.'
                )
            };
        }

        return {
            dealId: source.crmDealId,
            existing: true,
            needsQuoteRelink: !explicitOwnerUid || !explicitQuoteId
        };
    }

    if (linkedCandidates.length === 1) {
        if (linkedCandidates[0].archived === true) {
            return {
                ambiguity: makeAmbiguity(
                    'archived_deal_match',
                    source,
                    quoteKey,
                    linkedCandidates,
                    'CRM-affären som pekar på offerten är arkiverad och måste hanteras manuellt.'
                )
            };
        }
        return { dealId: existingDocumentId(linkedCandidates[0]), existing: true };
    }

    const deterministicId = createDeterministicId('deal', source.ownerUid, source.quoteId);
    const collision = existingDealsById.get(deterministicId);
    if (collision) {
        const collisionOwnerUid = cleanText(collision.quoteOwnerUid);
        const collisionQuoteId = cleanText(collision.quoteId);
        if (collision.archived === true) {
            return {
                ambiguity: makeAmbiguity(
                    'archived_deal_match',
                    source,
                    deterministicId,
                    [collision],
                    'Den deterministiskt matchade CRM-affären är arkiverad och måste hanteras manuellt.'
                )
            };
        }
        if (
            (collisionOwnerUid && collisionOwnerUid !== source.ownerUid) ||
            (collisionQuoteId && collisionQuoteId !== source.quoteId)
        ) {
            return {
                ambiguity: makeAmbiguity(
                    'deal_id_collision',
                    source,
                    deterministicId,
                    [deterministicId],
                    'Deterministiskt affärs-ID används av en annan offert.'
                )
            };
        }
        return {
            dealId: deterministicId,
            existing: true,
            needsQuoteRelink: !collisionOwnerUid || !collisionQuoteId
        };
    }

    return { dealId: deterministicId, existing: false };
}

function resolveFullAdminUidSet(adminUids, userRoles) {
    const recognizedRoles = new Map();

    for (const roleDocument of userRoles) {
        const role = toRecord(roleDocument);
        const uid = cleanText(role.id || role.uid);
        const normalizedRole = normalizeLookupText(role.role);
        if (
            uid
            && (normalizedRole === 'admin' || normalizedRole === 'quote_only' || normalizedRole === 'sketch_only')
        ) {
            recognizedRoles.set(uid, normalizedRole);
        }
    }

    const resolved = new Set();
    for (const uidValue of adminUids) {
        const uid = cleanText(uidValue);
        if (uid && !recognizedRoles.has(uid)) {
            resolved.add(uid);
        }
    }
    for (const [uid, role] of recognizedRoles) {
        if (role === 'admin') {
            resolved.add(uid);
        }
    }

    return resolved;
}

function createNoteAppend(targets, id, note, existingNotes = '') {
    const normalizedId = cleanText(id);
    const normalizedNote = cleanText(note);
    if (!normalizedId || !normalizedNote) return;

    const current = targets.get(normalizedId) || [];
    const before = mergeDistinctNotes(existingNotes, current);
    const after = mergeDistinctNotes(existingNotes, current, normalizedNote);
    if (before === after) return;

    targets.set(
        normalizedId,
        mergeDistinctNotes(current, normalizedNote)
            .split('\n\n')
            .filter(Boolean)
    );
}

function scheduleExistingRecordUpgrade(targets, collection, record) {
    const current = toRecord(record);
    const id = existingDocumentId(current);
    if (!id) return;

    const patch = {};
    if (current.schemaVersion !== CRM_SCHEMA_VERSION) {
        patch.schemaVersion = CRM_SCHEMA_VERSION;
    }
    if (collection === CRM_COLLECTIONS.deals && !Array.isArray(current.tags)) {
        patch.tags = [];
    }
    if (Object.keys(patch).length === 0) return;

    targets.set(`${collection}/${id}`, {
        collection,
        id,
        patch
    });
}

/**
 * Creates a deterministic migration plan.
 *
 * Existing CRM documents are reused. Records participating in an unambiguous
 * migration are upgraded to the current schema, customer notes remain
 * append-only, and quote links are guarded at apply time. If a unique match
 * cannot be established, the quote is reported.
 */
export function buildCrmMigrationPlan({
    quotes = [],
    existingCompanies = [],
    existingContacts = [],
    existingDeals = [],
    existingMembers = [],
    userRoles = [],
    adminUids = FULL_ADMIN_UIDS
} = {}) {
    const sources = quotes
        .map(extractQuoteSource)
        .filter((source) => source.ownerUid && source.quoteId)
        .sort((left, right) =>
            sourceQuoteKey(left.ownerUid, left.quoteId).localeCompare(
                sourceQuoteKey(right.ownerUid, right.quoteId),
                'sv'
            )
        );

    const activeSources = sources.filter((source) => source.stage !== null);
    const fullAdminUids = resolveFullAdminUidSet(adminUids, userRoles);
    const eligibleSources = activeSources.filter((source) => fullAdminUids.has(source.ownerUid));
    const nonAdminSources = activeSources.filter((source) => !fullAdminUids.has(source.ownerUid));
    const existingCompaniesById = new Map(
        existingCompanies
            .map((company) => [existingDocumentId(company), company])
            .filter(([id]) => id)
    );
    const existingCompaniesByName = groupBy(existingCompanies, (company) =>
        normalizeCompanyName(company.normalizedName || company.name)
    );
    const existingContactsById = new Map(
        existingContacts
            .map((contact) => [existingDocumentId(contact), contact])
            .filter(([id]) => id)
    );
    const existingContactsByMatch = groupBy(existingContacts, (contact) =>
        contactMatchKey({
            email: contact.normalizedEmail || contact.email,
            companyId: contact.companyId,
            name: contact.normalizedName || contact.name
        })
    );
    const existingDealsById = new Map(
        existingDeals
            .map((deal) => [existingDocumentId(deal), deal])
            .filter(([id]) => id)
    );
    const existingDealsByQuote = groupBy(existingDeals, (deal) => {
        const ownerUid = cleanText(deal.quoteOwnerUid);
        const quoteId = cleanText(deal.quoteId);
        return ownerUid && quoteId ? sourceQuoteKey(ownerUid, quoteId) : '';
    });
    const existingMembersById = new Map(
        existingMembers
            .map((member) => [existingDocumentId(member), member])
            .filter(([id]) => id)
    );
    const existingMembersByEmail = groupBy(existingMembers, (member) =>
        normalizeEmail(member.normalizedEmail || member.email)
    );

    const sourceEmailAffiliations = new Map();
    for (const source of eligibleSources) {
        if (!source.email) continue;
        const affiliation = source.normalizedCompanyName || 'standalone';
        const affiliations = sourceEmailAffiliations.get(source.email) || new Set();
        affiliations.add(affiliation);
        sourceEmailAffiliations.set(source.email, affiliations);
    }

    const companiesToCreate = new Map();
    const contactsToCreate = new Map();
    const contactsToCreateByMatch = new Map();
    const dealsToCreate = new Map();
    const membersToCreate = new Map();
    const plannedMembersByEmail = new Map();
    const companyNoteAppends = new Map();
    const contactNoteAppends = new Map();
    const quoteLinks = [];
    const dealQuoteLinks = [];
    const existingRecordUpgrades = new Map();
    const ambiguities = [];
    const skippedQuotePaths = [];

    for (const source of eligibleSources) {
        const desiredMemberId = cleanText(source.savedByUid || source.ownerUid);
        let memberId = desiredMemberId;
        let existingMember = existingMembersById.get(desiredMemberId);

        if (!existingMember && source.savedByEmail) {
            const memberEmailMatches = documentCandidates(
                existingMembersByEmail,
                source.savedByEmail
            );
            if (memberEmailMatches.length > 1) {
                ambiguities.push(makeAmbiguity(
                    'ambiguous_member',
                    source,
                    `email:${source.savedByEmail}`,
                    memberEmailMatches,
                    'Flera CRM-medlemmar har samma normaliserade e-postadress.'
                ));
                skippedQuotePaths.push(source.quotePath);
                continue;
            }
            if (memberEmailMatches.length === 1) {
                existingMember = memberEmailMatches[0];
                memberId = existingDocumentId(existingMember);
            } else {
                const plannedEmailMatch = plannedMembersByEmail.get(source.savedByEmail);
                if (plannedEmailMatch) {
                    if (plannedEmailMatch.id !== desiredMemberId) {
                        ambiguities.push(makeAmbiguity(
                            'member_uid_email_conflict',
                            source,
                            `email:${source.savedByEmail}`,
                            [plannedEmailMatch],
                            'Samma medlems-e-post förekommer med olika savedByUid.'
                        ));
                        skippedQuotePaths.push(source.quotePath);
                        continue;
                    }
                    memberId = plannedEmailMatch.id;
                }
            }
        }

        if (existingMember?.archived === true) {
            ambiguities.push(makeAmbiguity(
                'archived_member_match',
                source,
                memberId,
                [existingMember],
                'CRM-medlemmen som skulle bli affärsansvarig är arkiverad.'
            ));
            skippedQuotePaths.push(source.quotePath);
            continue;
        }

        if (!existingMember && memberId && !membersToCreate.has(memberId)) {
            const pendingMember = buildMemberRecord(source, memberId);
            membersToCreate.set(memberId, pendingMember);
            if (pendingMember.normalizedEmail) {
                plannedMembersByEmail.set(pendingMember.normalizedEmail, pendingMember);
            }
        } else if (!existingMember && memberId) {
            const mergedMember = mergeMemberRecord(
                membersToCreate.get(memberId),
                buildMemberRecord(source, memberId)
            );
            membersToCreate.set(memberId, mergedMember);
            if (mergedMember.normalizedEmail) {
                plannedMembersByEmail.set(mergedMember.normalizedEmail, mergedMember);
            }
        }

        const dealResolution = resolveExistingDeal(source, existingDealsById, existingDealsByQuote);
        if (dealResolution.ambiguity) {
            ambiguities.push(dealResolution.ambiguity);
            skippedQuotePaths.push(source.quotePath);
            continue;
        }

        if (dealResolution.existing) {
            const existingDeal = existingDealsById.get(dealResolution.dealId);
            const existingCompanyId = cleanText(existingDeal?.companyId);
            const existingContactId = cleanText(existingDeal?.primaryContactId);
            scheduleExistingRecordUpgrade(
                existingRecordUpgrades,
                CRM_COLLECTIONS.deals,
                existingDeal
            );
            if (existingMember) {
                scheduleExistingRecordUpgrade(
                    existingRecordUpgrades,
                    CRM_COLLECTIONS.members,
                    existingMember
                );
            }
            if (existingCompanyId && existingCompaniesById.has(existingCompanyId)) {
                scheduleExistingRecordUpgrade(
                    existingRecordUpgrades,
                    CRM_COLLECTIONS.companies,
                    existingCompaniesById.get(existingCompanyId)
                );
            }
            if (existingContactId && existingContactsById.has(existingContactId)) {
                scheduleExistingRecordUpgrade(
                    existingRecordUpgrades,
                    CRM_COLLECTIONS.contacts,
                    existingContactsById.get(existingContactId)
                );
            }
            if (source.extraNotes && existingCompanyId && existingCompaniesById.has(existingCompanyId)) {
                createNoteAppend(
                    companyNoteAppends,
                    existingCompanyId,
                    source.extraNotes,
                    existingCompaniesById.get(existingCompanyId)?.notes
                );
            } else if (
                source.extraNotes &&
                existingContactId &&
                existingContactsById.has(existingContactId)
            ) {
                createNoteAppend(
                    contactNoteAppends,
                    existingContactId,
                    source.extraNotes,
                    existingContactsById.get(existingContactId)?.notes
                );
            }
            if (dealResolution.needsQuoteRelink) {
                dealQuoteLinks.push({
                    dealId: dealResolution.dealId,
                    quotePath: source.quotePath,
                    quoteOwnerUid: source.ownerUid,
                    quoteId: source.quoteId,
                    quoteNumber: source.quoteNumber || null,
                    quoteRevisionId: source.latestRevisionId || null,
                    quoteVersion: source.latestVersion || null,
                    valueSek: Math.max(0, toFiniteNumber(source.totalSek))
                });
            }
            if (!dealResolution.needsQuoteRelink && source.crmDealId !== dealResolution.dealId) {
                quoteLinks.push({
                    quotePath: source.quotePath,
                    ownerUid: source.ownerUid,
                    quoteId: source.quoteId,
                    dealId: dealResolution.dealId
                });
            }
            continue;
        }

        let companyId = null;
        let pendingCompany = null;
        if (source.normalizedCompanyName) {
            const matches = documentCandidates(existingCompaniesByName, source.normalizedCompanyName);
            if (matches.length > 1) {
                ambiguities.push(makeAmbiguity(
                    'ambiguous_company',
                    source,
                    source.normalizedCompanyName,
                    matches,
                    'Flera befintliga CRM-företag har samma normaliserade namn.'
                ));
                skippedQuotePaths.push(source.quotePath);
                continue;
            }

            if (matches.length === 1) {
                if (matches[0].archived === true) {
                    ambiguities.push(makeAmbiguity(
                        'archived_company_match',
                        source,
                        source.normalizedCompanyName,
                        matches,
                        'Enda företagsmatchningen är arkiverad.'
                    ));
                    skippedQuotePaths.push(source.quotePath);
                    continue;
                }
                companyId = existingDocumentId(matches[0]);
            } else {
                companyId = createDeterministicId('company', source.normalizedCompanyName);
                const collision = existingCompaniesById.get(companyId);
                if (collision) {
                    ambiguities.push(makeAmbiguity(
                        'company_id_collision',
                        source,
                        source.normalizedCompanyName,
                        [collision],
                        'Deterministiskt företags-ID används av ett annat företag.'
                    ));
                    skippedQuotePaths.push(source.quotePath);
                    continue;
                }
                pendingCompany = buildCompanyRecord(source, companyId);
            }
        }

        let contactId = null;
        let pendingContact = null;
        if (source.contactName || source.email) {
            const affiliations = source.email ? sourceEmailAffiliations.get(source.email) : null;
            if (affiliations && affiliations.size > 1) {
                ambiguities.push(makeAmbiguity(
                    'email_used_across_companies',
                    source,
                    `email:${source.email}`,
                    [...affiliations],
                    'Samma e-postadress förekommer på offerter för flera företag.'
                ));
                skippedQuotePaths.push(source.quotePath);
                continue;
            }

            const matchKey = contactMatchKey({
                email: source.email,
                companyId,
                name: source.contactName
            });
            const existingMatches = documentCandidates(existingContactsByMatch, matchKey);
            if (existingMatches.length > 1) {
                ambiguities.push(makeAmbiguity(
                    'ambiguous_contact',
                    source,
                    matchKey,
                    existingMatches,
                    'Flera befintliga CRM-kontakter matchar samma e-post eller namn.'
                ));
                skippedQuotePaths.push(source.quotePath);
                continue;
            }

            const plannedMatch = contactsToCreateByMatch.get(matchKey);
            if (existingMatches.length === 1) {
                const match = existingMatches[0];
                const matchedCompanyId = cleanText(match.companyId) || null;
                if (match.archived === true || matchedCompanyId !== companyId) {
                    ambiguities.push(makeAmbiguity(
                        match.archived === true ? 'archived_contact_match' : 'contact_company_conflict',
                        source,
                        matchKey,
                        existingMatches,
                        match.archived === true
                            ? 'Enda kontaktmatchningen är arkiverad.'
                            : 'Kontaktmatchningen tillhör ett annat företag.'
                    ));
                    skippedQuotePaths.push(source.quotePath);
                    continue;
                }
                contactId = existingDocumentId(match);
            } else if (plannedMatch) {
                if (plannedMatch.companyId !== companyId) {
                    ambiguities.push(makeAmbiguity(
                        'contact_company_conflict',
                        source,
                        matchKey,
                        [plannedMatch.id],
                        'Planerad kontaktmatchning tillhör ett annat företag.'
                    ));
                    skippedQuotePaths.push(source.quotePath);
                    continue;
                }
                contactId = plannedMatch.id;
                pendingContact = buildContactRecord(source, contactId, companyId);
            } else {
                contactId = createDeterministicId(
                    'contact',
                    source.email || `${companyId || 'standalone'}\u001f${source.normalizedContactName}`
                );
                const collision = existingContactsById.get(contactId);
                if (collision) {
                    ambiguities.push(makeAmbiguity(
                        'contact_id_collision',
                        source,
                        matchKey,
                        [collision],
                        'Deterministiskt kontakt-ID används av en annan kontakt.'
                    ));
                    skippedQuotePaths.push(source.quotePath);
                    continue;
                }
                pendingContact = buildContactRecord(source, contactId, companyId);
            }
        }

        if (pendingCompany) {
            companiesToCreate.set(
                companyId,
                mergeCompanyRecord(companiesToCreate.get(companyId), pendingCompany)
            );
        }
        if (pendingContact) {
            const matchKey = contactMatchKey({
                email: source.email,
                companyId,
                name: source.contactName
            });
            const mergedContact = mergeContactRecord(contactsToCreate.get(contactId), pendingContact);
            contactsToCreate.set(contactId, mergedContact);
            contactsToCreateByMatch.set(matchKey, mergedContact);
        }

        if (source.extraNotes) {
            if (companyId && !pendingCompany && existingCompaniesById.has(companyId)) {
                createNoteAppend(
                    companyNoteAppends,
                    companyId,
                    source.extraNotes,
                    existingCompaniesById.get(companyId)?.notes
                );
            } else if (
                !companyId &&
                contactId &&
                !pendingContact &&
                existingContactsById.has(contactId)
            ) {
                createNoteAppend(
                    contactNoteAppends,
                    contactId,
                    source.extraNotes,
                    existingContactsById.get(contactId)?.notes
                );
            }
        }

        dealsToCreate.set(
            dealResolution.dealId,
            buildDealRecord(source, dealResolution.dealId, companyId, contactId, memberId || null)
        );
        if (existingMember) {
            scheduleExistingRecordUpgrade(
                existingRecordUpgrades,
                CRM_COLLECTIONS.members,
                existingMember
            );
        }
        if (companyId && !pendingCompany && existingCompaniesById.has(companyId)) {
            scheduleExistingRecordUpgrade(
                existingRecordUpgrades,
                CRM_COLLECTIONS.companies,
                existingCompaniesById.get(companyId)
            );
        }
        if (contactId && !pendingContact && existingContactsById.has(contactId)) {
            scheduleExistingRecordUpgrade(
                existingRecordUpgrades,
                CRM_COLLECTIONS.contacts,
                existingContactsById.get(contactId)
            );
        }
        quoteLinks.push({
            quotePath: source.quotePath,
            ownerUid: source.ownerUid,
            quoteId: source.quoteId,
            dealId: dealResolution.dealId
        });
    }

    const byId = (left, right) => left.id.localeCompare(right.id, 'sv');
    const byPath = (left, right) => left.quotePath.localeCompare(right.quotePath, 'sv');

    return {
        companiesToCreate: [...companiesToCreate.values()].sort(byId),
        contactsToCreate: [...contactsToCreate.values()].sort(byId),
        dealsToCreate: [...dealsToCreate.values()].sort(byId),
        membersToCreate: [...membersToCreate.values()].sort(byId),
        companyNoteAppends: [...companyNoteAppends.entries()]
            .map(([id, notes]) => ({ id, notes }))
            .sort(byId),
        contactNoteAppends: [...contactNoteAppends.entries()]
            .map(([id, notes]) => ({ id, notes }))
            .sort(byId),
        dealQuoteLinks: dealQuoteLinks.sort((left, right) =>
            left.dealId.localeCompare(right.dealId, 'sv')
        ),
        existingRecordUpgrades: [...existingRecordUpgrades.values()].sort((left, right) =>
            left.collection.localeCompare(right.collection, 'sv')
            || left.id.localeCompare(right.id, 'sv')
        ),
        quoteLinks: quoteLinks.sort(byPath),
        ambiguities: ambiguities.sort((left, right) =>
            left.sourceQuotePath.localeCompare(right.sourceQuotePath, 'sv') ||
            left.type.localeCompare(right.type, 'sv')
        ),
        skippedQuotePaths: uniqueSorted(skippedQuotePaths),
        nonAdminQuotePaths: nonAdminSources.map((source) => source.quotePath).sort(),
        stats: {
            scannedQuotes: sources.length,
            archivedQuotesSkipped: sources.length - activeSources.length,
            activeQuotes: activeSources.length,
            nonAdminQuotesSkipped: nonAdminSources.length,
            eligibleAdminQuotes: eligibleSources.length,
            fullAdminUsersResolved: fullAdminUids.size
        }
    };
}

async function loadLatestRevision(quoteDoc) {
    const metadata = toRecord(quoteDoc.data());
    const revisions = quoteDoc.ref.collection('revisions');
    const latestRevisionId = cleanText(metadata.latestRevisionId);

    if (latestRevisionId) {
        const explicitRevision = await revisions.doc(latestRevisionId).get();
        if (explicitRevision.exists) {
            return {
                id: explicitRevision.id,
                ...toRecord(explicitRevision.data())
            };
        }
    }

    const latestSnapshot = await revisions.orderBy('version', 'desc').limit(1).get();
    const latestDoc = latestSnapshot.docs[0];
    return latestDoc
        ? { id: latestDoc.id, ...toRecord(latestDoc.data()) }
        : null;
}

async function loadQuoteSources(db) {
    const snapshot = await db.collectionGroup('quotes').get();
    const quoteDocs = snapshot.docs.filter((quoteDoc) => QUOTE_PATH_PATTERN.test(quoteDoc.ref.path));
    const sources = [];

    for (let offset = 0; offset < quoteDocs.length; offset += 20) {
        const chunk = quoteDocs.slice(offset, offset + 20);
        const rows = await Promise.all(chunk.map(async (quoteDoc) => {
            const pathMatch = quoteDoc.ref.path.match(QUOTE_PATH_PATTERN);
            const latestRevision = await loadLatestRevision(quoteDoc);
            return {
                ownerUid: pathMatch[1],
                quoteId: pathMatch[2],
                quotePath: quoteDoc.ref.path,
                metadata: toRecord(quoteDoc.data()),
                latestRevision
            };
        }));
        sources.push(...rows);
    }

    return sources;
}

async function loadCollection(db, collectionName) {
    const snapshot = await db.collection(collectionName).get();
    return snapshot.docs.map((document) => ({
        id: document.id,
        ...toRecord(document.data())
    }));
}

async function buildPlanFromFirestore(db) {
    const [
        quotes,
        existingCompanies,
        existingContacts,
        existingDeals,
        existingMembers,
        userRoles
    ] = await Promise.all([
        loadQuoteSources(db),
        loadCollection(db, CRM_COLLECTIONS.companies),
        loadCollection(db, CRM_COLLECTIONS.contacts),
        loadCollection(db, CRM_COLLECTIONS.deals),
        loadCollection(db, CRM_COLLECTIONS.members),
        loadCollection(db, 'user_roles')
    ]);

    return buildCrmMigrationPlan({
        quotes,
        existingCompanies,
        existingContacts,
        existingDeals,
        existingMembers,
        userRoles
    });
}

function planOperations(plan) {
    return [
        ...plan.membersToCreate.map((data) => ({
            kind: 'create',
            collection: CRM_COLLECTIONS.members,
            id: data.id,
            data
        })),
        ...plan.companiesToCreate.map((data) => ({
            kind: 'create',
            collection: CRM_COLLECTIONS.companies,
            id: data.id,
            data
        })),
        ...plan.contactsToCreate.map((data) => ({
            kind: 'create',
            collection: CRM_COLLECTIONS.contacts,
            id: data.id,
            data
        })),
        ...plan.dealsToCreate.map((data) => ({
            kind: 'create',
            collection: CRM_COLLECTIONS.deals,
            id: data.id,
            data
        }))
    ];
}

export function evaluateQuoteLink(currentDealId, plannedDealId) {
    const current = cleanText(currentDealId);
    const planned = cleanText(plannedDealId);
    if (!planned) return 'conflict';
    if (!current) return 'write';
    if (current === planned) return 'noop';
    return 'conflict';
}

async function upgradeExistingRecordTransaction(db, upgrade) {
    const supportedCollections = new Set(Object.values(CRM_COLLECTIONS));
    if (!supportedCollections.has(upgrade.collection)) {
        throw new Error(`Refusing to upgrade unknown CRM collection: ${upgrade.collection}`);
    }

    return db.runTransaction(async (transaction) => {
        const reference = db.collection(upgrade.collection).doc(upgrade.id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) {
            return {
                writes: 0,
                conflict: {
                    type: 'missing_schema_upgrade_target',
                    collection: upgrade.collection,
                    id: upgrade.id
                }
            };
        }

        const current = toRecord(snapshot.data());
        const patch = {};
        if (current.schemaVersion !== CRM_SCHEMA_VERSION) {
            patch.schemaVersion = CRM_SCHEMA_VERSION;
        }
        if (
            upgrade.collection === CRM_COLLECTIONS.deals
            && !Array.isArray(current.tags)
        ) {
            patch.tags = [];
        }
        if (Object.keys(patch).length === 0) {
            return { writes: 0, conflict: null };
        }

        transaction.update(reference, patch);
        return { writes: 1, conflict: null };
    });
}

async function appendNotesTransaction(db, collection, append) {
    return db.runTransaction(async (transaction) => {
        const reference = db.collection(collection).doc(append.id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) {
            return {
                writes: 0,
                conflict: {
                    type: 'missing_note_target',
                    collection,
                    id: append.id
                }
            };
        }

        const current = toRecord(snapshot.data());
        if (current.archived === true) {
            return {
                writes: 0,
                conflict: {
                    type: 'archived_note_target',
                    collection,
                    id: append.id
                }
            };
        }

        const notes = mergeDistinctNotes(current.notes, append.notes);
        if (notes === mergeDistinctNotes(current.notes)) {
            return { writes: 0, conflict: null };
        }

        transaction.update(reference, { notes });
        return { writes: 1, conflict: null };
    });
}

async function linkExistingDealTransaction(db, link) {
    if (!QUOTE_PATH_PATTERN.test(link.quotePath)) {
        throw new Error(`Refusing to write invalid quote path: ${link.quotePath}`);
    }

    return db.runTransaction(async (transaction) => {
        const dealReference = db.collection(CRM_COLLECTIONS.deals).doc(link.dealId);
        const quoteReference = db.doc(link.quotePath);
        const dealSnapshot = await transaction.get(dealReference);
        const quoteSnapshot = await transaction.get(quoteReference);
        if (!dealSnapshot.exists || !quoteSnapshot.exists) {
            return {
                writes: 0,
                conflict: {
                    type: !dealSnapshot.exists
                        ? 'missing_deal_during_relink'
                        : 'missing_quote_during_relink',
                    dealId: link.dealId,
                    quotePath: link.quotePath
                }
            };
        }

        const current = toRecord(dealSnapshot.data());
        const currentOwnerUid = cleanText(current.quoteOwnerUid);
        const currentQuoteId = cleanText(current.quoteId);
        const currentQuoteDealId = cleanText(toRecord(quoteSnapshot.data()).crmDealId);
        const quoteLinkDecision = evaluateQuoteLink(currentQuoteDealId, link.dealId);
        const ownerConflict = currentOwnerUid && currentOwnerUid !== link.quoteOwnerUid;
        const quoteConflict = currentQuoteId && currentQuoteId !== link.quoteId;
        if (
            current.archived === true ||
            ownerConflict ||
            quoteConflict ||
            quoteLinkDecision === 'conflict'
        ) {
            return {
                writes: 0,
                conflict: {
                    type: current.archived === true
                        ? 'archived_deal_during_relink'
                        : quoteLinkDecision === 'conflict'
                            ? 'quote_link_changed_during_deal_relink'
                            : 'deal_quote_link_changed',
                    dealId: link.dealId,
                    currentQuoteOwnerUid: currentOwnerUid || null,
                    currentQuoteId: currentQuoteId || null,
                    plannedQuoteOwnerUid: link.quoteOwnerUid,
                    plannedQuoteId: link.quoteId,
                    currentQuoteDealId: currentQuoteDealId || null
                }
            };
        }

        transaction.update(dealReference, {
            quoteOwnerUid: link.quoteOwnerUid,
            quoteId: link.quoteId,
            quoteNumber: link.quoteNumber,
            quoteRevisionId: link.quoteRevisionId,
            quoteVersion: link.quoteVersion,
            valueSek: Math.max(0, toFiniteNumber(link.valueSek))
        });
        let writes = 1;
        if (quoteLinkDecision === 'write') {
            transaction.update(quoteReference, { crmDealId: link.dealId });
            writes += 1;
        }
        return { writes, conflict: null };
    });
}

async function linkQuoteTransaction(db, link) {
    if (!QUOTE_PATH_PATTERN.test(link.quotePath)) {
        throw new Error(`Refusing to write invalid quote path: ${link.quotePath}`);
    }

    return db.runTransaction(async (transaction) => {
        const reference = db.doc(link.quotePath);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) {
            return {
                writes: 0,
                conflict: {
                    type: 'missing_quote_during_link',
                    quotePath: link.quotePath,
                    plannedDealId: link.dealId
                }
            };
        }

        const currentDealId = cleanText(toRecord(snapshot.data()).crmDealId);
        const decision = evaluateQuoteLink(currentDealId, link.dealId);
        if (decision === 'noop') return { writes: 0, conflict: null };
        if (decision === 'conflict') {
            return {
                writes: 0,
                conflict: {
                    type: 'quote_link_changed',
                    quotePath: link.quotePath,
                    currentDealId: currentDealId || null,
                    plannedDealId: link.dealId
                }
            };
        }

        transaction.update(reference, { crmDealId: link.dealId });
        return { writes: 1, conflict: null };
    });
}

async function createDealAndLinkQuoteTransaction(db, deal, link) {
    if (!QUOTE_PATH_PATTERN.test(link.quotePath)) {
        throw new Error(`Refusing to write invalid quote path: ${link.quotePath}`);
    }

    return db.runTransaction(async (transaction) => {
        const dealReference = db.collection(CRM_COLLECTIONS.deals).doc(deal.id);
        const quoteReference = db.doc(link.quotePath);
        const [dealSnapshot, quoteSnapshot] = await Promise.all([
            transaction.get(dealReference),
            transaction.get(quoteReference)
        ]);

        if (dealSnapshot.exists || !quoteSnapshot.exists) {
            return {
                writes: 0,
                conflict: {
                    type: dealSnapshot.exists
                        ? 'deal_created_during_apply'
                        : 'missing_quote_during_deal_create',
                    dealId: deal.id,
                    quotePath: link.quotePath
                }
            };
        }

        const currentDealId = cleanText(toRecord(quoteSnapshot.data()).crmDealId);
        const decision = evaluateQuoteLink(currentDealId, deal.id);
        if (decision === 'conflict') {
            return {
                writes: 0,
                conflict: {
                    type: 'quote_link_changed_during_deal_create',
                    quotePath: link.quotePath,
                    currentDealId: currentDealId || null,
                    plannedDealId: deal.id
                }
            };
        }

        transaction.create(dealReference, deal);
        if (decision === 'write') {
            transaction.update(quoteReference, { crmDealId: deal.id });
        }
        return { writes: decision === 'write' ? 2 : 1, conflict: null };
    });
}

export async function applyPlan(db, plan) {
    const newDealIds = new Set(plan.dealsToCreate.map((deal) => deal.id));
    const quoteLinkByNewDealId = new Map(
        plan.quoteLinks
            .filter((link) => newDealIds.has(link.dealId))
            .map((link) => [link.dealId, link])
    );
    const operations = planOperations(plan).filter((operation) => (
        operation.collection !== CRM_COLLECTIONS.deals
        || !quoteLinkByNewDealId.has(operation.id)
    ));
    let writes = 0;
    const conflicts = [];

    for (let offset = 0; offset < operations.length; offset += MAX_BATCH_OPERATIONS) {
        const batch = db.batch();
        const chunk = operations.slice(offset, offset + MAX_BATCH_OPERATIONS);

        for (const operation of chunk) {
            batch.create(db.collection(operation.collection).doc(operation.id), operation.data);
        }

        await batch.commit();
        writes += chunk.length;
    }

    for (const deal of plan.dealsToCreate) {
        const link = quoteLinkByNewDealId.get(deal.id);
        if (!link) continue;
        const result = await createDealAndLinkQuoteTransaction(db, deal, link);
        writes += result.writes;
        if (result.conflict) conflicts.push(result.conflict);
    }

    for (const upgrade of plan.existingRecordUpgrades || []) {
        const result = await upgradeExistingRecordTransaction(db, upgrade);
        writes += result.writes;
        if (result.conflict) conflicts.push(result.conflict);
    }

    for (const append of plan.companyNoteAppends) {
        const result = await appendNotesTransaction(db, CRM_COLLECTIONS.companies, append);
        writes += result.writes;
        if (result.conflict) conflicts.push(result.conflict);
    }
    for (const append of plan.contactNoteAppends) {
        const result = await appendNotesTransaction(db, CRM_COLLECTIONS.contacts, append);
        writes += result.writes;
        if (result.conflict) conflicts.push(result.conflict);
    }
    for (const link of plan.dealQuoteLinks) {
        const result = await linkExistingDealTransaction(db, link);
        writes += result.writes;
        if (result.conflict) conflicts.push(result.conflict);
    }
    for (const link of plan.quoteLinks) {
        if (quoteLinkByNewDealId.has(link.dealId)) continue;
        const result = await linkQuoteTransaction(db, link);
        writes += result.writes;
        if (result.conflict) conflicts.push(result.conflict);
    }

    return { writes, conflicts };
}

function printPlan(plan, apply) {
    const modeLabel = apply ? 'APPLY' : 'DRY RUN';
    console.log(`CRM backfill (${modeLabel})`);
    console.log(`Quotes scanned: ${plan.stats.scannedQuotes}`);
    console.log(`Archived quotes skipped: ${plan.stats.archivedQuotesSkipped}`);
    console.log(
        `Non-admin active quotes skipped: ${plan.stats.nonAdminQuotesSkipped} ` +
        '(CRM migration is restricted to full-admin quote owners)'
    );
    console.log(`Eligible full-admin quotes: ${plan.stats.eligibleAdminQuotes}`);
    console.log(`CRM members to create: ${plan.membersToCreate.length}`);
    console.log(`Companies to create: ${plan.companiesToCreate.length}`);
    console.log(`Contacts to create: ${plan.contactsToCreate.length}`);
    console.log(`Deals to create: ${plan.dealsToCreate.length}`);
    console.log(`Existing CRM records to upgrade: ${plan.existingRecordUpgrades.length}`);
    console.log(
        `Existing customer records receiving deduplicated notes: ` +
        `${plan.companyNoteAppends.length + plan.contactNoteAppends.length}`
    );
    console.log(`Existing deals requiring guarded quote relink: ${plan.dealQuoteLinks.length}`);
    console.log(`Quote metadata links to write: ${plan.quoteLinks.length}`);
    console.log(`Ambiguous quotes skipped: ${plan.skippedQuotePaths.length}`);

    if (plan.ambiguities.length > 0) {
        console.log('Ambiguities requiring manual review:');
        for (const ambiguity of plan.ambiguities) {
            console.log(JSON.stringify(ambiguity));
        }
    }

    if (!apply) {
        console.log('No writes performed. Re-run with --apply after reviewing this report.');
    }
}

async function initializeFirestore() {
    const [
        { applicationDefault, cert, getApps, initializeApp },
        { getFirestore }
    ] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/firestore')
    ]);
    const existingApp = getApps()[0];
    if (existingApp) return getFirestore(existingApp);

    const serviceAccountPath = cleanText(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    let credential;
    if (serviceAccountPath) {
        const resolvedPath = path.resolve(serviceAccountPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Service account file not found: ${resolvedPath}`);
        }
        credential = cert(JSON.parse(fs.readFileSync(resolvedPath, 'utf8')));
    } else {
        credential = applicationDefault();
    }

    return getFirestore(initializeApp({ credential }));
}

export async function runCli(args = process.argv.slice(2), dependencies = {}) {
    const options = parseCliArgs(args);
    if (options.help) {
        console.log('Usage: node scripts/backfill-crm-from-quotes.mjs [--apply]');
        console.log('Default mode is a read-only dry run. --apply enables writes.');
        console.log('Only quotes owned by full-admin users are eligible for CRM migration.');
        return { applied: false, help: true };
    }

    const db = dependencies.db || await initializeFirestore();
    const plan = await buildPlanFromFirestore(db);
    printPlan(plan, options.apply);

    if (!options.apply) {
        return { applied: false, plan };
    }

    const result = await applyPlan(db, plan);
    console.log(`CRM backfill complete. Writes committed: ${result.writes}`);
    if (result.conflicts.length > 0) {
        console.log(`Concurrent or apply-time conflicts skipped: ${result.conflicts.length}`);
        for (const conflict of result.conflicts) {
            console.log(JSON.stringify(conflict));
        }
    }
    return {
        applied: true,
        writes: result.writes,
        conflicts: result.conflicts,
        plan
    };
}

const directEntryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (directEntryPath === import.meta.url) {
    runCli().catch((error) => {
        console.error('CRM backfill failed:', error);
        process.exitCode = 1;
    });
}
