import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { DEFAULT_TEMPLATE_ID, isBuiltinTemplateId, getTemplateById } from '../../config/legalTemplates.shared.js';

const QuoteContext = createContext();

const STORAGE_KEY = 'offertverktyg_state';

function normalizePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function normalizePdfOptions(state) {
    // Accept any template ID (built-in or custom Firestore ID) — fallback to default if empty
    const safeTemplateId = state.termsTemplateId || DEFAULT_TEMPLATE_ID;
    const template = isBuiltinTemplateId(safeTemplateId) ? getTemplateById(safeTemplateId) : null;

    const customerInfoSource = state.customerInfo || {};
    const validityFromCustomer = parseValidityDays(customerInfoSource.validity);
    const normalizedValidityDays = normalizePositiveInt(
        state.quoteValidityDays,
        validityFromCustomer || 30
    );

    return {
        ...state,
        customerInfo: {
            ...customerInfoSource,
            validity: formatValidityLabel(normalizedValidityDays)
        },
        includeTerms: state.includeTerms !== false,
        termsTemplateId: safeTemplateId,
        termsText: typeof state.termsText === 'string' && state.termsText.trim().length > 0
            ? state.termsText
            : (template?.body || ''),
        termsCustomized: typeof state.termsCustomized === 'boolean' ? state.termsCustomized : false,
        includeSignatureBlock: state.includeSignatureBlock === true,
        includePaymentBox: state.includePaymentBox === true,
        paymentTermsDays: normalizePositiveInt(state.paymentTermsDays, 30),
        quoteValidityDays: normalizedValidityDays
    };
}

const initialState = normalizePdfOptions({
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
    termsText: '',
    termsTemplateId: DEFAULT_TEMPLATE_ID,
    termsCustomized: false,
    includeSignatureBlock: false,
    includePaymentBox: false,
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
});

function quoteReducer(state, action) {
    switch (action.type) {
        case 'SET_STEP':
            return { ...state, step: action.payload };
        case 'UPDATE_STATE':
            return normalizePdfOptions({ ...state, ...action.payload });
        case 'SET_CUSTOMER_INFO':
        case 'UPDATE_CUSTOMER_INFO': {
            const incoming = action.payload || {};
            const mergedCustomer = { ...state.customerInfo, ...incoming };
            const hasValidityUpdate = Object.prototype.hasOwnProperty.call(incoming, 'validity');

            if (!hasValidityUpdate) {
                return { ...state, customerInfo: mergedCustomer };
            }

            const validityDays = parseValidityDays(mergedCustomer.validity) || state.quoteValidityDays || 30;
            return {
                ...state,
                customerInfo: { ...mergedCustomer, validity: formatValidityLabel(validityDays) },
                quoteValidityDays: validityDays
            };
        }
        case 'SET_INCLUDES_VAT':
            return { ...state, includesVat: Boolean(action.payload) };
        case 'SET_GLOBAL_DISCOUNT':
            return { ...state, globalDiscountPct: action.payload, prevGlobalDiscountPct: action.payload };
        case 'SET_EXCHANGE_RATE':
            return { ...state, exchangeRate: action.payload };
        case 'SET_SELECTED_LINES':
            return { ...state, selectedLines: action.payload };
        case 'SET_BUILDER_ITEMS':
            return { ...state, builderItems: action.payload };
        case 'SET_GRID_SELECTIONS':
            return { ...state, gridSelections: action.payload };
        case 'SET_CUSTOM_COSTS':
            return { ...state, customCosts: action.payload };
        case 'SET_INVENTORY_DATA':
            return { ...state, inventoryData: action.payload };
        case 'SET_CLOUD_INVENTORY_DATA':
            return { ...state, cloudInventoryData: action.payload };
        case 'SET_INVENTORY_BASKET':
            return { ...state, inventoryBasket: action.payload };
        case 'SET_INCLUDE_TERMS':
            return { ...state, includeTerms: Boolean(action.payload) };
        case 'SET_TERMS_TEXT':
            return { ...state, termsText: String(action.payload ?? '') };
        case 'SET_TERMS_TEMPLATE_ID':
            return {
                ...state,
                termsTemplateId: action.payload || DEFAULT_TEMPLATE_ID
            };
        case 'SET_TERMS_CUSTOMIZED':
            return { ...state, termsCustomized: Boolean(action.payload) };
        case 'SET_INCLUDE_PAYMENT_BOX':
            return { ...state, includePaymentBox: Boolean(action.payload) };
        case 'SET_INCLUDE_SIGNATURE_BLOCK':
            return { ...state, includeSignatureBlock: Boolean(action.payload) };
        case 'SET_PAYMENT_TERMS_DAYS':
            return { ...state, paymentTermsDays: normalizePositiveInt(action.payload, 30) };
        case 'SET_QUOTE_VALIDITY_DAYS': {
            const validityDays = normalizePositiveInt(action.payload, 30);
            return {
                ...state,
                quoteValidityDays: validityDays,
                customerInfo: {
                    ...state.customerInfo,
                    validity: formatValidityLabel(validityDays)
                }
            };
        }
        case 'RESET_STATE':
            return JSON.parse(JSON.stringify(initialState));
        default:
            return state;
    }
}

export function QuoteProvider({ children }) {
    const [state, dispatch] = useReducer(quoteReducer, initialState, (initial) => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return normalizePdfOptions({ ...initial, ...JSON.parse(saved) });
            }
        } catch (e) {
            console.error('Failed to load state from localStorage', e);
        }
        return initial;
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save state to localStorage', e);
        }
    }, [state]);

    return (
        <QuoteContext.Provider value={{ state, dispatch }}>
            {children}
        </QuoteContext.Provider>
    );
}

export function useQuote() {
    const context = useContext(QuoteContext);
    if (!context) {
        throw new Error('useQuote must be used within a QuoteProvider');
    }
    return context;
}
