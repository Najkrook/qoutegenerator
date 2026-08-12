import { beforeEach, describe, expect, it, vi } from 'vitest';

const generatePDF = vi.hoisted(() => vi.fn(() => new Blob(['pdf'])));

vi.mock('../src/features/pdfExport', () => ({ generatePDF }));

import { createQuotePdfBlob } from '../src/services/quotePdfService';
import { prepareQuote } from '../src/services/quotePreparation';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function createPreparedQuote() {
    const state = {
        ...createInitialQuoteState(),
        exportLanguage: 'en',
        pdfThemeId: 'roslagsmarkisen',
        hideZeroDiscountReferencesInPdf: true,
        contractingWork: {
            enabled: true,
            projectName: 'Terrace',
            rows: [{
                id: 'work-1',
                workPackage: 'Installation',
                scope: 'Complete installation',
                unit: 'project',
                priceExVatSek: 1000
            }],
            margin: { enabled: true, percent: 20 },
            ata: { enabled: true, percent: 10 }
        }
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

    return prepareQuote({
        state,
        totals,
        audience: { isRetailer: false, allowedPdfThemes: [] }
    });
}

describe('createQuotePdfBlob', () => {
    beforeEach(() => {
        generatePDF.mockClear();
    });

    it('adapts one prepared Quote result without reinterpreting canonical state', async () => {
        const prepared = createPreparedQuote();

        const result = await createQuotePdfBlob(prepared);

        expect(result).toBeInstanceOf(Blob);
        expect(generatePDF).toHaveBeenCalledWith(
            expect.objectContaining({
                includesVat: false,
                exportLanguage: 'en',
                pdfThemeId: 'roslagsmarkisen',
                hideZeroDiscountReferencesInPdf: true,
                contractingWork: {
                    enabled: true,
                    projectName: 'Terrace',
                    rows: [{
                        id: 'work-1',
                        workPackage: 'Installation',
                        scope: 'Complete installation',
                        unit: 'project',
                        priceExVatSek: 1200
                    }],
                    margin: { enabled: false, percent: 0 },
                    ata: { enabled: true, percent: 10 }
                }
            }),
            expect.objectContaining({
                totals: [expect.objectContaining({ model: 'Jumbrella', qty: 1 })],
                grossTotalSek: 1000,
                totalDiscountSek: 0,
                finalTotalSek: 1000,
                globalDiscountAmt: 0
            }),
            true
        );
    });
});
