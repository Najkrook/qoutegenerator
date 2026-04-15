import { jsPDF } from 'jspdf';
import { notifyWarn, notifyError } from '../services/notificationService';
import {
    buildExportSummary,
    shouldHideDiscountReferencesInPdf
} from '../services/exportDataBuilders';
import type { CustomerInfo, QuoteState, QuoteTotalsResult } from '../types/contracts';
import {
    PDF_LAYOUT,
    drawHeader,
    drawTermsPageHeader,
    normalizePositiveInt,
    renderCustomerInfoBlock,
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

type PdfSummaryData = Partial<QuoteTotalsResult>;

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
    return new Intl.NumberFormat('sv-SE', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

function createPdfDocument(): JsPdfDocument {
    return new jsPDF();
}

export function computeValidUntilDateString(
    quoteDateValue: string | null | undefined,
    quoteValidityDays: unknown,
    nowDate = new Date()
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

    if (!baseDate) {
        baseDate = new Date(nowDate.getTime());
    }

    const validUntil = new Date(baseDate.getTime());
    validUntil.setDate(validUntil.getDate() + validityDays);
    return validUntil.toLocaleDateString('sv-SE');
}

export function generatePDF(
    state: PdfExportState,
    summaryData: PdfSummaryData,
    returnBlob = false
): Blob | null {
    const doc = createPdfDocument();

    try {
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const customerInfo: Partial<CustomerInfo> = state.customerInfo || {};
        const quoteDate = customerInfo.date || new Date().toLocaleDateString('sv-SE');
        const pdfLegalTemplatesEnabled = typeof window === 'undefined'
            ? true
            : window.FEATURE_PDF_LEGAL_TEMPLATES !== false;
        const shouldRenderPaymentBox = pdfLegalTemplatesEnabled && state.includePaymentBox !== false;
        const shouldRenderSignatureBlock = pdfLegalTemplatesEnabled && state.includeSignatureBlock !== false;
        const hideDiscountReferences = shouldHideDiscountReferencesInPdf(state, summaryData);
        const validUntilDate = computeValidUntilDateString(customerInfo.date, state.quoteValidityDays);
        const drawMainHeader = () => drawHeader(doc, {
            pageWidth,
            quoteDate,
            customerInfo,
            layout: PDF_LAYOUT
        });

        drawMainHeader();

        let finalY = renderCustomerInfoBlock(doc, {
            customerInfo,
            pageWidth,
            layout: PDF_LAYOUT
        });

        finalY = renderGroupedTables(doc, {
            summaryData,
            formatSEK: formatSek,
            currentY: finalY,
            pageWidth,
            pageHeight,
            hideDiscountReferences,
            drawMainHeader,
            layout: PDF_LAYOUT
        });

        if ((summaryData.totals || []).length === 0 && !returnBlob) {
            notifyWarn('Avancerad PDF-tabell saknas. Exporterar med enkel layout.');
        }

        const exportSummary = buildExportSummary(state, summaryData);
        finalY = renderTotalsSection(doc, {
            state: {
                ...state,
                hideDiscountReferences,
                validUntilDate,
                customerInfo
            },
            exportSummary,
            finalY,
            pageWidth,
            pageHeight,
            formatSEK: formatSek,
            shouldRenderPaymentBox,
            drawMainHeader,
            layout: PDF_LAYOUT
        });

        finalY = renderExtraNotesBlock(doc, {
            customerInfo,
            pageWidth,
            pageHeight,
            drawMainHeader,
            currentY: finalY + 12,
            layout: PDF_LAYOUT
        });

        const termsPageEndY = renderTermsPages(doc, {
            state,
            pageWidth,
            pageHeight,
            layout: PDF_LAYOUT
        });

        if (shouldRenderSignatureBlock) {
            if (termsPageEndY !== null) {
                doc.setPage(getPdfPageCount(doc));
                renderSignatureBlock(doc, {
                    preferredY: termsPageEndY,
                    pageWidth,
                    pageHeight,
                    drawPageHeader: () => drawTermsPageHeader(doc, { pageWidth, layout: PDF_LAYOUT }),
                    layout: PDF_LAYOUT
                });
            } else {
                renderSignatureBlock(doc, {
                    preferredY: finalY + 12,
                    pageWidth,
                    pageHeight,
                    drawPageHeader: drawMainHeader,
                    layout: PDF_LAYOUT
                });
            }
        }

        renderFooters(doc, { pageWidth, pageHeight, layout: PDF_LAYOUT });

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
