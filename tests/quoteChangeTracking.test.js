import { describe, expect, it } from 'vitest';
import { quoteWorkspaceReducer } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';
import { hasUnsavedQuoteChanges, quoteContentSignature } from '../src/store/quoteChangeTracking';
import { loadPersistedQuoteWorkspace, persistQuoteState, getQuoteStateStorageKey } from '../src/store/quoteStatePersistence';

const initial = () => ({ state: createInitialQuoteState(), savedSignature: null, generation: 0 });
const dirty = (workspace) => hasUnsavedQuoteChanges(workspace.state, workspace.savedSignature);
const edit = (workspace, company) => quoteWorkspaceReducer(workspace, { type: 'UPDATE_CUSTOMER_INFO', payload: { company } });
const receipt = (workspace, version = 1) => ({ type: 'QUOTE_SAVED', payload: {
    generation: workspace.generation,
    savedSignature: quoteContentSignature(workspace.state),
    statePatch: { activeQuoteId: 'quote-1', activeQuoteVersion: version, quoteNumber: 'BRIXX-1', quoteStatus: 'draft' }
} });

function storageMock() {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

describe('quote change tracking', () => {
    it('marks edits and becomes clean when edits are reverted', () => {
        const empty = initial();
        expect(dirty(empty)).toBe(false);
        const edited = edit(empty, 'Kund AB');
        expect(dirty(edited)).toBe(true);
        const saved = quoteWorkspaceReducer(edited, receipt(edited));
        expect(dirty(saved)).toBe(false);
        expect(dirty(edit(saved, 'Annan kund'))).toBe(true);
        expect(dirty(edit(edit(saved, 'Annan kund'), 'Kund AB'))).toBe(false);
    });

    it('ignores navigation, inventory, sketch drafts and identity metadata', () => {
        const empty = initial();
        const state = { ...empty.state, step: 4, draftUpdatedAtMs: 123, quoteStatus: 'sent',
            activeQuoteVersion: 3, prevGlobalDiscountPct: 10, inventoryBasket: [{ id: 'item' }],
            sketchDraft: { arbitrary: 'draft' }, cloudInventoryData: { stock: 42 } };
        expect(quoteContentSignature(state)).toBe(quoteContentSignature(empty.state));
    });

    it.each([
        { pdfThemeId: 'minimal' }, { exportLanguage: 'en' }, { globalDiscountPct: 12 },
        { includesVat: true }, { termsText: 'New terms' }, { paymentTermsDays: 60 },
        { selectedLines: ['BaHaMa'] }, { customCosts: [{ description: 'Frakt', price: 100, qty: 1 }] }
    ])('tracks quote content %j', patch => {
        const empty = initial();
        expect(quoteContentSignature({ ...empty.state, ...patch })).not.toBe(quoteContentSignature(empty.state));
    });

    it('opens saved revisions cleanly but treats duplicates as new drafts', () => {
        const draft = edit(initial(), 'Kund AB');
        const saved = quoteWorkspaceReducer(draft, { type: 'HYDRATE_STATE', payload: { ...draft.state, activeQuoteId: 'quote-1' } });
        expect(dirty(saved)).toBe(false);
        const duplicate = quoteWorkspaceReducer(saved, { type: 'HYDRATE_STATE', payload: { ...saved.state, activeQuoteId: null } });
        expect(dirty(duplicate)).toBe(true);
    });

    it('preserves changes made during saving and ignores responses after reset or reopening', () => {
        const draft = edit(initial(), 'Saved customer');
        const pending = receipt(draft);
        const changed = quoteWorkspaceReducer(edit(draft, 'New customer'), pending);
        expect(changed.state.customerInfo.company).toBe('New customer');
        expect(dirty(changed)).toBe(true);
        expect(dirty(edit(changed, 'Saved customer'))).toBe(false);
        for (const action of [{ type: 'RESET_QUOTE_DRAFT' }, { type: 'HYDRATE_STATE', payload: draft.state }]) {
            const replaced = quoteWorkspaceReducer(draft, action);
            expect(quoteWorkspaceReducer(replaced, pending)).toBe(replaced);
        }
        const newer = quoteWorkspaceReducer(draft, receipt(draft, 3));
        expect(quoteWorkspaceReducer(newer, pending)).toBe(newer);
    });

    it('persists the baseline separately, keeps dirty drafts dirty, and isolates users', () => {
        const storage = storageMock();
        const draft = edit(initial(), 'Kund AB');
        const saved = quoteWorkspaceReducer(draft, receipt(draft));
        persistQuoteState(saved.state, 'a', storage, saved.savedSignature);
        expect(dirty(loadPersistedQuoteWorkspace('a', storage))).toBe(false);
        const edited = edit(saved, 'Updated');
        persistQuoteState(edited.state, 'a', storage, edited.savedSignature);
        expect(dirty(loadPersistedQuoteWorkspace('a', storage))).toBe(true);
        expect(dirty(loadPersistedQuoteWorkspace('b', storage))).toBe(false);
        const envelope = JSON.parse(storage.getItem(getQuoteStateStorageKey('a')));
        expect(envelope.workspaceVersion).toBe(1);
        expect(envelope.state).not.toHaveProperty('savedSignature');
        storage.setItem(getQuoteStateStorageKey('a'), JSON.stringify(saved.state));
        expect(dirty(loadPersistedQuoteWorkspace('a', storage))).toBe(true);
    });
});
