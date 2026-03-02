import { BRIXX_LOGO_BASE64 } from '../assets/logoData.js';
import { notifyWarn, notifyError } from '../services/notificationService.js';
import { buildPdfTableData, buildExportSummary } from '../services/exportDataBuilders.js';

export function generatePDF(state, summaryData, returnBlob = false) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        if (!returnBlob) notifyWarn("PDF-motorn laddar fortfarande, forsok igen om nagra sekunder.");
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

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // â”€â”€ Brand Colors â”€â”€
    const brandOrange = [243, 156, 18];   // #f39c12
    const darkText = [30, 30, 30];
    const grayText = [120, 120, 120];
    const lightGray = [230, 230, 230];
    const accentGreen = [46, 174, 96];     // For "Ert Pris" highlight

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  HEADER: Logo + Title + Date/Ref
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // Logo (left side)
    try {
        doc.addImage(BRIXX_LOGO_BASE64, 'PNG', 14, 10, 50, 16);
    } catch (e) {
        // Fallback: text logo if image fails
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(...brandOrange);
        doc.text("BRIXX", 14, 22);
    }

    // Title (right side)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...darkText);
    doc.text("OFFERT", pageWidth - 14, 18, { align: "right" });

    // Date & Reference below title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...grayText);
    doc.text(`Datum: ${state.customerInfo.date || new Date().toLocaleDateString('sv-SE')}`, pageWidth - 14, 24, { align: "right" });
    if (state.customerInfo.reference) {
        doc.text(`Ref: ${state.customerInfo.reference}`, pageWidth - 14, 29, { align: "right" });
    }

    // Orange accent line under header
    doc.setDrawColor(...brandOrange);
    doc.setLineWidth(0.8);
    doc.line(14, 32, pageWidth - 14, 32);

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  CUSTOMER INFO BLOCK
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    let currentY = 42;

    // Light background box for customer info
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, 36, pageWidth - 28, 28, 2, 2, 'F');

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...darkText);

    doc.text(`Malmö ${state.customerInfo.date || new Date().toLocaleDateString('sv-SE')}`, 18, currentY);
    currentY += 6;
    doc.setTextColor(...grayText);
    doc.text("Ca kostnad enligt diskussion.", 18, currentY);
    currentY += 6;

    if (state.customerInfo.name || state.customerInfo.company) {
        doc.setTextColor(...darkText);
        doc.setFont("helvetica", "bold");
        doc.text("Till:", 18, currentY);
        doc.setFont("helvetica", "normal");
        let toText = [state.customerInfo.company, state.customerInfo.name].filter(Boolean).join(" / ");
        doc.text(toText, 28, currentY);
        currentY += 6;
    }

    if (state.customerInfo.validity) {
        doc.setTextColor(...grayText);
        doc.text(`Giltighetstid: ${state.customerInfo.validity}`, 18, currentY);
    }

    currentY = 70;

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  ITEMS TABLE
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 38 },
            1: { halign: 'center', cellWidth: 18 },
            2: { halign: 'right', cellWidth: 22 },
            3: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
            4: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
            5: { halign: 'right', cellWidth: 24 },
            6: { halign: 'right', cellWidth: 22 },
            7: { halign: 'center', cellWidth: 16 }
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
        margin: { left: 14, right: 14 }
    });

    let finalY = doc.lastAutoTable?.finalY || autoTableResult?.finalY || 45;
    if (!autoTableResult && !doc.lastAutoTable) {
        if (!returnBlob) {
            notifyWarn("Avancerad PDF-tabell saknas. Exporterar med enkel layout.");
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Offertdetaljer", 14, currentY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        let y = currentY + 6;
        summaryData.totals.forEach((t) => {
            if (y > pageHeight - 42) {
                doc.addPage();
                y = 20;
            }
            const row = `${t.model} | ${t.size || '-'} | x${t.qty} | ${formatSEK(t.net)} SEK`;
            doc.text(row, 14, y);
            y += 4.5;
        });
        finalY = y + 6;
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  TOTALS SECTION
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    doc.setFontSize(10);
    let rightColX = pageWidth - 90;
    finalY += 12;

    const drawTotalLine = (label, value, y, isBold = false, bgColor = null) => {
        if (bgColor) {
            doc.setFillColor(...bgColor);
            doc.roundedRect(rightColX - 4, y - 5, (pageWidth - 14) - rightColX + 8, 8, 1, 1, 'F');
        }
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(...darkText);
        doc.text(label, rightColX, y);
        doc.text(value, pageWidth - 14, y, { align: "right" });
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
    doc.text(`${formatSEK(exportSummary.finalTotalSek)} SEK`, pageWidth - 14, finalY, { align: "right" });
    doc.setTextColor(...darkText);
    finalY += 10;

    if (state.includesVat) {
        drawTotalLine("Moms 25%:", `${formatSEK(exportSummary.vatAmount)} SEK`, finalY);
        finalY += 8;
        drawTotalLine("Totalt inkl. moms:", `${formatSEK(exportSummary.totalWithVat)} SEK`, finalY, true, [35, 35, 45]);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Totalt inkl. moms:", rightColX, finalY);
        doc.text(`${formatSEK(exportSummary.totalWithVat)} SEK`, pageWidth - 14, finalY, { align: "right" });
        doc.setTextColor(...darkText);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  TERMS & CONDITIONS PAGE (optional)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    if (state.includeTerms && state.termsText) {
        doc.addPage();

        // Mini header with logo
        try {
            doc.addImage(BRIXX_LOGO_BASE64, 'PNG', 14, 10, 35, 11);
        } catch (e) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(...brandOrange);
            doc.text("BRIXX", 14, 18);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...darkText);
        doc.text("VILLKOR", pageWidth - 14, 18, { align: "right" });

        // Orange line
        doc.setDrawColor(...brandOrange);
        doc.setLineWidth(0.6);
        doc.line(14, 26, pageWidth - 14, 26);

        // Render terms text with auto-wrapping
        let termsY = 34;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...darkText);

        const termsLines = state.termsText.split('\n');
        const maxWidth = pageWidth - 28;
        const footerZone = pageHeight - 35; // Don't go below footer area

        termsLines.forEach(line => {
            if (termsY > footerZone) {
                // Would overflow into footer â€” skip (could add page break logic later)
                return;
            }

            if (line.trim() === '') {
                termsY += 4; // Blank line spacing
                return;
            }

            // Check if this is a heading (ALL CAPS line)
            const isHeading = line === line.toUpperCase() && line.trim().length > 2 && !line.startsWith('•');
            if (isHeading) {
                termsY += 3;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(...darkText);
                doc.text(line, 14, termsY);
                termsY += 6;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
            } else {
                // Wrap long lines
                const wrapped = doc.splitTextToSize(line, maxWidth);
                wrapped.forEach(wl => {
                    if (termsY > footerZone) return;
                    doc.text(wl, 14, termsY);
                    termsY += 4.5;
                });
            }
        });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  FOOTER (all pages)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
        doc.line(14, footerBandY, pageWidth - 14, footerBandY);

        // Footer text - white on dark
        let footerY = footerBandY + 7;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text("Parasoll    ·    Värme    ·    Vindskydd    ·    Miljö", pageWidth / 2, footerY, { align: "center" });

        footerY += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(180, 180, 190);
        doc.text("BRIXX EUROPE  |  Dockplatsen 1  |  SE 211 19 Malmö  |  SWEDEN", pageWidth / 2, footerY, { align: "center" });

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
        doc.text(`${i} / ${pageCount}`, pageWidth - 14, pageHeight - 5, { align: "right" });
    }

        const pdfBlob = doc.output('blob');
        if (returnBlob) {
            return pdfBlob;
        }
        return pdfBlob;
    } catch (err) {
        console.error("PDF export failed:", err);
        if (!returnBlob) {
            notifyError("Kunde inte skapa PDF. Kontrollera att PDF-biblioteken ar laddade och forsok igen.");
        }
        return null;
    }
}

