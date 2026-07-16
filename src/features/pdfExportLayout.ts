import autoTable, { type Color, type FontStyle, type Styles } from 'jspdf-autotable';
import { BRIXX_LOGO_BASE64 } from '../../assets/logoData';
import { buildPdfTableData } from '../services/exportDataBuilders';
import { getExportLabels, formatLocalizedDays, translateGroupLabel } from '../services/exportLocalization';
import { applyVat } from '../utils/vatHelper';
import type {
    CustomerInfo,
    ExportSummaryInput,
    QuoteState,
    QuoteTotalsResult,
    QuoteTotalsRow
} from '../types/contracts';

export interface PdfThemeLayout {
    pageMarginX: number;
    headerTopY: number;
    headerLineY: number;
    customerBoxY: number;
    contentStartY: number;
    contentBottomSafe: number;
    termsStartY: number;
    termsFooterZone: number;
    footerBandHeight: number;
    colors: {
        brandPrimary: [number, number, number];
        darkText: [number, number, number];
        grayText: [number, number, number];
        lightGray: [number, number, number];
        accent: [number, number, number];
        backgroundTint?: [number, number, number];
    };
    logoConfig: {
        type: 'base64' | 'text';
        data: string;
        width: number;
        height: number;
        fallbackSize: number;
        textYOffset?: number;
    };
    footerConfig: {
        slogan: string;
        address: string;
        contact: string;
        website?: string;
    };
}

export const BRIXX_LAYOUT: PdfThemeLayout = Object.freeze<PdfThemeLayout>({
    pageMarginX: 10,
    headerTopY: 16,
    headerLineY: 34,
    customerBoxY: 37,
    contentStartY: 41,
    contentBottomSafe: 36,
    termsStartY: 31,
    termsFooterZone: 35,
    footerBandHeight: 30,
    colors: {
        brandPrimary: [243, 156, 18],
        darkText: [30, 30, 30],
        grayText: [120, 120, 120],
        lightGray: [230, 230, 230],
        accent: [46, 174, 96]
    },
    logoConfig: {
        type: 'base64',
        data: BRIXX_LOGO_BASE64,
        width: 50,
        height: 16,
        fallbackSize: 22
    },
    footerConfig: {
        slogan: 'Parasoll | Värme | Vindskydd | Miljö',
        address: 'BRIXX EUROPE | Dockplatsen 1 | SE 211 19 Malmö | SWEDEN',
        website: 'Products Designed for Excellence, Engineered for Performance.',
        contact: "+46 (0) 708-500 000   |   team@brixx.se   |   WWW.BRIXX.SE   |   EST'D 1992"
    }
});

export const ROSLAGSMARKISEN_LAYOUT: PdfThemeLayout = Object.freeze<PdfThemeLayout>({
    pageMarginX: 10,
    headerTopY: 16,
    headerLineY: 34,
    customerBoxY: 37,
    contentStartY: 41,
    contentBottomSafe: 36,
    termsStartY: 31,
    termsFooterZone: 35,
    footerBandHeight: 30,
    colors: {
        brandPrimary: [2, 26, 53],
        darkText: [30, 30, 30],
        grayText: [120, 120, 120],
        lightGray: [230, 230, 230],
        accent: [80, 99, 84],
        backgroundTint: [251, 249, 246]
    },
    logoConfig: {
        type: 'text',
        data: 'ROSLAGSMARKISEN',
        width: 0,
        height: 16,
        fallbackSize: 18,
        textYOffset: -2
    },
    footerConfig: {
        slogan: 'Skydd mot solen med stil och hållbarhet',
        address: 'Stora björknäsvägen 6 | 761 98 Norrtälje',
        website: 'info@roslagsmarkisen.se | www.roslagsmarkisen.se',
        contact: 'Tel: 0176 15615'
    }
});

