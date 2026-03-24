import { describe, expect, it } from 'vitest';
import { computeQuoteTotals } from '../src/services/calculationEngine.js';
import {
    buildExcelSheetData,
    buildExportSummary,
    buildPdfTableData,
    hasZeroDiscountSummary,
    shouldHideDiscountReferencesInPdf
} from '../src/services/exportDataBuilders.js';
import { createCatalogFixture, createStateFixture } from './fixtures/calculationFixtures.js';

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
                ClickitUP: {
                    items: {
                        'ClickitUP Section|1000': { qty: 1, discountPct: 0 }
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

        expect(wsData.some((row) => row[0] === '  + Tillval: Speciallack')).toBe(true);
        expect(pdfRows.some((row) => row[0] === '  + Tillval: Speciallack')).toBe(true);
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
                ClickitUP: {
                    items: {
                        'ClickitUP Section|1000': { qty: 1, discountPct: 0 }
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
});
