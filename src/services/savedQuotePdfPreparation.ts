import type { QuoteMetadata, QuoteRevision } from '../types/contracts';
import { prepareQuote, restorePreparedQuote, type PreparedQuote, type QuotePreparationAudience } from './quotePreparation';
import { hydrateQuoteState } from '../store/quoteStateSchema';
import { catalogData } from '../data/catalog';
import { computeQuoteTotals } from './calculationEngine';

export function prepareSavedQuoteForPdf({
    revision,
    metadata,
    audience
}: {
    revision: QuoteRevision;
    metadata: Pick<QuoteMetadata, 'quoteId' | 'quoteNumber' | 'status' | 'originType'>;
    audience?: QuotePreparationAudience;
}): { preparedQuote: PreparedQuote; usesCurrentCatalog: boolean } {
    if (!revision.state || typeof revision.state !== 'object' || Array.isArray(revision.state)) {
        throw new Error('Revisionen saknar sparat tillstånd.');
    }
    const state = hydrateQuoteState({
        ...revision.state,
        activeQuoteId: metadata.quoteId,
        quoteNumber: metadata.quoteNumber,
        activeQuoteVersion: revision.version,
        quoteStatus: metadata.status
    });

    if (revision.commercialSnapshot) {
        return {
            preparedQuote: restorePreparedQuote({ state, commercialSnapshot: revision.commercialSnapshot, audience }),
            usesCurrentCatalog: false
        };
    }

    // Legacy revisions follow the same historical PDF policy as order requests.
    const legacyAudience = audience || {
        isRetailer: metadata.originType === 'retailer',
        allowedPdfThemes: state.pdfThemeId === 'brixx' ? [] : [state.pdfThemeId]
    };
    const savedAt = new Date(revision.savedAtMs);
    const fallbackDate = revision.savedAtMs > 0 && Number.isFinite(savedAt.getTime())
        ? savedAt.toISOString().slice(0, 10)
        : '1970-01-01';
    return {
        preparedQuote: prepareQuote({
            state,
            totals: computeQuoteTotals({ state, catalogData }),
            audience: legacyAudience,
            fallbackDate,
            catalogData
        }),
        usesCurrentCatalog: true
    };
}

