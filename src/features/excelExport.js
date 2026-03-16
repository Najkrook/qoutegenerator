import * as XLSX from 'xlsx';
import { buildExcelSheetData } from '../services/exportDataBuilders.js';

export function generateExcel(state, summaryData) {
    const wsData = buildExcelSheetData(state, summaryData);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Offert");

    XLSX.writeFile(wb, "Offert.xlsx");
}
