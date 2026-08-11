import type { UnknownRecord } from '../types/contracts';

const PRIVATE_QUOTE_STATE_KEYS = new Set([
    'crmDealId',
    'crmSynchronizationIssue',
    'crmSyncIssue',
    'crmRouting',
    'crmRoutingMetadata',
    'quoteOwnerUid',
    'ownerUid',
    'ownerRouting',
    'ownerRoutingData',
    'saveIntentId',
    'internalMargin',
    'internalMargins',
    'marginAnalysis',
    'marginSettings',
    'marginsByLine',
    'costPrice',
    'grossProfit',
    'actualMargin',
    'marginPct',
    'estimatedCostSek',
    'estimatedGrossProfitSek',
    'actualMarginPct',
    'discountImpactSek',
    'reviewCode',
    'reviewCodes',
    'totalEstimatedCostSek',
    'totalEstimatedGrossProfitSek',
    'totalDiscountImpactSek',
    'totalNetSek',
    'reviewCounts',
    'hasReviewItems'
]);

function isRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function stripPrivateQuoteStateData(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(stripPrivateQuoteStateData);
    }
    if (!isRecord(value)) {
        return value;
    }

    return Object.entries(value).reduce<UnknownRecord>((result, [key, child]) => {
        if (!PRIVATE_QUOTE_STATE_KEYS.has(key)) {
            result[key] = stripPrivateQuoteStateData(child);
        }
        return result;
    }, {});
}
