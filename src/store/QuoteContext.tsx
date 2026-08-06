import React, { createContext, useContext, useReducer, useEffect, useRef, type PropsWithChildren } from 'react';
import type { QuoteContextValue, QuoteReducerAction, QuoteState } from '../types/contracts';
import { AuthContext } from './AuthContext';
import {
    createInitialQuoteState,
    hydrateQuoteState
} from './quoteStateSchema';
import { loadPersistedQuoteState, persistQuoteState } from './quoteStatePersistence';
import {
    getDefaultTemplateIdForLanguage,
    getTemplateById,
    isBuiltinTemplateId
} from '../config/legalTemplates.shared';
import { normalizeExportLanguage } from '../services/exportLocalization';

export const QuoteContext = createContext<QuoteContextValue | undefined>(undefined);

function normalizePositiveInt(value: unknown, fallback: number) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseValidityDays(value: unknown): number | null {
    const match = String(value ?? '').match(/(\d+)/);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatValidityLabel(days: number) {
    return `${days} dagar`;
}

const NON_QUOTE_UPDATE_KEYS = new Set<keyof QuoteState>([
    'stateVersion',
    'draftUpdatedAtMs',
    'inventoryData',
    'cloudInventoryData',
    'inventoryBasket',
    'sketchDraft',
    'advancedSketchDraft'
]);

function markQuoteDraftUpdated(state: QuoteState): QuoteState {
    return {
        ...state,
        draftUpdatedAtMs: Date.now()
    };
}

function patchChangesQuoteDraft(payload: Partial<QuoteState>): boolean {
    return Object.keys(payload).some((key) => !NON_QUOTE_UPDATE_KEYS.has(key as keyof QuoteState));
}

function applyExportLanguage(state: QuoteState, rawLanguage: unknown): QuoteState {
    const exportLanguage = normalizeExportLanguage(rawLanguage);
    const nextState = { ...state, exportLanguage };

    if (!state.termsCustomized && isBuiltinTemplateId(state.termsTemplateId)) {
        const template = getTemplateById(getDefaultTemplateIdForLanguage(exportLanguage));
        return {
            ...nextState,
            termsTemplateId: template.id,
            termsText: template.body
        };
    }

    return nextState;
}

export function quoteReducer(state: QuoteState, action: QuoteReducerAction): QuoteState {
    switch (action.type) {
        case 'SET_STEP':
            return { ...state, step: action.payload };
        case 'HYDRATE_STATE':
            return hydrateQuoteState(action.payload);
        case 'UPDATE_STATE': {
            const nextState = hydrateQuoteState({ ...state, ...action.payload });
            return patchChangesQuoteDraft(action.payload)
                ? markQuoteDraftUpdated(nextState)
                : nextState;
        }
        case 'SET_CUSTOMER_INFO':
        case 'UPDATE_CUSTOMER_INFO': {
            const incoming = action.payload || {};
            const mergedCustomer = { ...state.customerInfo, ...incoming };
            const hasValidityUpdate = Object.prototype.hasOwnProperty.call(incoming, 'validity');

            if (!hasValidityUpdate) {
                return markQuoteDraftUpdated({ ...state, customerInfo: mergedCustomer });
            }

            const validityDays = parseValidityDays(mergedCustomer.validity) || state.quoteValidityDays || 30;
            return markQuoteDraftUpdated(hydrateQuoteState({
                ...state,
                customerInfo: { ...mergedCustomer, validity: formatValidityLabel(validityDays) },
                quoteValidityDays: validityDays
            }));
        }
        case 'SET_INCLUDES_VAT':
            return markQuoteDraftUpdated({ ...state, includesVat: Boolean(action.payload) });
        case 'SET_GLOBAL_DISCOUNT':
            return markQuoteDraftUpdated({
                ...state,
                globalDiscountPct: action.payload,
                prevGlobalDiscountPct: action.payload
            });
        case 'SET_EXCHANGE_RATE':
            return markQuoteDraftUpdated({ ...state, exchangeRate: action.payload });
        case 'SET_SELECTED_LINES':
            return markQuoteDraftUpdated({ ...state, selectedLines: action.payload });
        case 'SET_BUILDER_ITEMS':
            return markQuoteDraftUpdated({ ...state, builderItems: action.payload });
        case 'SET_GRID_SELECTIONS':
            return markQuoteDraftUpdated({ ...state, gridSelections: action.payload });
        case 'SET_CUSTOM_COSTS':
            return markQuoteDraftUpdated({ ...state, customCosts: action.payload });
        case 'SET_CONTRACTING_WORK':
            return markQuoteDraftUpdated(hydrateQuoteState({ ...state, contractingWork: action.payload }));
        case 'SET_INVENTORY_DATA':
            return { ...state, inventoryData: action.payload };
        case 'SET_CLOUD_INVENTORY_DATA':
            return { ...state, cloudInventoryData: action.payload };
        case 'SET_INVENTORY_BASKET':
            return { ...state, inventoryBasket: action.payload };
        case 'SET_INCLUDE_TERMS':
            return markQuoteDraftUpdated({ ...state, includeTerms: Boolean(action.payload) });
        case 'SET_TERMS_TEXT':
            return markQuoteDraftUpdated({ ...state, termsText: String(action.payload ?? '') });
        case 'SET_TERMS_TEMPLATE_ID':
            return markQuoteDraftUpdated({
                ...state,
                termsTemplateId: action.payload || state.termsTemplateId
            });
        case 'SET_TERMS_CUSTOMIZED':
            return markQuoteDraftUpdated({ ...state, termsCustomized: Boolean(action.payload) });
        case 'SET_INCLUDE_PAYMENT_BOX':
            return markQuoteDraftUpdated({ ...state, includePaymentBox: Boolean(action.payload) });
        case 'SET_INCLUDE_SIGNATURE_BLOCK':
            return markQuoteDraftUpdated({ ...state, includeSignatureBlock: Boolean(action.payload) });
        case 'SET_HIDE_ZERO_DISCOUNT_REFERENCES_IN_PDF':
            return markQuoteDraftUpdated({
                ...state,
                hideZeroDiscountReferencesInPdf: Boolean(action.payload)
            });
        case 'SET_PDF_THEME_ID':
            return markQuoteDraftUpdated(hydrateQuoteState({ ...state, pdfThemeId: action.payload }));
        case 'SET_EXPORT_LANGUAGE':
            return markQuoteDraftUpdated(applyExportLanguage(state, action.payload));
        case 'SET_PAYMENT_TERMS_DAYS':
            return markQuoteDraftUpdated(hydrateQuoteState({
                ...state,
                paymentTermsDays: normalizePositiveInt(action.payload, 30)
            }));
        case 'SET_QUOTE_VALIDITY_DAYS':
            return markQuoteDraftUpdated(hydrateQuoteState({
                ...state,
                quoteValidityDays: normalizePositiveInt(action.payload, 30)
            }));
        case 'RESET_QUOTE_DRAFT': {
            const resetState = createInitialQuoteState();
            return hydrateQuoteState({
                ...resetState,
                inventoryData: state.inventoryData,
                cloudInventoryData: state.cloudInventoryData,
                inventoryBasket: state.inventoryBasket,
                sketchDraft: state.sketchDraft,
                advancedSketchDraft: state.advancedSketchDraft
            });
        }
        case 'RESET_STATE':
            return createInitialQuoteState();
        default:
            return state;
    }
}

interface UserQuoteStateProviderProps extends PropsWithChildren {
    ownerUid: string | null;
}

function UserQuoteStateProvider({ children, ownerUid }: UserQuoteStateProviderProps) {
    const [state, dispatch] = useReducer(
        quoteReducer,
        ownerUid,
        (initialOwnerUid) => loadPersistedQuoteState(initialOwnerUid)
    );
    const latestStateRef = useRef(state);
    latestStateRef.current = state;

    useEffect(() => {
        const timeoutId = globalThis.setTimeout(() => {
            persistQuoteState(state, ownerUid);
        }, 250);

        return () => {
            globalThis.clearTimeout(timeoutId);
        };
    }, [ownerUid, state]);

    useEffect(() => () => {
        persistQuoteState(latestStateRef.current, ownerUid);
    }, [ownerUid]);

    return (
        <QuoteContext.Provider value={{ state, dispatch }}>
            {children}
        </QuoteContext.Provider>
    );
}

interface QuoteProviderProps extends PropsWithChildren {
    ownerUid?: string | null;
}

export function QuoteProvider({ children, ownerUid: ownerUidProp }: QuoteProviderProps) {
    const authContext = useContext(AuthContext);
    const ownerUid = ownerUidProp === undefined
        ? authContext?.user?.uid || null
        : ownerUidProp;

    return (
        <UserQuoteStateProvider key={ownerUid || 'guest'} ownerUid={ownerUid}>
            {children}
        </UserQuoteStateProvider>
    );
}

export function useQuote(): QuoteContextValue {
    const context = useContext(QuoteContext);
    if (!context) {
        throw new Error('useQuote must be used within a QuoteProvider');
    }
    return context;
}
