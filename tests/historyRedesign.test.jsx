// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
    auth: {},
    repository: {
        getUserQuotes: vi.fn(), getAllUsersQuotes: vi.fn(), getQuoteRevisions: vi.fn(),
        getQuoteLatestRevision: vi.fn(), updateQuoteStatus: vi.fn(), deleteQuote: vi.fn()
    },
    confirm: vi.fn(), success: vi.fn(), error: vi.fn(), repair: vi.fn(), sync: vi.fn(), getDocs: vi.fn()
}));
vi.mock('../src/store/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../src/services/quoteRepositoryClient', () => ({ quoteRepository: mocks.repository }));
vi.mock('../src/services/firebase', () => ({ db: {}, collection: vi.fn(), getDocs: mocks.getDocs }));
vi.mock('../src/components/features/QuotePdfPreview', () => ({ QuotePdfPreview: () => null }));
vi.mock('../src/services/notificationService', () => ({
    confirmAction: mocks.confirm, notifySuccess: mocks.success, notifyError: mocks.error, notifyInfo: vi.fn(), notifyWarn: vi.fn()
}));
vi.mock('../src/services/quoteSaveService', () => ({ quoteSave: { repairCrm: mocks.repair } }));
vi.mock('../src/services/crmQuoteWorkflow', () => ({ syncCrmDealFromQuote: mocks.sync }));
import { History } from '../src/views/History';

const now = Date.now();
const row = (id, overrides = {}) => ({
    quoteId: id, ownerUid: 'user-1', quoteNumber: `BRIXX-${id}`, reference: `Projekt ${id}`,
    company: 'Hotell Mossbylund', customerName: 'Anna', customerReference: 'Kundreferens',
    updatedAtMs: now, latestVersion: 3, totalSek: 1000, status: 'draft', searchText: '',
    savedBy: 'owner@example.com', originType: 'internal', ...overrides
});
const revision = (overrides = {}) => ({ revisionId: 'r1', version: 1, savedAtMs: now, state: { customerInfo: { name: 'Anna' } }, changeNote: 'Första versionen', ...overrides });
function mount(props = {}) {
    return render(<MemoryRouter><History {...props} /></MemoryRouter>);
}
async function ready(title = 'Projekt 1') { return screen.findByRole('article', { name: title }); }
function tile(label) { return within(screen.getByLabelText('Offertöversikt')).getByRole('button', { name: new RegExp(`^${label}`) }); }
function change(label, value) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
function deferred() { let resolve; let reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth = { user: { uid: 'user-1', email: 'me@example.com' }, canAccessQuoteHistory: true, canStartQuote: true, canViewEverything: false };
    mocks.repository.getUserQuotes.mockResolvedValue([row('1')]);
    mocks.repository.getAllUsersQuotes.mockResolvedValue([]);
    mocks.repository.getQuoteRevisions.mockResolvedValue([revision()]);
    mocks.repository.getQuoteLatestRevision.mockResolvedValue({ metadata: row('1'), revision: revision() });
    mocks.repository.updateQuoteStatus.mockImplementation(async ({ status, userId, quoteId }) => row(quoteId, { ownerUid: userId, status }));
    mocks.confirm.mockResolvedValue(true);
    mocks.repair.mockResolvedValue({ status: 'repaired' });
    mocks.getDocs.mockResolvedValue({ forEach() {} });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete window.FEATURE_QUOTE_LIFECYCLE; });

