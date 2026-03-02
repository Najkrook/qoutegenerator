import { DEFAULT_TEMPLATE_ID, getTemplateById, isLegalTemplateId } from '../features/legalTemplates.js';

const DEFAULT_TERMS_TEXT = getTemplateById(DEFAULT_TEMPLATE_ID).body;
const VALID_QUOTE_STATUSES = ['draft', 'sent', 'won', 'lost', 'archived'];

function normalizePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const state = {
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
        reference: '',
        date: '',
        validity: '30 dagar'
    },
    inventoryData: { bahama: [], clickitup: {} },
    cloudInventoryData: { bahama: [], clickitup: {} },
    inventoryBasket: [],
    activeQuoteId: null,
    activeQuoteVersion: 0,
    quoteStatus: 'draft',
    includeTerms: true,
    termsText: DEFAULT_TERMS_TEXT,
    termsTemplateId: DEFAULT_TEMPLATE_ID,
    termsCustomized: false,
    includeSignatureBlock: true,
    includePaymentBox: true,
    paymentTermsDays: 30,
    quoteValidityDays: 14
};

let saveDebounceMs = 750;
let saveTimer = null;
let persistenceInitialized = false;

export function saveState() {
    try {
        localStorage.setItem('offertverktyg_state', JSON.stringify(state));
    } catch (e) {
        // Silently fail if storage is full
    }
}

export function flushStateNow() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    saveState();
}

export function markStateDirty() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveState();
    }, saveDebounceMs);
}

export function initStatePersistence({ debounceMs = 750 } = {}) {
    saveDebounceMs = debounceMs;
    if (persistenceInitialized) return;

    window.addEventListener('beforeunload', () => {
        flushStateNow();
    });

    persistenceInitialized = true;
}

export function loadState() {
    try {
        const saved = localStorage.getItem('offertverktyg_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(state, parsed);
            if (!state.activeQuoteId) state.activeQuoteId = null;
            if (!Number.isFinite(Number(state.activeQuoteVersion))) state.activeQuoteVersion = 0;
            if (!VALID_QUOTE_STATUSES.includes(String(state.quoteStatus || '').toLowerCase())) {
                state.quoteStatus = 'draft';
            }
            if (typeof state.includeTerms !== 'boolean') state.includeTerms = true;
            if (typeof state.includeSignatureBlock !== 'boolean') state.includeSignatureBlock = true;
            if (typeof state.includePaymentBox !== 'boolean') state.includePaymentBox = true;
            state.paymentTermsDays = normalizePositiveInt(state.paymentTermsDays, 30);
            state.quoteValidityDays = normalizePositiveInt(state.quoteValidityDays, 14);

            const hasSavedTerms = typeof state.termsText === 'string' && state.termsText.trim().length > 0;
            if (!hasSavedTerms) {
                state.termsText = DEFAULT_TERMS_TEXT;
            }

            const parsedTemplateId = typeof parsed.termsTemplateId === 'string' ? parsed.termsTemplateId : '';
            const normalizedTemplate = isLegalTemplateId(state.termsTemplateId) ? state.termsTemplateId : DEFAULT_TEMPLATE_ID;
            state.termsTemplateId = normalizedTemplate;

            if (typeof parsed.termsCustomized === 'boolean') {
                state.termsCustomized = parsed.termsCustomized;
            } else if (!parsedTemplateId && hasSavedTerms) {
                state.termsCustomized = true;
            } else {
                const template = getTemplateById(state.termsTemplateId);
                state.termsCustomized = Boolean(template && state.termsText.trim() !== String(template.body || '').trim());
            }
        }
    } catch (e) {
        // Ignore parse errors
    }
}

export function clearState() {
    localStorage.removeItem('offertverktyg_state');
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    state.step = 0;
    state.selectedLines = [];
    state.builderItems = [];
    state.gridSelections = {};
    state.customCosts = [];
    state.includesVat = false;
    state.globalDiscountPct = 0;
    state.prevGlobalDiscountPct = 0;
    state.activeQuoteId = null;
    state.activeQuoteVersion = 0;
    state.quoteStatus = 'draft';
    state.includeTerms = true;
    state.termsText = DEFAULT_TERMS_TEXT;
    state.termsTemplateId = DEFAULT_TEMPLATE_ID;
    state.termsCustomized = false;
    state.includeSignatureBlock = true;
    state.includePaymentBox = true;
    state.paymentTermsDays = 30;
    state.quoteValidityDays = 14;
    location.reload();
}
