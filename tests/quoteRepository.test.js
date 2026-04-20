import { describe, expect, it } from 'vitest';
import {
    applyQuoteFilters,
    createQuoteRepository,
    normalizeQuoteMetadata,
    normalizeScriveStatus
} from '../src/services/quoteRepository';
import { createFirestoreMock } from './fixtures/firestoreMock';

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
        name: '',
        company: 'Brixx AB',
        reference: 'REF-01',
        customerReference: 'ER-01'
    }
};

const baseSummary = {
    finalTotalSek: 12345,
    grossTotalSek: 14000,
    totalDiscountSek: 1655
};

describe('quoteRepository', () => {
    it('createQuote creates metadata and revision v1', async () => {
        const { repo, mock } = buildRepo();
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
        expect(saved.metadata.customerName).toBe('Brixx AB');
        expect(saved.metadata.customerReference).toBe('ER-01');
        expect(saved.revision.version).toBe(1);
        expect(saved.revision.state.customerInfo.company).toBe('Brixx AB');

        const quotePath = `users/${user.uid}/quotes/${saved.quoteId}`;
        const revisionPath = `users/${user.uid}/quotes/${saved.quoteId}/revisions/${saved.revision.revisionId}`;

        expect(mock.__docs.get(quotePath)).toMatchObject({
            customerName: 'Brixx AB',
            customerReference: 'ER-01',
            latestVersion: 1,
            latestRevisionId: saved.revision.revisionId,
            status: 'draft',
            totalSek: 12345
        });
        expect(mock.__docs.get(revisionPath)).toMatchObject({
            quoteId: saved.quoteId,
            version: 1,
            savedBy: 'sales@example.com',
            savedByUid: 'user-1',
            summary: {
                finalTotalSek: 12345,
                grossTotalSek: 14000,
                totalDiscountSek: 1655
            }
        });
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
                    reference: 'REF-02',
                    customerReference: 'ER-02'
                }
            },
            summary: { ...baseSummary, finalTotalSek: 15000 },
            customerInfo: {
                ...baseState.customerInfo,
                reference: 'REF-02',
                customerReference: 'ER-02'
            },
            status: 'sent',
            changeNote: 'Updated reference'
        });

        expect(updated.metadata.latestVersion).toBe(2);
        expect(updated.metadata.latestRevisionId).toBe(updated.revision.revisionId);
        expect(updated.metadata.status).toBe('sent');
        expect(updated.metadata.customerReference).toBe('ER-02');
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
                    name: '',
                    company: 'Nordic Partner',
                    reference: 'ABC',
                    customerReference: 'CUST-ABC'
                }
            },
            summary: { ...baseSummary, finalTotalSek: 5000 },
            customerInfo: {
                name: '',
                company: 'Nordic Partner',
                reference: 'ABC',
                customerReference: 'CUST-ABC'
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
        const customerRefSearch = await repo.getUserQuotes({
            userId: user.uid,
            status: '',
            search: 'cust-abc'
        });

        expect(won).toHaveLength(1);
        expect(won[0].status).toBe('won');
        expect(search).toHaveLength(1);
        expect(search[0].company).toBe('Nordic Partner');
        expect(customerRefSearch).toHaveLength(1);
        expect(customerRefSearch[0].customerReference).toBe('CUST-ABC');
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
                    reference: 'REV-2',
                    customerReference: 'ER-REV-2'
                }
            },
            summary: { ...baseSummary, finalTotalSek: 22222 },
            customerInfo: {
                ...baseState.customerInfo,
                reference: 'REV-2',
                customerReference: 'ER-REV-2'
            },
            status: 'sent'
        });

        const latest = await repo.getQuoteLatestRevision({
            userId: user.uid,
            quoteId: created.quoteId
        });

        expect(latest?.revision?.version).toBe(2);
        expect(latest?.revision?.state?.customerInfo?.reference).toBe('REV-2');
        expect(latest?.revision?.state?.customerInfo?.customerReference).toBe('ER-REV-2');
        expect(latest?.metadata?.status).toBe('sent');
    });

    it('updateQuoteScrive stores scrive metadata on quote document', async () => {
        const { repo } = buildRepo();
        const created = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        const updated = await repo.updateQuoteScrive({
            userId: user.uid,
            quoteId: created.quoteId,
            scrive: {
                enabled: true,
                status: 'pending',
                documentId: 'doc_123',
                signerEmail: 'customer@example.com',
                signerName: 'Testkund'
            }
        });

        expect(updated.scriveEnabled).toBe(true);
        expect(updated.scriveStatus).toBe('pending');
        expect(updated.scriveDocumentId).toBe('doc_123');
        expect(updated.scriveSignerEmail).toBe('customer@example.com');
    });

    it('saveQuoteRevision falls back cleanly when runTransaction is unavailable', async () => {
        const mock = createFirestoreMock();
        delete mock.runTransaction;
        const repo = createQuoteRepository(mock);

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
            state: baseState,
            summary: { ...baseSummary, finalTotalSek: 20000 },
            customerInfo: baseState.customerInfo,
            status: 'sent'
        });

        expect(updated.metadata.latestVersion).toBe(2);
        expect(updated.revision.version).toBe(2);
        expect(updated.metadata.latestRevisionId).toBe(updated.revision.revisionId);
    });

    it('getQuoteLatestRevision falls back to the revision list when latestRevisionId is missing', async () => {
        const { repo } = buildRepo({
            'users/user-1/quotes/q_fallback': {
                customerName: 'Fallback kund',
                reference: 'FB-1',
                customerReference: 'ER-FB-1',
                latestVersion: 2,
                updatedAtMs: 1710000000000,
                totalSek: 18000,
                status: 'sent'
            },
            'users/user-1/quotes/q_fallback/revisions/rev_2': {
                version: 2,
                savedAtMs: 1710000000000,
                savedBy: 'sales@example.com',
                savedByUid: 'user-1',
                state: {
                    customerInfo: { reference: 'FB-2' }
                },
                summary: {
                    finalTotalSek: 18000,
                    grossTotalSek: 19000,
                    totalDiscountSek: 1000
                },
                changeNote: 'Fallback revision'
            }
        });

        const latest = await repo.getQuoteLatestRevision({
            userId: user.uid,
            quoteId: 'q_fallback'
        });

        expect(latest?.revision?.revisionId).toBe('rev_2');
        expect(latest?.revision?.version).toBe(2);
        expect(latest?.revision?.state?.customerInfo?.reference).toBe('FB-2');
    });

    it('updateQuoteScrive preserves undefined fields and clears explicit nulls', async () => {
        const { repo } = buildRepo();
        const created = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        await repo.updateQuoteScrive({
            userId: user.uid,
            quoteId: created.quoteId,
            scrive: {
                enabled: true,
                status: 'pending',
                documentId: 'doc_keep',
                sentAtMs: 1700000000000,
                lastEventAtMs: 1700000000100
            }
        });

        const updated = await repo.updateQuoteScrive({
            userId: user.uid,
            quoteId: created.quoteId,
            scrive: {
                documentId: null,
                sentAtMs: null,
                lastEventAtMs: undefined
            }
        });

        expect(updated.scriveDocumentId).toBe(null);
        expect(updated.scriveSentAtMs).toBe(null);
        expect(updated.scriveLastEventAtMs).toBe(1700000000100);
        expect(updated.scriveEnabled).toBe(true);
    });
});

