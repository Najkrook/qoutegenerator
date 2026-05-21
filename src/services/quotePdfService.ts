import type { PdfExportModule, QuoteState, QuoteTotalsResult } from '../types/contracts';

export async function createQuotePdfBlob(state: QuoteState, summaryData: QuoteTotalsResult): Promise<Blob | null> {
    try {
        const pdfModule: PdfExportModule = await import('../features/pdfExport');
        const { generatePDF } = pdfModule;

        if (typeof generatePDF !== 'function') {
            return null;
        }

        const result = await generatePDF(state, summaryData, true);
        return result ?? null;
    } catch (error) {
        console.error('Failed to load PDF export module:', error);
        return null;
    }
}
