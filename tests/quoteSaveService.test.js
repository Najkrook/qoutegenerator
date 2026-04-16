import { describe, expect, it, vi } from 'vitest';
import { buildSavedQuoteStatePatch, saveQuoteToRepository } from '../src/services/quoteSaveService';

describe('quoteSaveService', () => {
    it('creates a new quote when activeQuoteId is missing', async () => {
        const createQuote = vi.fn(async () => ({
            quoteId: 'quote_123',
            metadata: { latestVersion: 1, status: 'draft' },
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
        expect(result.statePatch.activeQuoteVersion).toBe(1);
        expect(result.statePatch.quoteStatus).toBe('draft');
    });

    it('saves a new revision when activeQuoteId exists', async () => {
        const createQuote = vi.fn();
        const saveQuoteRevision = vi.fn(async () => ({
            metadata: {
                latestVersion: 3,
                status: 'sent',
                scriveStatus: 'pending'
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
                customerInfo: { name: 'Testkund' },
                scriveStatus: 'not_sent'
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
        expect(result.statePatch.activeQuoteVersion).toBe(3);
        expect(result.statePatch.quoteStatus).toBe('sent');
        expect(result.statePatch.scriveStatus).toBe('pending');
    });

    it('throws when the user is missing', async () => {
        await expect(() => saveQuoteToRepository({
            quoteRepository: {},
            user: null,
            state: { customerInfo: {} },
            summary: { finalTotalSek: 0, grossTotalSek: 0, totalDiscountSek: 0 }
        })).rejects.toThrow(/inloggad.*spara offerter/i);
    });

    it('buildSavedQuoteStatePatch preserves fallback state when metadata is partial', () => {
        const patch = buildSavedQuoteStatePatch(
            {
                metadata: { latestVersion: 4, status: 'won' },
                revision: { version: 4 }
            },
            {
                activeQuoteId: 'quote_999',
                scriveEnabled: true,
                scriveStatus: 'closed',
                scriveDocumentId: 'doc_1'
            }
        );

        expect(patch.activeQuoteId).toBe('quote_999');
        expect(patch.activeQuoteVersion).toBe(4);
        expect(patch.quoteStatus).toBe('won');
        expect(patch.scriveEnabled).toBe(true);
        expect(patch.scriveStatus).toBe('closed');
        expect(patch.scriveDocumentId).toBe('doc_1');
    });

    it('buildSavedQuoteStatePatch copies quote identity and scrive fields from saved metadata', () => {
        const patch = buildSavedQuoteStatePatch(
            {
                quoteId: 'quote_321',
                metadata: {
                    latestVersion: 7,
                    status: 'sent',
                    scriveEnabled: true,
                    scriveStatus: 'pending',
                    scriveDocumentId: 'scrive_7',
                    scriveSignerName: 'Ada',
                    scriveSignerEmail: 'ada@example.com',
                    scriveLastError: null,
                    scriveSentAtMs: 1700000000000,
                    scriveLastEventAtMs: 1700000000100,
                    scriveCompletedAtMs: null
                },
                revision: { version: 7 }
            },
            {}
        );

        expect(patch).toMatchObject({
            activeQuoteId: 'quote_321',
            activeQuoteVersion: 7,
            quoteStatus: 'sent',
            scriveEnabled: true,
            scriveStatus: 'pending',
            scriveDocumentId: 'scrive_7',
            scriveSignerName: 'Ada',
            scriveSignerEmail: 'ada@example.com',
            scriveLastError: null,
            scriveSentAtMs: 1700000000000,
            scriveLastEventAtMs: 1700000000100,
            scriveCompletedAtMs: null
        });
    });
});