export function getPdfLayout(themeId?: string): PdfThemeLayout {
    if (themeId === 'roslagsmarkisen') {
        return ROSLAGSMARKISEN_LAYOUT;
    }
    return BRIXX_LAYOUT;
}

export const PDF_LAYOUT = BRIXX_LAYOUT;

const GROUP_SORT_ORDER = ['clickitup', 'bahama', 'fiesta', 'ovrigt'];

function normalizeCustomerInfo(customerInfo: Partial<CustomerInfo> | null | undefined): Partial<CustomerInfo> {
    return customerInfo || {};
}

function normalizeSummaryTotals(summaryData: ExportSummaryInput = {}): QuoteTotalsRow[] {
    return Array.isArray(summaryData.totals) ? summaryData.totals : [];
}

function normalizeGroupKey(line) {
    return String(line || '')
        .normalize('NFKD')
        .replace(/[^\w]/g, '')
        .toLowerCase();
}

export function normalizePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createPdfTableLayout(hideDiscountReferences, pageWidth, includesVat = false, layout = PDF_LAYOUT, exportLanguage = 'sv') {
    const labels = getExportLabels(exportLanguage);
    const vatText = includesVat ? labels.inclVat : labels.exclVat;
    const tableHead = hideDiscountReferences
        ? [[labels.model, labels.size, `${labels.unitPrice}\n${vatText}`, labels.quantity, `${labels.recommendedPrice}\n${vatText}`]]
        : [[labels.model, labels.size, `${labels.unitPrice}\n${vatText}`, labels.quantity, `${labels.yourPrice}\n${vatText}`, `${labels.recommendedPrice}\n${vatText}`, `${labels.discountSek}\n(${vatText})`, labels.discountPct]];
    const tableColumnStyles = (hideDiscountReferences
        ? {
            0: { halign: 'left', fontStyle: 'bold' as FontStyle, cellWidth: 54 },
            1: { halign: 'center', cellWidth: 20 },
            2: { halign: 'right', cellWidth: 33 },
            3: { halign: 'center', fontStyle: 'bold' as FontStyle, cellWidth: 18 },
            4: { halign: 'right', fontStyle: 'bold' as FontStyle, cellWidth: 33 }
        }
        : {
            0: { halign: 'left', fontStyle: 'bold' as FontStyle, cellWidth: 44 },
            1: { halign: 'center', cellWidth: 16 },
            2: { halign: 'right', cellWidth: 27 },
            3: { halign: 'center', fontStyle: 'bold' as FontStyle, cellWidth: 14 },
            4: { halign: 'right', fontStyle: 'bold' as FontStyle, cellWidth: 27 },
            5: { halign: 'right', cellWidth: 27 },
            6: { halign: 'right', cellWidth: 23 },
            7: { halign: 'center', cellWidth: 14 }
        }) as Record<string, Partial<Styles>>;
    const reducedTableWidth = Object.values(tableColumnStyles).reduce((sum, style) => (
        sum + (typeof style.cellWidth === 'number' ? style.cellWidth : 0)
    ), 0);
    const tableLeftMargin = hideDiscountReferences
        ? Math.max(layout.pageMarginX, (pageWidth - reducedTableWidth) / 2)
        : layout.pageMarginX;
    const tableRightMargin = hideDiscountReferences
        ? Math.max(layout.pageMarginX, pageWidth - tableLeftMargin - reducedTableWidth)
        : layout.pageMarginX;

    return {
        tableHead,
        tableColumnStyles,
        reducedTableWidth,
        tableLeftMargin,
        tableRightMargin
    };
}

