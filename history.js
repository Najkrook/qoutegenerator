import {
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    writeBatch,
    runTransaction
} from './services/firebase.js';
import { currentUser, onAuthChange, logout, requireFullAccess, hasFullAccess } from './services/authService.js';
import { createQuoteRepository, normalizeQuoteStatus } from './services/quoteRepository.js';
import { escapeHtml } from './features/utils.js';
import { initNotifications, notifyError, notifyInfo, notifySuccess, confirmAction } from './services/notificationService.js';

const STATUS_LABELS = {
    draft: 'Utkast',
    sent: 'Skickad',
    won: 'Vunnen',
    lost: 'Forlorad',
    archived: 'Arkiverad'
};

const DOM = {
    historyContainer: document.getElementById('historyContainer'),
    historyStatusFilter: document.getElementById('historyStatusFilter'),
    historySearch: document.getElementById('historySearch'),
    historyMeta: document.getElementById('historyMeta')
};
const quoteLifecycleEnabled = typeof window === 'undefined'
    ? true
    : window.FEATURE_QUOTE_LIFECYCLE !== false;

const quoteRepository = createQuoteRepository({
    db,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    writeBatch,
    runTransaction
});

const viewState = {
    status: '',
    search: '',
    quotes: [],
    revisionCache: {}
};

let searchTimer = null;

