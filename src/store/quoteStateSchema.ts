import type {
    ClickitupStockEntry,
    BuilderAddon,
    GridAddonState,
    GridItemSelectionState,
    HydratedQuoteStatePayload,
    QuoteState,
    QuoteStatus,
    RawClickitupStockEntry,
    RawPersistedBuilderAddon,
    RawPersistedBuilderItem,
    RawPersistedCustomerInfo,
    RawPersistedGridLineSelection,
    RawPersistedInventoryData,
    RawPersistedSketchMeta,
    ScriveStatus,
    StepInput,
    UnknownRecord
} from '../types/contracts';
import { DEFAULT_TEMPLATE_ID, getTemplateById, isBuiltinTemplateId } from '../config/legalTemplates.shared';

export const QUOTE_STATE_STORAGE_KEY = 'offertverktyg_state';
export const CURRENT_STATE_VERSION = 1;

const VALID_QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'won', 'lost', 'archived'];
const VALID_SCRIVE_STATUSES: ScriveStatus[] = ['not_sent', 'preparation', 'pending', 'closed', 'rejected', 'canceled', 'timedout', 'failed'];

function clone<T>(value: T): T {
    if (value === undefined) {
        return value;
    }
    return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toRecord<T extends UnknownRecord = UnknownRecord>(value: unknown): T {
    return (isObject(value) ? value : {}) as T;
}

function cloneArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? clone(value) : [];
}

function cloneValueOr<T>(value: unknown, fallback: T): T {
    return value === undefined ? fallback : clone(value as T);
}

function normalizeClickitupStockEntry(value: unknown): ClickitupStockEntry {
    const record = toRecord<RawClickitupStockEntry>(value);
    return {
        sektion: toNumber(record.sektion, 0) || 0,
        dorr_h: toNumber(record.dorr_h, 0) || 0,
        dorr_v: toNumber(record.dorr_v, 0) || 0,
        hane_h: toNumber(record.hane_h, 0) || 0,
        hane_v: toNumber(record.hane_v, 0) || 0
    };
}

function normalizeClickitupStockMap(value: unknown): QuoteState['inventoryData']['clickitup'] {
    if (!isObject(value)) {
        return {};
    }

    return Object.entries(value).reduce<QuoteState['inventoryData']['clickitup']>((acc, [size, entry]) => {
        acc[size] = normalizeClickitupStockEntry(entry);
        return acc;
    }, {});
}

function normalizeGridItemSelectionMap(value: unknown): Record<string, GridItemSelectionState> {
    if (!isObject(value)) {
        return {};
    }

    return Object.entries(value).reduce<Record<string, GridItemSelectionState>>((acc, [itemId, itemState]) => {
        const record = toRecord(itemState);
        acc[itemId] = {
            qty: normalizeNonNegativeInt(record.qty, 0),
            discountPct: toNumber(record.discountPct, 0)
        };
        return acc;
    }, {});
}

function normalizeGridAddonStateMap(value: unknown): Record<string, GridAddonState> {
    if (!isObject(value)) {
        return {};
    }

    return Object.entries(value).reduce<Record<string, GridAddonState>>((acc, [addonId, addonState]) => {
        const record = toRecord(addonState);
        const syncMode = record.syncMode === 'manual' ? 'manual' : record.syncMode === 'auto' ? 'auto' : undefined;
        const discountSyncMode = record.discountSyncMode === 'manual'
            ? 'manual'
            : record.discountSyncMode === 'global'
                ? 'global'
                : undefined;

        acc[addonId] = {
            qty: normalizeNonNegativeInt(record.qty, 0),
            discountPct: toNumber(record.discountPct, 0),
            ...(syncMode ? { syncMode } : {}),
            ...(discountSyncMode ? { discountSyncMode } : {})
        };
        return acc;
    }, {});
}

