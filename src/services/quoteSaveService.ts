import type {
    CreateQuoteInput,
    QuoteState,
    SaveQuoteToRepositoryParams,
    SaveQuoteToRepositoryResult,
    SavedQuoteStatePatch,
    SavedQuoteLike
} from '../types/contracts';

export function buildSavedQuoteStatePatch(
    saved: SavedQuoteLike,
    state: Partial<QuoteState> = {}
): SavedQuoteStatePatch {
    const metadata = saved?.metadata || {};

    return {
        activeQuoteId: saved?.quoteId || state.activeQuoteId || null,
        quoteNumber: metadata.quoteNumber ?? state.quoteNumber ?? null,
        activeQuoteVersion: metadata.latestVersion || saved?.revision?.version || state.activeQuoteVersion || 1,
        quoteStatus: metadata.status || state.quoteStatus || 'draft'
    };
}

export async function saveQuoteToRepository({
    quoteRepository,
    user,
    retailer,
    state,
    summary,
    quoteOwnerUid
}: SaveQuoteToRepositoryParams): Promise<SaveQuoteToRepositoryResult> {
    if (!user?.uid) {
        throw new Error('Du måste vara inloggad för att spara offerter.');
    }

    const basePayload: Omit<CreateQuoteInput, 'quoteId'> = {
        user,
        ownerUid: quoteOwnerUid || undefined,
        state,
        summary,
        customerInfo: state.customerInfo || {},
        status: state.quoteStatus || 'draft',
        retailerName: retailer?.name || null,
        originType: retailer ? 'retailer' : 'internal'
    };

    const isNewQuote = !state.activeQuoteId;
    const saved = isNewQuote
        ? await quoteRepository.createQuote(basePayload)
        : await quoteRepository.saveQuoteRevision({
            ...basePayload,
            quoteId: state.activeQuoteId
        });

    return {
        saved,
        isNewQuote,
        statePatch: buildSavedQuoteStatePatch(saved, state)
    };
}
