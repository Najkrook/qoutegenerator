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
    it('preserves negative unit prices and totals in PDF and Excel data', () => {
        const prepared = createPreparedQuote({ exportLanguage: 'en' }, {
            model: 'Pallet return', size: '-', unitPrice: -680, qty: 3,
            gross: -2040, net: -2040
        });
        expect(buildPdfTableData(prepared.commercial.productRows, String, { exportLanguage: 'en' })[0])
            .toEqual(['Pallet return', '-', '-680 SEK', '3', '-2040 SEK', '-2040 SEK', '0 SEK', '0%']);
        expect(buildPreparedExcelSheetData(prepared))
            .toContainEqual(['Pallet return', '-', -680, 3, -2040, -2040, 0, '0%']);
    });

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

    it('preserves a 200 percent discount as a negative row in PDF and Excel data', () => {
        const prepared = createPreparedQuote({ exportLanguage: 'sv' }, {
            model: 'Avdrag: textilduk',
            discountPct: 200,
            discountSek: 2000,
            net: -1000
        });
        const row = prepared.commercial.productRows[0];

        expect(buildPdfTableData([row], String, { exportLanguage: 'sv' })).toEqual([[
            'Avdrag: textilduk', '3x3', '1000 SEK', '1', '-1000 SEK', '1000 SEK', '2000 SEK', '200%'
        ]]);
        expect(buildPreparedExcelSheetData(prepared)).toContainEqual([
            'Avdrag: textilduk', '3x3', 1000, 1, -1000, 1000, -2000, '200%'
        ]);
    });
});
