import type {
    CustomerInfo,
    ExportSummaryInput,
    ExportSummaryResult,
    ExportSummaryState,
    PdfTableOptions,
    PdfTableRow,
    QuoteState,
    QuoteTotalsRow
} from '../types/contracts';
import { applyVat } from '../utils/vatHelper';
import { calculateContractingWorkSummary } from './contractingWork';
import {
    formatLocalizedValidityPeriod,
    getExportLabels,
    translateQuoteTotalsRowModel
} from './exportLocalization';

type WorksheetCell = string | number;
type WorksheetRow = WorksheetCell[];
type ExportStateWithContracting = ExportSummaryState & Partial<Pick<QuoteState, 'contractingWork'>>;

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
    state: ExportStateWithContracting = {},
    summaryData: ExportSummaryInput = {}
): WorksheetRow[] {
    const customerInfo = safeCustomerInfo(state);
    const labels = getExportLabels(state.exportLanguage);
    const vatText = state.includesVat ? labels.inclVat : labels.exclVat;
    const discountSekLabel = labels.discountSek.replace(/\n/g, ' ');
    const discountPctLabel = labels.discountPct.replace(/\n/g, ' ');
    const productRows = Array.isArray(summaryData.totals) ? summaryData.totals : [];
    const contractingSummary = calculateContractingWorkSummary(state.contractingWork);
    const hasContractingWork = contractingSummary.customerRows.length > 0;
    const shouldRenderProductSection = productRows.length > 0 || !hasContractingWork;
    const wsData: WorksheetRow[] = [
        [labels.quote],
        [labels.company, customerInfo.company || customerInfo.name || ''],
        [labels.projectReference, customerInfo.reference || ''],
        [labels.customerReference, customerInfo.customerReference || ''],
        [labels.date, customerInfo.date || new Date().toLocaleDateString()],
        [labels.validityPeriod, formatLocalizedValidityPeriod(customerInfo.validity, state.exportLanguage)]
    ];

    if (shouldRenderProductSection) {
        wsData.push([]);
        if (hasContractingWork) {
            wsData.push([labels.productsHeading]);
        }
        wsData.push([
            labels.model,
            labels.size,
            `${labels.unitPrice} (${vatText})`,
            labels.quantity,
            state.includesVat ? `${labels.yourPrice} (${vatText})` : labels.yourPrice,
            state.includesVat ? `${labels.recommendedPrice} (${vatText})` : labels.recommendedPrice,
            state.includesVat ? `${discountSekLabel} (${vatText})` : discountSekLabel,
            discountPctLabel
        ]);

        productRows.forEach((row) => {
            const isReq = row.priceUponRequest === true;
            wsData.push([
                translateQuoteTotalsRowModel(row, state.exportLanguage),
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
            hasContractingWork && !state.includesVat
                ? labels.productTotalExVat
                : (state.includesVat ? labels.totalInclVatExcel : labels.totalExVatExcel),
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
                hasContractingWork ? labels.productTotalExVat : labels.totalExVatExcel,
                '',
                '',
                '',
                roundSek(totals.finalTotalSek),
                '',
                '',
                ''
            ]);
        }

        const hasPriceUponRequest = productRows.some((row) => row.priceUponRequest === true);
        if (hasPriceUponRequest) {
            wsData.push([]);
            wsData.push([labels.totalsExcludePriceUponRequest]);
        }
    }

    if (hasContractingWork) {
        const projectName = String(state.contractingWork?.projectName || '');
        const contractingTitle = projectName.trim()
            ? `${labels.contractingHeading} ${labels.contractingFor} ${projectName}`
            : labels.contractingHeading;

        wsData.push([]);
        wsData.push([
            contractingTitle
        ]);
        wsData.push([
            labels.contractingWorkPackage,
            labels.contractingScope,
            labels.contractingUnit,
            labels.contractingPriceExVat.replace(/\n/g, ' ')
        ]);
        contractingSummary.customerRows.forEach((row) => {
            wsData.push([
                row.workPackage,
                row.scope,
                row.unit,
                roundSek(row.priceExVatSek)
            ]);
        });
        wsData.push([]);
        wsData.push([
            labels.contractingBaseValue,
            '',
            '',
            roundSek(contractingSummary.baseTotalSek)
        ]);

        if (contractingSummary.ataEnabled) {
            wsData.push([
                `${labels.contractingAtaAllowance} (±${contractingSummary.ataPercent}%)`,
                '',
                '',
                roundSek(contractingSummary.allowanceSek)
            ]);
            wsData.push([
                `${labels.contractingLowerIndicative} (-${contractingSummary.ataPercent}%)`,
                '',
                '',
                roundSek(contractingSummary.lowerIndicativeSek)
            ]);
            wsData.push([
                `${labels.contractingUpperIndicative} (+${contractingSummary.ataPercent}%)`,
                '',
                '',
                roundSek(contractingSummary.upperIndicativeSek)
            ]);
        }
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
            translateQuoteTotalsRowModel(row, options.exportLanguage),
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
