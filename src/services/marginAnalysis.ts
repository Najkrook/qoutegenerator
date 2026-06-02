import type {
    QuoteMarginAnalysis,
    QuoteMarginAnalysisRow,
    QuoteMarginReviewCode,
    QuoteMarginSettings,
    QuoteTotalsResult,
    QuoteTotalsRow,
    QuoteTotalsRowSource
} from '../types/contracts';
import { normalizeQuoteMarginsByLine, QUOTE_MARGIN_LINE_IDS } from './marginSettingsService';

const REVIEW_CODES: QuoteMarginReviewCode[] = [
    'price-upon-request',
    'missing-margin',
    'manual-pricing',
    'other-line',
    'non-positive-net',
    'negative-profit'
];

const configuredLineIds = new Set<string>(QUOTE_MARGIN_LINE_IDS);

function createEmptyReviewCounts(): Record<QuoteMarginReviewCode, number> {
    return REVIEW_CODES.reduce<Record<QuoteMarginReviewCode, number>>((acc, code) => {
        acc[code] = 0;
        return acc;
    }, {} as Record<QuoteMarginReviewCode, number>);
}

function addReviewCode(codes: QuoteMarginReviewCode[], code: QuoteMarginReviewCode): void {
    if (!codes.includes(code)) {
        codes.push(code);
    }
}

export function isManualMarginSource(source: QuoteTotalsRowSource): boolean {
    return source.type === 'builder-custom-addon'
        || source.type === 'grid-custom-addon'
        || source.type === 'grid-custom-item';
}

function getLineMarginPct(row: QuoteTotalsRow, settings: QuoteMarginSettings): number | null {
    const lineId = String(row.line || '').trim();
    if (!configuredLineIds.has(lineId)) {
        return null;
    }

    const marginsByLine = normalizeQuoteMarginsByLine(settings.marginsByLine);
    return marginsByLine[lineId as keyof typeof marginsByLine];
}

export function analyzeQuoteMargins(
    summaryData: QuoteTotalsResult,
    settings: QuoteMarginSettings
): QuoteMarginAnalysis {
    const reviewCounts = createEmptyReviewCounts();
    const rows: QuoteMarginAnalysisRow[] = [];
    let totalEstimatedCostSek = 0;
    let totalEstimatedGrossProfitSek = 0;
    let totalDiscountImpactSek = 0;
    let totalNetSek = 0;
    let includedRowCount = 0;

    for (const row of summaryData.totals || []) {
        const reviewCodes: QuoteMarginReviewCode[] = [];
        const lineId = String(row.line || '').trim();
        const marginPct = getLineMarginPct(row, settings);
        const isOtherLine = !configuredLineIds.has(lineId);
        const isRequestPrice = row.priceUponRequest === true;
        const isNonPositiveNet = Number(row.net) <= 0;

        if (isRequestPrice) {
            addReviewCode(reviewCodes, 'price-upon-request');
        }

        if (isOtherLine) {
            addReviewCode(reviewCodes, 'other-line');
        } else if (marginPct == null) {
            addReviewCode(reviewCodes, 'missing-margin');
        }

        if (isManualMarginSource(row.source)) {
            addReviewCode(reviewCodes, 'manual-pricing');
        }

        if (isNonPositiveNet && !isRequestPrice) {
            addReviewCode(reviewCodes, 'non-positive-net');
        }

        const includedInTotals = !isRequestPrice && !isOtherLine && marginPct != null && !isNonPositiveNet;
        const estimatedCostSek = includedInTotals
            ? Number(row.gross || 0) * (1 - (marginPct / 100))
            : 0;
        const estimatedGrossProfitSek = includedInTotals
            ? Number(row.net || 0) - estimatedCostSek
            : 0;
        const actualMarginPct = includedInTotals && Number(row.net || 0) > 0
            ? (estimatedGrossProfitSek / Number(row.net)) * 100
            : null;
        const discountImpactSek = includedInTotals ? Number(row.discountSek || 0) : 0;

        if (includedInTotals && estimatedGrossProfitSek < 0) {
            addReviewCode(reviewCodes, 'negative-profit');
        }

        reviewCodes.forEach((code) => {
            reviewCounts[code] += 1;
        });

        if (includedInTotals) {
            includedRowCount += 1;
            totalEstimatedCostSek += estimatedCostSek;
            totalEstimatedGrossProfitSek += estimatedGrossProfitSek;
            totalDiscountImpactSek += discountImpactSek;
            totalNetSek += Number(row.net || 0);
        }

        rows.push({
            row,
            lineId,
            marginPct,
            estimatedCostSek,
            estimatedGrossProfitSek,
            actualMarginPct,
            discountImpactSek,
            includedInTotals,
            reviewCodes
        });
    }

    return {
        rows,
        totalEstimatedCostSek,
        totalEstimatedGrossProfitSek,
        totalDiscountImpactSek,
        totalNetSek,
        actualMarginPct: totalNetSek > 0 ? (totalEstimatedGrossProfitSek / totalNetSek) * 100 : null,
        includedRowCount,
        reviewCounts,
        hasReviewItems: REVIEW_CODES.some((code) => reviewCounts[code] > 0)
    };
}

export function getQuoteMarginReviewLabel(code: QuoteMarginReviewCode): string {
    switch (code) {
        case 'price-upon-request':
            return 'Pris på förfrågan';
        case 'missing-margin':
            return 'Saknar marginal';
        case 'manual-pricing':
            return 'Manuell prissättning';
        case 'other-line':
            return 'Övrigt/okänd rad';
        case 'non-positive-net':
            return 'Noll/negativt nettopris';
        case 'negative-profit':
            return 'Negativ vinst';
        default:
            return String(code);
    }
}
