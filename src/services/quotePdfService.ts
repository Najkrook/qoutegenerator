import type { PdfExportModule } from '../types/contracts';
import type { PreparedQuote } from './quotePreparation';

function adaptPreparedQuote(prepared: PreparedQuote) {
    const contractingWork = prepared.commercial.contractingWork;
    const state = {
        ...prepared.persistenceSnapshot,
        customerInfo: {
            ...prepared.agreement.customerInfo,
            date: prepared.agreement.effectiveQuoteDate
        },
        includesVat: prepared.commercial.productTotals.includesVat,
        exportLanguage: prepared.presentation.exportLanguage,
        pdfThemeId: prepared.presentation.pdfThemeId,
        hideZeroDiscountReferencesInPdf: prepared.visibility.discountReferences === 'hidden-zero',
        includeTerms: prepared.agreement.legalTerms.included,
        termsText: prepared.agreement.legalTerms.text,
        termsTemplateId: prepared.agreement.legalTerms.templateId,
        termsCustomized: prepared.agreement.legalTerms.customized,
        includePaymentBox: prepared.agreement.includePaymentBox,
        includeSignatureBlock: prepared.agreement.includeSignatureBlock,
        paymentTermsDays: prepared.agreement.paymentTermsDays,
        quoteValidityDays: prepared.agreement.validityDays,
        activeQuoteId: prepared.agreement.quoteIdentity.quoteId,
        quoteNumber: prepared.agreement.quoteIdentity.quoteNumber,
        activeQuoteVersion: prepared.agreement.quoteIdentity.version,
        quoteStatus: prepared.agreement.quoteIdentity.status,
        contractingWork: contractingWork
            ? {
                enabled: true,
                projectName: contractingWork.projectName,
                rows: contractingWork.rows,
                margin: { enabled: false, percent: 0 },
                ata: {
                    enabled: contractingWork.ataEnabled,
                    percent: contractingWork.ataPercent
                }
            }
            : {
                enabled: false,
                projectName: '',
                rows: [],
                margin: { enabled: false, percent: 0 },
                ata: { enabled: false, percent: 0 }
            }
    };
    const productTotals = prepared.commercial.productTotals;
    const productRows = prepared.commercial.productRows.map((row, index) => ({
        ...row,
        source: { type: 'custom' as const, index }
    }));

    return {
        state,
        summaryData: {
            totals: productRows,
            grossTotalSek: productTotals.grossTotalSek,
            totalDiscountSek: productTotals.totalDiscountSek,
            finalTotalSek: productTotals.finalTotalSek,
            globalDiscountAmt: productTotals.globalDiscountAmt,
            vatAmountSek: productTotals.vatAmountSek,
            totalWithVatSek: productTotals.totalWithVatSek
        }
    };
}

export async function createQuotePdfBlob(prepared: PreparedQuote): Promise<Blob | null>;
export async function createQuotePdfBlob(
    prepared: PreparedQuote
): Promise<Blob | null> {
    try {
        const pdfModule: PdfExportModule = await import('../features/pdfExport');
        const { generatePDF } = pdfModule;

        if (typeof generatePDF !== 'function') {
            return null;
        }

        const { state, summaryData } = adaptPreparedQuote(prepared);
        const result = await generatePDF(state, summaryData, true);
        return result ?? null;
    } catch (error) {
        console.error('Failed to load PDF export module:', error);
        return null;
    }
}
