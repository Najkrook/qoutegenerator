function roundSek(value) {
    return Math.round(Number(value) || 0);
}

function safeCustomerInfo(state) {
    return state?.customerInfo || {};
}

export function buildExportSummary(state = {}, summaryData = {}) {
    const finalTotalSek = Number(summaryData.finalTotalSek) || 0;
    const grossTotalSek = Number(summaryData.grossTotalSek) || 0;
    const totalDiscountSek = Number(summaryData.totalDiscountSek) || 0;
    const vatAmount = state.includesVat ? finalTotalSek * 0.25 : 0;
    const totalWithVat = finalTotalSek + vatAmount;

    return {
        finalTotalSek,
        grossTotalSek,
        totalDiscountSek,
        vatAmount,
        totalWithVat
    };
}

export function buildExcelSheetData(state = {}, summaryData = {}) {
    const customerInfo = safeCustomerInfo(state);
    const wsData = [
        ['Offert'],
        ['Kund', customerInfo.name || ''],
        ['Foretag', customerInfo.company || ''],
        ['Referens', customerInfo.reference || ''],
        ['Datum', customerInfo.date || new Date().toLocaleDateString()],
        ['Giltighetstid', customerInfo.validity || ''],
        [],
        ['Modell', 'Storlek', 'Pris/enhet (Exkl. moms)', 'Antal', 'Ert Pris', 'Rek Utpris', 'Rabatt i SEK', 'Rabatt i %']
    ];

    (summaryData.totals || []).forEach((row) => {
        wsData.push([
            row.model,
            row.size,
            roundSek(row.unitPrice),
            row.qty,
            roundSek(row.net),
            roundSek(row.gross),
            roundSek(-(row.discountSek || 0)),
            `${row.discountPct}%`
        ]);
    });

    if ((summaryData.globalDiscountAmt || 0) > 0) {
        wsData.push([
            `Overgripande Rabatt (${state.globalDiscountPct}%)`,
            '',
            '',
            '',
            '',
            '',
            roundSek(-(summaryData.globalDiscountAmt || 0)),
            ''
        ]);
    }

    const totals = buildExportSummary(state, summaryData);
    wsData.push([]);
    wsData.push([
        'Totalt Exkl. Moms',
        '',
        '',
        '',
        roundSek(totals.finalTotalSek),
        roundSek(totals.grossTotalSek),
        roundSek(-totals.totalDiscountSek),
        ''
    ]);

    if (state.includesVat) {
        wsData.push([
            'Moms 25%',
            '',
            '',
            '',
            roundSek(totals.vatAmount),
            '',
            '',
            ''
        ]);
        wsData.push([
            'TOTALT ATT BETALA (Ink. Moms)',
            '',
            '',
            '',
            roundSek(totals.totalWithVat),
            '',
            '',
            ''
        ]);
    }

    return wsData;
}

export function buildPdfTableData(state = {}, summaryData = {}, formatSEK = (v) => String(v)) {
    const tableData = [];

    (summaryData.totals || []).forEach((row) => {
        tableData.push([
            row.model,
            row.size || '-',
            `${formatSEK(row.unitPrice)} SEK`,
            `${row.qty}`,
            `${formatSEK(row.net)} SEK`,
            `${formatSEK(row.gross)} SEK`,
            `${formatSEK(row.discountSek)} SEK`,
            `${row.discountPct}%`
        ]);
    });

    if ((summaryData.globalDiscountAmt || 0) > 0) {
        tableData.push([
            `Overgripande Rabatt (${state.globalDiscountPct}%)`,
            '',
            '',
            '',
            `-${formatSEK(summaryData.globalDiscountAmt)} SEK`,
            '',
            '',
            '-'
        ]);
    }

    return tableData;
}
