import type {
    CustomerInfo,
    ExportSummaryInput,
    ExportSummaryResult,
    ExportSummaryState,
    PdfTableOptions,
    PdfTableRow,
    QuoteTotalsRow
} from '../types/contracts';
import { applyVat } from '../utils/vatHelper';

type WorksheetCell = string | number;
type WorksheetRow = WorksheetCell[];

function roundSek(value: number | string | null | undefined): number {
    return Math.round(Number(value) || 0);
}

function safeCustomerInfo(state: ExportSummaryState): Partial<CustomerInfo> {
    return state.customerInfo || {};
}

function isZeroNumber(value: number | string | null | undefined): boolean {
    return Number(value) === 0;
}

export function buildExportSummary(
    state: ExportSummaryState = {},
    summaryData: ExportSummaryInput = {}
): ExportSummaryResult {
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

export function hasZeroDiscountSummary(summaryData: ExportSummaryInput = {}): boolean {
    const totals = Array.isArray(summaryData?.totals) ? summaryData.totals : [];
    return isZeroNumber(summaryData?.totalDiscountSek) && totals.every((row) => (
        isZeroNumber(row?.discountPct) && isZeroNumber(row?.discountSek)
    ));
}

export function shouldHideDiscountReferencesInPdf(
    state: ExportSummaryState = {},
    summaryData: ExportSummaryInput = {}
): boolean {
    return state?.hideZeroDiscountReferencesInPdf === true && hasZeroDiscountSummary(summaryData);
}

export function buildExcelSheetData(
    state: ExportSummaryState = {},
    summaryData: ExportSummaryInput = {}
): WorksheetRow[] {
    const customerInfo = safeCustomerInfo(state);
    const wsData: WorksheetRow[] = [
        ['Offert'],
        ['Foretag', customerInfo.company || customerInfo.name || ''],
        ['Projektreferens', customerInfo.reference || ''],
        ['Er referens', customerInfo.customerReference || ''],
        ['Datum', customerInfo.date || new Date().toLocaleDateString()],
        ['Giltighetstid', customerInfo.validity || ''],
        [],
        [
            'Modell', 
            'Storlek', 
            state.includesVat ? 'Pris/enhet (Inkl. moms)' : 'Pris/enhet (Exkl. moms)', 
            'Antal', 
            state.includesVat ? 'Ert Pris (Inkl. moms)' : 'Ert Pris', 
            state.includesVat ? 'Rek Utpris (Inkl. moms)' : 'Rek Utpris', 
            state.includesVat ? 'Rabatt i SEK (Inkl. moms)' : 'Rabatt i SEK', 
            'Rabatt i %'
        ]
    ];

    (summaryData.totals || []).forEach((row) => {
        const isReq = row.priceUponRequest === true;
        wsData.push([
            row.model,
            row.size || '',
            isReq ? 'Pris på förfrågan' : roundSek(applyVat(row.unitPrice, state.includesVat)),
            row.qty,
            isReq ? 'Pris på förfrågan' : roundSek(applyVat(row.net, state.includesVat)),
            isReq ? 'Pris på förfrågan' : roundSek(applyVat(row.gross, state.includesVat)),
            isReq ? '-' : roundSek(-applyVat(row.discountSek || 0, state.includesVat)),
            isReq ? '-' : `${row.discountPct}%`
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
            roundSek(-applyVat(summaryData.globalDiscountAmt || 0, state.includesVat)),
            ''
        ]);
    }

    const totals = buildExportSummary(state, summaryData);
    wsData.push([]);
    wsData.push([
        state.includesVat ? 'Totalt Inkl. Moms' : 'Totalt Exkl. Moms',
        '',
        '',
        '',
        roundSek(applyVat(totals.finalTotalSek, state.includesVat)),
        roundSek(applyVat(totals.grossTotalSek, state.includesVat)),
        roundSek(-applyVat(totals.totalDiscountSek, state.includesVat)),
        ''
    ]);

    if (state.includesVat) {
        wsData.push([
            'Varav Moms (25%)',
            '',
            '',
            '',
            roundSek(totals.vatAmount),
            '',
            '',
            ''
        ]);
        wsData.push([
            'Totalt Exkl. Moms',
            '',
            '',
            '',
            roundSek(totals.finalTotalSek),
            '',
            '',
            ''
        ]);
    }

    const hasPriceUponRequest = (summaryData.totals || []).some((r) => r.priceUponRequest === true);
    if (hasPriceUponRequest) {
        wsData.push([]);
        wsData.push([
            '* Totalsumman exkluderar artiklar med pris på förfrågan'
        ]);
    }

    return wsData;
}

export function buildPdfTableData(
    totalsArray: QuoteTotalsRow[] = [],
    formatSEK: (value: number) => string = (value) => String(value),
    options: PdfTableOptions = {}
): PdfTableRow[] {
    const hideDiscountColumns = options.hideDiscountColumns === true;
    const hideRecommendedPriceColumn = options.hideRecommendedPriceColumn === true;
    const includesVat = options.includesVat === true;
    const tableData: PdfTableRow[] = [];

    totalsArray.forEach((row) => {
        const isReq = row.priceUponRequest === true;
        const cells: PdfTableRow = [
            row.model,
            row.size || '-',
            isReq ? 'Pris på förfrågan' : `${formatSEK(applyVat(row.unitPrice, includesVat))} SEK`,
            `${row.qty}`,
            isReq ? 'Pris på förfrågan' : `${formatSEK(applyVat(row.net, includesVat))} SEK`
        ];

        if (!hideRecommendedPriceColumn) {
            cells.push(isReq ? 'Pris på förfrågan' : `${formatSEK(applyVat(row.gross, includesVat))} SEK`);
        }

        if (!hideDiscountColumns) {
            cells.push(
                isReq ? '-' : `${formatSEK(applyVat(row.discountSek, includesVat))} SEK`,
                isReq ? '-' : `${row.discountPct}%`
            );
        }

        tableData.push(cells);
    });

    return tableData;
}
