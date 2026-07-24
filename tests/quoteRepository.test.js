import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    applyQuoteFilters,
    createQuoteRepository,
    normalizeQuoteMetadata,
    sortQuotes
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
    afterEach(() => {
        vi.useRealTimers();
    });

    it('createQuote creates metadata and revision v1', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-22T08:00:00.000Z'));

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
        expect(saved.metadata.quoteNumber).toBe('BRIXX - 260422-101');
        expect(saved.metadata.quoteDateKey).toBe('260422');
        expect(saved.metadata.quoteSequence).toBe(101);
        expect(saved.metadata.customerName).toBe('Brixx AB');
        expect(saved.metadata.customerReference).toBe('ER-01');
        expect(saved.revision.version).toBe(1);
        expect(saved.revision.state.customerInfo.company).toBe('Brixx AB');

        const quotePath = `users/${user.uid}/quotes/${saved.quoteId}`;
        const revisionPath = `users/${user.uid}/quotes/${saved.quoteId}/revisions/${saved.revision.revisionId}`;

        expect(mock.__docs.get(quotePath)).toMatchObject({
            quoteNumber: 'BRIXX - 260422-101',
            quoteDateKey: '260422',
            quoteSequence: 101,
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
        expect(mock.__docs.get('quote_counters/260422')).toMatchObject({
            lastSequence: 101
        });
    });

    it('saveQuoteRevision increments version and updates latest metadata pointer', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-22T09:00:00.000Z'));

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
        expect(updated.metadata.quoteNumber).toBe(created.metadata.quoteNumber);
        expect(updated.metadata.quoteDateKey).toBe(created.metadata.quoteDateKey);
        expect(updated.metadata.quoteSequence).toBe(created.metadata.quoteSequence);
        expect(updated.metadata.customerReference).toBe('ER-02');
        expect(updated.revision.version).toBe(2);
    });

    it('assigns a global daily quote sequence across multiple new quotes on the same day', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-22T10:00:00.000Z'));

        const { repo } = buildRepo();

        const first = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });
        const second = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });
        const third = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        expect(first.metadata.quoteNumber).toBe('BRIXX - 260422-101');
        expect(second.metadata.quoteNumber).toBe('BRIXX - 260422-102');
        expect(third.metadata.quoteNumber).toBe('BRIXX - 260422-103');
    });

    it('resets the daily quote sequence when the Stockholm business day changes', async () => {
        vi.useFakeTimers();
        const { repo } = buildRepo();

        vi.setSystemTime(new Date('2026-04-22T21:30:00.000Z'));
        const firstDay = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        vi.setSystemTime(new Date('2026-04-23T08:00:00.000Z'));
        const secondDay = await repo.createQuote({
            user,
            state: baseState,
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        expect(firstDay.metadata.quoteNumber).toBe('BRIXX - 260422-101');
        expect(secondDay.metadata.quoteNumber).toBe('BRIXX - 260423-101');
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

    it('stores the CRM deal link only in quote metadata and preserves it across revisions', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-22T09:30:00.000Z'));

        const { repo, mock } = buildRepo();
        const created = await repo.createQuote({
            user,
            state: {
                ...baseState,
                crmDealId: 'malicious-state-link',
                quoteOwnerUid: 'malicious-owner'
            },
            summary: baseSummary,
            customerInfo: baseState.customerInfo,
            status: 'draft',
            crmDealId: 'deal-1'
        });

        expect(created.metadata.crmDealId).toBe('deal-1');
        expect(created.revision.state).not.toHaveProperty('crmDealId');
        expect(created.revision.state).not.toHaveProperty('quoteOwnerUid');

        const updated = await repo.saveQuoteRevision({
            user,
            quoteId: created.quoteId,
            state: baseState,
            summary: { ...baseSummary, finalTotalSek: 15000 },
            customerInfo: baseState.customerInfo,
            status: 'sent'
        });

        expect(updated.metadata.crmDealId).toBe('deal-1');
        expect(updated.revision.state).not.toHaveProperty('crmDealId');
        expect(mock.__docs.get(`users/${user.uid}/quotes/${created.quoteId}`)).toMatchObject({
            crmDealId: 'deal-1'
        });
    });

    it('round-trips contracting work through revisions without changing the product history total', async () => {
        const { repo } = buildRepo();
        const contractingWork = {
            enabled: true,
            projectName: 'Designer Village',
            rows: [{
                id: 'work-1',
                workPackage: 'Fundament',
                scope: 'Schaktning och gjutning',
                unit: 'Samlat arbetspaket',
                priceExVatSek: 571200
            }],
            margin: { enabled: true, percent: 15 },
            ata: { enabled: true, percent: 15 }
        };
        const contractingOnlySummary = {
            finalTotalSek: 0,
            grossTotalSek: 0,
            totalDiscountSek: 0
        };

        const created = await repo.createQuote({
            user,
            state: { ...baseState, contractingWork },
            summary: contractingOnlySummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        expect(created.metadata.totalSek).toBe(0);
        expect(created.revision.state.contractingWork).toEqual(contractingWork);

        const revisedContractingWork = {
            ...contractingWork,
            margin: { enabled: true, percent: 20 },
            rows: [{ ...contractingWork.rows[0], priceExVatSek: 600000 }]
        };
        await repo.saveQuoteRevision({
            user,
            quoteId: created.quoteId,
            state: { ...baseState, contractingWork: revisedContractingWork },
            summary: contractingOnlySummary,
            customerInfo: baseState.customerInfo,
            status: 'draft'
        });

        const latest = await repo.getQuoteLatestRevision({
            userId: user.uid,
            quoteId: created.quoteId
        });

        expect(latest?.metadata?.totalSek).toBe(0);
        expect(latest?.revision?.state?.contractingWork).toEqual(revisedContractingWork);
        expect(latest?.revision?.state?.contractingWork?.margin).toEqual({ enabled: true, percent: 20 });
    });

    it('saveQuoteRevision falls back cleanly when runTransaction is unavailable', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-22T12:00:00.000Z'));

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
        expect(updated.metadata.quoteNumber).toBe(created.metadata.quoteNumber);
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

    it('getQuoteRevisionByVersion returns the exact requested saved version', async () => {
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
            summary: { ...baseSummary, finalTotalSek: 20000 },
            customerInfo: {
                ...baseState.customerInfo,
                reference: 'REV-2'
            },
            status: 'draft'
        });

        await repo.saveQuoteRevision({
            user,
            quoteId: created.quoteId,
            state: {
                ...baseState,
                customerInfo: {
                    ...baseState.customerInfo,
                    reference: 'REV-3'
                }
            },
            summary: { ...baseSummary, finalTotalSek: 30000 },
            customerInfo: {
                ...baseState.customerInfo,
                reference: 'REV-3'
            },
            status: 'sent'
        });

        const revision = await repo.getQuoteRevisionByVersion({
            userId: user.uid,
            quoteId: created.quoteId,
            version: 2
        });

        expect(revision?.version).toBe(2);
        expect(revision?.state?.customerInfo?.reference).toBe('REV-2');
    });
});

describe('quoteRepository pure helpers', () => {
    it('normalizeQuoteMetadata defaults status/version for legacy payload', () => {
        const normalized = normalizeQuoteMetadata('q1', {
            quoteNumber: 'BRIXX - 260422-101',
            quoteDateKey: '260422',
            quoteSequence: 101,
            customerName: 'A',
            customerReference: 'ER-7',
            reference: 'X',
            timestamp: '2026-01-01T00:00:00.000Z'
        });

        expect(normalized.status).toBe('draft');
        expect(normalized.latestVersion).toBe(1);
        expect(normalized.quoteNumber).toBe('BRIXX - 260422-101');
        expect(normalized.quoteDateKey).toBe('260422');
        expect(normalized.quoteSequence).toBe(101);
        expect(normalized.customerReference).toBe('ER-7');
        expect(normalized.searchText).toContain('draft');
    });

    it('applyQuoteFilters filters by status, search text, date and origin', () => {
        const rows = [
            { status: 'draft', searchText: 'acme draft er-1', customerName: 'Acme', reference: 'A1', customerReference: 'ER-1', updatedAtMs: Date.now(), originType: 'internal' },
            { status: 'won', searchText: 'beta won er-2', customerName: 'Beta', reference: 'B1', customerReference: 'ER-2', updatedAtMs: Date.now() - 10 * 86400000, originType: 'retailer' }
        ];

        expect(applyQuoteFilters(rows, { status: 'won', search: '' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { status: '', search: 'acme' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { status: '', search: 'er-2' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { status: 'lost', search: '' })).toHaveLength(0);
        expect(applyQuoteFilters(rows, { dateFilter: '7days' })).toHaveLength(1);
        expect(applyQuoteFilters(rows, { originFilter: 'retailer' })).toHaveLength(1);
    });

    it('sortQuotes sorts correctly', () => {
        const rows = [
            { quoteId: '1', totalSek: 100, updatedAtMs: 1000 },
            { quoteId: '2', totalSek: 200, updatedAtMs: 2000 }
        ];

        expect(sortQuotes([...rows], 'newest')[0].quoteId).toBe('2');
        expect(sortQuotes([...rows], 'oldest')[0].quoteId).toBe('1');
        expect(sortQuotes([...rows], 'highest-value')[0].quoteId).toBe('2');
        expect(sortQuotes([...rows], 'lowest-value')[0].quoteId).toBe('1');
    });
});
