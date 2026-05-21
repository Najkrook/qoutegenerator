import React, { useCallback, useEffect, useState } from 'react';
import { getCatalogLineIds, getCatalogLineName } from '../data/catalogLookup';
import { useAuth } from '../store/AuthContext';
import { db, collection, query, orderBy, limit, getDocs } from '../services/firebase';
import {
    formatActivityMetadata,
    getActivityLogVisual,
    normalizeActivityLog
} from '../services/activityLogService';
import {
    getOrderRequestStatusLabel,
    orderRequestService
} from '../services/orderRequestService';
import type { DashboardProps, OrderRequestRecord, RetailerRecord } from '../types/contracts';

type ActivityLogEntry = ReturnType<typeof normalizeActivityLog>;

function formatCurrencySek(value: number): string {
    return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatOrderRequestDateTime(value: number): string {
    const date = new Date(value || Date.now());
    return `${date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
}

function getOrderRequestStatusClasses(status: string): string {
    switch (status) {
        case 'completed':
            return 'border border-success/40 bg-success/10 text-success';
        case 'reviewing':
            return 'border border-primary/40 bg-primary/10 text-primary';
        case 'new':
        default:
            return 'border border-warning/40 bg-warning/10 text-warning';
    }
}

interface RetailerLineSummary {
    id: string;
    name: string;
    discountPct: number;
}

function getRetailerLineSummaries(retailer: RetailerRecord | null): RetailerLineSummary[] {
    if (!retailer?.productLines) {
        return [];
    }

    return getCatalogLineIds().flatMap((lineId) => {
        const lineConfig = retailer.productLines?.[lineId];
        if (!lineConfig?.enabled) {
            return [];
        }

        return [{
            id: lineId,
            name: getCatalogLineName(lineId) || lineId,
            discountPct: Number(lineConfig.discountPct) || 0
        }];
    });
}

export function Dashboard({
    onStartQuote,
    onOpenHistory,
    onOpenInventory,
    onOpenSketch,
    onOpenPlanner,
    onOpenActivity,
    onOpenRetailers,
    onOpenRetailerOrders
}: DashboardProps) {
    const {
        canViewEverything,
        canStartQuote,
        canAccessSketch,
        canAccessQuoteHistory,
        isRetailer,
        retailer
    } = useAuth();
    const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState(false);
    const [recentOrderRequests, setRecentOrderRequests] = useState<OrderRequestRecord[]>([]);
    const [orderRequestsLoading, setOrderRequestsLoading] = useState(false);
    const [orderRequestsError, setOrderRequestsError] = useState(false);

    const fetchLogs = useCallback(async (): Promise<void> => {
        if (!canViewEverything) {
            setLogs([]);
            setLogsLoading(false);
            setLogsError(false);
            return;
        }

        setLogsLoading(true);
        setLogsError(false);
        try {
            const logsRef = collection(db, 'activity_logs');
            const snapshot = await getDocs(query(logsRef, orderBy('createdAt', 'desc'), limit(20)));
            const nextLogs = snapshot.docs.map((docSnap) => normalizeActivityLog(docSnap));
            nextLogs.sort((left, right) => right.resolvedMs - left.resolvedMs);
            setLogs(nextLogs);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
            setLogs([]);
            setLogsError(true);
        } finally {
            setLogsLoading(false);
        }
    }, [canViewEverything]);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    const fetchRecentOrderRequests = useCallback(async (): Promise<void> => {
        if (!canViewEverything) {
            setRecentOrderRequests([]);
            setOrderRequestsLoading(false);
            setOrderRequestsError(false);
            return;
        }

        setOrderRequestsLoading(true);
        setOrderRequestsError(false);
        try {
            const nextRequests = await orderRequestService.listRecentOrderRequests({ limit: 5 });
            setRecentOrderRequests(nextRequests);
        } catch (error) {
            console.error('Failed to fetch recent order requests:', error);
            setRecentOrderRequests([]);
            setOrderRequestsError(true);
        } finally {
            setOrderRequestsLoading(false);
        }
    }, [canViewEverything]);

    useEffect(() => {
        void fetchRecentOrderRequests();
    }, [fetchRecentOrderRequests]);

    const retailerLineSummaries = getRetailerLineSummaries(retailer);
    const retailerName = retailer?.name || 'Er retailerprofil';

    if (isRetailer) {
        return (
            <div className="mx-auto flex max-w-6xl flex-col gap-8 animate-slide-in">
                <section className="w-full rounded-2xl border border-panel-border bg-panel-bg p-8 shadow-lg">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                                Retailer Workspace
                            </span>
                            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-text-primary">
                                Välkommen, {retailerName}
                            </h2>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
                                Här kan ni se och skapa offerter från de produktlinjer och sortiment ni har tillgång till hos BRIXX.
                            </p>
                        </div>

                        <div className="grid min-w-[240px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                                    Aktiva produktlinjer
                                </div>
                                <div className="mt-2 text-3xl font-black text-text-primary">
                                    {retailerLineSummaries.length}
                                </div>
                            </div>
                            <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                                    Historik
                                </div>
                                <div className="mt-2 text-sm font-medium text-text-primary">
                                    {canAccessQuoteHistory ? 'Mina Offerter tillgängligt' : 'Historik ej tillgänglig'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        {canStartQuote && (
                            <button
                                type="button"
                                onClick={onStartQuote}
                                className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-hover"
                            >
                                Starta Ny Offert
                            </button>
                        )}
                        {canAccessQuoteHistory && onOpenHistory && (
                            <button
                                type="button"
                                onClick={onOpenHistory}
                                className="rounded-md border border-panel-border bg-black/10 px-6 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
                            >
                                Mina Offerter
                            </button>
                        )}
                    </div>
                </section>

                <section className="w-full rounded-2xl border border-panel-border bg-panel-bg p-8 shadow-sm">
                    <div className="flex items-center justify-between gap-4 border-b border-panel-border pb-4">
                        <div>
                            <h3 className="m-0 text-xl font-semibold text-text-primary">Aktiva produktlinjer och rabatter</h3>
                            <p className="mt-1 text-sm text-text-secondary">
                                Rabatten appliceras som standard när du väljer en av era aktiva linjer i offertflödet.
                            </p>
                        </div>
                    </div>

                    {retailerLineSummaries.length === 0 ? (
                        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-text-secondary">
                            Inga produktlinjer är aktiva för det här retailer-kontot ännu. Kontakta Brixx om ni behöver
                            utöka ert sortiment.
                        </div>
                    ) : (
                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {retailerLineSummaries.map((line) => (
                                <div
                                    key={line.id}
                                    className="rounded-xl border border-panel-border bg-black/10 p-5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 className="m-0 text-lg font-semibold text-text-primary">{line.name}</h4>
                                            <p className="mt-2 text-sm text-text-secondary">
                                                Standardrabatt för nya offerter inom denna produktlinje.
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                                            {line.discountPct}% rabatt
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center animate-slide-in">
            <h2 className="text-center mb-12 text-4xl font-semibold tracking-tight text-text-primary">
                Välkommen till Brixx portal
            </h2>

            <div className="flex gap-8 justify-center flex-wrap w-full max-w-5xl">
                {canStartQuote && (
                    <button
                        type="button"
                        onClick={onStartQuote}
                        className="flex-1 min-w-[300px] max-w-[400px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform" aria-hidden="true">📄</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Skapa Ny Offert</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Starta ett nytt offertflöde för kund. Konfigurera produkter, priser och generera PDF.
                        </p>
                    </button>
                )}

                {canViewEverything && (
                    <button
                        type="button"
                        onClick={onOpenInventory}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform" aria-hidden="true">📦</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Hantera Lagersaldo</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Uppdatera lagersaldon för BaHaMa och ClickitUp. Se loggar och historik.
                        </p>
                    </button>
                )}

                {canAccessSketch && (
                    <button
                        type="button"
                        onClick={onOpenSketch}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform" aria-hidden="true">✏️</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Rita Uteservering</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Skissa snabbt en rektangel för att automatiskt beräkna optimala ClickitUp-sektioner.
                        </p>
                    </button>
                )}

                {canViewEverything && onOpenActivity && (
                    <button
                        type="button"
                        onClick={onOpenActivity}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform" aria-hidden="true">🕘</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Aktivitetslog</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Se vem som skapade offerter, exporterade filer och använde ritverktyget.
                        </p>
                    </button>
                )}

                {canViewEverything && onOpenPlanner && (
                    <button
                        type="button"
                        onClick={onOpenPlanner}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform" aria-hidden="true">📋</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Projektplanerare</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Planera och följ upp projekt. Lägg till, checka av och håll koll på framsteg.
                        </p>
                    </button>
                )}

                {canViewEverything && onOpenRetailers && (
                    <button
                        type="button"
                        onClick={onOpenRetailers}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform" aria-hidden="true">🏪</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Återförsäljare</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Hantera återförsäljare, produktlinjer och rabatter.
                        </p>
                    </button>
                )}
            </div>

            {!canStartQuote && !canAccessSketch && (
                <div className="mt-8 w-full max-w-3xl bg-panel-bg border border-panel-border rounded-xl p-8 text-center">
                    <p className="m-0 text-text-secondary">
                        Ditt konto har för närvarande ingen tilldelad arbetsyta. Kontakta administratör.
                    </p>
                </div>
            )}

            {canViewEverything && (
                <div className="mt-16 w-full max-w-[980px]">
                    <div className="mb-6 flex items-center justify-between gap-4 border-b border-panel-border pb-4">
                        <div>
                            <h3 className="m-0 text-xl font-semibold text-text-primary">Inkomna orderförfrågningar</h3>
                            <p className="mt-1 text-sm text-text-secondary">
                                Senaste retailerförfrågningarna som väntar på hantering i BRIXX.
                            </p>
                        </div>
                        {onOpenRetailerOrders && (
                            <button
                                type="button"
                                onClick={onOpenRetailerOrders}
                                className="rounded-md border border-panel-border bg-panel-bg px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-panel-border"
                            >
                                Öppna inbox
                            </button>
                        )}
                    </div>
                    <div className="flex flex-col gap-3">
                        {orderRequestsLoading ? (
                            <p className="text-text-secondary text-center italic">Laddar orderförfrågningar...</p>
                        ) : orderRequestsError ? (
                            <p className="text-text-secondary text-center italic">Kunde inte ladda orderförfrågningar just nu.</p>
                        ) : recentOrderRequests.length === 0 ? (
                            <p className="text-text-secondary text-center italic">Inga orderförfrågningar har registrerats ännu.</p>
                        ) : (
                            recentOrderRequests.map((request) => (
                                <button
                                    key={request.id}
                                    type="button"
                                    onClick={() => onOpenRetailerOrders?.()}
                                    className="grid w-full grid-cols-1 gap-3 rounded-xl border border-panel-border bg-panel-bg/70 p-4 text-left transition-colors hover:bg-white/5 lg:grid-cols-[minmax(0,1.6fr)_auto_auto]"
                                >
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-text-primary">{request.quoteNumber}</span>
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${getOrderRequestStatusClasses(request.status)}`}>
                                                {getOrderRequestStatusLabel(request.status)}
                                            </span>
                                        </div>
                                        <div className="mt-2 text-sm text-text-secondary">
                                            {request.retailerName} · {request.company || request.customerName || 'Okänd kund'}
                                        </div>
                                        <div className="mt-1 text-xs text-text-secondary">
                                            {request.reference ? `Ref: ${request.reference}` : 'Ingen referens'} · v{request.quoteVersion}
                                        </div>
                                    </div>
                                    <div className="text-sm font-semibold text-text-primary lg:text-right">
                                        {formatCurrencySek(request.totalSek)}
                                    </div>
                                    <div className="text-xs text-text-secondary lg:text-right">
                                        {formatOrderRequestDateTime(request.createdAtMs)}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {canViewEverything && (
                <div className="mt-16 w-full max-w-[800px]">
                    <div className="flex justify-between items-center gap-4 border-b border-panel-border pb-4 mb-6">
                        <h3 className="text-xl font-semibold text-text-primary m-0">Senaste Händelser</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                        {logsLoading ? (
                            <p className="text-text-secondary text-center italic">Laddar loggar...</p>
                        ) : logsError ? (
                            <p className="text-text-secondary text-center italic">Kunde inte ladda senaste händelser just nu.</p>
                        ) : logs.length === 0 ? (
                            <p className="text-text-secondary text-center italic">Inga loggade händelser ännu. Nya sparade offerter och exporter visas här.</p>
                        ) : (
                            logs.slice(0, 10).map((entry, index) => {
                                const date = new Date(entry.resolvedMs || Date.now());
                                const { icon, color, label } = getActivityLogVisual(entry);
                                const metadataSummary = formatActivityMetadata(entry.metadata);
                                const targetIdLabel = entry.metadata?.reference || (entry.targetId && entry.targetId !== '-' ? entry.targetId : '');
                                const targetLabel = targetIdLabel || entry.targetType;

                                return (
                                    <div
                                        key={entry.id || `${entry.resolvedMs}-${index}`}
                                        className="rounded-lg p-4 flex items-start gap-4"
                                        style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `3px solid ${color}` }}
                                    >
                                        <div className="text-xl leading-none">{icon}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-semibold text-text-primary text-sm">
                                                    {label}
                                                </span>
                                                <span className="text-xs text-text-secondary whitespace-nowrap">
                                                    {date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}{' '}
                                                    {date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="text-sm text-text-primary">
                                                {entry.user || '-'}{targetLabel ? ` · ${targetLabel}` : ''}
                                            </div>
                                            <div className="text-xs text-text-secondary">
                                                {entry.details || '-'}{metadataSummary ? ` · ${metadataSummary}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
