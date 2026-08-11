import { catalogData } from '../data/catalog';
import type {
    AccessUser,
    CreateQuoteInput,
    CrmSynchronizationIssue,
    QuoteReference,
    QuoteRepository,
    QuoteState,
    QuoteSummary,
    QuoteTotalsResult,
    RetailerRecord,
    SavedQuoteLike,
    SavedQuoteStatePatch,
    UnknownRecord
} from '../types/contracts';
import type { CrmActor, CrmDeal, CrmLinkDealToQuoteInput, CrmRepository } from '../types/crm';
import { hydrateQuoteState } from '../store/quoteStateSchema';
import { DEFAULT_PDF_THEME_ID, normalizePdfThemeId } from '../config/pdfThemes';
import { computeQuoteTotals } from './calculationEngine';
import { hasConfiguredContractingWork } from './contractingWork';
import { hasConfiguredGridSelection, hasConfiguredGridSelections } from './quoteContent';
import { sanitizeQuoteRevisionState } from './quoteRepository';

const RETAILER_SAFE_CONTRACTING_WORK: QuoteState['contractingWork'] = {
    enabled: false,
    projectName: '',
    rows: [],
    margin: { enabled: false, percent: 15 },
    ata: { enabled: false, percent: 15 }
};

const DEFAULT_CRM_TIMEOUT_MS = 8_000;
const DEFAULT_ACTIVITY_TIMEOUT_MS = 2_000;
const DEFAULT_REPAIR_DELAYS_MS = [1_500, 5_000, 15_000] as const;

export type QuoteSaveTarget =
    | { kind: 'new'; ownerUid?: string | null; crmDealId?: string | null }
    | { kind: 'existing'; quote: QuoteReference; crmDealId?: string | null };

export interface SaveQuoteRevisionInput {
    actor: AccessUser | null;
    state: QuoteState;
    target: QuoteSaveTarget;
    retailer?: RetailerRecord | null;
    canManageAllQuotes?: boolean;
    retrySaveIntentId?: string | null;
    changeNote?: string;
}

export interface RepairCrmLinkInput {
    actor: AccessUser | null;
    quote: QuoteReference;
    canManageAllQuotes?: boolean;
    relink?: boolean;
}

export type QuoteSaveFailureCode =
    | 'unauthenticated'
    | 'unauthorized'
    | 'invalid-draft'
    | 'invalid-target'
    | 'quote-not-found'
    | 'persistence-failed'
    | 'persistence-ambiguous';

export interface QuoteSaveFailure {
    code: QuoteSaveFailureCode;
    message: string;
    retryable: boolean;
}

interface SavedQuoteOutcomeBase {
    quote: QuoteReference;
    isNewQuote: boolean;
    statePatch: SavedQuoteStatePatch;
}

export interface QuoteSavedOutcome extends SavedQuoteOutcomeBase {
    status: 'saved';
}

export interface QuoteSavedNeedsCrmRepairOutcome extends SavedQuoteOutcomeBase {
    status: 'saved-needs-crm-repair';
    crm: {
        dealId: string;
        status: 'repair-pending' | 'relink-required';
    };
}

export interface QuoteNotSavedOutcome {
    status: 'not-saved';
    failure: QuoteSaveFailure;
    retry?: { saveIntentId: string };
}

export type QuoteSaveOutcome =
    | QuoteSavedOutcome
    | QuoteSavedNeedsCrmRepairOutcome
    | QuoteNotSavedOutcome;

export type CrmRepairOutcome =
    | { status: 'repaired'; quote: QuoteReference; dealId: string }
    | { status: 'no-repair-needed'; quote: QuoteReference }
    | { status: 'needs-relink'; quote: QuoteReference; dealId: string }
    | { status: 'repair-pending'; quote: QuoteReference; dealId: string }
    | { status: 'not-repaired'; failure: QuoteSaveFailure };

type QuotePersistencePort = Pick<
    QuoteRepository,
    | 'createQuote'
    | 'saveQuoteRevision'
    | 'getQuoteLatestRevision'
    | 'updateQuoteCrmSynchronizationIssue'
>;

type CrmPort = Pick<CrmRepository, 'getDeal' | 'linkDealToQuote' | 'relinkDealToQuote'>;

interface ActivityResultLike {
    ok?: boolean;
}

