import { describe, expect, it } from 'vitest';
import { computeQuoteTotals } from '../src/services/calculationEngine';
import {
    buildExcelSheetData,
    buildExportSummary,
    buildPdfTableData,
    hasZeroDiscountSummary,
    shouldHideDiscountReferencesInPdf
} from '../src/services/exportDataBuilders';
import { createCatalogFixture, createStateFixture } from './fixtures/calculationFixtures';

function formatSek(value) {
    return Math.round(value).toString();
}

describe('export data builders', () => {
    it('buildExportSummary is VAT-aware and consistent with totals', () => {
        const state = createStateFixture({ includesVat: true });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });
        const exportSummary = buildExportSummary(state, summary);

        expect(exportSummary.finalTotalSek).toBe(summary.finalTotalSek);
        expect(exportSummary.grossTotalSek).toBe(summary.grossTotalSek);
        expect(exportSummary.totalDiscountSek).toBe(summary.totalDiscountSek);
        expect(exportSummary.vatAmount).toBe(summary.finalTotalSek * 0.25);
        expect(exportSummary.totalWithVat).toBe(summary.finalTotalSek * 1.25);
    });

    it('buildPdfTableData reflects line totals from summary computation', () => {
        const state = createStateFixture();
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });
        const rows = buildPdfTableData(summary.totals, formatSek);

        expect(rows).toHaveLength(summary.totals.length);
        expect(rows[0]).toHaveLength(8);
        expect(rows[0][0]).toContain('BaHaMa');
        expect(rows[0][4]).toContain(formatSek(summary.totals[0].net));
        expect(rows.some((row) => String(row[0]).includes('Overgripande Rabatt'))).toBe(false);
    });

    it('buildPdfTableData can omit discount and recommended-price columns for zero-discount PDF exports', () => {
        const state = createStateFixture({
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }
            ],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 1, discountPct: 0 }
                    },
                    addons: {
                        'door-right': { qty: 1, discountPct: 0 }
                    }
                }
            },
            globalDiscountPct: 0
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const rows = buildPdfTableData(summary.totals, formatSek, {
            hideDiscountColumns: true,
            hideRecommendedPriceColumn: true
        });

        expect(rows).toHaveLength(summary.totals.length);
        expect(rows[0]).toHaveLength(5);
        expect(rows[0][4]).toContain(formatSek(summary.totals[0].net));
    });

    it('buildExcelSheetData totals row is aligned with computed summary', () => {
        const state = createStateFixture({ includesVat: false });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const wsData = buildExcelSheetData(state, summary);
        const totalsRow = wsData.find((row) => row[0] === 'Totalt Exkl. Moms');
        const customerLabels = wsData.slice(0, 6).map((row) => row[0]);

        expect(totalsRow).toBeTruthy();
        expect(customerLabels).toContain('Foretag');
        expect(customerLabels).toContain('Projektreferens');
        expect(customerLabels).toContain('Er referens');
        expect(customerLabels).not.toContain('Kund');
        expect(totalsRow[4]).toBe(Math.round(summary.finalTotalSek));
        expect(totalsRow[5]).toBe(Math.round(summary.grossTotalSek));
        expect(totalsRow[6]).toBe(Math.round(-summary.totalDiscountSek));
    });

    it('includes custom builder add-ons in export rows', () => {
        const state = createStateFixture({
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [
                        {
                            id: 'custom_1',
                            qty: 2,
                            discountPct: 10,
                            isCustom: true,
                            name: 'Speciallack',
                            price: 500,
                            categoryId: 'installation'
                        }
                    ]
                }
            ],
            gridSelections: {},
            customCosts: []
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const wsData = buildExcelSheetData(state, summary);
        const pdfRows = buildPdfTableData(summary.totals, formatSek);

        expect(wsData.some((row) => row[0] === 'Tillval: Speciallack')).toBe(true);
        expect(pdfRows.some((row) => row[0] === 'Tillval: Speciallack')).toBe(true);
    });

    it('uses renamed builder rows and preserved block order in export rows', () => {
        const state = createStateFixture({
            gridSelections: {},
            customCosts: [],
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    displayName: 'Produkt B',
                    addons: [{ id: 'heater', qty: 1, discountPct: 0, displayName: 'Tillval B1' }]
                },
                {
                    id: 'builder_2',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    displayName: 'Produkt A',
                    addons: [{ id: 'gutter-kit', qty: 1, discountPct: 0, displayName: 'Tillval A1' }]
                }
            ]
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const wsData = buildExcelSheetData(state, summary);
        const pdfRows = buildPdfTableData(summary.totals, formatSek);
        const exportLabels = wsData.filter((row) => typeof row[0] === 'string').map((row) => row[0]);

        expect(pdfRows.map((row) => row[0])).toEqual([
            'Produkt B',
            'Tillval B1',
            'Produkt A',
            'Tillval A1'
        ]);
        expect(exportLabels).toEqual(expect.arrayContaining(['Produkt B', 'Tillval B1', 'Produkt A', 'Tillval A1']));
    });

    it('keeps backward compatibility when global discount amount is present', () => {
        const state = createStateFixture({
            includesVat: false,
            globalDiscountPct: 10
        });
        const summary = {
            ...computeQuoteTotals({
                state,
                catalogData: createCatalogFixture()
            }),
            globalDiscountAmt: 2500
        };

        const wsData = buildExcelSheetData(state, summary);
        const pdfRows = buildPdfTableData(summary.totals, formatSek);


        expect(wsData.some((row) => String(row[0]).includes('Overgripande Rabatt'))).toBe(true);
        expect(pdfRows.some((row) => String(row[0]).includes('Overgripande Rabatt'))).toBe(false);
        expect(pdfRows).toHaveLength(summary.totals.length);
    });

    it('detects when a quote is eligible to hide discount references in the PDF', () => {
        const zeroDiscountState = createStateFixture({
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [{ id: 'heater', qty: 1, discountPct: 0 }]
                }
            ],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 1, discountPct: 0 }
                    },
                    addons: {
                        'door-right': { qty: 1, discountPct: 0 }
                    }
                }
            },
            globalDiscountPct: 0
        });
        const zeroDiscountSummary = computeQuoteTotals({
            state: zeroDiscountState,
            catalogData: createCatalogFixture()
        });
        const discountedSummary = computeQuoteTotals({
            state: createStateFixture(),
            catalogData: createCatalogFixture()
        });

        expect(hasZeroDiscountSummary(zeroDiscountSummary)).toBe(true);
        expect(shouldHideDiscountReferencesInPdf({
            hideZeroDiscountReferencesInPdf: true
        }, zeroDiscountSummary)).toBe(true);
        expect(hasZeroDiscountSummary(discountedSummary)).toBe(false);
        expect(shouldHideDiscountReferencesInPdf({
            hideZeroDiscountReferencesInPdf: true
        }, discountedSummary)).toBe(false);
    });

    it('formats priceUponRequest rows and appends footnote at the bottom of the Excel sheet', () => {
        const state = createStateFixture();
        const summary = {
            totals: [
                {
                    model: 'Jumbrella outSide Heater',
                    size: '4 Spokes',
                    unitPrice: 0,
                    qty: 1,
                    gross: 0,
                    net: 0,
                    discountSek: 0,
                    discountPct: 0,
                    priceUponRequest: true
                }
            ],
            finalTotalSek: 0,
            grossTotalSek: 0,
            totalDiscountSek: 0
        };

        const pdfRows = buildPdfTableData(summary.totals, formatSek);
        expect(pdfRows).toHaveLength(1);
        expect(pdfRows[0][2]).toBe('Pris på förfrågan');
        expect(pdfRows[0][4]).toBe('Pris på förfrågan');
        expect(pdfRows[0][5]).toBe('Pris på förfrågan'); // gross column
        expect(pdfRows[0][6]).toBe('-'); // discount SEK column
        expect(pdfRows[0][7]).toBe('-'); // discount pct column

        const wsData = buildExcelSheetData(state, summary);
        expect(wsData.length).toBeGreaterThan(10);
        
        // Assert product row formats correctly
        const productRow = wsData.find((row) => row[0] === 'Jumbrella outSide Heater');
        expect(productRow).toBeTruthy();
        expect(productRow[2]).toBe('Pris på förfrågan');
        expect(productRow[4]).toBe('Pris på förfrågan');
        expect(productRow[5]).toBe('Pris på förfrågan');
        expect(productRow[6]).toBe('-');
        expect(productRow[7]).toBe('-');

        // Assert footnote is at the absolute bottom
        const lastRow = wsData[wsData.length - 1];
        expect(lastRow[0]).toBe('* Totalsumman exkluderar artiklar med pris på förfrågan');
    });
});
