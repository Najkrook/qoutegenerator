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
import { getExportLabels, translateSystemLabel } from './exportLocalization';

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
    const labels = getExportLabels(state.exportLanguage);
    const vatText = state.includesVat ? labels.inclVat : labels.exclVat;
    const discountSekLabel = labels.discountSek.replace(/\n/g, ' ');
    const discountPctLabel = labels.discountPct.replace(/\n/g, ' ');
    const wsData: WorksheetRow[] = [
        [labels.quote],
        [labels.company, customerInfo.company || customerInfo.name || ''],
        [labels.projectReference, customerInfo.reference || ''],
        [labels.customerReference, customerInfo.customerReference || ''],
        [labels.date, customerInfo.date || new Date().toLocaleDateString()],
        [labels.validityPeriod, customerInfo.validity || ''],
        [],
        [
            labels.model,
            labels.size,
            `${labels.unitPrice} (${vatText})`,
            labels.quantity,
            state.includesVat ? `${labels.yourPrice} (${vatText})` : labels.yourPrice,
            state.includesVat ? `${labels.recommendedPrice} (${vatText})` : labels.recommendedPrice,
            state.includesVat ? `${discountSekLabel} (${vatText})` : discountSekLabel,
            discountPctLabel
        ]
    ];

    (summaryData.totals || []).forEach((row) => {
        const isReq = row.priceUponRequest === true;
        wsData.push([
            translateSystemLabel(row.model, state.exportLanguage),
            row.size || '',
            isReq ? labels.priceUponRequest : roundSek(applyVat(row.unitPrice, state.includesVat)),
            row.qty,
            isReq ? labels.priceUponRequest : roundSek(applyVat(row.net, state.includesVat)),
            isReq ? labels.priceUponRequest : roundSek(applyVat(row.gross, state.includesVat)),
            isReq ? '-' : roundSek(-applyVat(row.discountSek || 0, state.includesVat)),
            isReq ? '-' : `${row.discountPct}%`
        ]);
    });

    if ((summaryData.globalDiscountAmt || 0) > 0) {
        wsData.push([
            `${labels.globalDiscount} (${state.globalDiscountPct}%)`,
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
        state.includesVat ? labels.totalInclVatExcel : labels.totalExVatExcel,
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
            labels.vat25Excel,
            '',
            '',
            '',
            roundSek(totals.vatAmount),
            '',
            '',
            ''
        ]);
        wsData.push([
            labels.totalExVatExcel,
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
            labels.totalsExcludePriceUponRequest
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
    const labels = getExportLabels(options.exportLanguage);
    const tableData: PdfTableRow[] = [];

    totalsArray.forEach((row) => {
        const isReq = row.priceUponRequest === true;
        const cells: PdfTableRow = [
            translateSystemLabel(row.model, options.exportLanguage),
            row.size || '-',
            isReq ? labels.priceUponRequest : `${formatSEK(applyVat(row.unitPrice, includesVat))} SEK`,
            `${row.qty}`,
            isReq ? labels.priceUponRequest : `${formatSEK(applyVat(hideDiscountColumns ? row.gross : row.net, includesVat))} SEK`
        ];

        if (!hideRecommendedPriceColumn) {
            cells.push(isReq ? labels.priceUponRequest : `${formatSEK(applyVat(row.gross, includesVat))} SEK`);
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
