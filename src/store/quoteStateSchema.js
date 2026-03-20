import { DEFAULT_TEMPLATE_ID, isBuiltinTemplateId, getTemplateById } from '../config/legalTemplates.shared.js';

export const QUOTE_STATE_STORAGE_KEY = 'offertverktyg_state';
export const CURRENT_STATE_VERSION = 1;

const VALID_QUOTE_STATUSES = ['draft', 'sent', 'won', 'lost', 'archived'];
const VALID_SCRIVE_STATUSES = ['not_sent', 'preparation', 'pending', 'closed', 'rejected', 'canceled', 'timedout', 'failed'];

function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInt(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseValidityDays(value) {
    const match = String(value ?? '').match(/(\d+)/);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatValidityLabel(days) {
    return `${days} dagar`;
}

function normalizeQuoteStatus(status) {
    const normalized = String(status || '').toLowerCase();
    return VALID_QUOTE_STATUSES.includes(normalized) ? normalized : 'draft';
}

function normalizeScriveStatus(status) {
    const normalized = String(status || '').toLowerCase();
    return VALID_SCRIVE_STATUSES.includes(normalized) ? normalized : 'not_sent';
}

function normalizeStep(step, fallback = 0) {
    if (typeof step === 'number' && Number.isFinite(step)) return step;
    if (typeof step === 'string' && step.trim()) return step;
    return fallback;
}

function normalizeInventoryData(value) {
    if (!isObject(value)) {
        return { bahama: [], clickitup: {} };
    }

    return {
        bahama: Array.isArray(value.bahama) ? clone(value.bahama) : [],
        clickitup: isObject(value.clickitup) ? clone(value.clickitup) : {}
    };
}

function normalizeGridCustomAddonsByCategory(value) {
    if (!isObject(value)) {
        return {};
    }

    return Object.entries(value).reduce((acc, [categoryId, rows]) => {
        acc[categoryId] = Array.isArray(rows)
            ? rows.map((row, index) => {
                const safeRow = isObject(row) ? row : {};
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

function normalizeGridSelections(value) {
    if (!isObject(value)) {
        return {};
    }

    return Object.entries(value).reduce((acc, [lineId, lineSelection]) => {
        if (!isObject(lineSelection)) {
            acc[lineId] = { items: {}, addons: {}, customAddonsByCategory: {} };
            return acc;
        }

        acc[lineId] = {
            ...clone(lineSelection),
            items: isObject(lineSelection.items) ? clone(lineSelection.items) : {},
            addons: isObject(lineSelection.addons) ? clone(lineSelection.addons) : {},
            customAddonsByCategory: normalizeGridCustomAddonsByCategory(lineSelection.customAddonsByCategory)
        };
        return acc;
    }, {});
}

function createBaseInitialState() {
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
            validity: '30 dagar'
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

export function createInitialQuoteState() {
    return clone(createBaseInitialState());
}

function migrateV0ToV1(rawState = {}) {
    const next = isObject(rawState) ? { ...rawState } : {};
    const customerInfo = isObject(next.customerInfo) ? { ...next.customerInfo } : {};
    const validityFromCustomer = parseValidityDays(customerInfo.validity);
    const inventoryData = normalizeInventoryData(next.inventoryData);
    const cloudInventoryData = Object.prototype.hasOwnProperty.call(next, 'cloudInventoryData')
        ? normalizeInventoryData(next.cloudInventoryData)
        : clone(inventoryData);

    return {
        ...next,
        stateVersion: 1,
        step: normalizeStep(next.step, 0),
        selectedLines: Array.isArray(next.selectedLines) ? clone(next.selectedLines) : [],
        builderItems: Array.isArray(next.builderItems) ? clone(next.builderItems) : [],
        gridSelections: normalizeGridSelections(next.gridSelections),
        customCosts: Array.isArray(next.customCosts) ? clone(next.customCosts) : [],
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
            validity: String(customerInfo.validity || formatValidityLabel(normalizePositiveInt(next.quoteValidityDays, validityFromCustomer || 30)))
        },
        inventoryData,
        cloudInventoryData,
        sketchDraft: Object.prototype.hasOwnProperty.call(next, 'sketchDraft') ? clone(next.sketchDraft) : null,
        sketchMeta: isObject(next.sketchMeta) ? clone(next.sketchMeta) : { addedBahamaLine: false, addedFiestaLine: false },
        inventoryBasket: Array.isArray(next.inventoryBasket) ? clone(next.inventoryBasket) : [],
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

export function migrateQuoteState(fromVersion, rawState) {
    let version = Number.isFinite(Number(fromVersion)) ? Number(fromVersion) : 0;
    let nextState = isObject(rawState) ? clone(rawState) : {};

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

export function hydrateQuoteState(input) {
    const initialState = createInitialQuoteState();
    if (!isObject(input)) {
        return initialState;
    }

    const rawState = clone(input);
    const rawVersion = Object.prototype.hasOwnProperty.call(rawState, 'stateVersion')
        ? Number(rawState.stateVersion)
        : 0;

    let migratedState = rawState;
    if (rawVersion > CURRENT_STATE_VERSION) {
        console.warn(
            `Quote state version ${rawVersion} is newer than supported version ${CURRENT_STATE_VERSION}. Conservatively hydrating known fields.`
        );
    } else {
        migratedState = migrateQuoteState(rawVersion, rawState);
    }

    const mergedState = { ...initialState, ...migratedState };
    const customerInfoSource = isObject(mergedState.customerInfo) ? mergedState.customerInfo : {};
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

    return {
        ...mergedState,
        stateVersion: CURRENT_STATE_VERSION,
        step: normalizeStep(mergedState.step, initialState.step),
        selectedLines: Array.isArray(mergedState.selectedLines) ? clone(mergedState.selectedLines) : [],
        builderItems: Array.isArray(mergedState.builderItems) ? clone(mergedState.builderItems) : [],
        gridSelections: normalizeGridSelections(mergedState.gridSelections),
        customCosts: Array.isArray(mergedState.customCosts) ? clone(mergedState.customCosts) : [],
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
            validity: formatValidityLabel(normalizedValidityDays)
        },
        inventoryData,
        cloudInventoryData,
        sketchDraft: Object.prototype.hasOwnProperty.call(mergedState, 'sketchDraft')
            ? clone(mergedState.sketchDraft)
            : initialState.sketchDraft,
        sketchMeta: {
            ...initialState.sketchMeta,
            ...(isObject(mergedState.sketchMeta) ? clone(mergedState.sketchMeta) : {}),
            addedBahamaLine: Boolean(mergedState?.sketchMeta?.addedBahamaLine),
            addedFiestaLine: Boolean(mergedState?.sketchMeta?.addedFiestaLine)
        },
        inventoryBasket: Array.isArray(mergedState.inventoryBasket) ? clone(mergedState.inventoryBasket) : [],
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
