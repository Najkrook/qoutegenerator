import { db, collection, query, orderBy, limit, startAfter, getDocs } from './services/firebase.js';
import { requireAuth, onAuthChange, logout } from './services/authService.js';
import { initNotifications, notifyError } from './services/notificationService.js';

const PAGE_SIZE = 50;
const QUERY_BATCH_SIZE = 100;
const MAX_QUERY_ROUNDS = 12;

const DOM = {
    badge: document.getElementById('userBadge'),
    badgeEmail: document.querySelector('#userBadge .user-email'),
    logsMeta: document.getElementById('logsMeta'),
    tableBody: document.getElementById('logsTableBody'),
    pageIndicator: document.getElementById('pageIndicator'),
    btnPrev: document.getElementById('btnPrevPage'),
    btnNext: document.getElementById('btnNextPage'),
    btnReset: document.getElementById('btnResetFilters'),
    filterFromDate: document.getElementById('filterFromDate'),
    filterToDate: document.getElementById('filterToDate'),
    filterCategory: document.getElementById('filterCategory'),
    filterAction: document.getElementById('filterAction'),
    filterActor: document.getElementById('filterActor'),
    filterSearch: document.getElementById('filterSearch')
};

const pageState = {
    loading: false,
    pageIndex: 0,
    pageStarts: [null],
    hasNext: false,
    rows: []
};

let filterDebounceTimer = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toEpochMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value && typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    return 0;
}

function categoryLabel(category) {
    if (category === 'bahama') return 'BaHaMa';
    if (category === 'clickitup') return 'ClickitUP';
    return '-';
}

function normalizeLog(docSnap) {
    const raw = docSnap.data() || {};
    const timestampMs = toEpochMs(raw.timestamp);
    const createdAtMs = toEpochMs(raw.createdAt);
    const resolvedMs = createdAtMs || timestampMs || 0;
    const system = String(raw.system || '').toLowerCase();
    const category = String(raw.category || (system.includes('clickitup') ? 'clickitup' : 'bahama')).toLowerCase();
    const targetId = raw.targetId || raw.element || '-';

    return {
        id: docSnap.id,
        timestampMs,
        createdAtMs,
        resolvedMs,
        category,
        action: String(raw.action || '-'),
        targetId: String(targetId),
        delta: typeof raw.delta === 'number' ? raw.delta : null,
        user: String(raw.user || '-'),
        userUid: String(raw.userUid || '-'),
        details: String(raw.details || '-')
    };
}

function getDateStartMs(dateValue) {
    if (!dateValue) return null;
    const ms = Date.parse(`${dateValue}T00:00:00`);
    return Number.isFinite(ms) ? ms : null;
}

function getDateEndMs(dateValue) {
    if (!dateValue) return null;
    const ms = Date.parse(`${dateValue}T23:59:59.999`);
    return Number.isFinite(ms) ? ms : null;
}

function getActiveFilters() {
    return {
        fromMs: getDateStartMs(DOM.filterFromDate?.value || ''),
        toMs: getDateEndMs(DOM.filterToDate?.value || ''),
        category: String(DOM.filterCategory?.value || '').trim().toLowerCase(),
        action: String(DOM.filterAction?.value || '').trim(),
        actor: String(DOM.filterActor?.value || '').trim().toLowerCase(),
        search: String(DOM.filterSearch?.value || '').trim().toLowerCase()
    };
}

function matchesFilters(log, filters) {
    if (filters.fromMs && log.resolvedMs < filters.fromMs) return false;
    if (filters.toMs && log.resolvedMs > filters.toMs) return false;
    if (filters.category && log.category !== filters.category) return false;
    if (filters.action && log.action !== filters.action) return false;

    if (filters.actor) {
        const actorHaystack = `${log.user} ${log.userUid}`.toLowerCase();
        if (!actorHaystack.includes(filters.actor)) return false;
    }

    if (filters.search) {
        const searchHaystack = `${log.targetId} ${log.details}`.toLowerCase();
        if (!searchHaystack.includes(filters.search)) return false;
    }

    return true;
}

