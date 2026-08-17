import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readSource(relativePath) {
    return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('customer-safe Quote preparation locality', () => {
    it('leaves downstream adapters no raw Quote-state policy bypass', () => {
        const pdfService = readSource('src/services/quotePdfService.ts');
        const pdfAdapter = readSource('src/features/pdfExport.ts');
        const exportBuilders = readSource('src/services/exportDataBuilders.ts');
        const summary = readSource('src/views/SummaryExport.tsx');
        const productSummary = readSource('src/components/features/FinalSummaryTable.tsx');
        const contractingSummary = readSource('src/components/features/ContractingWorkSummaryTable.tsx');

        expect(pdfService).not.toMatch(/QuoteState|QuoteTotalsResult|legacySummaryData/);
        expect(pdfAdapter).not.toMatch(/shouldHideDiscountReferencesInPdf|buildExportSummary/);
        expect(exportBuilders).not.toMatch(/export function (buildExcelSheetData|buildExportSummary|hasZeroDiscountSummary|shouldHideDiscountReferencesInPdf)/);
        expect(summary).not.toMatch(/normalizePdfThemeId|normalizeExportLanguage|RETAILER_SAFE_CONTRACTING_WORK|hasZeroDiscountSummary/);
        expect(productSummary).not.toMatch(/computeQuoteTotals|hasZeroDiscountSummary|normalizeExportLanguage/);
        expect(contractingSummary).not.toMatch(/calculateContractingWorkSummary|normalizeExportLanguage/);
    });

    it('makes every customer-delivery path depend on the preparation seam', () => {
        const summary = readSource('src/views/SummaryExport.tsx');
        const orderRequests = readSource('src/services/orderRequestService.ts');
        const submittedOrderExport = readSource('src/views/RetailerOrderRequests.tsx');
        const pdfService = readSource('src/services/quotePdfService.ts');
        const excelAdapter = readSource('src/features/excelExport.ts');
        const quoteSave = readSource('src/services/quoteSaveService.ts');

        expect(summary).toContain('prepareQuote({');
        expect(orderRequests).toContain('restorePreparedQuote({');
        expect(submittedOrderExport).toContain('restorePreparedQuote({');
        expect(pdfService).toContain('PreparedQuote');
        expect(excelAdapter).toContain('PreparedQuote');
        expect(quoteSave).toContain('persistenceSnapshot');
    });
});
