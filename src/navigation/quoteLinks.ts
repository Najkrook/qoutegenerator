import { APP_PATHS, APP_ROUTE_IDS } from './routes';

export interface QuoteRevisionLinkParams {
    quoteId: string;
    version: number;
    ownerUid?: string | null;
}

export interface ParsedQuoteRevisionLinkParams {
    quoteId: string;
    version: number;
    ownerUid: string | null;
}

function normalizeVersion(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function buildQuoteRevisionLink({ quoteId, version, ownerUid }: QuoteRevisionLinkParams): string {
    const params = new URLSearchParams();
    params.set('openQuote', String(quoteId || ''));
    params.set('version', String(normalizeVersion(version)));

    const normalizedOwner = String(ownerUid || '').trim();
    if (normalizedOwner) {
        params.set('owner', normalizedOwner);
    }

    return `${APP_PATHS[APP_ROUTE_IDS.quotes]}?${params.toString()}`;
}

export function parseQuoteRevisionLinkParams(searchParams: URLSearchParams): ParsedQuoteRevisionLinkParams | null {
    const quoteId = String(searchParams.get('openQuote') || '').trim();
    if (!quoteId) {
        return null;
    }

    const ownerUid = String(searchParams.get('owner') || '').trim() || null;

    return {
        quoteId,
        version: normalizeVersion(searchParams.get('version')),
        ownerUid
    };
}
