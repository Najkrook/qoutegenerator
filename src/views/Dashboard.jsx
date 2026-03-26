import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import { db, collection, query, orderBy, limit, getDocs } from '../services/firebase';
import {
    formatActivityMetadata,
    getActivityLogVisual,
    normalizeActivityLog
} from '../services/activityLogService';

export function Dashboard({ onStartQuote, onOpenInventory, onOpenSketch, onOpenPlanner, onOpenActivity, onOpenRetailers }) {
    const { canViewEverything, canStartQuote, canAccessSketch } = useAuth();
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsError, setLogsError] = useState(false);

    const fetchLogs = useCallback(async () => {
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
            const snap = await getDocs(query(logsRef, orderBy('createdAt', 'desc'), limit(20)));
            const data = snap.docs.map((docSnap) => normalizeActivityLog(docSnap));
            data.sort((a, b) => b.resolvedMs - a.resolvedMs);
            setLogs(data);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
            setLogs([]);
            setLogsError(true);
        } finally {
            setLogsLoading(false);
        }
    }, [canViewEverything]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return (
        <div className="flex flex-col items-center animate-slide-in">
            <h2 className="text-center mb-12 text-4xl font-semibold tracking-tight text-text-primary">
                Välkommen till Brixx portal
            </h2>

            <div className="flex gap-8 justify-center flex-wrap w-full max-w-5xl">
                {canStartQuote && (
                    <button
                        onClick={onStartQuote}
                        className="flex-1 min-w-[300px] max-w-[400px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📄</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Skapa Ny Offert</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Starta ett nytt offertflöde för kund. Konfigurera produkter, priser och generera PDF.
                        </p>
                    </button>
                )}

                {canViewEverything && (
                    <button
                        onClick={onOpenInventory}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📦</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Hantera Lagersaldo</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Uppdatera lagersaldon för BaHaMa och ClickitUp. Se loggar och historik.
                        </p>
                    </button>
                )}

                {canAccessSketch && (
                    <button
                        onClick={onOpenSketch}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">✏️</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Rita Uteservering</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Skissa snabbt en rektangel för att automatiskt beräkna optimala ClickitUp-sektioner.
                        </p>
                    </button>
                )}

                {canViewEverything && onOpenActivity && (
                    <button
                        onClick={onOpenActivity}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🕘</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Aktivitetslog</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Se vem som skapade offerter, exporterade filer och använde ritverktyget.
                        </p>
                    </button>
                )}

                {canViewEverything && onOpenPlanner && (
                    <button
                        onClick={onOpenPlanner}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📋</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Projektplanerare</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Planera och följ upp projekt. Lägg till, checka av och håll koll på framsteg.
                        </p>
                    </button>
                )}

                {canViewEverything && onOpenRetailers && (
                    <button
                        onClick={onOpenRetailers}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏪</div>
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
                            logs.slice(0, 10).map((entry, idx) => {
                                const date = new Date(entry.resolvedMs || Date.now());
                                const { icon, color, label } = getActivityLogVisual(entry);
                                const metadataSummary = formatActivityMetadata(entry.metadata);
                                const targetIdLabel = entry.metadata?.reference || (entry.targetId && entry.targetId !== '-' ? entry.targetId : '');
                                const targetLabel = targetIdLabel || entry.targetType;
                                return (
                                    <div
                                        key={idx}
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