export function groupSummaryTotalsByLine(summaryData: ExportSummaryInput = {}) {
    const totals = normalizeSummaryTotals(summaryData);
    const groupedTotals = totals.reduce<Record<string, QuoteTotalsRow[]>>((acc, item) => {
        const line = item.line || 'Övrigt';
        if (!acc[line]) {
            acc[line] = [];
        }
        acc[line].push(item);
        return acc;
    }, {});
    const groupKeys = Object.keys(groupedTotals).sort((left, right) => {
        const leftIndex = GROUP_SORT_ORDER.indexOf(normalizeGroupKey(left));
        const rightIndex = GROUP_SORT_ORDER.indexOf(normalizeGroupKey(right));

        if (leftIndex !== -1 || rightIndex !== -1) {
            if (leftIndex === -1) return 1;
            if (rightIndex === -1) return -1;
            return leftIndex - rightIndex;
        }

        return left.localeCompare(right);
    });

    return { groupedTotals, groupKeys };
}

function drawBrandLogo(doc, x, y, layout: PdfThemeLayout) {
    if (layout.logoConfig.type === 'text') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout.logoConfig.fallbackSize);
        doc.setTextColor(...layout.colors.brandPrimary);
        const yOffset = layout.logoConfig.textYOffset || 0;
        doc.text(layout.logoConfig.data, x, y + layout.logoConfig.height + yOffset);
        return;
    }

    try {
        doc.addImage(layout.logoConfig.data, 'PNG', x, y, layout.logoConfig.width, layout.logoConfig.height);
    } catch (error) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(layout.logoConfig.fallbackSize);
        doc.setTextColor(...layout.colors.brandPrimary);
        doc.text('BRIXX', x, y + layout.logoConfig.height - 4);
    }
}

function startNewPage(doc, drawPageHeader, contentStartY) {
    doc.addPage();
    if (drawPageHeader) {
        drawPageHeader();
    }
    return contentStartY;
}

function ensurePageSpace(doc, currentY, requiredHeight, pageHeight, drawPageHeader, contentStartY, footerReserve = PDF_LAYOUT.contentBottomSafe) {
    if (currentY + requiredHeight <= pageHeight - footerReserve) {
        return currentY;
    }
    return startNewPage(doc, drawPageHeader, contentStartY);
}

function drawGroupSubtitle(doc, title, y, layout, pageMarginX) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...layout.colors.darkText);
    doc.text(title, pageMarginX, y);
}

export function drawHeader(doc, { pageWidth, quoteDate, quoteNumber = null, customerInfo = {}, layout = PDF_LAYOUT, exportLanguage = 'sv' }) {
    const { pageMarginX, headerTopY } = layout;
    const safeCustomerInfo = normalizeCustomerInfo(customerInfo);
    const headerLineY = quoteNumber ? layout.headerLineY + 2 : layout.headerLineY;
    const labels = getExportLabels(exportLanguage);

    drawBrandLogo(doc, pageMarginX, 8, layout);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...layout.colors.darkText);
    doc.text(labels.quoteTitle, pageWidth - pageMarginX, headerTopY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...layout.colors.grayText);
    doc.text(`${labels.date}: ${quoteDate}`, pageWidth - pageMarginX, 22, { align: 'right' });
    if (quoteNumber) {
        doc.text(`${labels.quoteNo}: ${quoteNumber}`, pageWidth - pageMarginX, 26, { align: 'right' });
    }
    if (safeCustomerInfo.reference) {
        doc.text(`${labels.projectReference}: ${safeCustomerInfo.reference}`, pageWidth - pageMarginX, quoteNumber ? 30 : 26, { align: 'right' });
    }
    if (safeCustomerInfo.customerReference) {
        doc.text(`${labels.customerReference}: ${safeCustomerInfo.customerReference}`, pageWidth - pageMarginX, quoteNumber ? 34 : 30, { align: 'right' });
    }

    doc.setDrawColor(...layout.colors.brandPrimary);
    doc.setLineWidth(0.8);
    doc.line(pageMarginX, headerLineY, pageWidth - pageMarginX, headerLineY);
}

