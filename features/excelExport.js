import { notifyWarn } from '../services/notificationService.js';
export function generateExcel(state, summaryData) {
    if (!window.XLSX) {
        notifyWarn("Excel-motorn laddar fortfarande, forsok igen om nagra sekunder.");
        return;
    }

    const ws_data = [
        ["Offert"],
        ["Kund", state.customerInfo.name],
        ["Företag", state.customerInfo.company],
        ["Referens", state.customerInfo.reference],
        ["Datum", state.customerInfo.date || new Date().toLocaleDateString()],
        ["Giltighetstid", state.customerInfo.validity],
        [],
        ["Modell", "Storlek", "Pris/enhet (Exkl. moms)", "Antal", "Ert Pris", "Rek Utpris", "Rabatt i SEK", "Rabatt i %"]
    ];

    summaryData.totals.forEach(t => {
        ws_data.push([
            t.model,
            t.size,
            Number((t.unitPrice || 0).toFixed(0)),
            t.qty,
            Number((t.net || 0).toFixed(0)),
            Number((t.gross || 0).toFixed(0)),
            Number((-(t.discountSek || 0)).toFixed(0)),
            `${t.discountPct}%`
        ]);
    });

    if (summaryData.globalDiscountAmt > 0) {
        ws_data.push([
            `Övergripande Rabatt (${state.globalDiscountPct}%)`,
            "", "", "", "", "",
            Number((-(summaryData.globalDiscountAmt || 0)).toFixed(0)),
            ""
        ]);
    }

    ws_data.push([]);
    ws_data.push([
        "Totalt Exkl. Moms",
        "", "", "",
        Number((summaryData.finalTotalSek || 0).toFixed(0)),
        Number((summaryData.grossTotalSek || 0).toFixed(0)),
        Number((-(summaryData.totalDiscountSek || 0)).toFixed(0)),
        ""
    ]);

    if (state.includesVat) {
        const vatAmount = summaryData.finalTotalSek * 0.25;
        const totalWithVat = summaryData.finalTotalSek + vatAmount;
        ws_data.push([
            "Moms 25%",
            "", "", "",
            Number((vatAmount || 0).toFixed(0)),
            "", "", ""
        ]);
        ws_data.push([
            "TOTALT ATT BETALA (Ink. Moms)",
            "", "", "",
            Number((totalWithVat || 0).toFixed(0)),
            "", "", ""
        ]);
    }

    const ws = window.XLSX.utils.aoa_to_sheet(ws_data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Offert");

    window.XLSX.writeFile(wb, "Offert.xlsx");
}


