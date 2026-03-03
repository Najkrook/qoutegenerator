import React, { createContext, useContext, useReducer, useEffect } from 'react';

const QuoteContext = createContext();

const STORAGE_KEY = 'offertverktyg_state';

const initialState = {
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
    termsText: '', // Will be initialized from templates or storage
    termsTemplateId: 'default',
    termsCustomized: false,
    includeSignatureBlock: true,
    includePaymentBox: true,
    paymentTermsDays: 30,
    quoteValidityDays: 14,
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

function quoteReducer(state, action) {
    switch (action.type) {
        case 'SET_STEP':
            return { ...state, step: action.payload };
        case 'UPDATE_STATE':
            return { ...state, ...action.payload };
        case 'UPDATE_CUSTOMER_INFO':
            return { ...state, customerInfo: { ...state.customerInfo, ...action.payload } };
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
                return { ...initial, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error("Failed to load state from localStorage", e);
        }
        return initial;
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error("Failed to save state to localStorage", e);
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
