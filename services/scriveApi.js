import { currentUser } from './authService.js';
import { buildSendPayload, isValidEmail } from './scrivePayload.js';
export { buildSendPayload, isValidEmail };

function stripTrailingSlash(value) {
    return String(value || '').replace(/\/+$/, '');
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = String(reader.result || '');
            const base64 = result.split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Kunde inte lasa PDF-data.'));
        reader.readAsDataURL(blob);
    });
}

export function resolveScriveApiBaseUrl() {
    if (typeof window === 'undefined') return '';
    return stripTrailingSlash(window.SCRIVE_PROXY_BASE_URL || '');
}

async function authorizedPost(path, payload) {
    const user = currentUser();
    if (!user) throw new Error('Du maste vara inloggad for Scrive-anslutning.');

    const idToken = await user.getIdToken();
    const base = resolveScriveApiBaseUrl();
    const url = `${base}${path}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
    });

    let json = null;
    try {
        json = await response.json();
    } catch (err) {
        json = null;
    }

    if (!response.ok) {
        const message = json?.error || json?.message || `Request failed (${response.status})`;
        throw new Error(message);
    }

    return json || {};
}

export async function sendQuoteToScrive({
    quoteId,
    revisionVersion,
    pdfBlob,
    signerName,
    signerEmail,
    quoteTitle,
    fileName
}) {
    if (!(pdfBlob instanceof Blob)) {
        throw new Error('PDF-dokument saknas.');
    }

    const pdfBase64 = await blobToBase64(pdfBlob);
    const payload = buildSendPayload({
        quoteId,
        revisionVersion,
        signerName,
        signerEmail,
        quoteTitle,
        fileName,
        pdfBase64
    });

    return authorizedPost('/api/scrive/send', payload);
}

export async function refreshScriveStatus({ quoteId }) {
    if (!quoteId) throw new Error('quoteId saknas.');
    return authorizedPost('/api/scrive/sync', { quoteId: String(quoteId) });
}
