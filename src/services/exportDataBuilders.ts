import type {
    ContractingWorkState,
    ContractingWorkSummary,
    CustomerInfo,
    PdfTableOptions,
    PdfTableRow,
    QuoteExportLanguage,
    QuoteTotalsResult,
    QuoteTotalsRow
} from '../types/contracts';
import type { PreparedQuote } from './quotePreparation';
import { applyVat } from '../utils/vatHelper';
import {
    formatLocalizedValidityPeriod,
    getExportLabels,
    translateQuoteTotalsRowModel
} from './exportLocalization';

type WorksheetCell = string | number;
type WorksheetRow = WorksheetCell[];
type ExportStateWithContracting = {
    customerInfo?: Partial<CustomerInfo>;
    exportLanguage?: QuoteExportLanguage;
    includesVat?: boolean;
    globalDiscountPct?: number;
    contractingWork?: ContractingWorkState;
    hideDiscountReferences?: boolean;
};

interface PreparedExcelValues {
    productTotals: {
        finalTotalSek: number;
        grossTotalSek: number;
        totalDiscountSek: number;
        vatAmount: number;
        totalWithVat: number;
    };
    contractingSummary: Pick<ContractingWorkSummary,
        | 'customerRows'
        | 'baseTotalSek'
        | 'allowanceSek'
        | 'lowerIndicativeSek'
        | 'upperIndicativeSek'
        | 'ataEnabled'
        | 'ataPercent'
    >;
}

function roundSek(value: number | string | null | undefined): number {
    return Math.round(Number(value) || 0);
}

function safeCustomerInfo(state: ExportStateWithContracting): Partial<CustomerInfo> {
    return state.customerInfo || {};
}

