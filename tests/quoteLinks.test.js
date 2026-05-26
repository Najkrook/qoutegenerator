import { describe, expect, it } from 'vitest';
import {
    buildQuoteRevisionLink,
    parseQuoteRevisionLinkParams
} from '../src/navigation/quoteLinks';

describe('quote revision links', () => {
    it('builds a quote revision link without owner', () => {
        expect(buildQuoteRevisionLink({ quoteId: 'q1', version: 2 })).toBe('/quotes?openQuote=q1&version=2');
    });

    it('builds a quote revision link with owner', () => {
        expect(buildQuoteRevisionLink({ quoteId: 'q1', version: 2, ownerUid: 'uid-123' })).toBe('/quotes?openQuote=q1&version=2&owner=uid-123');
    });

    it('omits empty owner values', () => {
        expect(buildQuoteRevisionLink({ quoteId: 'q1', version: 2, ownerUid: null })).toBe('/quotes?openQuote=q1&version=2');
        expect(buildQuoteRevisionLink({ quoteId: 'q1', version: 2, ownerUid: undefined })).toBe('/quotes?openQuote=q1&version=2');
        expect(buildQuoteRevisionLink({ quoteId: 'q1', version: 2, ownerUid: '   ' })).toBe('/quotes?openQuote=q1&version=2');
    });

    it('parses quote revision link params', () => {
        expect(parseQuoteRevisionLinkParams(new URLSearchParams('openQuote=q1&version=2&owner=uid-123'))).toEqual({
            quoteId: 'q1',
            version: 2,
            ownerUid: 'uid-123'
        });
    });

    it('returns null when openQuote is missing', () => {
        expect(parseQuoteRevisionLinkParams(new URLSearchParams('version=2'))).toBeNull();
        expect(parseQuoteRevisionLinkParams(new URLSearchParams('openQuote=&version=2'))).toBeNull();
    });

    it('normalizes invalid versions to latest', () => {
        expect(parseQuoteRevisionLinkParams(new URLSearchParams('openQuote=q1&version=nope'))?.version).toBe(0);
        expect(parseQuoteRevisionLinkParams(new URLSearchParams('openQuote=q1&version=-3'))?.version).toBe(0);
        expect(buildQuoteRevisionLink({ quoteId: 'q1', version: Number.NaN })).toBe('/quotes?openQuote=q1&version=0');
    });

    it('encodes and round-trips values', () => {
        const path = buildQuoteRevisionLink({ quoteId: 'quote 1/2', version: 4, ownerUid: 'owner@example.com' });
        const parsed = parseQuoteRevisionLinkParams(new URLSearchParams(path.split('?')[1]));

        expect(path).toBe('/quotes?openQuote=quote+1%2F2&version=4&owner=owner%40example.com');
        expect(parsed).toEqual({
            quoteId: 'quote 1/2',
            version: 4,
            ownerUid: 'owner@example.com'
        });
    });
});
