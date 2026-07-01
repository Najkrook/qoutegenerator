import * as XLSX from 'xlsx';
import { buildExcelSheetData } from '../services/exportDataBuilders';
import { getExportLabels } from '../services/exportLocalization';

export function generateExcel(state, summaryData) {
    const wsData = buildExcelSheetData(state, summaryData);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, getExportLabels(state?.exportLanguage).sheetName);

    XLSX.writeFile(wb, state?.exportLanguage === 'en' ? 'Quote.xlsx' : 'Offert.xlsx');
}
