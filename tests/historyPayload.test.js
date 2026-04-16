import { describe, expect, it } from 'vitest';
import { buildHistoryOpenQuotePayload } from '../src/views/historyPayload';

describe('historyPayload', () => {
    it('builds a reopen payload from revision state with object customer info', () => {
        const payload = buildHistoryOpenQuotePayload(
            {
                step: 4,
                customerInfo: {
                    name: 'Historik Kund',
                    company: 'Brixx AB'
                },
                selectedLines: ['ClickitUp']
            },
            'quote_123',
            5,
            'sent'
        );

        expect(payload.step).toBe(4);
        expect(payload.selectedLines).toEqual(['ClickitUp']);
        expect(payload.customerInfo).toEqual({
            name: 'Historik Kund',
            company: 'Brixx AB'
        });
        expect(payload.activeQuoteId).toBe('quote_123');
        expect(payload.activeQuoteVersion).toBe(5);
        expect(payload.quoteStatus).toBe('sent');
    });

    it('falls back to an empty customer info patch when customerInfo is missing', () => {
        const payload = buildHistoryOpenQuotePayload(
            {
                step: 2
            },
            'quote_234',
            2,
            'draft'
        );

        expect(payload.customerInfo).toEqual({});
        expect(payload.activeQuoteId).toBe('quote_234');
        expect(payload.activeQuoteVersion).toBe(2);
        expect(payload.quoteStatus).toBe('draft');
    });

    it('falls back to an empty customer info patch when customerInfo is malformed', () => {
        const payload = buildHistoryOpenQuotePayload(
            {
                customerInfo: 'broken'
            },
            'quote_345',
            3,
            'won'
        );

        expect(payload.customerInfo).toEqual({});
        expect(payload.quoteStatus).toBe('won');
    });

    it('survives a non-object revision state', () => {
        const payload = buildHistoryOpenQuotePayload(
            'broken',
            'quote_456',
            0,
            'draft'
        );

        expect(payload.customerInfo).toEqual({});
        expect(payload.activeQuoteId).toBe('quote_456');
        expect(payload.activeQuoteVersion).toBe(1);
        expect(payload.quoteStatus).toBe('draft');
    });

    it('normalizes invalid metadata status while preserving identity fields', () => {
        const payload = buildHistoryOpenQuotePayload(
            {
                customerInfo: {
                    name: 'Fallback Kund'
                }
            },
            'quote_567',
            7,
            'bad-status'
        );

        expect(payload.customerInfo).toEqual({
            name: 'Fallback Kund'
        });
        expect(payload.activeQuoteId).toBe('quote_567');
        expect(payload.activeQuoteVersion).toBe(7);
        expect(payload.quoteStatus).toBe('draft');
    });
});
