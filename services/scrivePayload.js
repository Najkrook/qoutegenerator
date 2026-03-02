export function isValidEmail(value) {
    const text = String(value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export function buildSendPayload({
    quoteId,
    revisionVersion,
    signerName,
    signerEmail,
    quoteTitle,
    fileName,
    pdfBase64
}) {
    if (!quoteId) throw new Error('quoteId saknas.');
    if (!pdfBase64) throw new Error('PDF-data saknas.');
    if (!isValidEmail(signerEmail)) throw new Error('Ogiltig e-postadress for signerare.');

    return {
        quoteId: String(quoteId),
        revisionVersion: Number.isFinite(Number(revisionVersion)) ? Number(revisionVersion) : 1,
        signerName: String(signerName || '').trim(),
        signerEmail: String(signerEmail || '').trim(),
        quoteTitle: String(quoteTitle || '').trim() || 'Offert',
        fileName: String(fileName || '').trim() || 'offert.pdf',
        pdfBase64: String(pdfBase64)
    };
}
