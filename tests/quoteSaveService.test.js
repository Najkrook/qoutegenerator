import { describe, expect, it, vi } from 'vitest';
import { buildSavedQuoteStatePatch, saveQuoteToRepository } from '../src/services/quoteSaveService';

describe('quoteSaveService', () => {
    it('creates a new quote when activeQuoteId is missing', async () => {
        const createQuote = vi.fn(async () => ({
            quoteId: 'quote_123',
            metadata: { latestVersion: 1, status: 'draft', quoteNumber: 'BRIXX - 260422-101' },
            revision: { version: 1 }
        }));
        const saveQuoteRevision = vi.fn();

        const result = await saveQuoteToRepository({
            quoteRepository: { createQuote, saveQuoteRevision },
            user: { uid: 'user-1', email: 'sales@example.com' },
            state: {
                activeQuoteId: null,
                quoteStatus: 'draft',
                customerInfo: { name: 'Testkund' }
            },
            summary: {
                finalTotalSek: 1000,
                grossTotalSek: 1200,
                totalDiscountSek: 200
            }
        });

        expect(createQuote).toHaveBeenCalledOnce();
        expect(saveQuoteRevision).not.toHaveBeenCalled();
        expect(result.isNewQuote).toBe(true);
        expect(result.statePatch.activeQuoteId).toBe('quote_123');
        expect(result.statePatch.quoteNumber).toBe('BRIXX - 260422-101');
        expect(result.statePatch.activeQuoteVersion).toBe(1);
        expect(result.statePatch.quoteStatus).toBe('draft');
    });

    it('saves a new revision when activeQuoteId exists', async () => {
        const createQuote = vi.fn();
        const saveQuoteRevision = vi.fn(async () => ({
            metadata: {
                latestVersion: 3,
                status: 'sent',
                quoteNumber: 'BRIXX - 260422-101'
            },
            revision: { version: 3 }
        }));

        const result = await saveQuoteToRepository({
            quoteRepository: { createQuote, saveQuoteRevision },
            user: { uid: 'user-1', email: 'sales@example.com' },
            state: {
                activeQuoteId: 'quote_123',
                activeQuoteVersion: 2,
                quoteStatus: 'draft',
                customerInfo: { name: 'Testkund' }
            },
            summary: {
                finalTotalSek: 2000,
                grossTotalSek: 2400,
                totalDiscountSek: 400
            }
        });

        expect(createQuote).not.toHaveBeenCalled();
        expect(saveQuoteRevision).toHaveBeenCalledOnce();
        expect(saveQuoteRevision.mock.calls[0][0].quoteId).toBe('quote_123');
        expect(result.isNewQuote).toBe(false);
        expect(result.statePatch.activeQuoteId).toBe('quote_123');
        expect(result.statePatch.quoteNumber).toBe('BRIXX - 260422-101');
        expect(result.statePatch.activeQuoteVersion).toBe(3);
        expect(result.statePatch.quoteStatus).toBe('sent');
    });

    it('leaves CRM linking to the transactional workflow without adding it to quote state', async () => {
        const createQuote = vi.fn(async () => ({
            quoteId: 'quote_crm',
            metadata: {
                latestVersion: 1,
                status: 'draft',
                quoteNumber: 'BRIXX - 260422-102',
                crmDealId: 'deal-1'
            },
            revision: { version: 1 }
        }));

        const state = {
            activeQuoteId: null,
            quoteStatus: 'draft',
            customerInfo: { name: 'CRM-kund' }
        };

        await saveQuoteToRepository({
            quoteRepository: { createQuote, saveQuoteRevision: vi.fn() },
            user: { uid: 'user-1', email: 'sales@example.com' },
            state,
            summary: {
                finalTotalSek: 1000,
                grossTotalSek: 1000,
                totalDiscountSek: 0
            },
            crmDealId: 'deal-1'
        });

        expect(createQuote).toHaveBeenCalledWith(expect.objectContaining({
            state
        }));
        expect(createQuote.mock.calls[0][0]).not.toHaveProperty('crmDealId');
        expect(state).not.toHaveProperty('crmDealId');
    });

    it('saves an opened linked quote under its original owner', async () => {
        const saveQuoteRevision = vi.fn().mockResolvedValue({
            metadata: {
                quoteId: 'quote-shared',
                latestVersion: 3,
                status: 'sent',
                quoteNumber: 'BRIXX - 260723-201'
            },
            revision: { version: 3 }
        });

        await saveQuoteToRepository({
            quoteRepository: { createQuote: vi.fn(), saveQuoteRevision },
            user: { uid: 'admin-editor', email: 'editor@brixx.se' },
            quoteOwnerUid: 'admin-owner',
            state: {
                activeQuoteId: 'quote-shared',
                quoteStatus: 'sent',
                customerInfo: { name: 'Delad kund' }
            },
            summary: {
                finalTotalSek: 2000,
                grossTotalSek: 2000,
                totalDiscountSek: 0
            }
        });

        expect(saveQuoteRevision).toHaveBeenCalledWith(expect.objectContaining({
            quoteId: 'quote-shared',
            ownerUid: 'admin-owner',
            user: { uid: 'admin-editor', email: 'editor@brixx.se' }
        }));
    });

    it('throws when the user is missing', async () => {
        await expect(() => saveQuoteToRepository({
            quoteRepository: {},
            user: null,
            state: { customerInfo: {} },
            summary: { finalTotalSek: 0, grossTotalSek: 0, totalDiscountSek: 0 }
        })).rejects.toThrow('Du måste vara inloggad för att spara offerter.');
    });

    it('buildSavedQuoteStatePatch preserves fallback state when metadata is partial', () => {
        const patch = buildSavedQuoteStatePatch(
            {
                metadata: { latestVersion: 4, status: 'won' },
                revision: { version: 4 }
            },
            {
                activeQuoteId: 'quote_999',
                quoteNumber: 'BRIXX - 260421-101'
            }
        );

        expect(patch.activeQuoteId).toBe('quote_999');
        expect(patch.quoteNumber).toBe('BRIXX - 260421-101');
        expect(patch.activeQuoteVersion).toBe(4);
        expect(patch.quoteStatus).toBe('won');
    });

    it('buildSavedQuoteStatePatch copies quote identity from saved metadata', () => {
        const patch = buildSavedQuoteStatePatch(
            {
                quoteId: 'quote_321',
                metadata: {
                    latestVersion: 7,
                    status: 'sent',
                    quoteNumber: 'BRIXX - 260422-107'
                },
                revision: { version: 7 }
            },
            {}
        );

        expect(patch).toMatchObject({
            activeQuoteId: 'quote_321',
            quoteNumber: 'BRIXX - 260422-107',
            activeQuoteVersion: 7,
            quoteStatus: 'sent'
        });
    });
});