describe('quoteRepository pure helpers', () => {
    it('normalizeQuoteMetadata defaults status/version for legacy payload', () => {
        const normalized = normalizeQuoteMetadata('q1', {
            customerName: 'A',
            customerReference: 'ER-7',
            reference: 'X',
            timestamp: '2026-01-01T00:00:00.000Z'
        });

        expect(normalized.status).toBe('draft');
        expect(normalized.latestVersion).toBe(1);
        expect(normalized.scriveEnabled).toBe(false);
        expect(normalized.scriveStatus).toBe('not_sent');
        expect(normalized.customerReference).toBe('ER-7');
        expect(normalized.searchText).toContain('draft');
    });

    it('applyQuoteFilters filters by status and search text', () => {
        const rows = [
            { status: 'draft', searchText: 'acme draft er-1', customerName: 'Acme', reference: 'A1', customerReference: 'ER-1' },
            { status: 'won', searchText: 'beta won er-2', customerName: 'Beta', reference: 'B1', customerReference: 'ER-2' }
        ];

        expect(applyQuoteFilters(rows, { status: 'won', search: '' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { status: '', search: 'acme' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { status: '', search: 'er-2' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { status: 'lost', search: '' })).toHaveLength(0);
    });

    it('normalizeScriveStatus falls back to not_sent for invalid values', () => {
        expect(normalizeScriveStatus('closed')).toBe('closed');
        expect(normalizeScriveStatus('PENDING')).toBe('pending');
        expect(normalizeScriveStatus('bad-status')).toBe('not_sent');
    });
});
