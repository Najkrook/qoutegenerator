import autoTable from 'jspdf-autotable';
import { BRIXX_LOGO_BASE64 } from '../../assets/logoData.js';
import { buildPdfTableData } from '../services/exportDataBuilders.js';

export const PDF_LAYOUT = Object.freeze({
    pageMarginX: 10,
    headerTopY: 16,
    headerLineY: 28,
    customerBoxY: 31,
    contentStartY: 35,
    contentBottomSafe: 36,
    termsStartY: 31,
    termsFooterZone: 35,
    footerBandHeight: 30,
    colors: {
        brandOrange: [243, 156, 18],
        darkText: [30, 30, 30],
        grayText: [120, 120, 120],
        lightGray: [230, 230, 230],
        accentGreen: [46, 174, 96]
    }
});

const GROUP_SORT_ORDER = ['clickitup', 'bahama', 'fiesta', 'ovrigt'];

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

export function createPdfTableLayout(hideDiscountReferences, pageWidth, layout = PDF_LAYOUT) {
    const tableHead = hideDiscountReferences
        ? [['Modell', 'Storlek', 'Pris/enhet\nExkl. moms', 'Antal', 'Ert Pris\nExkl. moms']]
        : [['Modell', 'Storlek', 'Pris/enhet\nExkl. moms', 'Antal', 'Ert Pris\nExkl. moms', 'Rek Utpris\nExkl. moms', 'Rabatt\ni SEK', 'Rabatt\ni %']];
    const tableColumnStyles = hideDiscountReferences
        ? {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 54 },
            1: { halign: 'center', cellWidth: 20 },
            2: { halign: 'right', cellWidth: 33 },
            3: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
            4: { halign: 'right', fontStyle: 'bold', cellWidth: 33 }
        }
        : {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 44 },
            1: { halign: 'center', cellWidth: 16 },
            2: { halign: 'right', cellWidth: 27 },
            3: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
            4: { halign: 'right', fontStyle: 'bold', cellWidth: 27 },
            5: { halign: 'right', cellWidth: 27 },
            6: { halign: 'right', cellWidth: 23 },
            7: { halign: 'center', cellWidth: 14 }
        };
    const reducedTableWidth = Object.values(tableColumnStyles).reduce((sum, style) => sum + (style.cellWidth || 0), 0);
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

