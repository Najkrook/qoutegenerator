// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const quoteRepositoryMocks = vi.hoisted(() => ({
    getAllUsersQuotes: vi.fn(async () => []),
    getUserQuotes: vi.fn(async () => []),
    getQuoteLatestRevision: vi.fn(),
    getQuoteRevisionByVersion: vi.fn(),
    updateQuoteStatus: vi.fn(),
    getQuoteRevisions: vi.fn(async () => []),
    deleteQuote: vi.fn()
}));

const firebaseMocks = vi.hoisted(() => ({
    db: {},
    collection: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({ forEach: vi.fn() }))
}));

const notificationMocks = vi.hoisted(() => ({
    notifyError: vi.fn(),
    notifyInfo: vi.fn(),
    notifySuccess: vi.fn(),
    confirmAction: vi.fn(async () => true)
}));

vi.mock('../src/services/quoteRepositoryClient', () => ({
    quoteRepository: quoteRepositoryMocks
}));

vi.mock('../src/services/firebase', () => firebaseMocks);
vi.mock('../src/services/notificationService', () => notificationMocks);

import { History } from '../src/views/History';
import { AuthContext } from '../src/store/AuthContext';

const mountedRoots = [];

function createAuthValue(overrides = {}) {
    return {
        user: { uid: 'user-1', email: 'user@example.com' },
        loading: false,
        accessLevel: 'quote-only',
        canViewEverything: false,
        canStartQuote: true,
        canAccessSketch: false,
        canAccessQuoteHistory: true,
        canExportSketchToQuote: false,
        login: vi.fn(),
        logout: vi.fn(),
        retailer: null,
        isRetailer: false,
        ...overrides
    };
}

function createMetadata(overrides = {}) {
    return {
        quoteId: 'q1',
        quoteNumber: 'BRIXX - 260526-001',
        quoteDateKey: '260526',
        quoteSequence: 1,
        customerName: 'Ada',
        company: 'Brixx',
        reference: 'REF-1',
        customerReference: 'ER-1',
        status: 'sent',
        createdAtMs: 1,
        updatedAtMs: 2,
        savedBy: 'user@example.com',
        savedByUid: 'user-1',
        latestVersion: 3,
        latestRevisionId: 'rev-3',
        totalSek: 1000,
        searchText: '',
        ...overrides
    };
}

function createRevision(overrides = {}) {
    return {
        revisionId: 'rev-2',
        quoteId: 'q1',
        version: 2,
        savedAtMs: 2,
        savedBy: 'user@example.com',
        savedByUid: 'user-1',
        state: {
            selectedLines: ['BaHaMa'],
            builderItems: [{
                id: 'item-1',
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '4x4 Kvadrat',
                qty: 1,
                discountPct: 0,
                addons: []
            }],
            customerInfo: { name: 'Ada' }
        },
        summary: {
            finalTotalSek: 1000,
            grossTotalSek: 1000,
            totalDiscountSek: 0
        },
        changeNote: '',
        ...overrides
    };
}

async function flushEffects() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

function LocationProbe({ onChange }) {
    const location = useLocation();
    onChange(location);
    return null;
}

async function renderHistory({ initialEntry, auth = {}, onOpenQuote = vi.fn() }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let currentLocation = null;

    await act(async () => {
        root.render(
            <MemoryRouter initialEntries={[initialEntry]}>
                <AuthContext.Provider value={createAuthValue(auth)}>
                    <History onBack={() => {}} onOpenQuote={onOpenQuote} />
                    <LocationProbe onChange={(location) => {
                        currentLocation = location;
                    }}
                    />
                </AuthContext.Provider>
            </MemoryRouter>
        );
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return {
        container,
        onOpenQuote,
        getLocation: () => currentLocation
    };
}

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }

    vi.clearAllMocks();
});

describe('History quote deep links', () => {
    it('opens an own quote deep link for a specific version', async () => {
        const latestRevision = createRevision({ revisionId: 'rev-3', version: 3 });
        const specificRevision = createRevision({ revisionId: 'rev-2', version: 2 });
        quoteRepositoryMocks.getQuoteLatestRevision.mockResolvedValue({
            metadata: createMetadata(),
            revision: latestRevision
        });
        quoteRepositoryMocks.getQuoteRevisionByVersion.mockResolvedValue(specificRevision);

        const { onOpenQuote, getLocation } = await renderHistory({
            initialEntry: '/quotes?openQuote=q1&version=2'
        });
        await flushEffects();

        expect(quoteRepositoryMocks.getQuoteLatestRevision).toHaveBeenCalledWith({
            userId: 'user-1',
            quoteId: 'q1'
        });
        expect(quoteRepositoryMocks.getQuoteRevisionByVersion).toHaveBeenCalledWith({
            userId: 'user-1',
            quoteId: 'q1',
            version: 2
        });
        expect(onOpenQuote).toHaveBeenCalledWith(expect.objectContaining({
            activeQuoteId: 'q1',
            activeQuoteVersion: 2,
            quoteNumber: 'BRIXX - 260526-001',
            quoteStatus: 'sent'
        }));
        expect(getLocation().search).toBe('');
    });

    it('allows admins to open another owner quote deep link', async () => {
        quoteRepositoryMocks.getQuoteLatestRevision.mockResolvedValue({
            metadata: createMetadata({ savedByUid: 'other-uid' }),
            revision: createRevision({ version: 1 })
        });
        quoteRepositoryMocks.getQuoteRevisionByVersion.mockResolvedValue(createRevision({ version: 1 }));

        const { onOpenQuote } = await renderHistory({
            initialEntry: '/quotes?openQuote=q1&version=1&owner=other-uid',
            auth: {
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            }
        });
        await flushEffects();

        expect(quoteRepositoryMocks.getQuoteLatestRevision).toHaveBeenCalledWith({
            userId: 'other-uid',
            quoteId: 'q1'
        });
        expect(onOpenQuote).toHaveBeenCalledWith(expect.objectContaining({
            activeQuoteId: 'q1',
            activeQuoteVersion: 1
        }));
    });

    it('blocks non-admin deep links for another owner and clears params', async () => {
        const { onOpenQuote, getLocation } = await renderHistory({
            initialEntry: '/quotes?openQuote=q1&version=1&owner=other-uid'
        });
        await flushEffects();

        expect(onOpenQuote).not.toHaveBeenCalled();
        expect(quoteRepositoryMocks.getQuoteLatestRevision).not.toHaveBeenCalled();
        expect(notificationMocks.notifyError).toHaveBeenCalledWith('Du har inte beh\u00f6righet att \u00f6ppna den h\u00e4r offerten.');
        expect(getLocation().search).toBe('');
    });
});
