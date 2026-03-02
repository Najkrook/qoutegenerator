import { describe, expect, it } from 'vitest';
import { buildSendPayload, isValidEmail } from '../services/scrivePayload.js';

describe('scriveApi helpers', () => {
    it('validates signer email', () => {
        expect(isValidEmail('anna@example.se')).toBe(true);
        expect(isValidEmail('bad-email')).toBe(false);
    });

    it('buildSendPayload throws for missing signer email', () => {
        expect(() => buildSendPayload({
            quoteId: 'q1',
            revisionVersion: 2,
            signerName: 'Anna',
            signerEmail: 'bad-email',
            quoteTitle: 'Offert',
            fileName: 'offert.pdf',
            pdfBase64: 'YWJj'
        })).toThrow(/Ogiltig e-postadress/);
    });

    it('buildSendPayload normalizes payload', () => {
        const payload = buildSendPayload({
            quoteId: 'q1',
            revisionVersion: 2,
            signerName: ' Anna ',
            signerEmail: 'anna@example.se',
            quoteTitle: '  Offert  ',
            fileName: ' quote.pdf ',
            pdfBase64: 'YWJj'
        });

        expect(payload.quoteId).toBe('q1');
        expect(payload.revisionVersion).toBe(2);
        expect(payload.signerName).toBe('Anna');
        expect(payload.signerEmail).toBe('anna@example.se');
        expect(payload.quoteTitle).toBe('Offert');
    });
});
