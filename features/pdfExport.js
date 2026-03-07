import { BRIXX_LOGO_BASE64 } from '../assets/logoData.js';
import { notifyWarn, notifyError } from '../services/notificationService.js';
import { buildPdfTableData, buildExportSummary } from '../services/exportDataBuilders.js';

function normalizePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
    if (!window.jspdf || !window.jspdf.jsPDF) {
        if (!returnBlob) notifyWarn("PDF-motorn laddar fortfarande, försök igen om några sekunder.");
        return null;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Support multiple jspdf-autotable attachment styles.
    const runAutoTable = (options) => {
        if (typeof doc.autoTable === 'function') return doc.autoTable(options);
        if (typeof window.autoTable === 'function') return window.autoTable(doc, options);
        if (typeof window.jspdf?.autoTable === 'function') return window.jspdf.autoTable(doc, options);
        return null;
    };
    try {
        const formatSEK = (val) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
        const pdfLegalTemplatesEnabled = typeof window === 'undefined'
            ? true
            : window.FEATURE_PDF_LEGAL_TEMPLATES !== false;
        const shouldRenderPaymentBox = pdfLegalTemplatesEnabled && state.includePaymentBox !== false;
        const shouldRenderSignatureBlock = pdfLegalTemplatesEnabled && state.includeSignatureBlock !== false;

        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const PAGE_MARGIN_X = 10;
        const HEADER_TOP_Y = 16;
        const HEADER_LINE_Y = 28;
        const CUSTOMER_BOX_Y = 31;
        const CONTENT_BOTTOM_SAFE = 36;
        const customerInfo = state.customerInfo || {};
        const quoteDate = customerInfo.date || new Date().toLocaleDateString('sv-SE');

        //
        const brandOrange = [243, 156, 18];   // #f39c12
        const darkText = [30, 30, 30];
        const grayText = [120, 120, 120];
        const lightGray = [230, 230, 230];
        const accentGreen = [46, 174, 96];     // For "Ert Pris" highlight

        //
        //  HEADER: Logo + Title + Date/Ref
        //

        // Logo (left side)
        try {
            doc.addImage(BRIXX_LOGO_BASE64, 'PNG', PAGE_MARGIN_X, 8, 50, 16);
        } catch (e) {
            // Fallback: text logo if image fails
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(...brandOrange);
            doc.text("BRIXX", PAGE_MARGIN_X, 20);
        }

        // Title (right side)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(...darkText);
        doc.text("OFFERT", pageWidth - PAGE_MARGIN_X, HEADER_TOP_Y, { align: "right" });

        // Date & Reference below title
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...grayText);
        doc.text(`Datum: ${quoteDate}`, pageWidth - PAGE_MARGIN_X, 22, { align: "right" });
        if (customerInfo.reference) {
            doc.text(`Ref: ${customerInfo.reference}`, pageWidth - PAGE_MARGIN_X, 26, { align: "right" });
        }

        // Orange accent line under header
        doc.setDrawColor(...brandOrange);
        doc.setLineWidth(0.8);
        doc.line(PAGE_MARGIN_X, HEADER_LINE_Y, pageWidth - PAGE_MARGIN_X, HEADER_LINE_Y);

        //
        //  CUSTOMER INFO BLOCK
        //

        const customerLines = [];
        const recipient = [customerInfo.company, customerInfo.name].filter(Boolean).join(" / ");
        if (recipient) {
            customerLines.push({ type: 'recipient', value: recipient });
        }
        if (customerInfo.validity) {
            customerLines.push({ type: 'muted', value: `Giltighetstid: ${customerInfo.validity}` });
        }

        let currentY = 35;
        if (customerLines.length > 0) {
            const customerBoxHeight = Math.max(14, 8 + (customerLines.length * 5));
            const customerBoxWidth = pageWidth - (PAGE_MARGIN_X * 2);
            const customerTextX = PAGE_MARGIN_X + 4;
            let customerTextY = CUSTOMER_BOX_Y + 7;

            doc.setFillColor(250, 250, 250);
            doc.roundedRect(PAGE_MARGIN_X, CUSTOMER_BOX_Y, customerBoxWidth, customerBoxHeight, 2, 2, 'F');
            doc.setFontSize(10);

            customerLines.forEach((line) => {
                if (line.type === 'recipient') {
                    doc.setTextColor(...darkText);
                    doc.setFont("helvetica", "bold");
                    doc.text("Till:", customerTextX, customerTextY);
                    doc.setFont("helvetica", "normal");
                    doc.text(line.value, customerTextX + 10, customerTextY);
                } else {
                    doc.setTextColor(...grayText);
                    doc.setFont("helvetica", "normal");
                    doc.text(line.value, customerTextX, customerTextY);
                }
                customerTextY += 5;
            });

            currentY = CUSTOMER_BOX_Y + customerBoxHeight + 6;
        }

        //
        //  ITEMS TABLE
        //

        const tableData = buildPdfTableData(state, summaryData, formatSEK);

        const autoTableResult = runAutoTable({
            startY: currentY,
            head: [['Modell', 'Storlek', 'Pris/enhet\nExkl. moms', 'Antal', 'Ert Pris\nExkl. moms', 'Rek Utpris\nExkl. moms', 'Rabatt\ni SEK', 'Rabatt\ni %']],
            body: tableData,
            theme: 'striped',
            styles: {
                fontSize: 8.5,
                cellPadding: 2.5,
                valign: 'middle',
                textColor: darkText,
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
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', cellWidth: 44 },
                1: { halign: 'center', cellWidth: 16 },
                2: { halign: 'right', cellWidth: 27 },
                3: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
                4: { halign: 'right', fontStyle: 'bold', cellWidth: 27 },
                5: { halign: 'right', cellWidth: 27 },
                6: { halign: 'right', cellWidth: 23 },
                7: { halign: 'center', cellWidth: 14 }
            },
            didParseCell: function (data) {
                // "Ert Pris" column: green accent
                if (data.section === 'head' && data.column.index === 4) {
                    data.cell.styles.fillColor = accentGreen;
                    data.cell.styles.textColor = [255, 255, 255];
                }
                if (data.section === 'body' && data.column.index === 4) {
                    data.cell.styles.fillColor = [235, 250, 240];
                }
            },
            margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X, top: 14, bottom: CONTENT_BOTTOM_SAFE },
            pageBreak: 'auto',
            rowPageBreak: 'avoid'
        });

        let finalY = doc.lastAutoTable?.finalY || autoTableResult?.finalY || 45;
        if (!autoTableResult && !doc.lastAutoTable) {
            if (!returnBlob) {
                notifyWarn("Avancerad PDF-tabell saknas. Exporterar med enkel layout.");
            }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("Offertdetaljer", PAGE_MARGIN_X, currentY);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            let y = currentY + 6;
            summaryData.totals.forEach((t) => {
                if (y > pageHeight - (CONTENT_BOTTOM_SAFE - 3)) {
                    doc.addPage();
                    y = 20;
                }
                const row = `${t.model} | ${t.size || '-'} | x${t.qty} | ${formatSEK(t.net)} SEK`;
                doc.text(row, PAGE_MARGIN_X, y);
                y += 4.5;
            });
            finalY = y + 6;
        }

        //
        //  TOTALS SECTION
        //

        doc.setFontSize(10);
        let rightColX = pageWidth - 90;

        // Ensure the totals block doesn't start too close to the footer
        if (finalY > pageHeight - 70) {
            doc.addPage();
            finalY = 20;
        } else {
            finalY += 12;
        }

        const drawTotalLine = (label, value, y, isBold = false, bgColor = null) => {
            if (bgColor) {
                doc.setFillColor(...bgColor);
                doc.roundedRect(rightColX - 4, y - 5, (pageWidth - PAGE_MARGIN_X) - rightColX + 8, 8, 1, 1, 'F');
            }
            doc.setFont("helvetica", isBold ? "bold" : "normal");
            doc.setTextColor(...darkText);
            doc.text(label, rightColX, y);
            doc.text(value, pageWidth - PAGE_MARGIN_X, y, { align: "right" });
        };

        const renderPaymentInfoBox = (startY) => {
            const boxX = PAGE_MARGIN_X;
            let boxY = Math.max(startY - 2, 84);
            const boxWidth = Math.max(74, rightColX - boxX - 8);
            const lines = [
                `Betalningsvillkor: ${normalizePositiveInt(state.paymentTermsDays, 30)} dagar`,
                `Giltig till: ${computeValidUntilDateString(customerInfo.date, state.quoteValidityDays)}`
            ];
            if (customerInfo.reference) {
                lines.push(`Referens: ${customerInfo.reference}`);
            }

            const boxHeight = 14 + (lines.length * 5);
            if (boxY + boxHeight > pageHeight - 35) {
                doc.addPage();
                boxY = 34;
            }
            doc.setFillColor(...lightGray);
            doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 1.5, 1.5, 'F');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(...darkText);
            doc.text("BETALNING & GILTIGHET", boxX + 3, boxY + 5);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            let lineY = boxY + 10;
            lines.forEach((line) => {
                const wrapped = doc.splitTextToSize(line, boxWidth - 6);
                wrapped.forEach((chunk) => {
                    doc.text(chunk, boxX + 3, lineY);
                    lineY += 4;
                });
                lineY += 1;
            });
        };

        const renderSignatureBlock = (preferredY = finalY + 12) => {
            const blockHeight = 31;
            const footerZone = pageHeight - 35;
            let y = preferredY;

            if (y + blockHeight > footerZone) {
                doc.addPage();
                y = 34;
            }

            const boxX = PAGE_MARGIN_X;
            const boxWidth = pageWidth - (PAGE_MARGIN_X * 2);
            doc.setDrawColor(190, 190, 190);
            doc.setLineWidth(0.4);
            doc.roundedRect(boxX, y, boxWidth, blockHeight, 2, 2, 'S');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(...darkText);
            doc.text("Godkännande", boxX + 4, y + 6);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.text("Namnförtydligande", boxX + 4, y + 13);
            doc.text("Datum", boxX + 110, y + 13);
            doc.text("Signatur", boxX + 145, y + 13);

            doc.setDrawColor(140, 140, 140);
            doc.line(boxX + 4, y + 21, boxX + 104, y + 21);
            doc.line(boxX + 110, y + 21, boxX + 140, y + 21);
            doc.line(boxX + 145, y + 21, boxX + boxWidth - 4, y + 21);

            return y + blockHeight + 4;
        };

        const exportSummary = buildExportSummary(state, summaryData);
        drawTotalLine("Totalt Rek Utpris:", `${formatSEK(exportSummary.grossTotalSek)} SEK`, finalY);
        finalY += 6;

        doc.setTextColor(...grayText);
        drawTotalLine("Total Rabatt:", `-${formatSEK(exportSummary.totalDiscountSek)} SEK`, finalY);
        finalY += 10;

        // Green bar for final total
        drawTotalLine("Totalt Exkl. moms:", `${formatSEK(exportSummary.finalTotalSek)} SEK`, finalY, true, accentGreen);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Totalt Exkl. moms:", rightColX, finalY);
        doc.text(`${formatSEK(exportSummary.finalTotalSek)} SEK`, pageWidth - PAGE_MARGIN_X, finalY, { align: "right" });
        doc.setTextColor(...darkText);
        finalY += 10;

        if (state.includesVat) {
            drawTotalLine("Moms 25%:", `${formatSEK(exportSummary.vatAmount)} SEK`, finalY);
            finalY += 8;
            drawTotalLine("Totalt inkl. moms:", `${formatSEK(exportSummary.totalWithVat)} SEK`, finalY, true, [35, 35, 45]);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text("Totalt inkl. moms:", rightColX, finalY);
            doc.text(`${formatSEK(exportSummary.totalWithVat)} SEK`, pageWidth - PAGE_MARGIN_X, finalY, { align: "right" });
            doc.setTextColor(...darkText);
        }

        if (shouldRenderPaymentBox) {
            renderPaymentInfoBox(finalY);
        }

        //
        //  TERMS & CONDITIONS PAGE (optional)
        //

        let termsPageEndY = null;
        if (state.includeTerms && state.termsText) {
            doc.addPage();

            // Mini header with logo
            try {
                doc.addImage(BRIXX_LOGO_BASE64, 'PNG', PAGE_MARGIN_X, 8, 35, 11);
            } catch (e) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(16);
                doc.setTextColor(...brandOrange);
                doc.text("BRIXX", PAGE_MARGIN_X, 16);
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(...darkText);
            doc.text("VILLKOR", pageWidth - PAGE_MARGIN_X, 16, { align: "right" });

            // Orange line
            doc.setDrawColor(...brandOrange);
            doc.setLineWidth(0.6);
            doc.line(PAGE_MARGIN_X, 24, pageWidth - PAGE_MARGIN_X, 24);

            // Render terms text with auto-wrapping
            let termsY = 31;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(...darkText);

            const termsLines = state.termsText.split('\n');
            const maxWidth = pageWidth - (PAGE_MARGIN_X * 2);
            const footerZone = pageHeight - 35; // Don't go below footer area

            termsLines.forEach(line => {
                if (termsY > footerZone) {
                    //
                    return;
                }

                if (line.trim() === '') {
                    termsY += 4; // Blank line spacing
                    return;
                }

                // Check if this is a heading (ALL CAPS line)
                const isHeading = line === line.toUpperCase() && line.trim().length > 2 && !line.startsWith('-');
                if (isHeading) {
                    termsY += 3;
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.setTextColor(...darkText);
                    doc.text(line, PAGE_MARGIN_X, termsY);
                    termsY += 6;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                } else {
                    // Wrap long lines
                    const wrapped = doc.splitTextToSize(line, maxWidth);
                    wrapped.forEach(wl => {
                        if (termsY > footerZone) return;
                        doc.text(wl, PAGE_MARGIN_X, termsY);
                        termsY += 4.5;
                    });
                }
            });
            termsPageEndY = termsY + 6;
        }

        if (shouldRenderSignatureBlock) {
            if (termsPageEndY !== null) {
                doc.setPage(doc.internal.getNumberOfPages());
                renderSignatureBlock(termsPageEndY);
            } else {
                renderSignatureBlock(finalY + 12);
            }
        }

        //
        //  FOOTER (all pages)
        //

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Dark footer band
            const footerBandY = pageHeight - 30;
            doc.setFillColor(35, 35, 45);
            doc.rect(0, footerBandY, pageWidth, 30, 'F');

            // Orange accent line above footer
            doc.setDrawColor(...brandOrange);
            doc.setLineWidth(0.6);
            doc.line(PAGE_MARGIN_X, footerBandY, pageWidth - PAGE_MARGIN_X, footerBandY);

            // Footer text - white on dark
            let footerY = footerBandY + 7;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text("Parasoll | Varme | Vindskydd | Miljo", pageWidth / 2, footerY, { align: "center" });

            footerY += 5;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(180, 180, 190);
            doc.text("BRIXX EUROPE | Dockplatsen 1 | SE 211 19 Malmö | SWEDEN", pageWidth / 2, footerY, { align: "center" });

            footerY += 4;
            doc.setFontSize(7);
            doc.text("Products Designed for Excellence, Engineered for Performance.", pageWidth / 2, footerY, { align: "center" });

            footerY += 5;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.text("+46 (0) 705-250 000   |   info@brixx.se   |   WWW.BRIXX.SE   |   EST'D 1992", pageWidth / 2, footerY, { align: "center" });

            // Page number (bottom right, orange)
            doc.setTextColor(...brandOrange);
            doc.setFontSize(7);
            doc.text(`${i} / ${pageCount}`, pageWidth - PAGE_MARGIN_X, pageHeight - 5, { align: "right" });
        }

        const pdfBlob = doc.output('blob');
        if (returnBlob) {
            return pdfBlob;
        }
        return pdfBlob;
    } catch (err) {
        console.error("PDF export failed:", err);
        if (!returnBlob) {
            notifyError("Kunde inte skapa PDF. Kontrollera att PDF-biblioteken är laddade och försök igen.");
        }
        return null;
    }
}