export function renderCustomerInfoBlock(doc, { customerInfo = {}, pageWidth, layout = PDF_LAYOUT, exportLanguage = 'sv' }) {
    const safeCustomerInfo = normalizeCustomerInfo(customerInfo);
    const labels = getExportLabels(exportLanguage);
    const customerLines = [];
    const recipient = safeCustomerInfo.company || safeCustomerInfo.name || '';
    if (recipient) {
        customerLines.push({ type: 'recipient', value: recipient });
    }
    if (safeCustomerInfo.validity) {
        customerLines.push({ type: 'muted', value: `${labels.validityPeriod}: ${safeCustomerInfo.validity}` });
    }

    if (customerLines.length === 0) {
        return layout.contentStartY;
    }

    const customerBoxHeight = Math.max(14, 8 + (customerLines.length * 5));
    const customerBoxWidth = pageWidth - (layout.pageMarginX * 2);
    const customerTextX = layout.pageMarginX + 4;
    let customerTextY = layout.customerBoxY + 7;

    doc.setFillColor(250, 250, 250);
    doc.roundedRect(layout.pageMarginX, layout.customerBoxY, customerBoxWidth, customerBoxHeight, 2, 2, 'F');
    doc.setFontSize(10);

    customerLines.forEach((line) => {
        if (line.type === 'recipient') {
            doc.setTextColor(...layout.colors.darkText);
            doc.setFont('helvetica', 'bold');
            doc.text(`${labels.to}:`, customerTextX, customerTextY);
            doc.setFont('helvetica', 'normal');
            doc.text(line.value, customerTextX + 10, customerTextY);
        } else {
            doc.setTextColor(...layout.colors.grayText);
            doc.setFont('helvetica', 'normal');
            doc.text(line.value, customerTextX, customerTextY);
        }
        customerTextY += 5;
    });

    return layout.customerBoxY + customerBoxHeight + 6;
}

export function renderExtraNotesBlock(doc, { customerInfo = {}, pageWidth, pageHeight, drawMainHeader, currentY, layout = PDF_LAYOUT, exportLanguage = 'sv' }) {
    const safeCustomerInfo = normalizeCustomerInfo(customerInfo);
    const labels = getExportLabels(exportLanguage);

    if (!safeCustomerInfo.extraNotes || !safeCustomerInfo.extraNotes.trim()) {
        return currentY;
    }

    const marginX = layout.pageMarginX;
    const notesText = safeCustomerInfo.extraNotes.trim();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(notesText, pageWidth - (marginX * 2));
    const requiredHeight = 6 + (lines.length * 4.5) + 4;
    
    currentY = ensurePageSpace(doc, currentY, requiredHeight, pageHeight, drawMainHeader, layout.contentStartY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...layout.colors.darkText);
    doc.text(labels.notes, marginX, currentY);
    
    let y = currentY + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...layout.colors.grayText);
    
    lines.forEach(line => {
        doc.text(line, marginX, y);
        y += 4.5;
    });

    return y + 4;
}

