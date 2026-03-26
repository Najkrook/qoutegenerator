import { describe, expect, it } from 'vitest';
import { normalizeRetailerData } from '../src/services/retailerService';

const mockCatalog = {
    BaHaMa: { name: 'BaHaMa', type: 'builder' },
    ClickitUp: { name: 'ClickitUp', type: 'grid' },
    Fiesta: { name: 'Fiesta', type: 'builder' }
};

describe('normalizeRetailerData', () => {
    it('trims whitespace from name', () => {
        const result = normalizeRetailerData({
            name: '  Markishuset  ',
            productLines: {}
        }, mockCatalog);
        expect(result.name).toBe('Markishuset');
    });

    it('rejects empty name', () => {
        expect(() => normalizeRetailerData({ name: '' }, mockCatalog)).toThrow('Retailer name is required.');
        expect(() => normalizeRetailerData({ name: '   ' }, mockCatalog)).toThrow('Retailer name is required.');
        expect(() => normalizeRetailerData({}, mockCatalog)).toThrow('Retailer name is required.');
    });

    it('clamps discount to 0..100', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 150 },
                ClickitUp: { enabled: true, discountPct: -10 }
            }
        }, mockCatalog);
        expect(result.productLines.BaHaMa.discountPct).toBe(100);
        expect(result.productLines.ClickitUp.discountPct).toBe(0);
    });

    it('zeros discount on disabled lines', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            productLines: {
                BaHaMa: { enabled: false, discountPct: 30 }
            }
        }, mockCatalog);
        expect(result.productLines.BaHaMa.enabled).toBe(false);
        expect(result.productLines.BaHaMa.discountPct).toBe(0);
    });

    it('strips unknown product line keys', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 20 },
                UnknownLine: { enabled: true, discountPct: 50 }
            }
        }, mockCatalog);
        expect(result.productLines).not.toHaveProperty('UnknownLine');
        expect(Object.keys(result.productLines)).toEqual(['BaHaMa', 'ClickitUp', 'Fiesta']);
    });

    it('fills missing product lines with disabled defaults', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 30 }
            }
        }, mockCatalog);
        expect(result.productLines.ClickitUp).toEqual({ enabled: false, discountPct: 0 });
        expect(result.productLines.Fiesta).toEqual({ enabled: false, discountPct: 0 });
    });

    it('preserves valid data unchanged', () => {
        const result = normalizeRetailerData({
            name: 'Solklar',
            notes: 'VIP retailer',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 22 },
                ClickitUp: { enabled: true, discountPct: 20 },
                Fiesta: { enabled: false, discountPct: 0 }
            }
        }, mockCatalog);
        expect(result).toEqual({
            name: 'Solklar',
            emails: [],
            notes: 'VIP retailer',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 22 },
                ClickitUp: { enabled: true, discountPct: 20 },
                Fiesta: { enabled: false, discountPct: 0 }
            }
        });
    });

    it('handles non-finite discount values', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            productLines: {
                BaHaMa: { enabled: true, discountPct: NaN },
                ClickitUp: { enabled: true, discountPct: undefined }
            }
        }, mockCatalog);
        expect(result.productLines.BaHaMa.discountPct).toBe(0);
        expect(result.productLines.ClickitUp.discountPct).toBe(0);
    });

    it('trims notes', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            notes: '  some notes  '
        }, mockCatalog);
        expect(result.notes).toBe('some notes');
    });

    it('only includes name, emails, productLines, and notes in output', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            extraField: 'should be stripped',
            productLines: {}
        }, mockCatalog);
        expect(Object.keys(result)).toEqual(['name', 'emails', 'productLines', 'notes']);
    });

    it('parses, lowercases, and deduplicates emails from a string', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            emails: ' USER1@test.com , user2@Test.com; user1@test.com\nuser3@test.com '
        }, mockCatalog);
        expect(result.emails).toEqual(['user1@test.com', 'user2@test.com', 'user3@test.com']);
    });

    it('handles emails as an array', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            emails: [' User1@test.com ', 'user2@test.com', 'user1@test.com']
        }, mockCatalog);
        expect(result.emails).toEqual(['user1@test.com', 'user2@test.com']);
    });

    it('handles empty or missing emails', () => {
        const result1 = normalizeRetailerData({ name: 'Test' }, mockCatalog);
        expect(result1.emails).toEqual([]);

        const result2 = normalizeRetailerData({ name: 'Test', emails: '   ,, ; \n ' }, mockCatalog);
        expect(result2.emails).toEqual([]);

        const result3 = normalizeRetailerData({ name: 'Test', emails: [' ', ''] }, mockCatalog);
        expect(result3.emails).toEqual([]);
    });
});

