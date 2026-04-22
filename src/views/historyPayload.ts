import { normalizeQuoteStatus } from '../services/quoteRepository';
import type {
    CustomerInfoPatch,
    HistoryOpenQuotePayload,
    QuoteRevision,
    QuoteStatus,
    UnknownRecord
} from '../types/contracts';

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
}

function toCustomerInfoPatch(value: unknown): CustomerInfoPatch {
    return isRecord(value) ? { ...value } : {};
}

export function buildHistoryOpenQuotePayload(
    revisionState: QuoteRevision['state'],
    quoteId: string,
    quoteNumber: string | null | undefined,
    version: number,
    status: QuoteStatus | string | null | undefined
): HistoryOpenQuotePayload {
    const safeRevisionState = isRecord(revisionState) ? revisionState : {};

    return {
        ...safeRevisionState,
        customerInfo: toCustomerInfoPatch(safeRevisionState.customerInfo),
        activeQuoteId: quoteId,
        quoteNumber: quoteNumber ? String(quoteNumber) : null,
        activeQuoteVersion: Number(version) || 1,
        quoteStatus: normalizeQuoteStatus(status || 'draft')
    };
}