export function renderGroupedTables(doc, {
    summaryData,
    formatSEK,
    currentY,
    pageWidth,
    pageHeight,
    includesVat,
    hideDiscountReferences,
    drawMainHeader,
    layout = PDF_LAYOUT,
    exportLanguage = 'sv'
}) {
    const totals = normalizeSummaryTotals(summaryData);
    const { groupedTotals, groupKeys } = groupSummaryTotalsByLine(summaryData);
    const labels = getExportLabels(exportLanguage);

    if (groupKeys.length === 0 || totals.length === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(labels.quoteDetails, layout.pageMarginX, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let y = currentY + 6;

        totals.forEach((row) => {
            if (y > pageHeight - (layout.contentBottomSafe - 3)) {
                y = startNewPage(doc, drawMainHeader, layout.contentStartY);
            }
            const textRow = `${row.model} | ${row.size || '-'} | x${row.qty} | ${formatSEK(applyVat(row.net, includesVat))} SEK`;
            doc.text(textRow, layout.pageMarginX, y);
            y += 4.5;
        });

        return y + 6;
    }

    const {
        tableHead,
        tableColumnStyles,
        reducedTableWidth,
        tableLeftMargin,
        tableRightMargin
    } = createPdfTableLayout(hideDiscountReferences, pageWidth, includesVat, layout, exportLanguage);

    let finalY = currentY;

    groupKeys.forEach((lineKey, index) => {
        const lineItems = groupedTotals[lineKey];

        if (index > 0) {
            currentY = startNewPage(doc, drawMainHeader, layout.contentStartY);
            drawGroupSubtitle(doc, `${labels.productsHeading} - ${translateGroupLabel(lineKey, exportLanguage)}`, currentY, layout, layout.pageMarginX);
            currentY += 8;
        } else if (groupKeys.length > 1 && lineKey !== 'Övrigt') {
            drawGroupSubtitle(doc, `${labels.productsHeading} - ${translateGroupLabel(lineKey, exportLanguage)}`, currentY, layout, layout.pageMarginX);
            currentY += 6;
        }

        autoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: buildPdfTableData(lineItems, formatSEK, {
                hideDiscountColumns: hideDiscountReferences,
                hideRecommendedPriceColumn: hideDiscountReferences,
                includesVat,
                exportLanguage: exportLanguage === 'en' ? 'en' : 'sv'
            }),
            theme: 'striped',
            styles: {
                fontSize: 8.5,
                cellPadding: 2.5,
                valign: 'middle',
                textColor: layout.colors.darkText as Color,
                lineColor: [220, 220, 220] as Color,
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: [35, 35, 45] as Color,
                textColor: [255, 255, 255] as Color,
                fontStyle: 'bold' as FontStyle,
                halign: 'center',
                fontSize: 8
            },
            alternateRowStyles: {
                fillColor: [248, 249, 250] as Color
            },
            columnStyles: tableColumnStyles,
            didParseCell(data) {
                if (data.section === 'head' && data.column.index === 4) {
                    data.cell.styles.fillColor = layout.colors.accent as Color;
                    data.cell.styles.textColor = [255, 255, 255] as Color;
                }
                if (data.section === 'body' && data.column.index === 4) {
                    data.cell.styles.fillColor = layout.colors.backgroundTint || ([235, 250, 240] as Color);
                }
                if (data.section === 'body' && data.column.index === 0) {
                    const rowData = lineItems[data.row.index];
                    if (rowData?.isAddon) {
                        data.cell.styles.cellPadding = {
                            top: 2.5,
                            right: 2.5,
                            bottom: 2.5,
                            left: 7
                        };
                        data.cell.styles.fontStyle = 'italic';
                        data.cell.styles.textColor = layout.colors.grayText as Color;
                    }
                }
            },
            margin: {
                left: tableLeftMargin,
                right: tableRightMargin,
                top: 14,
                bottom: layout.contentBottomSafe
            },
            tableWidth: hideDiscountReferences ? reducedTableWidth : 'auto',
            pageBreak: 'auto',
            rowPageBreak: 'avoid'
        });

        currentY = doc.lastAutoTable?.finalY || (currentY + 20);

        if (groupKeys.length > 1) {
            const baseItems = lineItems.filter((row) => !row.isAddon);
            const addonItems = lineItems.filter((row) => row.isAddon);
            const baseNet = baseItems.reduce((sum, row) => sum + (row.net || 0), 0);
            const addonNet = addonItems.reduce((sum, row) => sum + (row.net || 0), 0);
            const groupNet = baseNet + addonNet;

            currentY = ensurePageSpace(doc, currentY, addonItems.length > 0 ? 32 : 24, pageHeight, drawMainHeader, layout.contentStartY);

            const barX = layout.pageMarginX;
            const barW = pageWidth - (layout.pageMarginX * 2);
            const rowH = 7;

            doc.setFillColor(245, 245, 245);
            doc.rect(barX, currentY, barW, rowH, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...layout.colors.grayText);
            doc.text(labels.products, barX + 4, currentY + 5);
            doc.text(`${formatSEK(applyVat(baseNet, includesVat))} SEK`, pageWidth - layout.pageMarginX - 4, currentY + 5, { align: 'right' });
            currentY += rowH;

            if (addonItems.length > 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(barX, currentY, barW, rowH, 'F');
                doc.text(labels.addons, barX + 4, currentY + 5);
                doc.text(`${formatSEK(applyVat(addonNet, includesVat))} SEK`, pageWidth - layout.pageMarginX - 4, currentY + 5, { align: 'right' });
                currentY += rowH;
            }

            const totalBarHeight = 9;
            doc.setFillColor(50, 50, 60);
            doc.rect(barX, currentY, barW, totalBarHeight, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.text(`${labels.subtotal} ${translateGroupLabel(lineKey, exportLanguage)} (${labels.yourPrice}${includesVat ? ` ${labels.inclVat}` : ''})`, barX + 4, currentY + 6);
            doc.text(`${formatSEK(applyVat(groupNet, includesVat))} SEK`, pageWidth - layout.pageMarginX - 4, currentY + 6, { align: 'right' });
            doc.setTextColor(...layout.colors.darkText);

            currentY += totalBarHeight + 6;
        }

        finalY = currentY;
    });

    return finalY;
}

