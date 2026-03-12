import { notifyWarn } from '../services/notificationService.js';
import { buildExcelSheetData } from '../services/exportDataBuilders.js';

export function generateExcel(state, summaryData) {
    if (!window.XLSX) {
        notifyWarn("Excel-motorn laddar fortfarande, forsok igen om nagra sekunder.");
        return;
    }

    const wsData = buildExcelSheetData(state, summaryData);

    const ws = window.XLSX.utils.aoa_to_sheet(wsData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Offert");

    window.XLSX.writeFile(wb, "Offert.xlsx");
}
