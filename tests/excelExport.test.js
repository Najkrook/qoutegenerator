import { beforeEach, describe, expect, it, vi } from 'vitest';

const xlsxState = vi.hoisted(() => ({
    sheetData: null,
    worksheet: null,
    workbook: {},
    appendedSheet: null,
    writeFile: vi.fn()
}));

vi.mock('xlsx', () => ({
    utils: {
        aoa_to_sheet: vi.fn((data) => {
            xlsxState.sheetData = data;
            const worksheet = {
                '!ref': 'A1:H4',
                A1: { v: data[0]?.[0] },
                A2: { v: data[1]?.[0] },
                B2: { v: data[1]?.[1] },
                A3: { v: data[2]?.[0] },
                A4: { v: data[3]?.[0] }
            };
            xlsxState.worksheet = worksheet;
            return worksheet;
        }),
        decode_range: vi.fn(() => ({ s: { r: 0, c: 0 }, e: { r: 3, c: 7 } })),
        encode_cell: vi.fn(({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`),
        book_new: vi.fn(() => xlsxState.workbook),
        book_append_sheet: vi.fn((workbook, worksheet, sheetName) => {
            xlsxState.appendedSheet = { workbook, worksheet, sheetName };
        })
    },
    writeFile: xlsxState.writeFile
}));

import { generateExcel } from '../src/features/excelExport';
import { prepareQuote } from '../src/services/quotePreparation';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function createPreparedQuote(exportLanguage = 'en', stateOverrides = {}) {
    const state = {
        ...createInitialQuoteState(),
        exportLanguage,
        customerInfo: {
            ...createInitialQuoteState().customerInfo,
            company: 'BRIXX customer',
            date: '2026-08-12'
        },
        ...stateOverrides
    };
    const totals = {
        totals: [{
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
            originalIndex: 0
        }],
        grossTotalSek: 1000,
        totalDiscountSek: 0,
        finalTotalSek: 1000,
        globalDiscountAmt: 0
    };

    return prepareQuote({ state, totals, audience: { isRetailer: false } });
}

describe('generateExcel', () => {
    beforeEach(() => {
        xlsxState.sheetData = null;
        xlsxState.worksheet = null;
        xlsxState.appendedSheet = null;
        xlsxState.writeFile.mockClear();
    });

    it('writes the prepared quote through the existing styled English workbook adapter', () => {
        const prepared = createPreparedQuote('en');

        generateExcel(prepared);

        expect(xlsxState.sheetData[0]).toEqual(['Quote']);
        expect(xlsxState.sheetData).toContainEqual(['Company', 'BRIXX customer']);
        expect(xlsxState.appendedSheet).toEqual({
            workbook: xlsxState.workbook,
            worksheet: xlsxState.worksheet,
            sheetName: 'Quote'
        });
        expect(xlsxState.worksheet['!cols']).toEqual([
            { wch: 38 },
            { wch: 88 },
            { wch: 24 },
            { wch: 24 },
            { wch: 24 },
            { wch: 24 },
            { wch: 22 },
            { wch: 18 }
        ]);
        expect(xlsxState.worksheet['!rows']).toHaveLength(xlsxState.sheetData.length);
        expect(xlsxState.worksheet.A1.s.alignment).toEqual({ vertical: 'top', wrapText: true });
        expect(xlsxState.writeFile).toHaveBeenCalledWith(
            xlsxState.workbook,
            'Quote.xlsx',
            { cellStyles: true }
        );
    });

    it('uses the prepared visibility decision to omit zero-discount references', () => {
        const prepared = createPreparedQuote('en', {
            hideZeroDiscountReferencesInPdf: true
        });

        generateExcel(prepared);

        expect(prepared.visibility.discountReferences).toBe('hidden-zero');
        expect(xlsxState.sheetData).toContainEqual([
            'Model',
            'Size',
            'Unit price (Excl. VAT)',
            'Qty',
            'Your Price'
        ]);
        expect(xlsxState.sheetData).toContainEqual(['Jumbrella', '3x3', 1000, 1, 1000]);
        expect(xlsxState.sheetData.flat()).not.toContain('Recommended Price');
        expect(xlsxState.sheetData.flat()).not.toContain('Discount in SEK');
        expect(xlsxState.sheetData.flat()).not.toContain('Discount in %');
    });

    it('retains the Swedish filename, sheet name, and long-row sizing behavior', () => {
        const prepared = createPreparedQuote('sv', {
            customerInfo: {
                ...createInitialQuoteState().customerInfo,
                company: 'A'.repeat(90),
                date: '2026-08-12'
            }
        });

        generateExcel(prepared);

        expect(xlsxState.appendedSheet.sheetName).toBe('Offert');
        expect(xlsxState.worksheet['!rows'][1]).toEqual({ hpt: 30 });
        expect(xlsxState.writeFile).toHaveBeenCalledWith(
            xlsxState.workbook,
            'Offert.xlsx',
            { cellStyles: true }
        );
    });
});
