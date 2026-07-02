import { describe, expect, it } from 'vitest';
import { analyzeQuoteMargins, isManualMarginSource } from '../src/services/marginAnalysis';
import { normalizeQuoteMarginSettings } from '../src/services/marginSettingsService';

function createRow(overrides = {}) {
    return {
        model: 'BaHaMa Jumbrella',
        size: '3x3',
        unitPrice: 10000,
        qty: 1,
        gross: 10000,
        discountPct: 10,
        discountSek: 1000,
        net: 9000,
        isAddon: false,
        source: { type: 'builder', itemId: 'builder-1' },
        line: 'BaHaMa',
        sortModel: 'BaHaMa Jumbrella',
        sortSizeRaw: '3x3',
        sortKind: 'text',
        sortDimensions: [],
        originalIndex: 0,
        ...overrides
    };
}

function createSummary(rows) {
    return {
        totals: rows,
        grossTotalSek: rows.reduce((sum, row) => sum + row.gross, 0),
        totalDiscountSek: rows.reduce((sum, row) => sum + row.discountSek, 0),
        finalTotalSek: rows.reduce((sum, row) => sum + row.net, 0),
        globalDiscountAmt: 0
    };
}

describe('margin analysis', () => {
    it('computes cost, profit, margin, and discount impact from list-price margin settings', () => {
        const settings = normalizeQuoteMarginSettings({
            data: () => ({
                marginsByLine: { BaHaMa: 40 }
            })
        });

        const analysis = analyzeQuoteMargins(createSummary([
            createRow()
        ]), settings);

        expect(analysis.totalEstimatedCostSek).toBe(6000);
        expect(analysis.totalEstimatedGrossProfitSek).toBe(3000);
        expect(analysis.totalDiscountImpactSek).toBe(1000);
        expect(analysis.totalNetSek).toBe(9000);
        expect(analysis.actualMarginPct).toBeCloseTo(33.3333, 4);
        expect(analysis.includedRowCount).toBe(1);
    });

    it('includes manually priced product-line rows but flags them for review', () => {
        const settings = normalizeQuoteMarginSettings(null);
        const row = createRow({
            model: 'Speciallack',
            gross: 2000,
            net: 1800,
            discountSek: 200,
            source: {
                type: 'builder-custom-addon',
                itemId: 'builder-1',
                rowId: 'custom-1',
                categoryId: 'installation'
            }
        });

        const analysis = analyzeQuoteMargins(createSummary([row]), settings);

        expect(isManualMarginSource(row.source)).toBe(true);
        expect(analysis.includedRowCount).toBe(1);
        expect(analysis.reviewCounts['manual-pricing']).toBe(1);
        expect(analysis.rows[0].reviewCodes).toContain('manual-pricing');
    });

    it('excludes request-price and other-line rows but includes non-positive rows while flagging them', () => {
        const settings = normalizeQuoteMarginSettings(null);
        const analysis = analyzeQuoteMargins(createSummary([
            createRow({
                priceUponRequest: true,
                gross: 0,
                net: 0,
                discountSek: 0
            }),
            createRow({
                line: 'Övrigt',
                source: { type: 'custom', index: 0 }
            }),
            createRow({
                model: 'No net',
                net: 0,
                discountSek: 10000
            })
        ]), settings);

        expect(analysis.includedRowCount).toBe(1);
        expect(analysis.reviewCounts['price-upon-request']).toBe(1);
        expect(analysis.reviewCounts['other-line']).toBe(1);
        expect(analysis.reviewCounts['non-positive-net']).toBe(1);
    });

    it('flags rows that become loss-making after discounts', () => {
        const settings = normalizeQuoteMarginSettings({
            data: () => ({
                marginsByLine: { Fiesta: 30 }
            })
        });
        const analysis = analyzeQuoteMargins(createSummary([
            createRow({
                line: 'Fiesta',
                gross: 10000,
                discountPct: 50,
                discountSek: 5000,
                net: 5000
            })
        ]), settings);

        expect(analysis.includedRowCount).toBe(1);
        expect(analysis.totalEstimatedGrossProfitSek).toBe(-2000);
        expect(analysis.reviewCounts['negative-profit']).toBe(1);
        expect(analysis.rows[0].reviewCodes).toContain('negative-profit');
    });
});
