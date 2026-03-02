import { describe, expect, it } from 'vitest';
import { computeQuoteTotals } from '../services/calculationEngine.js';
import { createCatalogFixture, createStateFixture } from './fixtures/calculationFixtures.js';

describe('computeQuoteTotals', () => {
    it('computes mixed quote totals deterministically', () => {
        const summary = computeQuoteTotals({
            state: createStateFixture(),
            catalogData: createCatalogFixture()
        });

        expect(summary.totals).toHaveLength(5);
        expect(summary.grossTotalSek).toBe(79800);
        expect(summary.totalDiscountSek).toBe(7575);
        expect(summary.finalTotalSek).toBe(72225);
        expect(summary.globalDiscountAmt).toBe(0);
    });

    it('does not apply global discount as a second discount', () => {
        const state = createStateFixture({
            globalDiscountPct: 25,
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 15,
                    addons: []
                }
            ],
            gridSelections: {},
            customCosts: []
        });

        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        expect(summary.grossTotalSek).toBe(30000);
        expect(summary.totalDiscountSek).toBe(4500);
        expect(summary.finalTotalSek).toBe(25500);
        expect(summary.globalDiscountAmt).toBe(0);
    });

    it('supports zero quantities, full discounts, and decimal exchange rates', () => {
        const state = createStateFixture({
            exchangeRate: 11.25,
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 0,
                    discountPct: 0,
                    addons: []
                }
            ],
            gridSelections: {
                ClickitUP: {
                    items: {
                        'ClickitUP Section|1200': { qty: 2, discountPct: 100 }
                    },
                    addons: {}
                }
            },
            customCosts: []
        });

        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        expect(summary.grossTotalSek).toBe(27000);
        expect(summary.totalDiscountSek).toBe(27000);
        expect(summary.finalTotalSek).toBe(0);
        expect(summary.totals.every((row) => Number.isFinite(row.net))).toBe(true);
    });

    it('returns a stable empty result for empty configuration', () => {
        const summary = computeQuoteTotals({
            state: {
                builderItems: [],
                gridSelections: {},
                customCosts: [],
                exchangeRate: 12,
                globalDiscountPct: 0
            },
            catalogData: {}
        });

        expect(summary.totals).toEqual([]);
        expect(summary.grossTotalSek).toBe(0);
        expect(summary.totalDiscountSek).toBe(0);
        expect(summary.finalTotalSek).toBe(0);
        expect(summary.globalDiscountAmt).toBe(0);
    });
});