function formatDateTime(ms) {
    const dateObj = new Date(Number(ms) || Date.now());
    return dateObj.toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatSek(value) {
    return Math.round(Number(value) || 0).toLocaleString('sv-SE');
}

function statusBadge(status) {
    const normalized = normalizeQuoteStatus(status);
    return `<span class="status-badge status-${normalized}">${escapeHtml(STATUS_LABELS[normalized])}</span>`;
}

function updateMetaText() {
    if (!DOM.historyMeta) return;
    const total = viewState.quotes.length;
    DOM.historyMeta.textContent = total === 0
        ? 'Inga offerter matchar filtret.'
        : `Visar ${total} offert${total === 1 ? '' : 'er'}.`;
}

function quoteActionSelect(status, quoteId) {
    if (!quoteLifecycleEnabled) return '';
    const normalized = normalizeQuoteStatus(status);
    return `
        <label class="status-inline">
            <span>Status</span>
            <select data-action="set-status" data-id="${escapeHtml(quoteId)}">
                ${Object.keys(STATUS_LABELS).map((key) => `
                    <option value="${escapeHtml(key)}" ${key === normalized ? 'selected' : ''}>
                        ${escapeHtml(STATUS_LABELS[key])}
                    </option>
                `).join('')}
            </select>
        </label>
    `;
}

function renderQuoteCards() {
    if (!DOM.historyContainer) return;

    if (viewState.quotes.length === 0) {
        DOM.historyContainer.innerHTML = `
            <div class="empty-state">
                <h3 style="margin-top: 0; margin-bottom: 0.5rem;">Inga sparade offerter</h3>
                <p>Skapa en ny offert i dashboarden och klicka pa "Spara Offert".</p>
            </div>
        `;
        updateMetaText();
        return;
    }

    DOM.historyContainer.innerHTML = viewState.quotes.map((quote) => {
        const status = normalizeQuoteStatus(quote.status);
        return `
            <article class="history-card" data-quote-id="${escapeHtml(quote.quoteId)}">
                <div class="history-details">
                    <div class="history-title-row">
                        <h3>${escapeHtml(quote.customerName || 'Okand kund')}</h3>
                        ${statusBadge(status)}
                    </div>
                    <p>
                        <strong>Foretag:</strong> ${escapeHtml(quote.company || '-')}
                        &nbsp;|&nbsp;
                        <strong>Referens:</strong> ${escapeHtml(quote.reference || '-')}
                    </p>
                    <p>
                        <strong>Uppdaterad:</strong> ${escapeHtml(formatDateTime(quote.updatedAtMs))}
                        &nbsp;|&nbsp;
                        <strong>Version:</strong> v${escapeHtml(quote.latestVersion)}
                    </p>
                    <div class="history-total">Totalt: ${escapeHtml(formatSek(quote.totalSek || 0))} SEK</div>
                </div>
                <div class="history-actions">
                    ${quoteActionSelect(status, quote.quoteId)}
                    <button class="primary btn-sm" data-action="open-latest" data-id="${escapeHtml(quote.quoteId)}">${quoteLifecycleEnabled ? 'Oppna senaste' : 'Oppna offert'}</button>
                    ${quoteLifecycleEnabled ? `<button class="btn-sm" data-action="toggle-revisions" data-id="${escapeHtml(quote.quoteId)}">Visa revisioner</button>` : ''}
                    <button class="btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(quote.quoteId)}">Ta bort</button>
                </div>
                <div class="history-revisions" data-revision-container="${escapeHtml(quote.quoteId)}" hidden></div>
            </article>
        `;
    }).join('');

    updateMetaText();
}

function renderRevisions(quoteId, revisions = []) {
    const container = DOM.historyContainer?.querySelector(`[data-revision-container="${quoteId}"]`);
    if (!container) return;

    if (!revisions.length) {
        container.innerHTML = '<p class="revisions-empty">Inga revisioner hittades.</p>';
        return;
    }

    container.innerHTML = `
        <div class="revisions-list">
            ${revisions.map((revision) => `
                <button class="revision-btn" data-action="open-revision" data-id="${escapeHtml(quoteId)}" data-revision-id="${escapeHtml(revision.revisionId)}">
                    <span>v${escapeHtml(revision.version)} - ${escapeHtml(formatDateTime(revision.savedAtMs))}</span>
                    <span>${escapeHtml(revision.changeNote || '')}</span>
                </button>
            `).join('')}
        </div>
    `;
}

async function loadQuotes() {
    const user = currentUser();
    if (!user) {
        if (DOM.historyContainer) {
            DOM.historyContainer.innerHTML = '<div class="loading-state">Vantar pa autentisering...</div>';
        }
        return;
    }

    if (DOM.historyContainer) {
        DOM.historyContainer.innerHTML = '<div class="loading-state">Laddar offerter...</div>';
    }

    try {
        viewState.quotes = await quoteRepository.getUserQuotes({
            userId: user.uid,
            status: viewState.status,
            search: viewState.search
        });
        viewState.revisionCache = {};
        renderQuoteCards();
    } catch (err) {
        console.error('Failed to load quotes:', err);
        notifyError('Kunde inte ladda offerter.');
        if (DOM.historyContainer) {
            DOM.historyContainer.innerHTML = `
                <div class="empty-state">
                    <h3 style="margin-top: 0; margin-bottom: 0.5rem;">Kunde inte ladda offerter</h3>
                    <p>${escapeHtml(err.message || 'Okant fel')}</p>
                </div>
            `;
        }
    }
}

async function openRevisionPayload(quoteId, revision) {
    if (!revision?.state) {
        notifyInfo('Revisionen saknar sparat tillstand.');
        return;
    }

    const metadata = viewState.quotes.find((q) => q.quoteId === quoteId);
    const nextState = {
        ...revision.state,
        customerInfo: {
            ...(revision.state?.customerInfo || {})
        },
        activeQuoteId: quoteId,
        activeQuoteVersion: Number(revision.version) || 1,
        quoteStatus: normalizeQuoteStatus(metadata?.status || 'draft')
    };

    localStorage.setItem('offertverktyg_state', JSON.stringify(nextState));
    window.location.href = 'index.html';
}

async function openLatestQuote(quoteId) {
    const user = currentUser();
    if (!user) return;

    try {
        const payload = await quoteRepository.getQuoteLatestRevision({
            userId: user.uid,
            quoteId
        });

        if (!payload?.revision) {
            notifyInfo('Offerten saknar sparad revision.');
            return;
        }
        await openRevisionPayload(quoteId, payload.revision);
    } catch (err) {
        console.error('Failed to open quote:', err);
        notifyError('Kunde inte öppna offerten: ' + err.message);
    }
}

async function openSpecificRevision(quoteId, revisionId) {
    const cached = viewState.revisionCache[quoteId] || [];
    const revision = cached.find((row) => row.revisionId === revisionId);
    if (!revision) {
        notifyInfo('Revisionen kunde inte hittas. Ladda om sidan.');
        return;
    }
    await openRevisionPayload(quoteId, revision);
}

async function toggleRevisions(quoteId) {
    if (!quoteLifecycleEnabled) return;
    const user = currentUser();
    if (!user || !DOM.historyContainer) return;

    const container = DOM.historyContainer.querySelector(`[data-revision-container="${quoteId}"]`);
    if (!container) return;

    if (!container.hidden) {
        container.hidden = true;
        return;
    }

    container.hidden = false;
    container.innerHTML = '<p class="revisions-empty">Laddar revisioner...</p>';

    try {
        const revisions = await quoteRepository.getQuoteRevisions({
            userId: user.uid,
            quoteId,
            limit: 5
        });
        viewState.revisionCache[quoteId] = revisions;
        renderRevisions(quoteId, revisions);
    } catch (err) {
        console.error('Failed to load revisions:', err);
        container.innerHTML = '<p class="revisions-empty">Kunde inte ladda revisioner.</p>';
    }
}

async function deleteQuote(quoteId) {
    const ok = await confirmAction({
        title: 'Ta bort offert',
        message: 'Är du säker på att du vill ta bort den här offerten och alla revisioner?',
        confirmText: 'Ta bort',
        cancelText: 'Avbryt',
        tone: 'danger'
    });
    if (!ok) return;

    const user = currentUser();
    if (!user) return;

    try {
        await quoteRepository.deleteQuote({ userId: user.uid, quoteId });
        notifySuccess('Offerten togs bort.');
        await loadQuotes();
    } catch (err) {
        console.error('Failed to delete quote:', err);
        notifyError('Kunde inte ta bort offerten: ' + err.message);
    }
}

async function setQuoteStatus(quoteId, nextStatus) {
    if (!quoteLifecycleEnabled) return;
    const user = currentUser();
    if (!user) return;

    try {
        const updated = await quoteRepository.updateQuoteStatus({
            userId: user.uid,
            quoteId,
            status: nextStatus
        });
        const index = viewState.quotes.findIndex((q) => q.quoteId === quoteId);
        if (index >= 0) {
            viewState.quotes[index] = updated;
            renderQuoteCards();
            const card = DOM.historyContainer?.querySelector(`[data-quote-id="${quoteId}"]`);
            if (card) {
                const revisions = viewState.revisionCache[quoteId];
                if (Array.isArray(revisions)) {
                    const container = card.querySelector(`[data-revision-container="${quoteId}"]`);
                    if (container && !container.hidden) {
                        renderRevisions(quoteId, revisions);
                    }
                }
            }
        }
        notifySuccess('Status uppdaterad.');
    } catch (err) {
        console.error('Failed to update quote status:', err);
        notifyError('Kunde inte uppdatera status.');
        await loadQuotes();
    }
}

async function handleHeaderAction(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const { action, id, revisionId } = actionEl.dataset;

    if (action === 'logout') {
        await logout();
        window.location.href = 'login.html';
        return;
    }
    if (action === 'open-latest') {
        await openLatestQuote(id);
        return;
    }
    if (action === 'toggle-revisions') {
        await toggleRevisions(id);
        return;
    }
    if (action === 'open-revision') {
        await openSpecificRevision(id, revisionId);
        return;
    }
    if (action === 'delete') {
        await deleteQuote(id);
    }
}

function bindFilters() {
    if (DOM.historyStatusFilter) {
        DOM.historyStatusFilter.addEventListener('change', () => {
            viewState.status = String(DOM.historyStatusFilter.value || '').trim().toLowerCase();
            loadQuotes();
        });
    }

    if (DOM.historySearch) {
        DOM.historySearch.addEventListener('input', () => {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchTimer = null;
                viewState.search = String(DOM.historySearch.value || '').trim().toLowerCase();
                loadQuotes();
            }, 220);
        });
    }

    document.body.addEventListener('change', (event) => {
        const target = event.target.closest('[data-action="set-status"]');
        if (!target) return;
        const quoteId = target.dataset.id;
        const nextStatus = target.value;
        setQuoteStatus(quoteId, nextStatus);
    });
}

onAuthChange((user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    if (!hasFullAccess(user)) {
        window.location.href = 'index.html';
        return;
    }

    loadQuotes();
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await requireFullAccess({ redirectTo: 'index.html' });
    } catch (err) {
        console.error('Full-access check failed:', err);
        window.location.href = 'login.html';
        return;
    }

    initNotifications();
    bindFilters();
    document.body.addEventListener('click', handleHeaderAction);
});