function renderTableRows(rows) {
    if (!DOM.tableBody) return;

    if (!rows.length) {
        DOM.tableBody.innerHTML = '<tr><td colspan="8" class="logs-empty">Inga loggar matchar filtret.</td></tr>';
        return;
    }

    DOM.tableBody.innerHTML = rows.map((row) => {
        const date = new Date(row.resolvedMs || Date.now());
        const dateStr = date.toLocaleString('sv-SE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const delta =
            typeof row.delta === 'number'
                ? `${row.delta > 0 ? '+' : ''}${row.delta}`
                : '-';

        return `
            <tr>
                <td>${escapeHtml(dateStr)}</td>
                <td>${escapeHtml(categoryLabel(row.category))}</td>
                <td>${escapeHtml(row.action)}</td>
                <td>${escapeHtml(row.targetId)}</td>
                <td>${escapeHtml(delta)}</td>
                <td>${escapeHtml(row.user)}</td>
                <td>${escapeHtml(row.userUid)}</td>
                <td class="details-cell">${escapeHtml(row.details)}</td>
            </tr>
        `;
    }).join('');
}

function updatePaginationUi() {
    if (DOM.pageIndicator) DOM.pageIndicator.textContent = `Sida ${pageState.pageIndex + 1}`;
    if (DOM.btnPrev) DOM.btnPrev.disabled = pageState.loading || pageState.pageIndex === 0;
    if (DOM.btnNext) DOM.btnNext.disabled = pageState.loading || !pageState.hasNext;
}

function updateMetaText() {
    if (!DOM.logsMeta) return;
    if (pageState.loading) {
        DOM.logsMeta.textContent = 'Laddar loggar...';
        return;
    }

    DOM.logsMeta.textContent = `Visar ${pageState.rows.length} poster (sida ${pageState.pageIndex + 1}, ${PAGE_SIZE} per sida).`;
}

async function fetchLogsBatch(startCursor) {
    const logsRef = collection(db, 'inventory_logs');
    const constraints = [orderBy('timestamp', 'desc'), limit(QUERY_BATCH_SIZE)];
    if (startCursor) constraints.splice(1, 0, startAfter(startCursor));
    const q = query(logsRef, ...constraints);
    return getDocs(q);
}

async function loadPage(targetPageIndex) {
    if (pageState.loading) return;
    pageState.loading = true;
    pageState.rows = [];
    updateMetaText();
    updatePaginationUi();
    renderTableRows([]);

    const filters = getActiveFilters();
    const startCursor = pageState.pageStarts[targetPageIndex] || null;
    let scanCursor = startCursor;
    let lastIncludedCursor = startCursor;
    let exhausted = false;
    let foundExtra = false;
    const rows = [];

    try {
        for (let round = 0; round < MAX_QUERY_ROUNDS; round += 1) {
            const snapshot = await fetchLogsBatch(scanCursor);
            if (snapshot.empty) {
                exhausted = true;
                break;
            }

            for (const docSnap of snapshot.docs) {
                scanCursor = docSnap;
                const logRow = normalizeLog(docSnap);
                if (!matchesFilters(logRow, filters)) continue;

                if (rows.length < PAGE_SIZE) {
                    rows.push(logRow);
                    lastIncludedCursor = docSnap;
                    continue;
                }

                foundExtra = true;
                break;
            }

            if (foundExtra) break;
            if (snapshot.docs.length < QUERY_BATCH_SIZE) {
                exhausted = true;
                break;
            }
        }
    } catch (err) {
        console.error('Failed to load inventory logs:', err);
        notifyError('Kunde inte ladda lagerloggar.');
        exhausted = true;
    }

    pageState.loading = false;
    pageState.pageIndex = targetPageIndex;
    pageState.rows = rows;
    pageState.hasNext = foundExtra;
    pageState.pageStarts[targetPageIndex + 1] = foundExtra ? lastIncludedCursor : null;

    renderTableRows(pageState.rows);
    updateMetaText();
    updatePaginationUi();

    if (!rows.length && !foundExtra && targetPageIndex > 0) {
        pageState.pageIndex = Math.max(0, targetPageIndex - 1);
        pageState.hasNext = false;
        updateMetaText();
        updatePaginationUi();
    }
}

function resetPaginationAndReload() {
    pageState.pageIndex = 0;
    pageState.pageStarts = [null];
    pageState.hasNext = false;
    loadPage(0);
}

function scheduleFilterReload() {
    if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer);
        filterDebounceTimer = null;
    }
    filterDebounceTimer = setTimeout(() => {
        filterDebounceTimer = null;
        resetPaginationAndReload();
    }, 220);
}

function resetFilters() {
    if (DOM.filterFromDate) DOM.filterFromDate.value = '';
    if (DOM.filterToDate) DOM.filterToDate.value = '';
    if (DOM.filterCategory) DOM.filterCategory.value = '';
    if (DOM.filterAction) DOM.filterAction.value = '';
    if (DOM.filterActor) DOM.filterActor.value = '';
    if (DOM.filterSearch) DOM.filterSearch.value = '';
    resetPaginationAndReload();
}

function bindEvents() {
    document.body.addEventListener('click', async (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;
        if (actionEl.dataset.action !== 'logout') return;
        await logout();
        window.location.href = 'login.html';
    });

    if (DOM.btnPrev) {
        DOM.btnPrev.addEventListener('click', () => {
            if (pageState.pageIndex === 0) return;
            loadPage(pageState.pageIndex - 1);
        });
    }

    if (DOM.btnNext) {
        DOM.btnNext.addEventListener('click', () => {
            if (!pageState.hasNext) return;
            loadPage(pageState.pageIndex + 1);
        });
    }

    if (DOM.btnReset) {
        DOM.btnReset.addEventListener('click', resetFilters);
    }

    const immediateReloadInputs = [DOM.filterFromDate, DOM.filterToDate, DOM.filterCategory, DOM.filterAction];
    immediateReloadInputs.forEach((input) => {
        if (!input) return;
        input.addEventListener('change', resetPaginationAndReload);
    });

    const debouncedReloadInputs = [DOM.filterActor, DOM.filterSearch];
    debouncedReloadInputs.forEach((input) => {
        if (!input) return;
        input.addEventListener('input', scheduleFilterReload);
    });
}

function bindAuthUi() {
    onAuthChange((user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        if (DOM.badge && DOM.badgeEmail) {
            DOM.badgeEmail.textContent = user.email || '';
            DOM.badge.style.display = 'flex';
        }
    });
}

async function init() {
    initNotifications();
    bindEvents();
    bindAuthUi();

    try {
        await requireAuth();
    } catch (err) {
        console.error('Auth check failed:', err);
        window.location.href = 'login.html';
        return;
    }

    resetPaginationAndReload();
}

document.addEventListener('DOMContentLoaded', init);
