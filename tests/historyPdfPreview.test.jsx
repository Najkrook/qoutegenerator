// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
    auth: { user: { uid: 'user-1' }, canAccessQuoteHistory: true, canViewEverything: false },
    repository: {
        getUserQuotes: vi.fn(), getAllUsersQuotes: vi.fn(), getQuoteLatestRevision: vi.fn(),
        getQuoteRevisionByVersion: vi.fn(), getQuoteRevisions: vi.fn(),
        updateQuoteStatus: vi.fn(), deleteQuote: vi.fn(), saveQuote: vi.fn()
    },
    prepare: vi.fn(), pdf: vi.fn(), createUrl: vi.fn(), revokeUrl: vi.fn()
}));
vi.mock('../src/store/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('../src/services/quoteRepositoryClient', () => ({ quoteRepository: mocks.repository }));
vi.mock('../src/services/firebase', () => ({ db: {}, collection: () => ({}), getDocs: async () => ({ forEach: () => {} }) }));
vi.mock('../src/services/quotePdfService', () => ({ createQuotePdfBlob: mocks.pdf }));
vi.mock('../src/services/savedQuotePdfPreparation', () => ({ prepareSavedQuoteForPdf: mocks.prepare }));
vi.mock('../src/services/notificationService', () => ({ notifyError: vi.fn(), notifyInfo: vi.fn(), notifySuccess: vi.fn(), notifyWarn: vi.fn(), confirmAction: vi.fn() }));
import { History } from '../src/views/History';
import { getQuoteStateStorageKey } from '../src/store/quoteStatePersistence';

const quote = { quoteId: 'q1', quoteNumber: 'BRIXX-123', company: 'Sparad kund', status: 'draft', latestVersion: 3, totalSek: 1000, updatedAtMs: 1 };
const revision = { revisionId: 'r3', version: 3, state: {}, savedAtMs: 1 };
function LocationProbe() { return <output data-testid="location">{useLocation().pathname}</output>; }
function mount() {
    const onOpenQuote = vi.fn();
    const view = render(<MemoryRouter initialEntries={['/quotes']}><History onOpenQuote={onOpenQuote} /><LocationProbe /></MemoryRouter>);
    return { ...view, onOpenQuote };
}
async function openPreview() {
    const button = await screen.findByRole('button', { name: 'Förhandsgranska PDF' });
    button.focus();
    fireEvent.click(button);
    return button;
}
async function ready() { await waitFor(() => expect(screen.getByTitle('PDF-förhandsvisning v3').getAttribute('src')).toBe('blob:preview')); }

beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth = { user: { uid: 'user-1' }, canAccessQuoteHistory: true, canViewEverything: false };
    mocks.repository.getUserQuotes.mockResolvedValue([quote]);
    mocks.repository.getAllUsersQuotes.mockResolvedValue([]);
    mocks.repository.getQuoteLatestRevision.mockResolvedValue({ metadata: quote, revision });
    mocks.repository.getQuoteRevisionByVersion.mockResolvedValue({ ...revision, version: 1 });
    mocks.repository.getQuoteRevisions.mockResolvedValue([{ ...revision, revisionId: 'r1', version: 1 }]);
    mocks.prepare.mockReturnValue({ preparedQuote: { saved: true }, usesCurrentCatalog: false });
    mocks.pdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    mocks.createUrl.mockReturnValue('blob:preview');
    vi.stubGlobal('URL', class extends URL { static createObjectURL = mocks.createUrl; static revokeObjectURL = mocks.revokeUrl; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('History PDF preview', () => {
    it('opens latest in a dialog without navigating, opening the draft, or saving; restores focus and filters', async () => {
        const draftKey = getQuoteStateStorageKey('user-1');
        localStorage.setItem(draftKey, 'unchanged');
        const { onOpenQuote } = mount();
        await screen.findByRole('button', { name: 'Förhandsgranska PDF' });
        expect(mocks.pdf).not.toHaveBeenCalled();
        fireEvent.change(screen.getByPlaceholderText('Sök företag eller referens'), { target: { value: 'Sparad' } });
        const button = await openPreview();
        await ready();
        expect(screen.getByRole('dialog').textContent).toContain('Sparad kund · BRIXX-123 · v3');
        expect(mocks.repository.getQuoteLatestRevision).toHaveBeenCalledWith({ userId: 'user-1', quoteId: 'q1' });
        expect(onOpenQuote).not.toHaveBeenCalled();
        expect(mocks.repository.saveQuote).not.toHaveBeenCalled();
        expect(mocks.repository.updateQuoteStatus).not.toHaveBeenCalled();
        expect(localStorage.getItem(draftKey)).toBe('unchanged');
        expect(screen.getByTestId('location').textContent).toBe('/quotes');
        fireEvent.click(screen.getByRole('button', { name: 'Stäng' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(button);
        expect(screen.getByPlaceholderText('Sök företag eller referens').value).toBe('Sparad');
        expect(mocks.revokeUrl).toHaveBeenCalledWith('blob:preview');
    });

    it('fetches exactly the selected older version without opening the quote flow', async () => {
        const { onOpenQuote } = mount();
        fireEvent.click(await screen.findByRole('button', { name: 'Visa revisioner' }));
        const versionButton = await screen.findByRole('button', { name: /v1 -/ });
        fireEvent.click(within(versionButton.parentElement).getByRole('button', { name: 'Förhandsgranska PDF' }));
        await screen.findByTitle('PDF-förhandsvisning v1');
        expect(mocks.repository.getQuoteRevisionByVersion).toHaveBeenCalledWith({ userId: 'user-1', quoteId: 'q1', version: 1 });
        expect(mocks.repository.getQuoteLatestRevision).not.toHaveBeenCalled();
        expect(mocks.prepare.mock.calls[0][0].revision.version).toBe(1);
        expect(onOpenQuote).not.toHaveBeenCalled();
    });

    it('uses the owner UID when an admin previews another owner quote', async () => {
        mocks.auth.canViewEverything = true;
        mocks.repository.getAllUsersQuotes.mockResolvedValue([{ ...quote, ownerUid: 'other-owner' }]);
        mount();
        const allOption = await screen.findByRole('option', { name: /Alla användare/ });
        fireEvent.change(allOption.parentElement, { target: { value: '__all__' } });
        await openPreview();
        await ready();
        expect(mocks.repository.getQuoteLatestRevision).toHaveBeenCalledWith({ userId: 'other-owner', quoteId: 'q1' });
    });

    it('shows the legacy catalog notice', async () => {
        mocks.prepare.mockReturnValue({ preparedQuote: {}, usesCurrentCatalog: true });
        mount(); await openPreview(); await ready();
        expect(screen.getByText(/Äldre offertversion: PDF:en återskapas med dagens produktkatalog/)).toBeTruthy();
    });

    it('does not let a non-admin preview a row belonging to another owner', async () => {
        mocks.repository.getUserQuotes.mockResolvedValue([{ ...quote, ownerUid: 'other-owner' }]);
        mount(); await openPreview();
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(mocks.repository.getQuoteLatestRevision).not.toHaveBeenCalled();
    });

    it('passes a retailer own theme permissions to preparation', async () => {
        mocks.auth.isRetailer = true;
        mocks.auth.retailer = { pdfThemes: ['roslagsmarkisen'] };
        mount(); await openPreview(); await ready();
        expect(mocks.prepare.mock.calls[0][0].audience).toEqual({ isRetailer: true, allowedPdfThemes: ['roslagsmarkisen'] });
    });

    it.each(['missing', 'state', 'load', 'pdf'])('shows a retryable error for %s failure', async (failure) => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        if (failure === 'missing') mocks.repository.getQuoteLatestRevision.mockResolvedValueOnce(null);
        if (failure === 'state') mocks.repository.getQuoteLatestRevision.mockResolvedValueOnce({ metadata: quote, revision: { ...revision, state: null } });
        if (failure === 'load') mocks.repository.getQuoteLatestRevision.mockRejectedValueOnce(new Error('offline'));
        if (failure === 'pdf') mocks.pdf.mockResolvedValueOnce(null);
        mount(); await openPreview();
        expect(await screen.findByRole('alert')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Stäng' })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Försök igen' }));
        await ready();
        vi.restoreAllMocks();
    });

    it('ignores a PDF completed after closing and reopening another version', async () => {
        let finishPdf;
        mocks.pdf.mockImplementationOnce(() => new Promise((resolve) => { finishPdf = resolve; }));
        mount(); await openPreview();
        await waitFor(() => expect(mocks.pdf).toHaveBeenCalledTimes(1));
        expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toContain('Genererar');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Visa revisioner' }));
        const versionButton = await screen.findByRole('button', { name: /v1 -/ });
        fireEvent.click(within(versionButton.parentElement).getByRole('button', { name: 'Förhandsgranska PDF' }));
        await screen.findByTitle('PDF-förhandsvisning v1');
        await act(async () => finishPdf(new Blob(['stale pdf'])));
        expect(screen.queryByTitle('PDF-förhandsvisning v3')).toBeNull();
        expect(mocks.createUrl).toHaveBeenCalledTimes(1);
    });

    it('does not generate a PDF if closed while the revision is loading', async () => {
        let finishLoad;
        mocks.repository.getQuoteLatestRevision.mockImplementationOnce(() => new Promise((resolve) => { finishLoad = resolve; }));
        mount(); await openPreview();
        fireEvent.click(screen.getByRole('button', { name: 'Stäng' }));
        await act(async () => finishLoad({ metadata: quote, revision }));
        expect(mocks.pdf).not.toHaveBeenCalled();
        expect(mocks.createUrl).not.toHaveBeenCalled();
    });
});