export function renderTotalsSection(doc, {
    state,
    exportSummary,
    finalY,
    pageWidth,
    pageHeight,
    formatSEK,
    shouldRenderPaymentBox,
    drawMainHeader,
    layout = PDF_LAYOUT,
    hasPriceUponRequest = false,
    exportLanguage = 'sv'
}) {
    const { tableRightMargin } = createPdfTableLayout(state.hideDiscountReferences, pageWidth, state.includesVat, layout, exportLanguage);
    const rightEdgeX = pageWidth - tableRightMargin;
    const rightColX = rightEdgeX - 90 + layout.pageMarginX;
    const labels = getExportLabels(exportLanguage);

    if (finalY > pageHeight - 70) {
        finalY = startNewPage(doc, drawMainHeader, layout.contentStartY);
    } else {
        finalY += 12;
    }

    const drawTotalLine = (label, value, y, isBold = false, bgColor = null) => {
        if (bgColor) {
            doc.setFillColor(...bgColor);
            doc.roundedRect(rightColX - 4, y - 5, rightEdgeX - rightColX + 8, 8, 1, 1, 'F');
        }
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(...layout.colors.darkText);
        doc.text(label, rightColX, y);
        doc.text(value, rightEdgeX, y, { align: 'right' });
    };

    const renderPaymentInfoBox = (startY) => {
        let boxY = Math.max(startY - 2, 84);
        const boxWidth = Math.max(74, rightColX - layout.pageMarginX - 8);
        const lines = [
            `${labels.paymentTerms}: ${formatLocalizedDays(normalizePositiveInt(state.paymentTermsDays, 30), exportLanguage)}`,
            `${labels.validUntil}: ${state.validUntilDate}`
        ];
        if (state.customerInfo?.reference) {
            lines.push(`${labels.projectReference}: ${state.customerInfo.reference}`);
        }

        const boxHeight = 14 + (lines.length * 5);
        if (boxY + boxHeight > pageHeight - layout.termsFooterZone) {
            boxY = startNewPage(doc, drawMainHeader, layout.contentStartY);
        }

        doc.setFillColor(...layout.colors.lightGray);
        doc.roundedRect(layout.pageMarginX, boxY, boxWidth, boxHeight, 1.5, 1.5, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...layout.colors.darkText);
        doc.text(labels.paymentValidity, layout.pageMarginX + 3, boxY + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        let lineY = boxY + 10;
        lines.forEach((line) => {
            const wrapped = doc.splitTextToSize(line, boxWidth - 6);
            wrapped.forEach((chunk) => {
                doc.text(chunk, layout.pageMarginX + 3, lineY);
                lineY += 4;
            });
            lineY += 1;
        });

        return boxY + boxHeight;
    };

    drawTotalLine(`${state.includesVat ? labels.totalRecommendedPriceExVat : labels.totalRecommendedPrice}:`, `${formatSEK(exportSummary.grossTotalSek)} SEK`, finalY);
    finalY += 6;

    if (!state.hideDiscountReferences) {
        doc.setTextColor(...layout.colors.grayText);
        drawTotalLine(`${state.includesVat ? labels.totalDiscountExVat : labels.totalDiscount}:`, `-${formatSEK(exportSummary.totalDiscountSek)} SEK`, finalY);
        finalY += 10;
    } else {
        finalY += 4;
    }

    drawTotalLine(`${labels.totalExVat}:`, `${formatSEK(exportSummary.finalTotalSek)} SEK`, finalY, true, layout.colors.accent);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`${labels.totalExVat}:`, rightColX, finalY);
    doc.text(`${formatSEK(exportSummary.finalTotalSek)} SEK`, rightEdgeX, finalY, { align: 'right' });
    doc.setTextColor(...layout.colors.darkText);
    finalY += 10;

    if (state.includesVat) {
        drawTotalLine(`${labels.vat25}:`, `${formatSEK(exportSummary.vatAmount)} SEK`, finalY);
        finalY += 8;
        drawTotalLine(`${labels.totalInclVat}:`, `${formatSEK(exportSummary.totalWithVat)} SEK`, finalY, true, [35, 35, 45]);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(`${labels.totalInclVat}:`, rightColX, finalY);
        doc.text(`${formatSEK(exportSummary.totalWithVat)} SEK`, rightEdgeX, finalY, { align: 'right' });
        doc.setTextColor(...layout.colors.darkText);
        finalY += 10;
    }

    if (hasPriceUponRequest) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...layout.colors.grayText);
        doc.text(labels.totalsExcludePriceUponRequest, rightEdgeX, finalY - 2, { align: 'right' });
        finalY += 6;
        doc.setTextColor(...layout.colors.darkText);
        doc.setFontSize(9);
    }

    if (shouldRenderPaymentBox) {
        finalY = Math.max(finalY, renderPaymentInfoBox(finalY));
    }

    return finalY;
}