describe('Offerter redesign', () => {
    it('shows compact project headings, all status totals, and keeps layout and filters across view switches', async () => {
        mocks.repository.getUserQuotes.mockResolvedValue([
            row('1'), row('2', { status: 'sent', totalSek: 2000 }), row('3', { status: 'won', totalSek: 3000 }),
            row('4', { status: 'lost', totalSek: 4000 }), row('5', { status: 'archived', totalSek: 5000 })
        ]);
        mount(); await ready();
        expect(screen.getAllByRole('article')).toHaveLength(5);
        expect(tile('Alla offerter').textContent.replace(/\s/g, '')).toContain('15000SEK');
        fireEvent.click(tile('Skickade'));
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getByLabelText('Filtrera status').value).toBe('sent');
        expect(tile('Alla offerter').textContent).toContain('(5)');
        fireEvent.click(screen.getByRole('button', { name: 'Tabellvy' }));
        expect(screen.getByRole('table').textContent).toContain('Projekt 2');
        expect(screen.getByRole('table').textContent).not.toContain('Projekt 1');
        change('Filtrera status', 'archived');
        expect(screen.getByRole('table').textContent).toContain('Projekt 5');
        expect(screen.getByRole('button', { name: 'Tabellvy' }).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: 'Kortvy' }));
        expect(screen.getByRole('article').textContent).toContain('Projekt 5');
        expect(mocks.repository.getUserQuotes).toHaveBeenCalledTimes(1);
    });

    it('combines search, date and sorting locally while overview ignores only the status filter', async () => {
        mocks.repository.getUserQuotes.mockResolvedValue([
            row('1', { totalSek: 100 }), row('2', { totalSek: 900, status: 'sent' }),
            row('3', { totalSek: 800, updatedAtMs: now - 40 * 86400000 }), row('4', { company: 'Annat företag' })
        ]);
        mount(); await ready();
        change('Sök företag eller referens', 'mossbylund'); change('Datum', '7days'); change('Sortering', 'highest-value');
        expect(screen.getAllByRole('article').map((node) => node.getAttribute('aria-label'))).toEqual(['Projekt 2', 'Projekt 1']);
        expect(tile('Alla offerter').textContent.replace(/\s/g, '')).toContain('1000SEK');
        fireEvent.click(tile('Utkast'));
        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(tile('Skickade').textContent).toContain('(1)');
        change('Sök företag eller referens', 'ingen träff');
        expect(screen.getByText('Inga offerter matchar filtret')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Rensa filter' }));
        expect(screen.getAllByRole('article')).toHaveLength(4);
        expect(mocks.repository.getUserQuotes).toHaveBeenCalledTimes(1);
    });

    it('distinguishes an empty collection and retries a failed load', async () => {
        mocks.repository.getUserQuotes.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([]);
        mount();
        expect((await screen.findByRole('alert')).textContent).toContain('Offline');
        fireEvent.click(screen.getByRole('button', { name: 'Försök igen' }));
        expect(await screen.findByText('Inga sparade offerter')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Rensa filter' })).toBeNull();
    });

    it('uses title fallbacks and starts a quote only when allowed', async () => {
        const start = vi.fn();
        mocks.repository.getUserQuotes.mockResolvedValue([row('1', { reference: '' }), row('2', { reference: '', quoteNumber: null, company: 'Kund utan referens' })]);
        const view = mount({ onStartQuote: start });
        await ready('BRIXX-1');
        expect(screen.getByRole('heading', { name: 'Kund utan referens' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Ny offert' })); expect(start).toHaveBeenCalledOnce();
        mocks.auth.canStartQuote = false;
        view.rerender(<MemoryRouter><History onStartQuote={start} /></MemoryRouter>);
        expect(screen.queryByRole('button', { name: 'Ny offert' })).toBeNull();
    });

    it('provides a portalled keyboard menu with dismissal, focus return and duplication', async () => {
        const onOpenQuote = vi.fn();
        const view = mount({ onOpenQuote }); const article = await ready();
        const trigger = within(article).getByRole('button', { name: 'Fler åtgärder' });
        fireEvent.click(trigger);
        const menu = screen.getByRole('menu');
        expect(view.container.contains(menu)).toBe(false);
        expect(document.activeElement.textContent).toBe('Duplicera');
        fireEvent.keyDown(menu, { key: 'End' }); expect(document.activeElement.textContent).toBe('Ta bort');
        fireEvent.keyDown(menu, { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull(); expect(document.activeElement).toBe(trigger);
        fireEvent.click(trigger); fireEvent.pointerDown(document.body); expect(screen.queryByRole('menu')).toBeNull();
        fireEvent.click(trigger); fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicera' }));
        await waitFor(() => expect(onOpenQuote).toHaveBeenCalledWith(expect.objectContaining({ activeQuoteId: null, activeQuoteVersion: 1, quoteNumber: null, quoteStatus: 'draft' })));
    });

    it.each(['cards', 'table'])('keeps revision open, preview and version links accessible in %s', async (layout) => {
        const onOpenQuote = vi.fn(); mount({ onOpenQuote }); await ready();
        if (layout === 'table') fireEvent.click(screen.getByRole('button', { name: 'Tabellvy' }));
        fireEvent.click(screen.getByRole('button', { name: 'Visa revisioner' }));
        const revisions = await screen.findByRole('region', { name: 'Revisioner för Projekt 1' });
        fireEvent.click(await within(revisions).findByRole('button', { name: 'Öppna v1' }));
        await waitFor(() => expect(onOpenQuote).toHaveBeenCalledWith(expect.objectContaining({ activeQuoteId: '1', activeQuoteVersion: 1 }), expect.objectContaining({ quoteOwnerUid: 'user-1' })));
        fireEvent.click(within(revisions).getByRole('button', { name: 'Kopiera länk' }));
        await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('version=1')));
        expect(within(revisions).getByRole('button', { name: 'Förhandsgranska PDF' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: layout === 'table' ? 'Kortvy' : 'Tabellvy' }));
        expect(screen.getByRole('region', { name: 'Revisioner för Projekt 1' })).toBeTruthy();
        expect(mocks.repository.getQuoteRevisions).toHaveBeenCalledTimes(1);
    });

    it('retries revision failures instead of leaving an endless loading message', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.repository.getQuoteRevisions.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
        mount(); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Visa revisioner' }));
        expect(await screen.findByRole('alert')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Försök igen' }));
        expect(await screen.findByText('Inga revisioner hittades.')).toBeTruthy();
    });

    it('updates totals and filtered rows after status saves and retains them after a failed save', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mount(); await ready(); fireEvent.click(tile('Utkast'));
        change('Status för Projekt 1', 'sent');
        await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
        expect(tile('Skickade').textContent).toContain('(1)');
        fireEvent.click(tile('Skickade'));
        mocks.repository.updateQuoteStatus.mockRejectedValueOnce(new Error('offline'));
        change('Status för Projekt 1', 'won');
        await waitFor(() => expect(mocks.error).toHaveBeenCalled());
        expect(screen.getByLabelText('Status för Projekt 1').value).toBe('sent');
    });

    it('disables only the pending owner row and prevents repeat status writes', async () => {
        const save = deferred();
        mocks.auth.canViewEverything = true;
        mocks.repository.getAllUsersQuotes.mockResolvedValue([row('1'), row('1', { ownerUid: 'other', reference: 'Annat projekt' })]);
        mocks.repository.updateQuoteStatus.mockReturnValueOnce(save.promise);
        mount(); await ready(); change('Offertägare', '__all__'); await ready('Annat projekt');
        change('Status för Projekt 1', 'sent');
        expect(screen.getByLabelText('Status för Projekt 1').disabled).toBe(true);
        expect(screen.getByLabelText('Status för Annat projekt').disabled).toBe(false);
        change('Status för Projekt 1', 'won');
        expect(mocks.repository.updateQuoteStatus).toHaveBeenCalledTimes(1);
        await act(async () => save.resolve(row('1', { status: 'sent' })));
        expect(screen.getByLabelText('Status för Projekt 1').value).toBe('sent');
        expect(screen.getByLabelText('Status för Projekt 1').disabled).toBe(false);
    });

    it('preserves successful local edits when an older admin list finishes loading', async () => {
        const all = deferred();
        mocks.auth.canViewEverything = true;
        mocks.repository.getAllUsersQuotes.mockReturnValueOnce(all.promise);
        mount(); await ready(); change('Status för Projekt 1', 'sent');
        await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Status uppdaterad.'));
        await act(async () => all.resolve([row('1')]));
        change('Offertägare', '__all__');
        expect(screen.getByLabelText('Status för Projekt 1').value).toBe('sent');
    });

    it('keeps duplicate IDs isolated for revisions, reopening, status and deletion across owners and caches', async () => {
        mocks.auth.canViewEverything = true;
        const other = row('1', { ownerUid: 'other', company: 'Återförsäljare', reference: 'Annat projekt', status: 'won', quoteNumber: 'BRIXX-other', originType: 'retailer' });
        mocks.repository.getAllUsersQuotes.mockResolvedValue([row('1'), other]);
        mocks.repository.getQuoteRevisions.mockImplementation(async ({ userId }) => [revision({ changeNote: `Ägare ${userId}` })]);
        const onOpenQuote = vi.fn(); mount({ onOpenQuote }); await ready();
        change('Offertägare', '__all__');
        const ownCard = await ready(); const otherCard = await ready('Annat projekt');
        fireEvent.click(within(ownCard).getByRole('button', { name: 'Visa revisioner' }));
        fireEvent.click(within(otherCard).getByRole('button', { name: 'Visa revisioner' }));
        await screen.findByText('Ägare user-1'); await screen.findByText('Ägare other');
        fireEvent.click(within(otherCard).getByRole('button', { name: 'Öppna v1' }));
        await waitFor(() => expect(onOpenQuote).toHaveBeenCalledWith(expect.objectContaining({ quoteNumber: 'BRIXX-other', quoteStatus: 'won' }), expect.objectContaining({ quoteOwnerUid: 'other' })));
        change('Status för Projekt 1', 'sent');
        await waitFor(() => expect(screen.getByLabelText('Status för Projekt 1').value).toBe('sent'));
        expect(screen.getByLabelText('Status för Annat projekt').value).toBe('won');
        change('Offertägare', '__mine__'); expect(screen.getByLabelText('Status för Projekt 1').value).toBe('sent');
        change('Offertägare', '__all__'); change('Källa', 'retailer');
        expect(screen.getAllByRole('article')).toHaveLength(1); expect(tile('Vunna').textContent).toContain('(1)');
        fireEvent.click(screen.getByRole('button', { name: 'Fler åtgärder' })); fireEvent.click(screen.getByRole('menuitem', { name: 'Ta bort' }));
        await waitFor(() => expect(mocks.repository.deleteQuote).toHaveBeenCalledWith({ userId: 'other', quoteId: '1' }));
        change('Källa', ''); expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.queryByRole('article', { name: 'Annat projekt' })).toBeNull();
        change('Offertägare', 'other');
        expect(screen.getByLabelText('Offertägare').value).toBe('other');
        expect(screen.getByRole('option', { name: 'owner@example.com (0)' })).toBeTruthy();
        expect(screen.getByText('Inga sparade offerter')).toBeTruthy();
    });

    it('cancels deletion through the shared confirmation and shows admin-only CRM repair', async () => {
        mocks.auth.canViewEverything = true;
        mocks.repository.getUserQuotes.mockResolvedValue([row('1', { crmSynchronizationIssue: { reason: 'pending' } })]);
        mocks.confirm.mockResolvedValue(false);
        mount(); await ready();
        fireEvent.click(screen.getByRole('button', { name: 'Fler åtgärder' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Ta bort' }));
        await waitFor(() => expect(mocks.confirm).toHaveBeenCalled()); expect(mocks.repository.deleteQuote).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Fler åtgärder' })); fireEvent.click(screen.getByRole('menuitem', { name: 'Reparera CRM-länk' }));
        await waitFor(() => expect(mocks.repair).toHaveBeenCalledWith(expect.objectContaining({ quote: { ownerUid: 'user-1', quoteId: '1' } })));
        await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('CRM-länken är reparerad.'));
        fireEvent.click(screen.getByRole('button', { name: 'Fler åtgärder' })); expect(screen.queryByRole('menuitem', { name: 'Reparera CRM-länk' })).toBeNull();
    });

    it('retains CRM status synchronization for linked admin quotes', async () => {
        mocks.auth.canViewEverything = true;
        mocks.repository.getUserQuotes.mockResolvedValue([row('1', { crmDealId: 'deal-1' })]);
        mount(); await ready(); change('Status för Projekt 1', 'won');
        await waitFor(() => expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ crmDealId: 'deal-1', status: 'won' }), quoteOwnerUid: 'user-1' })));
        expect(mocks.repository.updateQuoteStatus).not.toHaveBeenCalled();
    });

    it('ignores an older user response and preserves the newly selected owner scope', async () => {
        const old = deferred(); const next = deferred();
        mocks.repository.getUserQuotes.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
        const view = mount();
        mocks.auth = { ...mocks.auth, user: { uid: 'user-2' } };
        view.rerender(<MemoryRouter><History /></MemoryRouter>);
        await act(async () => next.resolve([row('2', { ownerUid: 'user-2' })])); await ready('Projekt 2');
        await act(async () => old.resolve([row('1')]));
        expect(screen.queryByRole('article', { name: 'Projekt 1' })).toBeNull();
        expect(screen.getByRole('article', { name: 'Projekt 2' })).toBeTruthy();
    });

    it('shows admin scope errors and retries without falling back to own quotes', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.auth.canViewEverything = true;
        mocks.repository.getAllUsersQuotes.mockRejectedValueOnce(new Error('Admin offline')).mockResolvedValueOnce([row('2', { ownerUid: 'other' })]);
        mount(); await ready(); change('Offertägare', '__all__');
        expect((await screen.findByRole('alert')).textContent).toContain('Admin offline');
        fireEvent.click(screen.getByRole('button', { name: 'Försök igen' })); await ready('Projekt 2');
    });

    it('keeps retailer controls scoped and respects the lifecycle switch', async () => {
        mocks.auth.isRetailer = true; window.FEATURE_QUOTE_LIFECYCLE = false;
        mount(); await ready();
        expect(screen.queryByLabelText('Offertägare')).toBeNull(); expect(screen.queryByLabelText('Källa')).toBeNull();
        expect(screen.queryByLabelText('Status för Projekt 1')).toBeNull(); expect(screen.queryByRole('button', { name: 'Visa revisioner' })).toBeNull();
        expect(screen.getByText('Utkast', { selector: 'span' })).toBeTruthy();
        expect(mocks.repository.getAllUsersQuotes).not.toHaveBeenCalled();
    });

    it('does not load history for an account without access', () => {
        mocks.auth.canAccessQuoteHistory = false; mocks.auth.canViewEverything = true;
        mount(); expect(screen.getByText('Ingen åtkomst till offerthistorik.')).toBeTruthy();
        expect(mocks.repository.getUserQuotes).not.toHaveBeenCalled(); expect(mocks.repository.getAllUsersQuotes).not.toHaveBeenCalled();
    });
});