interface QuoteSaveModuleDependencies {
    quotePersistence: QuotePersistencePort;
    crm: CrmPort;
    logActivity: (input: UnknownRecord) => Promise<ActivityResultLike | void>;
    calculateTotals?: (draft: QuoteState) => QuoteTotalsResult;
    createSaveIntentId?: () => string;
    now?: () => number;
    crmTimeoutMs?: number;
    activityTimeoutMs?: number;
    repairDelaysMs?: readonly number[];
    schedule?: (callback: () => void, delayMs: number) => unknown;
}

export interface QuoteSaveModule {
    save(input: SaveQuoteRevisionInput): Promise<QuoteSaveOutcome>;
    repairCrm(input: RepairCrmLinkInput): Promise<CrmRepairOutcome>;
}

interface ErrorRecord extends UnknownRecord {
    code?: unknown;
    message?: unknown;
    ambiguous?: unknown;
    conflictingDealId?: unknown;
    conflictingQuoteOwnerUid?: unknown;
    conflictingQuoteId?: unknown;
}

class CrmAttemptError extends Error {
    readonly code: string;
    readonly conflictingDealId: string | null;
    readonly conflictingQuoteOwnerUid: string | null;
    readonly conflictingQuoteId: string | null;

    constructor(
        code: string,
        message: string,
        conflicts: Partial<Pick<CrmAttemptError, 'conflictingDealId' | 'conflictingQuoteOwnerUid' | 'conflictingQuoteId'>> = {}
    ) {
        super(message);
        this.name = 'CrmAttemptError';
        this.code = code;
        this.conflictingDealId = conflicts.conflictingDealId || null;
        this.conflictingQuoteOwnerUid = conflicts.conflictingQuoteOwnerUid || null;
        this.conflictingQuoteId = conflicts.conflictingQuoteId || null;
    }
}

function isRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toErrorRecord(error: unknown): ErrorRecord {
    return isRecord(error) ? error as ErrorRecord : {};
}

function getErrorCode(error: unknown): string {
    const raw = String(toErrorRecord(error).code || '').trim().toLowerCase();
    return raw.includes('/') ? raw.split('/').pop() || raw : raw;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    const message = toErrorRecord(error).message;
    return message ? String(message) : fallback;
}

