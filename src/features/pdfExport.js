import { jsPDF } from 'jspdf';
import { notifyWarn, notifyError } from '../services/notificationService.js';
import {
    buildExportSummary,
    shouldHideDiscountReferencesInPdf
} from '../services/exportDataBuilders.js';
import {
    PDF_LAYOUT,
    drawHeader,
    drawTermsPageHeader,
    normalizePositiveInt,
    renderCustomerInfoBlock,
    renderFooters,
    renderGroupedTables,
    renderSignatureBlock,
    renderTermsPages,
    renderTotalsSection
} from './pdfExportLayout.js';

export { createPdfTableLayout, groupSummaryTotalsByLine } from './pdfExportLayout.js';

export function computeValidUntilDateString(quoteDateValue, quoteValidityDays, nowDate = new Date()) {
    const validityDays = normalizePositiveInt(quoteValidityDays, 14);
    let baseDate = null;

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

export function generatePDF(state, summaryData, returnBlob = false) {
    const doc = new jsPDF();

    try {
        const formatSEK = (value) => new Intl.NumberFormat('sv-SE', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const customerInfo = state.customerInfo || {};
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
            formatSEK,
            currentY: finalY,
            pageWidth,
            pageHeight,
            hideDiscountReferences,
            drawMainHeader,
            layout: PDF_LAYOUT
        });

        if ((summaryData?.totals || []).length === 0 && !returnBlob) {
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
            formatSEK,
            shouldRenderPaymentBox,
            drawMainHeader,
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
                doc.setPage(doc.internal.getNumberOfPages());
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
        if (returnBlob) {
            return pdfBlob;
        }
        return pdfBlob;
    } catch (error) {
        console.error('PDF export failed:', error);
        if (!returnBlob) {
            notifyError('Kunde inte skapa PDF. Kontrollera innehållet och försök igen.');
        }
        return null;
    }
}
