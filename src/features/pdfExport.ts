import { jsPDF } from 'jspdf';
import { notifyWarn, notifyError } from '../services/notificationService';
import { calculateContractingWorkSummary } from '../services/contractingWork';
import type {
    ContractingWorkSummary,
    CustomerInfo,
    QuoteState,
    QuoteTotalsResult
} from '../types/contracts';
import {
    getPdfLayout,
    drawHeader,
    drawTermsPageHeader,
    normalizePositiveInt,
    renderCustomerInfoBlock,
    renderContractingWorkSection,
    renderExtraNotesBlock,
    renderFooters,
    renderGroupedTables,
    renderSignatureBlock,
    renderTermsPages,
    renderTotalsSection
} from './pdfExportLayout';

export { createPdfTableLayout, groupSummaryTotalsByLine } from './pdfExportLayout';

type PdfExportState = Partial<QuoteState> & {
    customerInfo?: Partial<CustomerInfo>;
};

type PdfSummaryData = Partial<QuoteTotalsResult> & {
    vatAmountSek?: number;
    totalWithVatSek?: number;
};

type JsPdfDocument = InstanceType<typeof jsPDF>;

function getPdfPageCount(doc: JsPdfDocument): number {
    const internal = doc.internal as typeof doc.internal & {
        getNumberOfPages?: () => number;
        pages?: unknown[];
    };

    if (typeof internal.getNumberOfPages === 'function') {
        return internal.getNumberOfPages();
    }

    const pageArrayLength = Array.isArray(internal.pages) ? internal.pages.length - 1 : 1;
    return Math.max(1, pageArrayLength);
}

