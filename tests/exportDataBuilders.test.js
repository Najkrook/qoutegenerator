import { describe, expect, it } from 'vitest';
import { computeQuoteTotals } from '../services/calculationEngine.js';
import {
    buildExcelSheetData,
    buildExportSummary,
    buildPdfTableData
} from '../services/exportDataBuilders.js';
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
        expect(rows[0][0]).toContain('BaHaMa');
        expect(rows[0][4]).toContain(formatSek(summary.totals[0].net));
        expect(rows.some((row) => String(row[0]).includes('Overgripande Rabatt'))).toBe(false);
    });

    it('buildExcelSheetData totals row is aligned with computed summary', () => {
        const state = createStateFixture({ includesVat: false });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const wsData = buildExcelSheetData(state, summary);
        const totalsRow = wsData.find((row) => row[0] === 'Totalt Exkl. Moms');

        expect(totalsRow).toBeTruthy();
        expect(totalsRow[4]).toBe(Math.round(summary.finalTotalSek));
        expect(totalsRow[5]).toBe(Math.round(summary.grossTotalSek));
        expect(totalsRow[6]).toBe(Math.round(-summary.totalDiscountSek));
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
});