export function drawTermsPageHeader(doc, { pageWidth, layout = PDF_LAYOUT, exportLanguage = 'sv' }) {
    const labels = getExportLabels(exportLanguage);
    drawBrandLogo(doc, layout.pageMarginX, 8, layout);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...layout.colors.darkText);
    doc.text(labels.termsTitle, pageWidth - layout.pageMarginX, 16, { align: 'right' });

    doc.setDrawColor(...layout.colors.brandPrimary);
    doc.setLineWidth(0.6);
    doc.line(layout.pageMarginX, 24, pageWidth - layout.pageMarginX, 24);
}

export function renderTermsPages(doc, {
    state,
    pageWidth,
    pageHeight,
    layout = PDF_LAYOUT,
    exportLanguage = 'sv'
}) {
    if (!state.includeTerms || !state.termsText) {
        return null;
    }

    let termsY = startNewPage(doc, () => drawTermsPageHeader(doc, { pageWidth, layout, exportLanguage }), layout.termsStartY);
    const maxWidth = pageWidth - (layout.pageMarginX * 2);
    const footerZone = pageHeight - layout.termsFooterZone;
    const ensureTermsSpace = (requiredHeight) => {
        if (termsY + requiredHeight <= footerZone) {
            return;
        }
        termsY = startNewPage(doc, () => drawTermsPageHeader(doc, { pageWidth, layout, exportLanguage }), layout.termsStartY);
        
        // Restore font settings after new page header which changes font to bold 16
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...layout.colors.darkText);
    };

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...layout.colors.darkText);

    state.termsText.split('\n').forEach((line) => {
        if (line.trim() === '') {
            ensureTermsSpace(4);
            termsY += 4;
            return;
        }

        const isHeading = line === line.toUpperCase() && line.trim().length > 2 && !line.startsWith('-');
        if (isHeading) {
            ensureTermsSpace(9);
            termsY += 3;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(line, layout.pageMarginX, termsY);
            termsY += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            return;
        }

        const wrapped = doc.splitTextToSize(line, maxWidth);
        wrapped.forEach((chunk) => {
            ensureTermsSpace(4.5);
            doc.text(chunk, layout.pageMarginX, termsY);
            termsY += 4.5;
        });
    });

    return termsY + 6;
}

