import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getDeal: vi.fn(),
    changeDealStage: vi.fn(),
    syncDealFromQuote: vi.fn()
}));

vi.mock('../src/services/crmRepository', () => ({
    crmRepository: {
        getDeal: mocks.getDeal,
        changeDealStage: mocks.changeDealStage,
        syncDealFromQuote: mocks.syncDealFromQuote
    }
}));

import {
    changeCrmDealStageWithQuote,
    syncCrmDealFromQuote
} from '../src/services/crmQuoteWorkflow';

const actor = { uid: 'admin-1', email: 'admin@brixx.se' };

describe('crmQuoteWorkflow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('synchronizes linked quote metadata into the CRM deal', async () => {
        mocks.syncDealFromQuote.mockResolvedValue({ id: 'deal-1', stage: 'quote' });

        await syncCrmDealFromQuote({
            metadata: {
                quoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260723-101',
                latestRevisionId: 'revision-2',
                latestVersion: 2,
                totalSek: 125000,
                status: 'sent',
                crmDealId: 'deal-1'
            },
            quoteOwnerUid: 'owner-1',
            actor
        });

        expect(mocks.syncDealFromQuote).toHaveBeenCalledWith({
            dealId: 'deal-1',
            quoteOwnerUid: 'owner-1',
            quoteId: 'quote-1',
            quoteNumber: 'BRIXX - 260723-101',
            quoteRevisionId: 'revision-2',
            quoteVersion: 2,
            valueSek: 125000,
            quoteStatus: 'sent',
            user: actor
        });
    });

    it('does not synchronize quotes without a CRM link', async () => {
        const result = await syncCrmDealFromQuote({
            metadata: {
                quoteId: 'quote-1',
                quoteNumber: null,
                latestRevisionId: '',
                latestVersion: 1,
                totalSek: 0,
                status: 'draft',
                crmDealId: null
            },
            quoteOwnerUid: 'owner-1',
            actor
        });

        expect(result).toBeNull();
        expect(mocks.syncDealFromQuote).not.toHaveBeenCalled();
    });

    it('requires a quote before moving a lead to the quote stage', async () => {
        mocks.getDeal.mockResolvedValue({
            id: 'deal-1',
            stage: 'lead',
            quoteId: null,
            quoteOwnerUid: null
        });

        await expect(changeCrmDealStageWithQuote({
            dealId: 'deal-1',
            stage: 'quote',
            actor
        })).rejects.toThrow('Koppla eller skapa en offert');

        expect(mocks.changeDealStage).not.toHaveBeenCalled();
    });

    it('delegates closing a linked deal to the transactional repository operation', async () => {
        mocks.getDeal.mockResolvedValue({
            id: 'deal-1',
            stage: 'quote',
            quoteId: 'quote-1',
            quoteOwnerUid: 'owner-1'
        });
        mocks.changeDealStage.mockResolvedValue({ id: 'deal-1', stage: 'won' });

        await changeCrmDealStageWithQuote({
            dealId: 'deal-1',
            stage: 'won',
            actor
        });

        expect(mocks.changeDealStage).toHaveBeenCalledWith({
            dealId: 'deal-1',
            stage: 'won',
            lostReason: undefined,
            actor
        });
    });
});
