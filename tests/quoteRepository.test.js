import { describe, expect, it } from 'vitest';
import {
    applyQuoteFilters,
    createQuoteRepository,
    normalizeQuoteMetadata
} from '../services/quoteRepository.js';
import { createFirestoreMock } from './fixtures/firestoreMock.js';

function buildRepo(initialDocs = {}) {
    const mock = createFirestoreMock(initialDocs);
    const repo = createQuoteRepository(mock);
    return { repo, mock };
}

const user = {
    uid: 'user-1',
    email: 'sales@example.com'
};

const baseState = {
    customerInfo: {
        name: 'Testkund',
        company: 'Brixx AB',
        reference: 'REF-01'
    }
};

const baseSummary = {
    finalTotalSek: 12345,
    grossTotalSek: 14000,
    totalDiscountSek: 1655
};

describe('quoteRepository', () => {
    it('createQuote creates metadata and revision v1', async () => {
        const { repo } = buildRepo();
        const saved = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        expect(saved.quoteId).toContain('quote_');
        expect(saved.metadata.latestVersion).toBe(1);
        expect(saved.metadata.status).toBe('draft');
        expect(saved.revision.version).toBe(1);
        expect(saved.revision.state.customerInfo.name).toBe('Testkund');
    });

    it('saveQuoteRevision increments version and updates latest metadata pointer', async () => {
        const { repo } = buildRepo();
        const created = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        const updated = await repo.saveQuoteRevision({
            user,
            quoteId: created.quoteId,
            state: {
                ...baseState,
                customerInfo: {
                    ...baseState.customerInfo,
                    reference: 'REF-02'
                }
            },
            summary: { ...baseSummary, finalTotalSek: 15000 },
            customerInfo: {
                ...baseState.customerInfo,
                reference: 'REF-02'
            },
            status: 'sent',
            changeNote: 'Updated reference'
        });

        expect(updated.metadata.latestVersion).toBe(2);
        expect(updated.metadata.latestRevisionId).toBe(updated.revision.revisionId);
        expect(updated.metadata.status).toBe('sent');
        expect(updated.revision.version).toBe(2);
    });

    it('getUserQuotes supports status and search filtering', async () => {
        const { repo } = buildRepo();

        const a = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });
        await repo.updateQuoteStatus({
            userId: user.uid,
            quoteId: a.quoteId,
            status: 'won'
        });

        await repo.createQuote({
            user,
            state: {
                customerInfo: {
                    name: 'Andra kund',
                    company: 'Nordic Partner',
                    reference: 'ABC'
                }
            },
            summary: { ...baseSummary, finalTotalSek: 5000 },
            customerInfo: {
                name: 'Andra kund',
                company: 'Nordic Partner',
                reference: 'ABC'
            },
            status: 'draft'
        });

        const won = await repo.getUserQuotes({
            userId: user.uid,
            status: 'won',
            search: ''
        });
        const search = await repo.getUserQuotes({
            userId: user.uid,
            status: '',
            search: 'nordic'
        });

        expect(won).toHaveLength(1);
        expect(won[0].status).toBe('won');
        expect(search).toHaveLength(1);
        expect(search[0].company).toBe('Nordic Partner');
    });

    it('supports legacy quote docs without lifecycle metadata', async () => {
        const legacyPath = 'users/user-1/quotes/legacy_1';
        const { repo } = buildRepo({
            [legacyPath]: {
                timestamp: '2026-02-01T10:00:00.000Z',
                customerName: 'Legacy kund',
                reference: 'LEG-1',
                totalSek: 9000,
                state: {
                    step: 4,
                    customerInfo: { name: 'Legacy kund' }
                }
            }
        });

        const quotes = await repo.getUserQuotes({ userId: user.uid, status: '', search: '' });
        const latest = await repo.getQuoteLatestRevision({ userId: user.uid, quoteId: 'legacy_1' });

        expect(quotes).toHaveLength(1);
        expect(quotes[0].status).toBe('draft');
        expect(quotes[0].latestVersion).toBe(1);
        expect(latest?.revision?.state?.customerInfo?.name).toBe('Legacy kund');
        expect(latest?.revision?.version).toBe(1);
    });

    it('returns exact latest revision payload after multiple saves', async () => {
        const { repo } = buildRepo();
        const created = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        await repo.saveQuoteRevision({
            user,
            quoteId: created.quoteId,
            state: {
                ...baseState,
                customerInfo: {
                    ...baseState.customerInfo,
                    reference: 'REV-2'
                }
            },
            summary: { ...baseSummary, finalTotalSek: 22222 },
            customerInfo: {
                ...baseState.customerInfo,
                reference: 'REV-2'
            },
            status: 'sent'
        });

        const latest = await repo.getQuoteLatestRevision({
            userId: user.uid,
            quoteId: created.quoteId
        });

        expect(latest?.revision?.version).toBe(2);
        expect(latest?.revision?.state?.customerInfo?.reference).toBe('REV-2');
        expect(latest?.metadata?.status).toBe('sent');
    });
});

describe('quoteRepository pure helpers', () => {
    it('normalizeQuoteMetadata defaults status/version for legacy payload', () => {
        const normalized = normalizeQuoteMetadata('q1', {
            customerName: 'A',
            reference: 'X',
            timestamp: '2026-01-01T00:00:00.000Z'
        });

        expect(normalized.status).toBe('draft');
        expect(normalized.latestVersion).toBe(1);
        expect(normalized.searchText).toContain('draft');
    });

    it('applyQuoteFilters filters by status and search text', () => {
        const rows = [
            { status: 'draft', searchText: 'acme draft', customerName: 'Acme', reference: 'A1' },
            { status: 'won', searchText: 'beta won', customerName: 'Beta', reference: 'B1' }
        ];

        expect(applyQuoteFilters(rows, { status: 'won', search: '' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { status: '', search: 'acme' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { status: 'lost', search: '' })).toHaveLength(0);
    });
});
