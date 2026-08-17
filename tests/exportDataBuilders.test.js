import { describe, expect, it } from 'vitest';

import {
    buildPdfTableData,
    buildPreparedExcelSheetData
} from '../src/services/exportDataBuilders';
import { prepareQuote } from '../src/services/quotePreparation';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function createPreparedQuote(stateOverrides = {}, rowOverrides = {}) {
    const state = {
        ...createInitialQuoteState(),
        customerInfo: {
            ...createInitialQuoteState().customerInfo,
            company: 'BRIXX customer',
            date: '2026-08-12'
        },
        ...stateOverrides
    };
    const row = {
        model: 'Jumbrella',
        size: '3x3',
        unitPrice: 1000,
        qty: 1,
        gross: 1000,
        discountPct: 0,
        discountSek: 0,
        net: 1000,
        isAddon: false,
        source: { type: 'builder', itemId: 'item-1' },
        line: 'BaHaMa',
        sortModel: 'Jumbrella',
        sortSizeRaw: '3x3',
        sortKind: 'dimension',
        sortDimensions: [3, 3],
        originalIndex: 0,
        ...rowOverrides
    };
    const totals = {
        totals: [row],
        grossTotalSek: row.gross,
        totalDiscountSek: row.discountSek,
        finalTotalSek: row.net,
        globalDiscountAmt: 0
    };

    return prepareQuote({ state, totals, audience: { isRetailer: false } });
}

describe('export format adapters', () => {
    it('maps prepared customer and product meaning into worksheet rows', () => {
        const rows = buildPreparedExcelSheetData(createPreparedQuote({ exportLanguage: 'en' }));

        expect(rows).toContainEqual(['Company', 'BRIXX customer']);
        expect(rows).toContainEqual([
            'Jumbrella', '3x3', 1000, 1, 1000, 1000, 0, '0%'
        ]);
        expect(rows).toContainEqual(['Total Excl. VAT', '', '', '', 1000, 1000, 0, '']);
    });

    it('maps a prepared visibility decision to the reduced worksheet columns', () => {
        const rows = buildPreparedExcelSheetData(createPreparedQuote({
            exportLanguage: 'en',
            hideZeroDiscountReferencesInPdf: true
        }));

        expect(rows).toContainEqual([
            'Model', 'Size', 'Unit price (Excl. VAT)', 'Qty', 'Your Price'
        ]);
        expect(rows).toContainEqual(['Jumbrella', '3x3', 1000, 1, 1000]);
    });

    it('formats PDF cells, including price-on-request markers, without owning preparation policy', () => {
        const row = createPreparedQuote({}, {
            model: 'Custom accessory',
            unitPrice: 0,
            gross: 0,
            net: 0,
            priceUponRequest: true
        }).commercial.productRows[0];

        expect(buildPdfTableData([row], String, { exportLanguage: 'en' })).toEqual([[
            'Custom accessory', '3x3', 'Price on request', '1',
            'Price on request', 'Price on request', '-', '-'
        ]]);
    });
});