function createSaveIntentId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `save_${uuid}`;
    return `save_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeId(value: unknown): string {
    return String(value || '').trim();
}

function isAmbiguousPersistenceError(error: unknown): boolean {
    if (toErrorRecord(error).ambiguous === true) return true;
    return [
        'aborted',
        'deadline-exceeded',
        'network-request-failed',
        'timeout',
        'unavailable',
        'unknown'
    ].includes(getErrorCode(error));
}

function persistenceFailure(error: unknown): QuoteSaveFailure {
    const ambiguous = isAmbiguousPersistenceError(error);
    return {
        code: ambiguous ? 'persistence-ambiguous' : 'persistence-failed',
        message: getErrorMessage(error, 'Quote persistence failed.'),
        retryable: ambiguous
    };
}

function authorizationFailure(code: QuoteSaveFailureCode, message: string): QuoteNotSavedOutcome {
    return {
        status: 'not-saved',
        failure: { code, message, retryable: false }
    };
}

function actorFrom(user: AccessUser): CrmActor {
    return {
        uid: normalizeId(user.uid),
        email: normalizeId(user.email)
    };
}

function clampDiscount(value: unknown, maximum: number): number {
    const parsed = Number(value);
    return Math.max(0, Math.min(maximum, Number.isFinite(parsed) ? parsed : 0));
}

function buildCanonicalDraft(draft: QuoteState, retailer: RetailerRecord | null): QuoteState | null {
    const sanitized = sanitizeQuoteRevisionState(draft);
    const hydrated = hydrateQuoteState(sanitized);
    if (!retailer) return hydrated;

    if (hydrated.selectedLines.length !== 1) return null;
    const selectedLineId = hydrated.selectedLines[0];
    const lineConfig = retailer.productLines?.[selectedLineId];
    if (lineConfig?.enabled !== true) return null;
    if (hydrated.builderItems.some((item) => item.line !== selectedLineId)) return null;

    const hasOtherGridContent = Object.entries(hydrated.gridSelections).some(([lineId, selection]) => (
        lineId !== selectedLineId
        && hasConfiguredGridSelection(selection)
    ));
    if (hasOtherGridContent) return null;

    const maximumDiscount = clampDiscount(lineConfig.discountPct, 100);
    const allowedThemes = new Set([DEFAULT_PDF_THEME_ID, ...(retailer.pdfThemes || [])]);
    const selectedTheme = normalizePdfThemeId(hydrated.pdfThemeId);
    const gridSelection = hydrated.gridSelections[selectedLineId];

    return {
        ...hydrated,
        selectedLines: [selectedLineId],
        globalDiscountPct: clampDiscount(hydrated.globalDiscountPct, maximumDiscount),
        prevGlobalDiscountPct: clampDiscount(hydrated.prevGlobalDiscountPct, maximumDiscount),
        pdfThemeId: allowedThemes.has(selectedTheme) ? selectedTheme : DEFAULT_PDF_THEME_ID,
        builderItems: hydrated.builderItems.map((item) => ({
            ...item,
            discountPct: clampDiscount(item.discountPct, maximumDiscount),
            addons: item.addons.map((addon) => ({
                ...addon,
                discountPct: clampDiscount(addon.discountPct, maximumDiscount)
            }))
        })),
        gridSelections: gridSelection ? {
            [selectedLineId]: {
                ...gridSelection,
                items: Object.fromEntries(Object.entries(gridSelection.items || {}).map(([id, item]) => [id, {
                    ...item,
                    discountPct: clampDiscount(item.discountPct, maximumDiscount)
                }])),
                addons: Object.fromEntries(Object.entries(gridSelection.addons || {}).map(([id, addon]) => [id, {
                    ...addon,
                    discountPct: clampDiscount(addon.discountPct, maximumDiscount)
                }])),
                customItems: (gridSelection.customItems || []).map((item) => ({
                    ...item,
                    discountPct: clampDiscount(item.discountPct, maximumDiscount)
                })),
                customAddonsByCategory: Object.fromEntries(
                    Object.entries(gridSelection.customAddonsByCategory || {}).map(([categoryId, rows]) => [
                        categoryId,
                        rows.map((row) => ({
                            ...row,
                            discountPct: clampDiscount(row.discountPct, maximumDiscount)
                        }))
                    ])
                )
            }
        } : {},
        customCosts: hydrated.customCosts.map((cost) => ({
            ...cost,
            discountPct: clampDiscount(cost.discountPct, maximumDiscount)
        })),
        contractingWork: RETAILER_SAFE_CONTRACTING_WORK
    };
}

function hasSavableQuoteContent(draft: QuoteState, isRetailer: boolean): boolean {
    const hasBuilderItems = Array.isArray(draft.builderItems) && draft.builderItems.length > 0;
    const hasGridItems = hasConfiguredGridSelections(draft.gridSelections);
    return hasBuilderItems
        || hasGridItems
        || (!isRetailer && hasConfiguredContractingWork(draft.contractingWork));
}

function buildSavedQuoteStatePatch(
    saved: SavedQuoteLike,
    state: Partial<QuoteState> = {}
): SavedQuoteStatePatch {
    const metadata = saved?.metadata || {};

    return {
        activeQuoteId: saved?.quoteId || metadata.quoteId || state.activeQuoteId || null,
        quoteNumber: metadata.quoteNumber ?? state.quoteNumber ?? null,
        activeQuoteVersion: metadata.latestVersion || saved?.revision?.version || state.activeQuoteVersion || 1,
        quoteStatus: metadata.status || state.quoteStatus || 'draft'
    };
}

function classifyCrmError(error: unknown): {
    code: CrmSynchronizationIssue['code'];
    requiresRelink: boolean;
    diagnosticCode: string;
    conflictingDealId: string | null;
    conflictingQuoteOwnerUid: string | null;
    conflictingQuoteId: string | null;
} {
    const record = toErrorRecord(error);
    const code = getErrorCode(error);
    const message = getErrorMessage(error, '').toLowerCase();
    const conflict = code === 'crm-link-conflict' || message.includes('already linked');

    let issueCode: CrmSynchronizationIssue['code'] = 'unknown';
    if (conflict) issueCode = 'conflict';
    else if (message.includes('deal not found') || message.includes('crm deal not found')) issueCode = 'deal-not-found';
    else if (code === 'permission-denied' || code === 'unauthenticated') issueCode = 'unauthorized';
    else if (code === 'timeout' || code === 'deadline-exceeded') issueCode = 'timeout';
    else if (code === 'unavailable' || code === 'network-request-failed') issueCode = 'unavailable';

    return {
        code: issueCode,
        requiresRelink: conflict,
        diagnosticCode: code || (error instanceof Error ? error.name : 'unknown'),
        conflictingDealId: record.conflictingDealId ? String(record.conflictingDealId) : null,
        conflictingQuoteOwnerUid: record.conflictingQuoteOwnerUid
            ? String(record.conflictingQuoteOwnerUid)
            : null,
        conflictingQuoteId: record.conflictingQuoteId ? String(record.conflictingQuoteId) : null
    };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError?: Error): Promise<T> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

    return new Promise<T>((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
            reject(timeoutError || new CrmAttemptError('timeout', 'CRM synchronization timed out.'));
        }, timeoutMs);
        promise.then(
            (value) => {
                globalThis.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                globalThis.clearTimeout(timer);
                reject(error);
            }
        );
    });
}

function buildCrmLinkInput({
    dealId,
    quote,
    saved,
    actor
}: {
    dealId: string;
    quote: QuoteReference;
    saved: { metadata: SavedQuoteLike['metadata']; revision: { revisionId?: string; version?: number } };
    actor: AccessUser;
}): CrmLinkDealToQuoteInput {
    return {
        dealId,
        quoteOwnerUid: quote.ownerUid,
        quoteId: quote.quoteId,
        quoteNumber: saved.metadata?.quoteNumber || null,
        quoteRevisionId: saved.metadata?.latestRevisionId || saved.revision.revisionId || null,
        quoteVersion: saved.metadata?.latestVersion || saved.revision.version || null,
        valueSek: Number(saved.metadata?.totalSek) || 0,
        user: actorFrom(actor)
    };
}

export function createQuoteSaveModule({
    quotePersistence,
    crm,
    logActivity,
    calculateTotals = (draft) => computeQuoteTotals({ state: draft, catalogData }),
    createSaveIntentId: makeSaveIntentId = createSaveIntentId,
    now = () => Date.now(),
    crmTimeoutMs = DEFAULT_CRM_TIMEOUT_MS,
    activityTimeoutMs = DEFAULT_ACTIVITY_TIMEOUT_MS,
    repairDelaysMs = DEFAULT_REPAIR_DELAYS_MS,
    schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs)
}: QuoteSaveModuleDependencies): QuoteSaveModule {
    const scheduledRepairs = new Set<string>();

    const canWriteQuote = (
        actorUid: string,
        ownerUid: string,
        canManageAllQuotes: boolean | undefined
    ) => actorUid === ownerUid || canManageAllQuotes === true;

    const makeIssue = ({
        error,
        dealId,
        saveIntentId,
        revisionId,
        quoteVersion,
        previous
    }: {
        error: unknown;
        dealId: string;
        saveIntentId: string;
        revisionId: string;
        quoteVersion: number;
        previous?: CrmSynchronizationIssue | null;
    }): CrmSynchronizationIssue => {
        const classified = classifyCrmError(error);
        const attemptedAtMs = now();
        const attemptCount = previous?.dealId === dealId ? previous.attemptCount + 1 : 1;
        const retryDelay = !classified.requiresRelink && attemptCount <= repairDelaysMs.length
            ? repairDelaysMs[attemptCount - 1]
            : null;

        return {
            code: classified.code,
            dealId,
            saveIntentId,
            revisionId,
            quoteVersion,
            firstFailedAtMs: previous?.dealId === dealId && previous.firstFailedAtMs > 0
                ? previous.firstFailedAtMs
                : attemptedAtMs,
            lastAttemptAtMs: attemptedAtMs,
            attemptCount,
            nextRetryAtMs: retryDelay == null ? null : attemptedAtMs + retryDelay,
            requiresRelink: classified.requiresRelink,
            conflictingDealId: classified.conflictingDealId,
            conflictingQuoteOwnerUid: classified.conflictingQuoteOwnerUid,
            conflictingQuoteId: classified.conflictingQuoteId,
            diagnosticCode: classified.diagnosticCode
        };
    };

    const persistIssue = async (
        quote: QuoteReference,
        issue: CrmSynchronizationIssue | null,
        expectedSaveIntentId?: string | null
    ): Promise<boolean> => {
        try {
            const result = await quotePersistence.updateQuoteCrmSynchronizationIssue({
                ...quote,
                issue,
                expectedSaveIntentId
            });
            return result.applied;
        } catch (error) {
            console.error('Failed to persist CRM synchronization issue:', error);
            return false;
        }
    };

    const attemptCrmLink = async ({
        dealId,
        quote,
        saved,
        actor,
        relink
    }: {
        dealId: string;
        quote: QuoteReference;
        saved: { metadata: SavedQuoteLike['metadata']; revision: { revisionId?: string; version?: number } };
        actor: AccessUser;
        relink: boolean;
    }): Promise<CrmDeal> => withTimeout((async () => {
        const deal = await crm.getDeal(dealId);
        if (!deal) {
            throw new CrmAttemptError('deal-not-found', 'CRM deal not found.');
        }

        const quoteLinkedDealId = normalizeId(saved.metadata?.crmDealId);
        if (quoteLinkedDealId && quoteLinkedDealId !== dealId && !relink) {
            throw new CrmAttemptError('crm-link-conflict', 'Quote is already linked to another CRM deal.', {
                conflictingDealId: quoteLinkedDealId,
                conflictingQuoteOwnerUid: quote.ownerUid,
                conflictingQuoteId: quote.quoteId
            });
        }
        if (
            deal.quoteOwnerUid
            && deal.quoteId
            && (deal.quoteOwnerUid !== quote.ownerUid || deal.quoteId !== quote.quoteId)
            && !relink
        ) {
            throw new CrmAttemptError('crm-link-conflict', 'CRM deal is already linked to another quote.', {
                conflictingQuoteOwnerUid: deal.quoteOwnerUid,
                conflictingQuoteId: deal.quoteId
            });
        }

        const linkInput = buildCrmLinkInput({ dealId, quote, saved, actor });
        return relink
            ? crm.relinkDealToQuote(linkInput)
            : crm.linkDealToQuote(linkInput);
    })(), crmTimeoutMs);

    const logSavedActivity = async ({
        actor,
        draft,
        summary,
        quote,
        isNewQuote,
        version
    }: {
        actor: AccessUser;
        draft: QuoteState;
        summary: QuoteSummary;
        quote: QuoteReference;
        isNewQuote: boolean;
        version: number;
    }): Promise<void> => {
        try {
            const result = await withTimeout(Promise.resolve(logActivity({
                user: actor,
                eventType: isNewQuote ? 'quote_created' : 'quote_revision_saved',
                system: 'quote',
                targetType: isNewQuote ? 'quote' : 'revision',
                targetId: quote.quoteId,
                details: isNewQuote
                    ? 'Offert skapad och sparad i Mina Offerter.'
                    : `Offerten sparades som version ${version}.`,
                metadata: {
                    version,
                    customerName: draft.customerInfo.company || draft.customerInfo.name || '',
                    reference: draft.customerInfo.reference || '',
                    totalSek: summary.finalTotalSek || 0
                }
            })), activityTimeoutMs, new Error('Activity logging timed out.'));
            if (result && result.ok === false) {
                console.error('Quote Save activity logging failed:', result);
            }
        } catch (error) {
            console.error('Quote Save activity logging failed:', error);
        }
    };

    let repairCrmInternal: (
        input: RepairCrmLinkInput,
        issueOverride?: CrmSynchronizationIssue
    ) => Promise<CrmRepairOutcome>;

    const scheduleRepair = (
        input: RepairCrmLinkInput,
        issue: CrmSynchronizationIssue
    ): void => {
        if (issue.requiresRelink || issue.nextRetryAtMs == null) return;
        const key = `${input.quote.ownerUid}/${input.quote.quoteId}/${issue.dealId}`;
        if (scheduledRepairs.has(key)) return;
        scheduledRepairs.add(key);
        const delayMs = Math.max(0, issue.nextRetryAtMs - now());
        schedule(() => {
            scheduledRepairs.delete(key);
            void repairCrmInternal(input, issue).catch((error) => {
                console.error('Scheduled CRM repair failed unexpectedly:', error);
            });
        }, delayMs);
    };

    repairCrmInternal = async (
        input: RepairCrmLinkInput,
        issueOverride?: CrmSynchronizationIssue
    ): Promise<CrmRepairOutcome> => {
        const actorUid = normalizeId(input.actor?.uid);
        if (!actorUid) {
            return {
                status: 'not-repaired',
                failure: { code: 'unauthenticated', message: 'Authentication is required.', retryable: false }
            };
        }
        if (!canWriteQuote(actorUid, input.quote.ownerUid, input.canManageAllQuotes)) {
            return {
                status: 'not-repaired',
                failure: { code: 'unauthorized', message: 'The actor cannot repair this Quote.', retryable: false }
            };
        }

        let latest;
        try {
            latest = await quotePersistence.getQuoteLatestRevision({
                userId: input.quote.ownerUid,
                quoteId: input.quote.quoteId
            });
        } catch (error) {
            return { status: 'not-repaired', failure: persistenceFailure(error) };
        }
        if (!latest) {
            return {
                status: 'not-repaired',
                failure: { code: 'quote-not-found', message: 'Quote not found.', retryable: false }
            };
        }

        const durableIssue = latest.metadata.crmSynchronizationIssue || null;
        const overrideMatchesLatest = issueOverride
            && (!latest.metadata.latestSaveIntentId || latest.metadata.latestSaveIntentId === issueOverride.saveIntentId)
            && (!durableIssue || durableIssue.saveIntentId === issueOverride.saveIntentId)
            && (!durableIssue || issueOverride.attemptCount >= durableIssue.attemptCount);
        const issue = overrideMatchesLatest ? issueOverride : durableIssue;
        if (!issue) return { status: 'no-repair-needed', quote: input.quote };
        if (issue.requiresRelink && input.relink !== true) {
            return { status: 'needs-relink', quote: input.quote, dealId: issue.dealId };
        }

        const saved = {
            metadata: latest.metadata,
            revision: latest.revision || {
                revisionId: issue.revisionId,
                version: issue.quoteVersion
            }
        };

        try {
            await attemptCrmLink({
                dealId: issue.dealId,
                quote: input.quote,
                saved,
                actor: input.actor as AccessUser,
                relink: input.relink === true
            });
            const cleared = await persistIssue(input.quote, null, issue.saveIntentId || null);
            if (!cleared) {
                const nextIssue = makeIssue({
                    error: new Error('CRM synchronization issue cleanup failed.'),
                    dealId: issue.dealId,
                    saveIntentId: issue.saveIntentId,
                    revisionId: issue.revisionId,
                    quoteVersion: issue.quoteVersion,
                    previous: issue
                });
                scheduleRepair(input, nextIssue);
                return { status: 'repair-pending', quote: input.quote, dealId: issue.dealId };
            }
            return { status: 'repaired', quote: input.quote, dealId: issue.dealId };
        } catch (error) {
            const nextIssue = makeIssue({
                error,
                dealId: issue.dealId,
                saveIntentId: issue.saveIntentId,
                revisionId: issue.revisionId,
                quoteVersion: issue.quoteVersion,
                previous: issue
            });
            await persistIssue(input.quote, nextIssue, issue.saveIntentId || null);
            scheduleRepair({ ...input, relink: false }, nextIssue);
            return nextIssue.requiresRelink
                ? { status: 'needs-relink', quote: input.quote, dealId: issue.dealId }
                : { status: 'repair-pending', quote: input.quote, dealId: issue.dealId };
        }
    };

    const save = async (input: SaveQuoteRevisionInput): Promise<QuoteSaveOutcome> => {
        const actorUid = normalizeId(input.actor?.uid);
        if (!actorUid) {
            return authorizationFailure('unauthenticated', 'Authentication is required to save a Quote.');
        }
        if (!isRecord(input.state)) {
            return authorizationFailure('invalid-draft', 'A Quote draft is required.');
        }

        const target = input.target;
        if (!target || (target.kind !== 'new' && target.kind !== 'existing')) {
            return authorizationFailure('invalid-target', 'A valid Quote target is required.');
        }

        const ownerUid = target.kind === 'existing'
            ? normalizeId(target.quote.ownerUid)
            : normalizeId(target.ownerUid) || actorUid;
        if (!ownerUid) {
            return authorizationFailure('invalid-target', 'A Quote Owner is required.');
        }
        if (!canWriteQuote(actorUid, ownerUid, input.canManageAllQuotes)) {
            return authorizationFailure('unauthorized', 'The actor cannot save for this Quote Owner.');
        }
        if (
            target.kind === 'existing'
            && normalizeId(input.state.activeQuoteId)
            && normalizeId(input.state.activeQuoteId) !== normalizeId(target.quote.quoteId)
        ) {
            return authorizationFailure('invalid-target', 'The Quote reference does not match the active draft.');
        }

        let existing = null;
        if (target.kind === 'existing') {
            try {
                existing = await quotePersistence.getQuoteLatestRevision({
                    userId: ownerUid,
                    quoteId: target.quote.quoteId
                });
            } catch (error) {
                const failure = persistenceFailure(error);
                return { status: 'not-saved', failure };
            }
            if (!existing) {
                return authorizationFailure('quote-not-found', 'Quote not found.');
            }
        }

        const canonicalDraft = buildCanonicalDraft(input.state, input.retailer || null);
        if (!canonicalDraft || !hasSavableQuoteContent(canonicalDraft, Boolean(input.retailer))) {
            return authorizationFailure('invalid-draft', 'The Quote draft has no configured content to save.');
        }
        const canonicalSummary = calculateTotals(canonicalDraft);
        const saveIntentId = normalizeId(input.retrySaveIntentId) || makeSaveIntentId();
        const isNewQuote = target.kind === 'new';
        const requestedDealId = normalizeId(target.crmDealId);
        const existingDealId = normalizeId(existing?.metadata.crmDealId);
        const existingCrmIssue = existing?.metadata.crmSynchronizationIssue || null;
        const preservedRelinkIssue = existingCrmIssue?.requiresRelink
            ? { ...existingCrmIssue, saveIntentId }
            : null;
        const previousIssueDealId = normalizeId(existingCrmIssue?.dealId);
        const desiredDealId = preservedRelinkIssue?.dealId
            || requestedDealId
            || existingDealId
            || previousIssueDealId;
        const pendingCrmIssue: CrmSynchronizationIssue | null = preservedRelinkIssue || (desiredDealId ? {
            code: 'pending',
            dealId: desiredDealId,
            saveIntentId,
            revisionId: '',
            quoteVersion: 0,
            firstFailedAtMs: 0,
            lastAttemptAtMs: 0,
            attemptCount: 0,
            nextRetryAtMs: null,
            requiresRelink: false,
            conflictingDealId: null,
            conflictingQuoteOwnerUid: null,
            conflictingQuoteId: null,
            diagnosticCode: 'pending'
        } : null);

        let saved: {
            quoteId?: string;
            metadata: NonNullable<SavedQuoteLike['metadata']>;
            revision: { revisionId?: string; version?: number };
        };
        try {
            if (target.kind === 'new') {
                const createInput: CreateQuoteInput = {
                    user: input.actor as AccessUser,
                    ownerUid,
                    state: canonicalDraft,
                    summary: canonicalSummary,
                    customerInfo: canonicalDraft.customerInfo,
                    status: canonicalDraft.quoteStatus,
                    changeNote: input.changeNote || 'Initial save',
                    retailerName: input.retailer?.name || null,
                    originType: input.retailer ? 'retailer' : 'internal',
                    crmSynchronizationIssue: pendingCrmIssue,
                    saveIntentId
                };
                saved = await quotePersistence.createQuote(createInput);
            } else {
                saved = await quotePersistence.saveQuoteRevision({
                    user: input.actor as AccessUser,
                    ownerUid,
                    quoteId: target.quote.quoteId,
                    state: canonicalDraft,
                    summary: canonicalSummary,
                    customerInfo: canonicalDraft.customerInfo,
                    status: canonicalDraft.quoteStatus,
                    changeNote: input.changeNote || '',
                    retailerName: input.retailer?.name || null,
                    crmSynchronizationIssue: pendingCrmIssue,
                    saveIntentId
                });
            }
        } catch (error) {
            const failure = persistenceFailure(error);
            return {
                status: 'not-saved',
                failure,
                ...(failure.code === 'persistence-ambiguous' ? { retry: { saveIntentId } } : {})
            };
        }

        const quote: QuoteReference = {
            ownerUid,
            quoteId: normalizeId(saved.quoteId || saved.metadata.quoteId || (target.kind === 'existing' ? target.quote.quoteId : ''))
        };
        if (!quote.quoteId) {
            throw new Error('Quote persistence returned no Quote identity.');
        }
        const statePatch = buildSavedQuoteStatePatch(saved, canonicalDraft);
        const version = saved.metadata.latestVersion || saved.revision.version || statePatch.activeQuoteVersion || 1;
        const persistedDealId = normalizeId(existing?.metadata.crmDealId || saved.metadata.crmDealId);
        const dealId = desiredDealId;

        let crmIssue: CrmSynchronizationIssue | null = preservedRelinkIssue
            ? saved.metadata.crmSynchronizationIssue || pendingCrmIssue
            : null;
        if (dealId && !preservedRelinkIssue) {
            try {
                if (persistedDealId && requestedDealId && persistedDealId !== requestedDealId) {
                    throw new CrmAttemptError('crm-link-conflict', 'Quote is already linked to another CRM deal.', {
                        conflictingDealId: persistedDealId,
                        conflictingQuoteOwnerUid: quote.ownerUid,
                        conflictingQuoteId: quote.quoteId
                    });
                }
                await attemptCrmLink({
                    dealId,
                    quote,
                    saved,
                    actor: input.actor as AccessUser,
                    relink: false
                });
                const cleared = await persistIssue(quote, null, saveIntentId);
                if (!cleared) {
                    crmIssue = makeIssue({
                        error: new Error('CRM synchronization issue cleanup failed.'),
                        dealId,
                        saveIntentId,
                        revisionId: normalizeId(saved.metadata.latestRevisionId || saved.revision.revisionId),
                        quoteVersion: version,
                        previous: saved.metadata.crmSynchronizationIssue || existing?.metadata.crmSynchronizationIssue || null
                    });
                    scheduleRepair({
                        actor: input.actor,
                        quote,
                        canManageAllQuotes: input.canManageAllQuotes
                    }, crmIssue);
                }
            } catch (error) {
                crmIssue = makeIssue({
                    error,
                    dealId,
                    saveIntentId,
                    revisionId: normalizeId(saved.metadata.latestRevisionId || saved.revision.revisionId),
                    quoteVersion: version,
                    previous: saved.metadata.crmSynchronizationIssue || existing?.metadata.crmSynchronizationIssue || null
                });
                await persistIssue(quote, crmIssue, saveIntentId);
                scheduleRepair({
                    actor: input.actor,
                    quote,
                    canManageAllQuotes: input.canManageAllQuotes
                }, crmIssue);
            }
        }

        await logSavedActivity({
            actor: input.actor as AccessUser,
            draft: canonicalDraft,
            summary: canonicalSummary,
            quote,
            isNewQuote,
            version
        });

        if (crmIssue) {
            return {
                status: 'saved-needs-crm-repair',
                quote,
                isNewQuote,
                statePatch,
                crm: {
                    dealId: crmIssue.dealId,
                    status: crmIssue.requiresRelink ? 'relink-required' : 'repair-pending'
                }
            };
        }

        return { status: 'saved', quote, isNewQuote, statePatch };
    };

    return {
        save,
        repairCrm: (input) => repairCrmInternal(input)
    };
}

let defaultModulePromise: Promise<QuoteSaveModule> | null = null;

async function getDefaultQuoteSaveModule(): Promise<QuoteSaveModule> {
    if (!defaultModulePromise) {
        defaultModulePromise = Promise.all([
            import('./quoteRepositoryClient'),
            import('./crmRepository'),
            import('./activityLogService')
        ]).then(([quoteModule, crmModule, activityModule]) => createQuoteSaveModule({
            quotePersistence: quoteModule.quoteRepository,
            crm: crmModule.crmRepository,
            logActivity: activityModule.safeLogActivity
        }));
    }
    return defaultModulePromise;
}

async function saveQuoteRevision(input: SaveQuoteRevisionInput): Promise<QuoteSaveOutcome> {
    return (await getDefaultQuoteSaveModule()).save(input);
}

async function repairCrm(input: RepairCrmLinkInput): Promise<CrmRepairOutcome> {
    return (await getDefaultQuoteSaveModule()).repairCrm(input);
}

export const quoteSave: QuoteSaveModule = {
    save: saveQuoteRevision,
    repairCrm
};