function toNumber(value: unknown, fallback: number): number;
function toNumber(value: unknown, fallback: null): number | null;
function toNumber(value: unknown, fallback: number | null = 0): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePositiveInt(value: unknown, fallback: number): number {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInt(value: unknown, fallback = 0): number {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseValidityDays(value: unknown): number | null {
    const match = String(value ?? '').match(/(\d+)/);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatValidityLabel(days: number): string {
    return `${days} dagar`;
}

function normalizeQuoteStatus(status: unknown): QuoteStatus {
    const normalized = String(status || '').toLowerCase();
    return VALID_QUOTE_STATUSES.includes(normalized as QuoteStatus) ? (normalized as QuoteStatus) : 'draft';
}

function normalizeScriveStatus(status: unknown): ScriveStatus {
    const normalized = String(status || '').toLowerCase();
    return VALID_SCRIVE_STATUSES.includes(normalized as ScriveStatus) ? (normalized as ScriveStatus) : 'not_sent';
}

function normalizeStep(step: unknown, fallback: StepInput = 0): StepInput {
    if (typeof step === 'number' && Number.isFinite(step)) return step;
    if (typeof step === 'string' && step.trim()) return step;
    return fallback;
}

function normalizeInventoryData(value: RawPersistedInventoryData | unknown): QuoteState['inventoryData'] {
    const record = toRecord<RawPersistedInventoryData>(value);

    return {
        bahama: cloneArray(record.bahama),
        clickitup: normalizeClickitupStockMap(record.clickitup)
    };
}

function normalizeGridCustomAddonsByCategory(
    value: unknown
): QuoteState['gridSelections'][string]['customAddonsByCategory'] {
    if (!isObject(value)) {
        return {};
    }

    return Object.entries(value).reduce<QuoteState['gridSelections'][string]['customAddonsByCategory']>((acc, [categoryId, rows]) => {
        acc[categoryId] = Array.isArray(rows)
            ? rows.map((row, index) => {
                const safeRow = toRecord(row);
                return {
                    id: String(safeRow.id || `custom_addon_${index}`),
                    name: String(safeRow.name || ''),
                    price: toNumber(safeRow.price, 0),
                    qty: normalizeNonNegativeInt(safeRow.qty, 1),
                    discountPct: toNumber(safeRow.discountPct, 0)
                };
            })
            : [];
        return acc;
    }, {});
}

function normalizeGridSelections(value: unknown): QuoteState['gridSelections'] {
    if (!isObject(value)) {
        return {};
    }

    return Object.entries(value).reduce<QuoteState['gridSelections']>((acc, [lineId, lineSelection]) => {
        const key = lineId === 'ClickitUP' ? 'ClickitUp' : lineId;
        const safeLineSelection = toRecord<RawPersistedGridLineSelection>(lineSelection);

        acc[key] = {
            ...clone(safeLineSelection),
            items: normalizeGridItemSelectionMap(safeLineSelection.items),
            addons: normalizeGridAddonStateMap(safeLineSelection.addons),
            customAddonsByCategory: normalizeGridCustomAddonsByCategory(safeLineSelection.customAddonsByCategory)
        };
        return acc;
    }, {});
}

function normalizeBuilderAddon(addon: unknown, index: number): BuilderAddon {
    const safeAddon = toRecord<RawPersistedBuilderAddon>(addon);
    const isCustom = safeAddon.isCustom === true;

    if (!isCustom) {
        return {
            id: String(safeAddon.id || `addon_${index}`),
            qty: normalizePositiveInt(safeAddon.qty, 1),
            discountPct: toNumber(safeAddon.discountPct, 0)
        };
    }

    return {
        id: String(safeAddon.id || `custom_builder_addon_${index}`),
        qty: normalizePositiveInt(safeAddon.qty, 1),
        discountPct: toNumber(safeAddon.discountPct, 0),
        isCustom: true,
        name: String(safeAddon.name || ''),
        price: toNumber(safeAddon.price, 0),
        categoryId: String(safeAddon.categoryId || '__uncategorized__')
    };
}

function normalizeBuilderItems(value: unknown): QuoteState['builderItems'] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((item, index) => {
        const safeItem = toRecord<RawPersistedBuilderItem>(item);
        return {
            ...clone(safeItem),
            id: String(safeItem.id || `builder_item_${index}`),
            line: String(safeItem.line || ''),
            model: String(safeItem.model || ''),
            size: String(safeItem.size || ''),
            qty: normalizePositiveInt(safeItem.qty, 1),
            discountPct: toNumber(safeItem.discountPct, 0),
            addons: Array.isArray(safeItem.addons)
                ? safeItem.addons.map((addon, addonIndex) => normalizeBuilderAddon(addon, addonIndex))
                : []
        };
    });
}

function createBaseInitialState(): QuoteState {
    const defaultTemplate = getTemplateById(DEFAULT_TEMPLATE_ID);

    return {
        stateVersion: CURRENT_STATE_VERSION,
        step: 0,
        selectedLines: [],
        builderItems: [],
        gridSelections: {},
        customCosts: [],
        includesVat: false,
        globalDiscountPct: 0,
        prevGlobalDiscountPct: 0,
        exchangeRate: 12.2,
        customerInfo: {
            name: '',
            company: '',
            email: '',
            reference: '',
            customerReference: '',
            date: '',
            validity: '30 dagar',
            extraNotes: ''
        },
        inventoryData: { bahama: [], clickitup: {} },
        cloudInventoryData: { bahama: [], clickitup: {} },
        sketchDraft: null,
        sketchMeta: { addedBahamaLine: false, addedFiestaLine: false },
        inventoryBasket: [],
        activeQuoteId: null,
        activeQuoteVersion: 0,
        quoteStatus: 'draft',
        includeTerms: true,
        termsText: defaultTemplate?.body || '',
        termsTemplateId: DEFAULT_TEMPLATE_ID,
        termsCustomized: false,
        includeSignatureBlock: false,
        includePaymentBox: false,
        hideZeroDiscountReferencesInPdf: false,
        paymentTermsDays: 30,
        quoteValidityDays: 30,
        scriveEnabled: false,
        scriveStatus: 'not_sent',
        scriveDocumentId: null,
        scriveSignerName: '',
        scriveSignerEmail: '',
        scriveLastError: null,
        scriveSentAtMs: null,
        scriveLastEventAtMs: null,
        scriveCompletedAtMs: null
    };
}

export function createInitialQuoteState(): QuoteState {
    return clone(createBaseInitialState());
}

function migrateV0ToV1(rawState: UnknownRecord = {}): UnknownRecord {
    const next = toRecord(rawState);
    const customerInfo = toRecord<RawPersistedCustomerInfo>(next.customerInfo);
    const validityFromCustomer = parseValidityDays(customerInfo.validity);
    const inventoryData = normalizeInventoryData(next.inventoryData);
    const cloudInventoryData = Object.prototype.hasOwnProperty.call(next, 'cloudInventoryData')
        ? normalizeInventoryData(next.cloudInventoryData)
        : clone(inventoryData);
    const sketchMeta = toRecord<RawPersistedSketchMeta>(next.sketchMeta);

    return {
        ...next,
        stateVersion: 1,
        step: normalizeStep(next.step, 0),
        selectedLines: Array.isArray(next.selectedLines)
            ? clone(next.selectedLines).map((line) => line === 'ClickitUP' ? 'ClickitUp' : String(line))
            : [],
        builderItems: normalizeBuilderItems(next.builderItems),
        gridSelections: normalizeGridSelections(next.gridSelections),
        customCosts: cloneArray(next.customCosts),
        includesVat: Boolean(next.includesVat),
        globalDiscountPct: toNumber(next.globalDiscountPct, 0),
        prevGlobalDiscountPct: toNumber(next.prevGlobalDiscountPct, toNumber(next.globalDiscountPct, 0)),
        exchangeRate: toNumber(next.exchangeRate, 12.2),
        customerInfo: {
            ...customerInfo,
            name: String(customerInfo.name || ''),
            company: String(customerInfo.company || ''),
            email: String(customerInfo.email || ''),
            reference: String(customerInfo.reference || ''),
            customerReference: String(customerInfo.customerReference || ''),
            date: String(customerInfo.date || ''),
            validity: String(customerInfo.validity || formatValidityLabel(normalizePositiveInt(next.quoteValidityDays, validityFromCustomer || 30))),
            extraNotes: String(customerInfo.extraNotes || '')
        },
        inventoryData,
        cloudInventoryData,
        sketchDraft: Object.prototype.hasOwnProperty.call(next, 'sketchDraft') ? cloneValueOr(next.sketchDraft, null) : null,
        sketchMeta: {
            addedBahamaLine: Boolean(sketchMeta.addedBahamaLine),
            addedFiestaLine: Boolean(sketchMeta.addedFiestaLine)
        },
        inventoryBasket: cloneArray(next.inventoryBasket),
        activeQuoteId: next.activeQuoteId ? String(next.activeQuoteId) : null,
        activeQuoteVersion: toNumber(next.activeQuoteVersion, 0),
        quoteStatus: normalizeQuoteStatus(next.quoteStatus),
        includeTerms: next.includeTerms !== false,
        termsText: typeof next.termsText === 'string' ? next.termsText : '',
        termsTemplateId: typeof next.termsTemplateId === 'string' && next.termsTemplateId
            ? next.termsTemplateId
            : DEFAULT_TEMPLATE_ID,
        termsCustomized: Boolean(next.termsCustomized),
        includeSignatureBlock: next.includeSignatureBlock === true,
        includePaymentBox: next.includePaymentBox === true,
        hideZeroDiscountReferencesInPdf: next.hideZeroDiscountReferencesInPdf === true,
        paymentTermsDays: normalizePositiveInt(next.paymentTermsDays, 30),
        quoteValidityDays: normalizePositiveInt(next.quoteValidityDays, validityFromCustomer || 30),
        scriveEnabled: Boolean(next.scriveEnabled),
        scriveStatus: normalizeScriveStatus(next.scriveStatus),
        scriveDocumentId: next.scriveDocumentId ? String(next.scriveDocumentId) : null,
        scriveSignerName: String(next.scriveSignerName || customerInfo.name || ''),
        scriveSignerEmail: String(next.scriveSignerEmail || customerInfo.email || ''),
        scriveLastError: next.scriveLastError ? String(next.scriveLastError) : null,
        scriveSentAtMs: next.scriveSentAtMs == null ? null : toNumber(next.scriveSentAtMs, null),
        scriveLastEventAtMs: next.scriveLastEventAtMs == null ? null : toNumber(next.scriveLastEventAtMs, null),
        scriveCompletedAtMs: next.scriveCompletedAtMs == null ? null : toNumber(next.scriveCompletedAtMs, null)
    };
}

export function migrateQuoteState(fromVersion: unknown, rawState: unknown): UnknownRecord {
    let version = Number.isFinite(Number(fromVersion)) ? Number(fromVersion) : 0;
    let nextState: UnknownRecord = isObject(rawState) ? clone(rawState) : {};

    while (version < CURRENT_STATE_VERSION) {
        if (version === 0) {
            nextState = migrateV0ToV1(nextState);
            version = 1;
            continue;
        }

        break;
    }

    return nextState;
}

export function hydrateQuoteState(input: HydratedQuoteStatePayload): QuoteState {
    const initialState = createInitialQuoteState();
    if (!isObject(input)) {
        return initialState;
    }

    const rawState = clone(input);
    const rawVersion = Object.prototype.hasOwnProperty.call(rawState, 'stateVersion')
        ? Number(rawState.stateVersion)
        : 0;

    let migratedState: UnknownRecord = rawState;
    if (rawVersion > CURRENT_STATE_VERSION) {
        console.warn(
            `Quote state version ${rawVersion} is newer than supported version ${CURRENT_STATE_VERSION}. Conservatively hydrating known fields.`
        );
    } else {
        migratedState = migrateQuoteState(rawVersion, rawState);
    }

    const mergedState: QuoteState & UnknownRecord = { ...initialState, ...migratedState };
    const customerInfoSource = toRecord<RawPersistedCustomerInfo>(mergedState.customerInfo);
    const validityFromCustomer = parseValidityDays(customerInfoSource.validity);
    const normalizedValidityDays = normalizePositiveInt(
        mergedState.quoteValidityDays,
        validityFromCustomer || initialState.quoteValidityDays
    );
    const safeTemplateId = typeof mergedState.termsTemplateId === 'string' && mergedState.termsTemplateId
        ? mergedState.termsTemplateId
        : DEFAULT_TEMPLATE_ID;
    const builtinTemplate = isBuiltinTemplateId(safeTemplateId) ? getTemplateById(safeTemplateId) : null;
    const inventoryData = normalizeInventoryData(mergedState.inventoryData);
    const cloudInventoryData = Object.prototype.hasOwnProperty.call(mergedState, 'cloudInventoryData')
        ? normalizeInventoryData(mergedState.cloudInventoryData)
        : clone(inventoryData);
    const normalizedGlobalDiscount = toNumber(mergedState.globalDiscountPct, initialState.globalDiscountPct);
    const sketchMeta = toRecord<RawPersistedSketchMeta>(mergedState.sketchMeta);

    return {
        ...mergedState,
        stateVersion: CURRENT_STATE_VERSION,
        step: normalizeStep(mergedState.step, initialState.step),
        selectedLines: Array.isArray(mergedState.selectedLines)
            ? clone(mergedState.selectedLines).map((line) => line === 'ClickitUP' ? 'ClickitUp' : String(line))
            : [],
        builderItems: normalizeBuilderItems(mergedState.builderItems),
        gridSelections: normalizeGridSelections(mergedState.gridSelections),
        customCosts: cloneArray(mergedState.customCosts),
        includesVat: Boolean(mergedState.includesVat),
        globalDiscountPct: normalizedGlobalDiscount,
        prevGlobalDiscountPct: toNumber(mergedState.prevGlobalDiscountPct, normalizedGlobalDiscount),
        exchangeRate: toNumber(mergedState.exchangeRate, initialState.exchangeRate),
        customerInfo: {
            ...initialState.customerInfo,
            ...customerInfoSource,
            name: String(customerInfoSource.name || ''),
            company: String(customerInfoSource.company || ''),
            email: String(customerInfoSource.email || ''),
            reference: String(customerInfoSource.reference || ''),
            customerReference: String(customerInfoSource.customerReference || ''),
            date: String(customerInfoSource.date || ''),
            validity: formatValidityLabel(normalizedValidityDays),
            extraNotes: String(customerInfoSource.extraNotes || '')
        },
        inventoryData,
        cloudInventoryData,
        sketchDraft: Object.prototype.hasOwnProperty.call(mergedState, 'sketchDraft')
            ? cloneValueOr(mergedState.sketchDraft, initialState.sketchDraft)
            : initialState.sketchDraft,
        sketchMeta: {
            ...initialState.sketchMeta,
            addedBahamaLine: Boolean(sketchMeta.addedBahamaLine),
            addedFiestaLine: Boolean(sketchMeta.addedFiestaLine)
        },
        inventoryBasket: cloneArray(mergedState.inventoryBasket),
        activeQuoteId: mergedState.activeQuoteId ? String(mergedState.activeQuoteId) : null,
        activeQuoteVersion: toNumber(mergedState.activeQuoteVersion, initialState.activeQuoteVersion),
        quoteStatus: normalizeQuoteStatus(mergedState.quoteStatus),
        includeTerms: mergedState.includeTerms !== false,
        termsTemplateId: safeTemplateId,
        termsText: typeof mergedState.termsText === 'string' && mergedState.termsText.trim().length > 0
            ? mergedState.termsText
            : (builtinTemplate?.body || initialState.termsText),
        termsCustomized: typeof mergedState.termsCustomized === 'boolean'
            ? mergedState.termsCustomized
            : false,
        includeSignatureBlock: mergedState.includeSignatureBlock === true,
        includePaymentBox: mergedState.includePaymentBox === true,
        hideZeroDiscountReferencesInPdf: mergedState.hideZeroDiscountReferencesInPdf === true,
        paymentTermsDays: normalizePositiveInt(mergedState.paymentTermsDays, initialState.paymentTermsDays),
        quoteValidityDays: normalizedValidityDays,
        scriveEnabled: Boolean(mergedState.scriveEnabled),
        scriveStatus: normalizeScriveStatus(mergedState.scriveStatus),
        scriveDocumentId: mergedState.scriveDocumentId ? String(mergedState.scriveDocumentId) : null,
        scriveSignerName: String(mergedState.scriveSignerName || customerInfoSource.name || ''),
        scriveSignerEmail: String(mergedState.scriveSignerEmail || customerInfoSource.email || ''),
        scriveLastError: mergedState.scriveLastError ? String(mergedState.scriveLastError) : null,
        scriveSentAtMs: mergedState.scriveSentAtMs == null ? null : toNumber(mergedState.scriveSentAtMs, null),
        scriveLastEventAtMs: mergedState.scriveLastEventAtMs == null ? null : toNumber(mergedState.scriveLastEventAtMs, null),
        scriveCompletedAtMs: mergedState.scriveCompletedAtMs == null ? null : toNumber(mergedState.scriveCompletedAtMs, null)
    };
}