export function renderSignatureBlock(doc, {
    preferredY,
    pageWidth,
    pageHeight,
    drawPageHeader,
    layout = PDF_LAYOUT,
    exportLanguage = 'sv'
}) {
    const labels = getExportLabels(exportLanguage);
    const blockHeight = 31;
    const footerZone = pageHeight - layout.termsFooterZone;
    let y = preferredY;

    if (y + blockHeight > footerZone) {
        y = startNewPage(doc, drawPageHeader, 34);
    }

    const boxWidth = pageWidth - (layout.pageMarginX * 2);
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.4);
    doc.roundedRect(layout.pageMarginX, y, boxWidth, blockHeight, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...layout.colors.darkText);
    doc.text(labels.approval, layout.pageMarginX + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(labels.printedName, layout.pageMarginX + 4, y + 13);
    doc.text(labels.date, layout.pageMarginX + 110, y + 13);
    doc.text(labels.signature, layout.pageMarginX + 145, y + 13);

    doc.setDrawColor(140, 140, 140);
    doc.line(layout.pageMarginX + 4, y + 21, layout.pageMarginX + 104, y + 21);
    doc.line(layout.pageMarginX + 110, y + 21, layout.pageMarginX + 140, y + 21);
    doc.line(layout.pageMarginX + 145, y + 21, layout.pageMarginX + boxWidth - 4, y + 21);

    return y + blockHeight + 4;
}

export function renderFooters(doc, { pageWidth, pageHeight, layout = PDF_LAYOUT }) {
    const internal = doc.internal as typeof doc.internal & {
        getNumberOfPages?: () => number;
        pages?: unknown[];
    };
    const pageCount = typeof internal.getNumberOfPages === 'function'
        ? internal.getNumberOfPages()
        : Math.max(1, Array.isArray(internal.pages) ? internal.pages.length - 1 : 1);

    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);

        const footerBandY = pageHeight - layout.footerBandHeight;
        doc.setFillColor(35, 35, 45);
        doc.rect(0, footerBandY, pageWidth, layout.footerBandHeight, 'F');

        doc.setDrawColor(...layout.colors.brandPrimary);
        doc.setLineWidth(0.6);
        doc.line(layout.pageMarginX, footerBandY, pageWidth - layout.pageMarginX, footerBandY);

        let footerY = footerBandY + 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(layout.footerConfig.slogan, pageWidth / 2, footerY, { align: 'center' });

        footerY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(180, 180, 190);
        doc.text(layout.footerConfig.address, pageWidth / 2, footerY, { align: 'center' });

        if (layout.footerConfig.website) {
            footerY += 4;
            doc.setFontSize(7);
            doc.text(layout.footerConfig.website, pageWidth / 2, footerY, { align: 'center' });
        }

        footerY += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(layout.footerConfig.contact, pageWidth / 2, footerY, { align: 'center' });

        doc.setTextColor(...layout.colors.brandPrimary);
        doc.setFontSize(7);
        doc.text(`${page} / ${pageCount}`, pageWidth - layout.pageMarginX, pageHeight - 5, { align: 'right' });
    }
}