function formatSek(value: number): string {
    const roundedValue = Math.round(value);
    const safeValue = Object.is(roundedValue, -0) ? 0 : roundedValue;

    return new Intl.NumberFormat('sv-SE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    })
        .format(safeValue)
        // jsPDF's built-in fonts can mangle Unicode minus signs in negative values.
        .replace(/\u2212/g, '-')
        .replace(/\u00A0/g, ' ');
}

function createPdfDocument(): JsPdfDocument {
    return new jsPDF();
}

export function computeValidUntilDateString(
    quoteDateValue: string | null | undefined,
    quoteValidityDays: unknown
): string {
    const validityDays = normalizePositiveInt(quoteValidityDays, 14);
    let baseDate: Date | null = null;

    if (typeof quoteDateValue === 'string' && quoteDateValue.trim()) {
        const rawDate = quoteDateValue.trim();
        const parsed = rawDate.includes('T')
            ? new Date(rawDate)
            : new Date(`${rawDate}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) {
            baseDate = parsed;
        }
    }

    if (!baseDate) return '';

    const validUntil = new Date(baseDate.getTime());
    validUntil.setDate(validUntil.getDate() + validityDays);
    return validUntil.toLocaleDateString('sv-SE');
}

export function generatePDF(
    state: PdfExportState,
    summaryData: PdfSummaryData,
    returnBlob = false,
    preparedContractingSummary?: ContractingWorkSummary
): Blob | null {
    const doc = createPdfDocument();

    try {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const customerInfo: Partial<CustomerInfo> = state.customerInfo || {};
        const quoteDate = customerInfo.date || '';
        const shouldRenderPaymentBox = state.includePaymentBox === true;
        const shouldRenderSignatureBlock = state.includeSignatureBlock === true;
        const hideDiscountReferences = state.hideZeroDiscountReferencesInPdf === true;
        const validUntilDate = computeValidUntilDateString(customerInfo.date, state.quoteValidityDays);
        const activeLayout = getPdfLayout(state.pdfThemeId);
        const exportLanguage = state.exportLanguage || 'sv';
        const productRows = Array.isArray(summaryData.totals) ? summaryData.totals : [];
        const hasProducts = productRows.length > 0;
        const contractingSummary = preparedContractingSummary
            ?? calculateContractingWorkSummary(state.contractingWork);
        const hasContractingWork = contractingSummary.activeRows.length > 0;
        const shouldRenderLegacyEmptyProductSection = !hasProducts && !hasContractingWork;
        const drawMainHeader = () => drawHeader(doc, {
            pageWidth,
            quoteDate,
            quoteNumber: state.quoteNumber || null,
            customerInfo,
            layout: activeLayout,
            exportLanguage
        });

        drawMainHeader();

        let finalY = renderCustomerInfoBlock(doc, {
            customerInfo,
            pageWidth,
            layout: activeLayout,
            exportLanguage
        });

        if (hasProducts || shouldRenderLegacyEmptyProductSection) {
            finalY = renderGroupedTables(doc, {
                summaryData,
                formatSEK: formatSek,
                currentY: finalY,
                pageWidth,
                pageHeight,
                includesVat: state.includesVat,
                hideDiscountReferences,
                showProductsHeading: hasContractingWork,
                drawMainHeader,
                layout: activeLayout,
                exportLanguage
            });
        }

        if (shouldRenderLegacyEmptyProductSection && !returnBlob) {
            notifyWarn('Avancerad PDF-tabell saknas. Exporterar med enkel layout.');
        }

        const finalTotalSek = summaryData.finalTotalSek || 0;
        const exportSummary = {
            finalTotalSek,
            grossTotalSek: summaryData.grossTotalSek || 0,
            totalDiscountSek: summaryData.totalDiscountSek || 0,
            vatAmount: summaryData.vatAmountSek || 0,
            totalWithVat: summaryData.totalWithVatSek ?? finalTotalSek
        };
        const totalsState = {
            ...state,
            hideDiscountReferences,
            validUntilDate,
            customerInfo
        };

        if (hasProducts || shouldRenderLegacyEmptyProductSection) {
            finalY = renderTotalsSection(doc, {
                state: totalsState,
                exportSummary,
                finalY,
                pageWidth,
                pageHeight,
                formatSEK: formatSek,
                shouldRenderPaymentBox: shouldRenderPaymentBox && !hasContractingWork,
                drawMainHeader,
                layout: activeLayout,
                hasPriceUponRequest: productRows.some((row) => row.priceUponRequest === true),
                useProductTotalLabel: hasContractingWork,
                exportLanguage
            });
        }

        if (hasContractingWork) {
            finalY = renderContractingWorkSection(doc, {
                contractingWork: state.contractingWork,
                summary: contractingSummary,
                formatSEK: formatSek,
                currentY: hasProducts ? finalY + 12 : finalY,
                pageWidth,
                pageHeight,
                drawMainHeader,
                layout: activeLayout,
                exportLanguage
            });

            if (shouldRenderPaymentBox) {
                finalY = renderTotalsSection(doc, {
                    state: totalsState,
                    exportSummary,
                    finalY,
                    pageWidth,
                    pageHeight,
                    formatSEK: formatSek,
                    shouldRenderPaymentBox: true,
                    drawMainHeader,
                    layout: activeLayout,
                    renderProductTotals: false,
                    exportLanguage
                });
            }
        }

        finalY = renderExtraNotesBlock(doc, {
            customerInfo,
            pageWidth,
            pageHeight,
            drawMainHeader,
            currentY: finalY + 12,
            layout: activeLayout,
            exportLanguage
        });

        const termsPageEndY = renderTermsPages(doc, {
            state,
            pageWidth,
            pageHeight,
            layout: activeLayout,
            exportLanguage
        });

        if (shouldRenderSignatureBlock) {
            if (termsPageEndY !== null) {
                doc.setPage(getPdfPageCount(doc));
                renderSignatureBlock(doc, {
                    preferredY: termsPageEndY,
                    pageWidth,
                    pageHeight,
                    drawPageHeader: () => drawTermsPageHeader(doc, { pageWidth, layout: activeLayout, exportLanguage }),
                    layout: activeLayout,
                    exportLanguage
                });
            } else {
                renderSignatureBlock(doc, {
                    preferredY: finalY + 12,
                    pageWidth,
                    pageHeight,
                    drawPageHeader: drawMainHeader,
                    layout: activeLayout,
                    exportLanguage
                });
            }
        }

        renderFooters(doc, { pageWidth, pageHeight, layout: activeLayout });

        const pdfBlob = doc.output('blob');
        return pdfBlob;
    } catch (error) {
        console.error('PDF export failed:', error);
        if (!returnBlob) {
            notifyError('Kunde inte skapa PDF. Kontrollera innehållet och försök igen.');
        }
        return null;
    }
}