export function groupSummaryTotalsByLine(summaryData = {}) {
    const totals = Array.isArray(summaryData?.totals) ? summaryData.totals : [];
    const groupedTotals = totals.reduce((acc, item) => {
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

function drawBrandLogo(doc, x, y, width, height, fallbackSize, layout) {
    try {
        doc.addImage(BRIXX_LOGO_BASE64, 'PNG', x, y, width, height);
    } catch (error) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fallbackSize);
        doc.setTextColor(...layout.colors.brandOrange);
        doc.text('BRIXX', x, y + height - 4);
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

export function drawHeader(doc, { pageWidth, quoteDate, customerInfo = {}, layout = PDF_LAYOUT }) {
    const { pageMarginX, headerTopY, headerLineY } = layout;

    drawBrandLogo(doc, pageMarginX, 8, 50, 16, 22, layout);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...layout.colors.darkText);
    doc.text('OFFERT', pageWidth - pageMarginX, headerTopY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...layout.colors.grayText);
    doc.text(`Datum: ${quoteDate}`, pageWidth - pageMarginX, 22, { align: 'right' });
    if (customerInfo.reference) {
        doc.text(`Ref: ${customerInfo.reference}`, pageWidth - pageMarginX, 26, { align: 'right' });
    }

    doc.setDrawColor(...layout.colors.brandOrange);
    doc.setLineWidth(0.8);
    doc.line(pageMarginX, headerLineY, pageWidth - pageMarginX, headerLineY);
}

export function renderCustomerInfoBlock(doc, { customerInfo = {}, pageWidth, layout = PDF_LAYOUT }) {
    const customerLines = [];
    const recipient = [customerInfo.company, customerInfo.name].filter(Boolean).join(' / ');
    if (recipient) {
        customerLines.push({ type: 'recipient', value: recipient });
    }
    if (customerInfo.validity) {
        customerLines.push({ type: 'muted', value: `Giltighetstid: ${customerInfo.validity}` });
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
            doc.text('Till:', customerTextX, customerTextY);
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

export function renderGroupedTables(doc, {
    summaryData,
    formatSEK,
    currentY,
    pageWidth,
    pageHeight,
    hideDiscountReferences,
    drawMainHeader,
    layout = PDF_LAYOUT
}) {
    const { groupedTotals, groupKeys } = groupSummaryTotalsByLine(summaryData);

    if (groupKeys.length === 0 || !Array.isArray(summaryData?.totals) || summaryData.totals.length === 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Offertdetaljer', layout.pageMarginX, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let y = currentY + 6;

        (summaryData?.totals || []).forEach((row) => {
            if (y > pageHeight - (layout.contentBottomSafe - 3)) {
                y = startNewPage(doc, drawMainHeader, layout.contentStartY);
            }
            const textRow = `${row.model} | ${row.size || '-'} | x${row.qty} | ${formatSEK(row.net)} SEK`;
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
    } = createPdfTableLayout(hideDiscountReferences, pageWidth, layout);

    let finalY = currentY;

    groupKeys.forEach((lineKey, index) => {
        const lineItems = groupedTotals[lineKey];

        if (index > 0) {
            currentY = startNewPage(doc, drawMainHeader, layout.contentStartY);
            drawGroupSubtitle(doc, `Produkter - ${lineKey}`, currentY, layout, layout.pageMarginX);
            currentY += 8;
        } else if (groupKeys.length > 1 && lineKey !== 'Övrigt') {
            drawGroupSubtitle(doc, `Produkter - ${lineKey}`, currentY, layout, layout.pageMarginX);
            currentY += 6;
        }

        autoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: buildPdfTableData(lineItems, formatSEK, {
                hideDiscountColumns: hideDiscountReferences,
                hideRecommendedPriceColumn: hideDiscountReferences
            }),
            theme: 'striped',
            styles: {
                fontSize: 8.5,
                cellPadding: 2.5,
                valign: 'middle',
                textColor: layout.colors.darkText,
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            headStyles: {
                fillColor: [35, 35, 45],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 8
            },
            alternateRowStyles: {
                fillColor: [248, 249, 250]
            },
            columnStyles: tableColumnStyles,
            didParseCell(data) {
                if (data.section === 'head' && data.column.index === 4) {
                    data.cell.styles.fillColor = layout.colors.accentGreen;
                    data.cell.styles.textColor = [255, 255, 255];
                }
                if (data.section === 'body' && data.column.index === 4) {
                    data.cell.styles.fillColor = [235, 250, 240];
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
            doc.text('Produkter', barX + 4, currentY + 5);
            doc.text(`${formatSEK(baseNet)} SEK`, pageWidth - layout.pageMarginX - 4, currentY + 5, { align: 'right' });
            currentY += rowH;

            if (addonItems.length > 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(barX, currentY, barW, rowH, 'F');
                doc.text('Tillval', barX + 4, currentY + 5);
                doc.text(`${formatSEK(addonNet)} SEK`, pageWidth - layout.pageMarginX - 4, currentY + 5, { align: 'right' });
                currentY += rowH;
            }

            const totalBarHeight = 9;
            doc.setFillColor(50, 50, 60);
            doc.rect(barX, currentY, barW, totalBarHeight, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.text(`Delsumma ${lineKey} (Ert Pris)`, barX + 4, currentY + 6);
            doc.text(`${formatSEK(groupNet)} SEK`, pageWidth - layout.pageMarginX - 4, currentY + 6, { align: 'right' });
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
    layout = PDF_LAYOUT
}) {
    const rightColX = pageWidth - 90;

    if (finalY > pageHeight - 70) {
        finalY = startNewPage(doc, drawMainHeader, layout.contentStartY);
    } else {
        finalY += 12;
    }

    const drawTotalLine = (label, value, y, isBold = false, bgColor = null) => {
        if (bgColor) {
            doc.setFillColor(...bgColor);
            doc.roundedRect(rightColX - 4, y - 5, (pageWidth - layout.pageMarginX) - rightColX + 8, 8, 1, 1, 'F');
        }
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(...layout.colors.darkText);
        doc.text(label, rightColX, y);
        doc.text(value, pageWidth - layout.pageMarginX, y, { align: 'right' });
    };

    const renderPaymentInfoBox = (startY) => {
        let boxY = Math.max(startY - 2, 84);
        const boxWidth = Math.max(74, rightColX - layout.pageMarginX - 8);
        const lines = [
            `Betalningsvillkor: ${normalizePositiveInt(state.paymentTermsDays, 30)} dagar`,
            `Giltig till: ${state.validUntilDate}`
        ];
        if (state.customerInfo?.reference) {
            lines.push(`Referens: ${state.customerInfo.reference}`);
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
        doc.text('BETALNING & GILTIGHET', layout.pageMarginX + 3, boxY + 5);

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

    drawTotalLine('Totalt Rek Utpris:', `${formatSEK(exportSummary.grossTotalSek)} SEK`, finalY);
    finalY += 6;

    if (!state.hideDiscountReferences) {
        doc.setTextColor(...layout.colors.grayText);
        drawTotalLine('Total Rabatt:', `-${formatSEK(exportSummary.totalDiscountSek)} SEK`, finalY);
        finalY += 10;
    } else {
        finalY += 4;
    }

    drawTotalLine('Totalt Exkl. moms:', `${formatSEK(exportSummary.finalTotalSek)} SEK`, finalY, true, layout.colors.accentGreen);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Totalt Exkl. moms:', rightColX, finalY);
    doc.text(`${formatSEK(exportSummary.finalTotalSek)} SEK`, pageWidth - layout.pageMarginX, finalY, { align: 'right' });
    doc.setTextColor(...layout.colors.darkText);
    finalY += 10;

    if (state.includesVat) {
        drawTotalLine('Moms 25%:', `${formatSEK(exportSummary.vatAmount)} SEK`, finalY);
        finalY += 8;
        drawTotalLine('Totalt inkl. moms:', `${formatSEK(exportSummary.totalWithVat)} SEK`, finalY, true, [35, 35, 45]);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('Totalt inkl. moms:', rightColX, finalY);
        doc.text(`${formatSEK(exportSummary.totalWithVat)} SEK`, pageWidth - layout.pageMarginX, finalY, { align: 'right' });
        doc.setTextColor(...layout.colors.darkText);
    }

    if (shouldRenderPaymentBox) {
        finalY = Math.max(finalY, renderPaymentInfoBox(finalY));
    }

    return finalY;
}

export function drawTermsPageHeader(doc, { pageWidth, layout = PDF_LAYOUT }) {
    drawBrandLogo(doc, layout.pageMarginX, 8, 35, 11, 16, layout);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...layout.colors.darkText);
    doc.text('VILLKOR', pageWidth - layout.pageMarginX, 16, { align: 'right' });

    doc.setDrawColor(...layout.colors.brandOrange);
    doc.setLineWidth(0.6);
    doc.line(layout.pageMarginX, 24, pageWidth - layout.pageMarginX, 24);
}

export function renderTermsPages(doc, {
    state,
    pageWidth,
    pageHeight,
    layout = PDF_LAYOUT
}) {
    if (!state.includeTerms || !state.termsText) {
        return null;
    }

    let termsY = startNewPage(doc, () => drawTermsPageHeader(doc, { pageWidth, layout }), layout.termsStartY);
    const maxWidth = pageWidth - (layout.pageMarginX * 2);
    const footerZone = pageHeight - layout.termsFooterZone;
    const ensureTermsSpace = (requiredHeight) => {
        if (termsY + requiredHeight <= footerZone) {
            return;
        }
        termsY = startNewPage(doc, () => drawTermsPageHeader(doc, { pageWidth, layout }), layout.termsStartY);
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
    layout = PDF_LAYOUT
}) {
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
    doc.text('Godkännande', layout.pageMarginX + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Namnförtydligande', layout.pageMarginX + 4, y + 13);
    doc.text('Datum', layout.pageMarginX + 110, y + 13);
    doc.text('Signatur', layout.pageMarginX + 145, y + 13);

    doc.setDrawColor(140, 140, 140);
    doc.line(layout.pageMarginX + 4, y + 21, layout.pageMarginX + 104, y + 21);
    doc.line(layout.pageMarginX + 110, y + 21, layout.pageMarginX + 140, y + 21);
    doc.line(layout.pageMarginX + 145, y + 21, layout.pageMarginX + boxWidth - 4, y + 21);

    return y + blockHeight + 4;
}

export function renderFooters(doc, { pageWidth, pageHeight, layout = PDF_LAYOUT }) {
    const pageCount = doc.internal.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);

        const footerBandY = pageHeight - layout.footerBandHeight;
        doc.setFillColor(35, 35, 45);
        doc.rect(0, footerBandY, pageWidth, layout.footerBandHeight, 'F');

        doc.setDrawColor(...layout.colors.brandOrange);
        doc.setLineWidth(0.6);
        doc.line(layout.pageMarginX, footerBandY, pageWidth - layout.pageMarginX, footerBandY);

        let footerY = footerBandY + 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('Parasoll | Värme | Vindskydd | Miljö', pageWidth / 2, footerY, { align: 'center' });

        footerY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(180, 180, 190);
        doc.text('BRIXX EUROPE | Dockplatsen 1 | SE 211 19 Malmö | SWEDEN', pageWidth / 2, footerY, { align: 'center' });

        footerY += 4;
        doc.setFontSize(7);
        doc.text('Products Designed for Excellence, Engineered for Performance.', pageWidth / 2, footerY, { align: 'center' });

        footerY += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text("+46 (0) 708-500 000   |   team@brixx.se   |   WWW.BRIXX.SE   |   EST'D 1992", pageWidth / 2, footerY, { align: 'center' });

        doc.setTextColor(...layout.colors.brandOrange);
        doc.setFontSize(7);
        doc.text(`${page} / ${pageCount}`, pageWidth - layout.pageMarginX, pageHeight - 5, { align: 'right' });
    }
}
