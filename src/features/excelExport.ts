import * as XLSX from 'xlsx';
import { buildExcelSheetData } from '../services/exportDataBuilders';
import { getExportLabels } from '../services/exportLocalization';

export function generateExcel(state, summaryData) {
    const wsData = buildExcelSheetData(state, summaryData);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
        { wch: 38 },
        { wch: 88 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
        { wch: 24 },
        { wch: 22 },
        { wch: 18 }
    ];

    const sheetRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    ws['!rows'] = wsData.map((row) => {
        const longestCell = row.reduce<number>(
            (maxLength, value) => Math.max(maxLength, String(value ?? '').length),
            0
        );
        return longestCell > 80
            ? { hpt: Math.min(120, 15 * Math.ceil(longestCell / 70)) }
            : { hpt: 18 };
    });

    for (let rowIndex = sheetRange.s.r; rowIndex <= sheetRange.e.r; rowIndex += 1) {
        for (let columnIndex = sheetRange.s.c; columnIndex <= sheetRange.e.c; columnIndex += 1) {
            const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
            const cell = ws[address];
            if (!cell) continue;
            cell.s = {
                ...(cell.s || {}),
                alignment: {
                    ...(cell.s?.alignment || {}),
                    vertical: 'top',
                    wrapText: true
                }
            };
        }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, getExportLabels(state?.exportLanguage).sheetName);

    XLSX.writeFile(
        wb,
        state?.exportLanguage === 'en' ? 'Quote.xlsx' : 'Offert.xlsx',
        { cellStyles: true }
    );
}
