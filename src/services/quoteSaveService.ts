import type {
    CreateQuoteInput,
    QuoteState,
    SaveQuoteToRepositoryParams,
    SaveQuoteToRepositoryResult,
    SavedQuoteLike
} from '../types/contracts';

export function buildSavedQuoteStatePatch(
    saved: SavedQuoteLike,
    state: Partial<QuoteState> = {}
): Partial<QuoteState> {
    const metadata = saved?.metadata || {};

    return {
        activeQuoteId: saved?.quoteId || state.activeQuoteId || null,
        activeQuoteVersion: metadata.latestVersion || saved?.revision?.version || state.activeQuoteVersion || 1,
        quoteStatus: metadata.status || state.quoteStatus || 'draft',
        scriveEnabled: typeof metadata.scriveEnabled === 'boolean' ? metadata.scriveEnabled : state.scriveEnabled,
        scriveStatus: metadata.scriveStatus || state.scriveStatus || 'not_sent',
        scriveDocumentId: metadata.scriveDocumentId ?? state.scriveDocumentId ?? null,
        scriveSignerName: metadata.scriveSignerName ?? state.scriveSignerName ?? '',
        scriveSignerEmail: metadata.scriveSignerEmail ?? state.scriveSignerEmail ?? '',
        scriveLastError: metadata.scriveLastError ?? state.scriveLastError ?? null,
        scriveSentAtMs: metadata.scriveSentAtMs ?? state.scriveSentAtMs ?? null,
        scriveLastEventAtMs: metadata.scriveLastEventAtMs ?? state.scriveLastEventAtMs ?? null,
        scriveCompletedAtMs: metadata.scriveCompletedAtMs ?? state.scriveCompletedAtMs ?? null
    };
}

export async function saveQuoteToRepository({
    quoteRepository,
    user,
    retailer,
    state,
    summary
}: SaveQuoteToRepositoryParams): Promise<SaveQuoteToRepositoryResult> {
    if (!user?.uid) {
        throw new Error('Du mÃ¥ste vara inloggad fÃ¶r att spara offerter.');
    }

    const basePayload: Omit<CreateQuoteInput, 'quoteId'> = {
        user,
        state,
        summary,
        customerInfo: state.customerInfo || {},
        status: state.quoteStatus || 'draft',
        retailerName: retailer?.name || null
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
