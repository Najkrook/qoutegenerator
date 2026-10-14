import type { QuoteState } from '../types/contracts';
import { createInitialQuoteState } from './quoteStateSchema';

const EXCLUDED_KEYS = new Set<keyof QuoteState>([
    'stateVersion', 'step', 'draftUpdatedAtMs', 'activeQuoteId', 'activeQuoteVersion',
    'quoteNumber', 'quoteStatus', 'inventoryData', 'cloudInventoryData',
    'inventoryBasket', 'sketchDraft', 'advancedSketchDraft', 'sketchMeta', 'prevGlobalDiscountPct'
]);

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
            .map(([key, entry]) => [key, canonicalize(entry)]));
    }
    return value;
}

/** Compare editable quote content, never navigation or workspace-only data. */
export function quoteContentSignature(state: QuoteState): string {
    return JSON.stringify(canonicalize(Object.fromEntries(
        Object.entries(state).filter(([key]) => !EXCLUDED_KEYS.has(key as keyof QuoteState))
    )));
}

export function hasUnsavedQuoteChanges(state: QuoteState, savedSignature: string | null): boolean {
    if (savedSignature !== null) return quoteContentSignature(state) !== savedSignature;
    // Legacy drafts have no trustworthy saved baseline.
    return Boolean(state.activeQuoteId || state.quoteNumber)
        || quoteContentSignature(state) !== quoteContentSignature(createInitialQuoteState());
}
