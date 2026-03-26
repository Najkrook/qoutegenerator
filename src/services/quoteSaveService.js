export function buildSavedQuoteStatePatch(saved, state = {}) {
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

export async function saveQuoteToRepository({ quoteRepository, user, retailer, state, summary }) {
    if (!user?.uid) {
        throw new Error('Du måste vara inloggad för att spara offerter.');
    }

    const basePayload = {
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
