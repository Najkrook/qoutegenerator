import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../store/AuthContext';
import { db, collection, getDocs, limit, orderBy, query, startAfter } from '../services/firebase';
import {
    ACTIVITY_EVENT_DEFINITIONS,
    formatActivityMetadata,
    getActivityEventDefinition,
    getActivitySystemLabel,
    normalizeActivityLog
} from '../services/activityLogService';
import { notifyError } from '../services/notificationService';

const PAGE_SIZE = 50;
const QUERY_BATCH_SIZE = 100;
const MAX_QUERY_ROUNDS = 12;

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

export function hasActiveActivityFilters(filters = {}) {
    return Object.values(filters).some((value) => String(value || '').trim() !== '');
}

export function getActivityLogsEmptyStateMessage({ loading = false, hasError = false, hasActiveFilters = false } = {}) {
    if (loading) return 'Laddar...';
    if (hasError) return 'Kunde inte ladda aktivitetsloggen.';
    if (hasActiveFilters) return 'Inga loggar matchar de aktiva filtren.';
    return 'Inga loggade händelser ännu.';
}

export function ActivityLogs({ onBack }) {
    const { user, canViewEverything } = useAuth();

    const [pageState, setPageState] = useState({
        loading: false,
        pageIndex: 0,
        pageStarts: [null],
        hasNext: false,
        rows: [],
        error: false
    });

    const [filters, setFilters] = useState({
        fromDate: '',
        toDate: '',
        system: '',
        eventType: '',
        actor: '',
        search: ''
    });

    const getActiveFilters = useCallback(() => ({
        fromMs: getDateStartMs(filters.fromDate),
        toMs: getDateEndMs(filters.toDate),
        system: String(filters.system || '').trim().toLowerCase(),
        eventType: String(filters.eventType || '').trim(),
        actor: String(filters.actor || '').trim().toLowerCase(),
        search: String(filters.search || '').trim().toLowerCase()
    }), [filters]);

    const matchesFilters = (row, activeFilters) => {
        if (activeFilters.fromMs && row.resolvedMs < activeFilters.fromMs) return false;
        if (activeFilters.toMs && row.resolvedMs > activeFilters.toMs) return false;
        if (activeFilters.system && row.system !== activeFilters.system) return false;
        if (activeFilters.eventType && row.eventType !== activeFilters.eventType) return false;

        if (activeFilters.actor) {
            const actorHaystack = `${row.user} ${row.userUid}`.toLowerCase();
            if (!actorHaystack.includes(activeFilters.actor)) return false;
        }

        if (activeFilters.search) {
            const searchHaystack = `${row.targetId} ${row.details} ${formatActivityMetadata(row.metadata)}`.toLowerCase();
            if (!searchHaystack.includes(activeFilters.search)) return false;
        }

        return true;
    };
    const hasActiveFilters = hasActiveActivityFilters(filters);

    const fetchLogsBatch = async (startCursor) => {
        const logsRef = collection(db, 'activity_logs');
        const constraints = [orderBy('createdAt', 'desc'), limit(QUERY_BATCH_SIZE)];
        if (startCursor) constraints.push(startAfter(startCursor));
        return getDocs(query(logsRef, ...constraints));
    };

    const loadPage = useCallback(async (targetPageIndex, currentStarts) => {
        setPageState((prev) => ({ ...prev, loading: true, rows: [], error: false }));

        const activeFilters = getActiveFilters();
        const startCursor = currentStarts[targetPageIndex] || null;
        let scanCursor = startCursor;
        let lastIncludedCursor = startCursor;
        let foundExtra = false;
        let exhausted = false;
        let hadError = false;
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
                    const row = normalizeActivityLog(docSnap);
                    if (!matchesFilters(row, activeFilters)) continue;

                    if (rows.length < PAGE_SIZE) {
                        rows.push(row);
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
            console.error('Failed to load activity logs:', err);
            notifyError('Kunde inte ladda aktivitetslogg.');
            exhausted = true;
            hadError = true;
        }

        setPageState((prev) => {
            const newStarts = [...currentStarts];
            newStarts[targetPageIndex + 1] = foundExtra ? lastIncludedCursor : null;

            let finalIndex = targetPageIndex;
            let finalHasNext = foundExtra;
            if (!rows.length && !foundExtra && exhausted && targetPageIndex > 0) {
                finalIndex = Math.max(0, targetPageIndex - 1);
                finalHasNext = false;
            }

            return {
                loading: false,
                pageIndex: finalIndex,
                rows,
                hasNext: finalHasNext,
                pageStarts: newStarts,
                error: hadError
            };
        });
    }, [getActiveFilters]);

    const resetPaginationAndReload = useCallback(() => {
        setPageState((prev) => ({
            ...prev,
            pageIndex: 0,
            pageStarts: [null],
            hasNext: false,
            loading: true,
            error: false
        }));
        loadPage(0, [null]);
    }, [loadPage]);

    useEffect(() => {
        if (!user || !canViewEverything) return undefined;

        const timer = setTimeout(() => {
            resetPaginationAndReload();
        }, 220);

        return () => clearTimeout(timer);
    }, [user, canViewEverything, filters, resetPaginationAndReload]);

    const handlePrev = () => {
        if (pageState.pageIndex === 0) return;
        loadPage(pageState.pageIndex - 1, pageState.pageStarts);
    };

    const handleNext = () => {
        if (!pageState.hasNext) return;
        loadPage(pageState.pageIndex + 1, pageState.pageStarts);
    };

    const resetFilters = () => {
        setFilters({
            fromDate: '',
            toDate: '',
            system: '',
            eventType: '',
            actor: '',
            search: ''
        });
    };

    const handleFilterChange = (field, value) => {
        setFilters((prev) => ({ ...prev, [field]: value }));
    };

    if (!canViewEverything) {
        return (
            <div className="empty-state text-center p-8 bg-panel-bg rounded">
                Ingen åtkomst till aktivitetslogg.
            </div>
        );
    }

    return (
        <div className="max-w-[1200px] mx-auto py-6">
            <section className="bg-panel-bg border border-panel-border rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center gap-4 flex-wrap mb-4">
                    <div>
                        <h2 className="text-3xl font-semibold text-text-primary m-0">Aktivitetslogg</h2>
                        <p className="text-text-secondary mt-1 m-0">
                            Se vem som skapade offerter, exporterade filer och använde ritverktyget.
                        </p>
                    </div>
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-4 py-2 bg-panel-bg border border-panel-border hover:bg-white/5 rounded text-text-primary transition-colors"
                        >
                            ← Tillbaka
                        </button>
                    )}
                </div>

                <h3 className="mt-0 mb-4 text-lg font-semibold border-b border-panel-border pb-2">Filter</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Från datum
                        <input
                            type="date"
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.fromDate}
                            onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Till datum
                        <input
                            type="date"
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.toDate}
                            onChange={(e) => handleFilterChange('toDate', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        System
                        <select
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.system}
                            onChange={(e) => handleFilterChange('system', e.target.value)}
                        >
                            <option value="">Alla</option>
                            <option value="quote">Offert</option>
                            <option value="sketch">Ritning</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Händelse
                        <select
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.eventType}
                            onChange={(e) => handleFilterChange('eventType', e.target.value)}
                        >
                            <option value="">Alla</option>
                            {Object.entries(ACTIVITY_EVENT_DEFINITIONS).map(([eventType, definition]) => (
                                <option key={eventType} value={eventType}>
                                    {definition.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Användare
                        <input
                            type="text"
                            placeholder="E-post"
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.actor}
                            onChange={(e) => handleFilterChange('actor', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Söktext
                        <input
                            type="text"
                            placeholder="target eller detaljer"
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                    </label>
                </div>
                <div className="flex justify-end pt-2 border-t border-panel-border">
                    <button
                        type="button"
                        onClick={resetFilters}
                        className="px-4 py-2 text-sm border border-panel-border rounded bg-transparent text-text-primary hover:bg-white/5 transition-colors"
                    >
                        Rensa filter
                    </button>
                </div>
            </section>

            <section className="bg-panel-bg border border-panel-border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                    <div className="text-sm text-text-secondary">
                        {pageState.loading ? 'Laddar aktivitetslogg...' : `Visar ${pageState.rows.length} poster (sida ${pageState.pageIndex + 1}, ${PAGE_SIZE} per sida).`}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrev}
                            disabled={pageState.loading || pageState.pageIndex === 0}
                            className="px-3 py-1.5 text-sm border border-panel-border bg-black/20 text-text-primary rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                        >
                            Föregående
                        </button>
                        <span className="min-w-[80px] text-center text-sm text-text-secondary">
                            Sida {pageState.pageIndex + 1}
                        </span>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={pageState.loading || !pageState.hasNext}
                            className="px-3 py-1.5 text-sm border border-panel-border bg-black/20 text-text-primary rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                        >
                            Nästa
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border border-panel-border rounded-lg">
                    <table className="w-full text-left border-collapse min-w-[920px]">
                        <thead>
                            <tr className="bg-black/20 border-b border-panel-border text-xs uppercase tracking-wider text-text-secondary">
                                <th className="px-4 py-3 font-medium">Tid</th>
                                <th className="px-4 py-3 font-medium">System</th>
                                <th className="px-4 py-3 font-medium">Händelse</th>
                                <th className="px-4 py-3 font-medium">Target</th>
                                <th className="px-4 py-3 font-medium">Användare</th>
                                <th className="px-4 py-3 font-medium">Detaljer</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-panel-border">
                            {pageState.rows.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-text-secondary">
                                        <div className="space-y-3">
                                            <div>{getActivityLogsEmptyStateMessage({
                                                loading: pageState.loading,
                                                hasError: pageState.error,
                                                hasActiveFilters
                                            })}</div>
                                            {hasActiveFilters && !pageState.loading && !pageState.error && (
                                                <button
                                                    type="button"
                                                    onClick={resetFilters}
                                                    className="px-4 py-2 text-sm border border-panel-border rounded bg-transparent text-text-primary hover:bg-white/5 transition-colors"
                                                >
                                                    Rensa filter
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pageState.rows.map((row) => {
                                    const date = new Date(row.resolvedMs || Date.now());
                                    const dateStr = date.toLocaleString('sv-SE', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });
                                    const eventLabel = getActivityEventDefinition(row.eventType).label;
                                    const metadataSummary = formatActivityMetadata(row.metadata);
                                    const targetValue = row.metadata?.reference || (row.targetId && row.targetId !== '-'
                                        ? `${row.targetType}: ${row.targetId}`
                                        : row.targetType);

                                    return (
                                        <tr key={row.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-text-secondary">{dateStr}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{getActivitySystemLabel(row.system)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{eventLabel}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{targetValue}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{row.user}</td>
                                            <td className="px-4 py-3 min-w-[320px] break-words text-text-secondary">
                                                <div>{row.details}</div>
                                                {metadataSummary && (
                                                    <div className="mt-1 text-xs text-text-secondary/80">{metadataSummary}</div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
