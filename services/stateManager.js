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
    termsText: `BETALNINGSVILLKOR
- Betalning sker mot faktura med 30 dagars netto.
- Vid forsenad betalning debiteras drojsmalsranta enligt rantelagen.

LEVERANS
- Leveranstid ca 4-6 veckor efter orderbekraftelse.
- Fraktkostnad tillkommer enligt offert.
- Leverans sker fritt vart lager om ej annat anges.

GARANTI & REKLAMATION
- Garanti enligt gallande konsumentkoplag.
- Reklamation ska ske skriftligt senast 14 dagar efter leverans.

MONTERING
- Montering ingar ej om ej annat avtalats.
- Vid montering av BRIXX ansvarar kunden for att underlaget ar plant och stabilt.

OVRIGT
- Alla priser ar exklusive moms om ej annat anges.
- Offerten ar giltig enligt angiven giltighetstid.
- BRIXX Europe AB forbehaller sig ratten till prisandringar och tryckfel.`
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
            const validStatuses = ['draft', 'sent', 'won', 'lost', 'archived'];
            if (!validStatuses.includes(String(state.quoteStatus || '').toLowerCase())) {
                state.quoteStatus = 'draft';
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
    location.reload();
}