function buildExcelSheetDataInternal(
    state: ExportStateWithContracting,
    summaryData: Partial<QuoteTotalsResult>,
    preparedValues: PreparedExcelValues
): WorksheetRow[] {
    const customerInfo = safeCustomerInfo(state);
    const labels = getExportLabels(state.exportLanguage);
    const vatText = state.includesVat ? labels.inclVat : labels.exclVat;
    const discountSekLabel = labels.discountSek.replace(/\n/g, ' ');
    const discountPctLabel = labels.discountPct.replace(/\n/g, ' ');
    const productRows = Array.isArray(summaryData.totals) ? summaryData.totals : [];
    const hideDiscountReferences = state.hideDiscountReferences === true;
    const contractingSummary = preparedValues.contractingSummary;
    const totals = preparedValues.productTotals;
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
        const productHeaders: WorksheetRow = [
            labels.model,
            labels.size,
            `${labels.unitPrice} (${vatText})`,
            labels.quantity,
            state.includesVat ? `${labels.yourPrice} (${vatText})` : labels.yourPrice
        ];
        if (!hideDiscountReferences) {
            productHeaders.push(
                state.includesVat ? `${labels.recommendedPrice} (${vatText})` : labels.recommendedPrice,
                state.includesVat ? `${discountSekLabel} (${vatText})` : discountSekLabel,
                discountPctLabel
            );
        }
        wsData.push(productHeaders);

        productRows.forEach((row) => {
            const isReq = row.priceUponRequest === true;
            const productRow: WorksheetRow = [
                translateQuoteTotalsRowModel(row, state.exportLanguage),
                row.size || '',
                isReq ? labels.priceUponRequest : roundSek(applyVat(row.unitPrice, state.includesVat)),
                row.qty,
                isReq
                    ? labels.priceUponRequest
                    : roundSek(applyVat(hideDiscountReferences ? row.gross : row.net, state.includesVat))
            ];
            if (!hideDiscountReferences) {
                productRow.push(
                    isReq ? labels.priceUponRequest : roundSek(applyVat(row.gross, state.includesVat)),
                    isReq ? '-' : roundSek(-applyVat(row.discountSek || 0, state.includesVat)),
                    isReq ? '-' : `${row.discountPct}%`
                );
            }
            wsData.push(productRow);
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

        wsData.push([]);
        const totalsRow: WorksheetRow = [
            hasContractingWork && !state.includesVat
                ? labels.productTotalExVat
                : (state.includesVat ? labels.totalInclVatExcel : labels.totalExVatExcel),
            '',
            '',
            '',
            roundSek(state.includesVat ? totals.totalWithVat : totals.finalTotalSek)
        ];
        if (!hideDiscountReferences) {
            totalsRow.push(
                roundSek(applyVat(totals.grossTotalSek, state.includesVat)),
                roundSek(-applyVat(totals.totalDiscountSek, state.includesVat)),
                ''
            );
        }
        wsData.push(totalsRow);

        if (state.includesVat) {
            const vatRow: WorksheetRow = [
                labels.vat25Excel,
                '',
                '',
                '',
                roundSek(totals.vatAmount)
            ];
            const totalExVatRow: WorksheetRow = [
                hasContractingWork ? labels.productTotalExVat : labels.totalExVatExcel,
                '',
                '',
                '',
                roundSek(totals.finalTotalSek)
            ];
            if (!hideDiscountReferences) {
                vatRow.push('', '', '');
                totalExVatRow.push('', '', '');
            }
            wsData.push(vatRow);
            wsData.push(totalExVatRow);
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

export function buildPreparedExcelSheetData(prepared: PreparedQuote): WorksheetRow[] {
    const productTotals = prepared.commercial.productTotals;
    const contractingWork = prepared.commercial.contractingWork;

    const preparedContractingSummary = contractingWork
        ? {
            customerRows: contractingWork.rows,
            baseTotalSek: contractingWork.baseTotalSek,
            allowanceSek: contractingWork.allowanceSek,
            lowerIndicativeSek: contractingWork.lowerIndicativeSek,
            upperIndicativeSek: contractingWork.upperIndicativeSek,
            ataEnabled: contractingWork.ataEnabled,
            ataPercent: contractingWork.ataPercent
        }
        : {
            customerRows: [],
            baseTotalSek: 0,
            allowanceSek: 0,
            lowerIndicativeSek: 0,
            upperIndicativeSek: 0,
            ataEnabled: false,
            ataPercent: 0
        };

    const preparedRows = prepared.commercial.productRows.map((row, index) => ({
        ...row,
        source: { type: 'custom' as const, index }
    }));

    return buildExcelSheetDataInternal({
        customerInfo: {
            ...prepared.agreement.customerInfo,
            date: prepared.agreement.effectiveQuoteDate
        },
        exportLanguage: prepared.presentation.exportLanguage,
        includesVat: productTotals.includesVat,
        globalDiscountPct: productTotals.globalDiscountPct,
        hideDiscountReferences: prepared.visibility.discountReferences === 'hidden-zero',
        contractingWork: contractingWork
            ? {
                enabled: true,
                projectName: contractingWork.projectName,
                rows: contractingWork.rows,
                margin: { enabled: false, percent: 0 },
                ata: {
                    enabled: contractingWork.ataEnabled,
                    percent: contractingWork.ataPercent
                }
            }
            : undefined
    }, {
        totals: preparedRows,
        grossTotalSek: productTotals.grossTotalSek,
        totalDiscountSek: productTotals.totalDiscountSek,
        finalTotalSek: productTotals.finalTotalSek,
        globalDiscountAmt: productTotals.globalDiscountAmt
    }, {
        productTotals: {
            finalTotalSek: productTotals.finalTotalSek,
            grossTotalSek: productTotals.grossTotalSek,
            totalDiscountSek: productTotals.totalDiscountSek,
            vatAmount: productTotals.vatAmountSek,
            totalWithVat: productTotals.totalWithVatSek
        },
        contractingSummary: preparedContractingSummary
    });
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
