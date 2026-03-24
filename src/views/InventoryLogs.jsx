import React, { useState, useEffect, useCallback } from 'react';
import { db, collection, query, orderBy, limit, startAfter, getDocs } from '../services/firebase';
import { useAuth } from '../store/AuthContext';
import { notifyError } from '../services/notificationService';

const PAGE_SIZE = 50;
const QUERY_BATCH_SIZE = 100;
const MAX_QUERY_ROUNDS = 12;

export function InventoryLogs({ onBack }) {
    const { user, canViewEverything } = useAuth();
    
    const [pageState, setPageState] = useState({
        loading: false,
        pageIndex: 0,
        pageStarts: [null],
        hasNext: false,
        rows: []
    });

    const [filters, setFilters] = useState({
        fromDate: '',
        toDate: '',
        category: '',
        action: '',
        actor: '',
        search: ''
    });

    const toEpochMs = (value) => {
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
    };

    const normalizeLog = (docSnap) => {
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
    };

    const getDateStartMs = (dateValue) => {
        if (!dateValue) return null;
        const ms = Date.parse(`${dateValue}T00:00:00`);
        return Number.isFinite(ms) ? ms : null;
    };

    const getDateEndMs = (dateValue) => {
        if (!dateValue) return null;
        const ms = Date.parse(`${dateValue}T23:59:59.999`);
        return Number.isFinite(ms) ? ms : null;
    };

    const getActiveFilters = useCallback(() => {
        return {
            fromMs: getDateStartMs(filters.fromDate),
            toMs: getDateEndMs(filters.toDate),
            category: String(filters.category || '').trim().toLowerCase(),
            action: String(filters.action || '').trim(),
            actor: String(filters.actor || '').trim().toLowerCase(),
            search: String(filters.search || '').trim().toLowerCase()
        };
    }, [filters]);

    const matchesFilters = (log, activeFilters) => {
        if (activeFilters.fromMs && log.resolvedMs < activeFilters.fromMs) return false;
        if (activeFilters.toMs && log.resolvedMs > activeFilters.toMs) return false;
        if (activeFilters.category && log.category !== activeFilters.category) return false;
        if (activeFilters.action && log.action !== activeFilters.action) return false;

        if (activeFilters.actor) {
            const actorHaystack = `${log.user} ${log.userUid}`.toLowerCase();
            if (!actorHaystack.includes(activeFilters.actor)) return false;
        }

        if (activeFilters.search) {
            const searchHaystack = `${log.targetId} ${log.details}`.toLowerCase();
            if (!searchHaystack.includes(activeFilters.search)) return false;
        }

        return true;
    };

    const fetchLogsBatch = async (startCursor) => {
        const logsRef = collection(db, 'inventory_logs');
        const constraints = [orderBy('timestamp', 'desc'), limit(QUERY_BATCH_SIZE)];
        if (startCursor) constraints.push(startAfter(startCursor));
        const q = query(logsRef, ...constraints);
        return getDocs(q);
    };

    const loadPage = useCallback(async (targetPageIndex, currentStarts) => {
        setPageState(prev => ({ ...prev, loading: true, rows: [] }));

        const activeFilters = getActiveFilters();
        const startCursor = currentStarts[targetPageIndex] || null;
        let scanCursor = startCursor;
        let lastIncludedCursor = startCursor;
        let foundExtra = false;
        const rows = [];
        let exhausted = false;

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
                    if (!matchesFilters(logRow, activeFilters)) continue;

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

        setPageState(prev => {
            const newStarts = [...currentStarts];
            newStarts[targetPageIndex + 1] = foundExtra ? lastIncludedCursor : null;
            
            let finalIndex = targetPageIndex;
            let finalHasNext = foundExtra;
            if (!rows.length && !foundExtra && targetPageIndex > 0) {
                finalIndex = Math.max(0, targetPageIndex - 1);
                finalHasNext = false;
            }

            return {
                loading: false,
                pageIndex: finalIndex,
                rows,
                hasNext: finalHasNext,
                pageStarts: newStarts
            };
        });
    }, [getActiveFilters]);

    const resetPaginationAndReload = useCallback(() => {
        setPageState(prev => ({
            ...prev,
            pageIndex: 0,
            pageStarts: [null],
            hasNext: false,
            loading: true
        }));
        loadPage(0, [null]);
    }, [loadPage]);

    // Initial load and filter effect
    useEffect(() => {
        if (!user || !canViewEverything) return;
        
        const timer = setTimeout(() => {
            resetPaginationAndReload();
        }, 220); // matching debounce
        
        return () => clearTimeout(timer);
    }, [user, canViewEverything, filters, resetPaginationAndReload]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const resetFilters = () => {
        setFilters({
            fromDate: '',
            toDate: '',
            category: '',
            action: '',
            actor: '',
            search: ''
        });
    };

    const categoryLabel = (category) => {
        if (category === 'bahama') return 'BaHaMa';
        if (category === 'clickitup') return 'ClickitUp';
        return '-';
    };

    const handlePrev = () => {
        if (pageState.pageIndex === 0) return;
        loadPage(pageState.pageIndex - 1, pageState.pageStarts);
    };

    const handleNext = () => {
        if (!pageState.hasNext) return;
        loadPage(pageState.pageIndex + 1, pageState.pageStarts);
    };

    if (!canViewEverything) {
        return (
            <div className="empty-state text-center p-8 bg-panel-bg rounded">
                Ingen åtkomst till lagerloggar.
            </div>
        );
    }

    return (
        <div className="max-w-[1200px] mx-auto py-6">
            <section className="bg-panel-bg border border-panel-border rounded-lg p-6 mb-6">
                <h3 className="mt-0 mb-4 text-lg font-semibold border-b border-panel-border pb-2">Filter</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Från datum
                        <input 
                            type="date" 
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.fromDate}
                            onChange={e => handleFilterChange('fromDate', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Till datum
                        <input 
                            type="date" 
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.toDate}
                            onChange={e => handleFilterChange('toDate', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Kategori
                        <select 
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.category}
                            onChange={e => handleFilterChange('category', e.target.value)}
                        >
                            <option value="">Alla</option>
                            <option value="bahama">BaHaMa</option>
                            <option value="clickitup">ClickitUp</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Åtgärd
                        <select 
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.action}
                            onChange={e => handleFilterChange('action', e.target.value)}
                        >
                            <option value="">Alla</option>
                            <option value="Lades Till">Lades Till</option>
                            <option value="Ändrades">Ändrades</option>
                            <option value="Togs Bort">Togs Bort</option>
                            <option value="Massuppdatering">Massuppdatering</option>
                            <option value="Justering">Justering</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Användare
                        <input 
                            type="text" 
                            placeholder="E-post eller UID"
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.actor}
                            onChange={e => handleFilterChange('actor', e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                        Söktext
                        <input 
                            type="text" 
                            placeholder="targetId eller details"
                            className="px-3 py-2 rounded-md border border-panel-border bg-black/20 text-text-primary"
                            value={filters.search}
                            onChange={e => handleFilterChange('search', e.target.value)}
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
                        {pageState.loading ? 'Laddar loggar...' : `Visar ${pageState.rows.length} poster (sida ${pageState.pageIndex + 1}, ${PAGE_SIZE} per sida).`}
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
                    <table className="w-full text-left border-collapse min-w-[980px]">
                        <thead>
                            <tr className="bg-black/20 border-b border-panel-border text-xs uppercase tracking-wider text-text-secondary">
                                <th className="px-4 py-3 font-medium">Tid</th>
                                <th className="px-4 py-3 font-medium">Kategori</th>
                                <th className="px-4 py-3 font-medium">Åtgärd</th>
                                <th className="px-4 py-3 font-medium">Target</th>
                                <th className="px-4 py-3 font-medium">Delta</th>
                                <th className="px-4 py-3 font-medium">Användare</th>
                                <th className="px-4 py-3 font-medium">UID</th>
                                <th className="px-4 py-3 font-medium">Details</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-panel-border">
                            {pageState.rows.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-4 py-8 text-center text-text-secondary">
                                        {pageState.loading ? 'Laddar...' : 'Inga loggar matchar filtret.'}
                                    </td>
                                </tr>
                            ) : (
                                pageState.rows.map(row => {
                                    const date = new Date(row.resolvedMs || Date.now());
                                    const dateStr = date.toLocaleString('sv-SE', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });

                                    const delta = typeof row.delta === 'number'
                                        ? `${row.delta > 0 ? '+' : ''}${row.delta}`
                                        : '-';

                                    return (
                                        <tr key={row.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 whitespace-nowrap text-text-secondary">{dateStr}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{categoryLabel(row.category)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{row.action}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{row.targetId}</td>
                                            <td className={`px-4 py-3 whitespace-nowrap font-medium ${row.delta > 0 ? 'text-success-color' : row.delta < 0 ? 'text-danger-color' : 'text-text-primary'}`}>
                                                {delta}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">{row.user}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-text-secondary text-xs font-mono">{row.userUid}</td>
                                            <td className="px-4 py-3 min-w-[280px] break-words text-text-secondary">
                                                {row.details}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            {onBack && (
                <div className="mt-6 text-center">
                    <button onClick={onBack} className="px-4 py-2 bg-panel-bg border border-panel-border hover:bg-white/5 rounded text-text-primary transition-colors">
                        Tillbaka till Dashboard
                    </button>
                </div>
            )}
        </div>
    );
}
