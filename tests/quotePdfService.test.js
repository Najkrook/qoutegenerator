import { beforeEach, describe, expect, it, vi } from 'vitest';

const generatePDF = vi.hoisted(() => vi.fn(() => new Blob(['pdf'])));

vi.mock('../src/features/pdfExport', () => ({ generatePDF }));

import { createQuotePdfBlob } from '../src/services/quotePdfService';
import { prepareSavedQuoteForPdf } from '../src/services/savedQuotePdfPreparation';
import { prepareQuote, createQuoteCommercialSnapshot } from '../src/services/quotePreparation';
import {
    buildPdfTableData,
    buildPreparedExcelSheetData
} from '../src/services/exportDataBuilders';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function createPreparedQuote() {
    const state = {
        ...createInitialQuoteState(),
        exportLanguage: 'en',
        pdfThemeId: 'roslagsmarkisen',
        hideZeroDiscountReferencesInPdf: true,
        customerInfo: {
            ...createInitialQuoteState().customerInfo,
            date: '2026-08-12'
        },
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

describe('prepareSavedQuoteForPdf', () => {
    const metadata = { quoteId: 'saved-quote', quoteNumber: 'BRIXX-123', status: 'sent', originType: 'internal' };
    const revision = {
        version: 2,
        savedAtMs: Date.parse('2026-08-12T12:00:00Z'),
        state: { customerInfo: { company: 'Sparad kund' } },
        commercialSnapshot: null
    };

    it('restores saved commercial values even when the state would calculate different prices', () => {
        const prepared = createPreparedQuote();
        const saved = {
            ...revision,
            state: { ...prepared.persistenceSnapshot, customCosts: [{ description: 'Changed price', price: 99999, qty: 1 }], builderItems: [] },
            commercialSnapshot: createQuoteCommercialSnapshot(prepared)
        };
        const before = JSON.stringify(saved);
        const result = prepareSavedQuoteForPdf({ revision: saved, metadata });

        expect(result.usesCurrentCatalog).toBe(false);
        expect(result.preparedQuote.commercial.productTotals).toEqual(prepared.commercial.productTotals);
        expect(result.preparedQuote.commercial.contractingWork).toEqual(prepared.commercial.contractingWork);
        expect(result.preparedQuote.commercial.productRows).toMatchObject(saved.commercialSnapshot.productRows);
        expect(result.preparedQuote.presentation).toMatchObject({ exportLanguage: 'en', pdfThemeId: 'roslagsmarkisen' });
        expect(result.preparedQuote.agreement.quoteIdentity).toEqual({ quoteId: 'saved-quote', quoteNumber: 'BRIXX-123', version: 2, status: 'sent' });
        expect(JSON.stringify(saved)).toBe(before);
    });

    it('hydrates partial legacy state and uses revision date only when the quote date is absent', () => {
        const result = prepareSavedQuoteForPdf({ revision, metadata });
        expect(result.usesCurrentCatalog).toBe(true);
        expect(result.preparedQuote.agreement.effectiveQuoteDate).toBe('2026-08-12');
        expect(result.preparedQuote.commercial.productTotals.finalTotalSek).toBe(0);
        const dated = prepareSavedQuoteForPdf({
            revision: { ...revision, state: { customerInfo: { date: '2025-01-02' } } }, metadata
        });
        expect(dated.preparedQuote.agreement.effectiveQuoteDate).toBe('2025-01-02');
    });

    it('preserves historical retailer theme and suppresses internal contracting work for legacy revisions', () => {
        const result = prepareSavedQuoteForPdf({
            revision: { ...revision, state: createPreparedQuote().persistenceSnapshot },
            metadata: { ...metadata, originType: 'retailer' }
        });
        expect(result.preparedQuote.presentation.pdfThemeId).toBe('roslagsmarkisen');
        expect(result.preparedQuote.visibility.contractingWork).toBe('suppressed-retailer');
        expect(result.preparedQuote.commercial.contractingWork).toBeNull();
    });

    it('normalizes retailer themes against supplied permissions', () => {
        const prepared = createPreparedQuote();
        const result = prepareSavedQuoteForPdf({
            revision: { ...revision, state: prepared.persistenceSnapshot, commercialSnapshot: createQuoteCommercialSnapshot(prepared) },
            metadata,
            audience: { isRetailer: true, allowedPdfThemes: [] }
        });
        expect(result.preparedQuote.presentation.pdfThemeId).toBe('brixx');
    });

    it('rejects absent state and invalid snapshots instead of silently recalculating them', () => {
        expect(() => prepareSavedQuoteForPdf({ revision: { ...revision, state: null }, metadata })).toThrow('Revisionen saknar sparat tillstånd.');
        expect(() => prepareSavedQuoteForPdf({ revision: { ...revision, commercialSnapshot: {} }, metadata })).toThrow();
    });
});

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
            true,
            {
                activeRows: [{
                    id: 'work-1',
                    workPackage: 'Installation',
                    scope: 'Complete installation',
                    unit: 'project',
                    priceExVatSek: 1200
                }],
                customerRows: [{
                    id: 'work-1',
                    workPackage: 'Installation',
                    scope: 'Complete installation',
                    unit: 'project',
                    priceExVatSek: 1200
                }],
                costTotalSek: 1200,
                baseTotalSek: 1200,
                marginEnabled: false,
                marginPercent: 0,
                marginAmountSek: 0,
                allowanceSek: 120,
                lowerIndicativeSek: 1080,
                upperIndicativeSek: 1320,
                ataEnabled: true,
                ataPercent: 10
            }
        );
    });

    it('keeps PDF and XLSX commercial meaning in parity from one prepared quote', async () => {
        const state = {
            ...createInitialQuoteState(),
            exportLanguage: 'en',
            includesVat: true,
            globalDiscountPct: 10,
            customerInfo: {
                ...createInitialQuoteState().customerInfo,
                company: 'Parity customer',
                date: '2026-08-12'
            },
            contractingWork: {
                enabled: true,
                projectName: 'Terrace',
                rows: [{
                    id: 'work-1',
                    workPackage: 'Installation',
                    scope: 'Complete installation',
                    unit: 'project',
                    priceExVatSek: 100
                }],
                margin: { enabled: true, percent: 20 },
                ata: { enabled: true, percent: 10 }
            }
        };
        const totals = {
            totals: [
                {
                    model: 'Jumbrella',
                    size: '3x3',
                    unitPrice: 100,
                    qty: 2,
                    gross: 200,
                    discountPct: 10,
                    discountSek: 20,
                    net: 180,
                    isAddon: false,
                    source: { type: 'builder', itemId: 'item-1' },
                    line: 'BaHaMa',
                    sortModel: 'Jumbrella',
                    sortSizeRaw: '3x3',
                    sortKind: 'dimension',
                    sortDimensions: [3, 3],
                    originalIndex: 0
                },
                {
                    model: 'Custom accessory',
                    size: '-',
                    unitPrice: 0,
                    qty: 1,
                    gross: 0,
                    discountPct: 0,
                    discountSek: 0,
                    net: 0,
                    isAddon: true,
                    isCustom: true,
                    priceUponRequest: true,
                    source: { type: 'custom-cost', index: 0 },
                    line: 'Custom',
                    sortModel: 'Custom accessory',
                    sortSizeRaw: '-',
                    sortKind: 'text',
                    sortDimensions: [],
                    originalIndex: 1
                }
            ],
            grossTotalSek: 200,
            totalDiscountSek: 20,
            finalTotalSek: 162,
            globalDiscountAmt: 18
        };
        const prepared = prepareQuote({ state, totals, audience: { isRetailer: false } });

        await createQuotePdfBlob(prepared);
        const [pdfState, pdfSummary] = generatePDF.mock.calls.at(-1);
        const pdfRows = buildPdfTableData(pdfSummary.totals, String, {
            includesVat: pdfState.includesVat,
            exportLanguage: pdfState.exportLanguage
        });
        const excelRows = buildPreparedExcelSheetData(prepared);

        expect(pdfRows[0]).toEqual([
            'Jumbrella', '3x3', '125 SEK', '2', '225 SEK', '250 SEK', '25 SEK', '10%'
        ]);
        expect(excelRows).toContainEqual([
            'Jumbrella', '3x3', 125, 2, 225, 250, -25, '10%'
        ]);
        expect(pdfRows[1]).toEqual([
            'Custom accessory', '-', 'Price on request', '1',
            'Price on request', 'Price on request', '-', '-'
        ]);
        expect(excelRows).toContainEqual([
            'Custom accessory', '-', 'Price on request', 1,
            'Price on request', 'Price on request', '-', '-'
        ]);
        expect(pdfSummary).toMatchObject({
            grossTotalSek: 200,
            totalDiscountSek: 20,
            finalTotalSek: 162,
            globalDiscountAmt: 18
        });
        expect(excelRows).toContainEqual(['Total Incl. VAT', '', '', '', 203, 250, -25, '']);
        expect(excelRows).toContainEqual(['VAT 25%', '', '', '', 41, '', '', '']);
        expect(excelRows).toContainEqual(['Product total excl. VAT', '', '', '', 162, '', '', '']);
        expect(pdfState.contractingWork.rows[0].priceExVatSek).toBe(120);
        expect(excelRows).toContainEqual(['Installation', 'Complete installation', 'project', 120]);

        const retailerPrepared = prepareQuote({ state, totals, audience: { isRetailer: true } });
        await createQuotePdfBlob(retailerPrepared);
        const [retailerPdfState] = generatePDF.mock.calls.at(-1);
        const retailerExcelRows = buildPreparedExcelSheetData(retailerPrepared);

        expect(retailerPrepared.visibility.contractingWork).toBe('suppressed-retailer');
        expect(retailerPdfState.contractingWork).toMatchObject({ enabled: false, rows: [] });
        expect(retailerExcelRows.flat()).not.toContain('Installation');
    });
});
