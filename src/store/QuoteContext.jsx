import React, { createContext, useContext, useReducer, useEffect } from 'react';
import {
    createInitialQuoteState,
    hydrateQuoteState
} from './quoteStateSchema.js';
import { loadPersistedQuoteState, persistQuoteState } from './quoteStatePersistence.js';

const QuoteContext = createContext();

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

const initialState = createInitialQuoteState();

export function quoteReducer(state, action) {
    switch (action.type) {
        case 'SET_STEP':
            return { ...state, step: action.payload };
        case 'HYDRATE_STATE':
            return hydrateQuoteState(action.payload);
        case 'UPDATE_STATE':
            return hydrateQuoteState({ ...state, ...action.payload });
        case 'SET_CUSTOMER_INFO':
        case 'UPDATE_CUSTOMER_INFO': {
            const incoming = action.payload || {};
            const mergedCustomer = { ...state.customerInfo, ...incoming };
            const hasValidityUpdate = Object.prototype.hasOwnProperty.call(incoming, 'validity');

            if (!hasValidityUpdate) {
                return { ...state, customerInfo: mergedCustomer };
            }

            const validityDays = parseValidityDays(mergedCustomer.validity) || state.quoteValidityDays || 30;
            return hydrateQuoteState({
                ...state,
                customerInfo: { ...mergedCustomer, validity: formatValidityLabel(validityDays) },
                quoteValidityDays: validityDays
            });
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
            return { ...state, termsTemplateId: action.payload || state.termsTemplateId };
        case 'SET_TERMS_CUSTOMIZED':
            return { ...state, termsCustomized: Boolean(action.payload) };
        case 'SET_INCLUDE_PAYMENT_BOX':
            return { ...state, includePaymentBox: Boolean(action.payload) };
        case 'SET_INCLUDE_SIGNATURE_BLOCK':
            return { ...state, includeSignatureBlock: Boolean(action.payload) };
        case 'SET_HIDE_ZERO_DISCOUNT_REFERENCES_IN_PDF':
            return { ...state, hideZeroDiscountReferencesInPdf: Boolean(action.payload) };
        case 'SET_PAYMENT_TERMS_DAYS':
            return hydrateQuoteState({ ...state, paymentTermsDays: normalizePositiveInt(action.payload, 30) });
        case 'SET_QUOTE_VALIDITY_DAYS':
            return hydrateQuoteState({
                ...state,
                quoteValidityDays: normalizePositiveInt(action.payload, 30)
            });
        case 'RESET_STATE':
            return createInitialQuoteState();
        default:
            return state;
    }
}

export function QuoteProvider({ children }) {
    const [state, dispatch] = useReducer(quoteReducer, initialState, () => loadPersistedQuoteState());

    useEffect(() => {
        persistQuoteState(state);
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
