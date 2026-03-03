import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import { db, collection, query, orderBy, limit, getDocs } from '../services/firebase';

function getLogVisual(entry) {
    if (entry.action === 'Lades Till' || (entry.action === 'Justering' && Number(entry.delta) > 0)) {
        return { icon: '+', color: 'var(--color-success)' };
    }
    if (entry.action === 'Togs Bort' || (entry.action === 'Justering' && Number(entry.delta) < 0)) {
        return { icon: '-', color: 'var(--color-danger)' };
    }
    if (entry.action === 'Massuppdatering') {
        return { icon: '*', color: 'var(--color-primary)' };
    }
    return { icon: 'i', color: 'var(--color-primary)' };
}

export function Dashboard({ onStartQuote, onOpenInventory, onOpenSketch }) {
    const { canViewEverything } = useAuth();
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const fetchLogs = useCallback(async () => {
        if (!canViewEverything) {
            setLogs([]);
            setLogsLoading(false);
            return;
        }

        setLogsLoading(true);
        try {
            const logsRef = collection(db, 'inventory_logs');
            let snap;
            try {
                snap = await getDocs(query(logsRef, orderBy('timestamp', 'desc'), limit(20)));
            } catch {
                snap = await getDocs(query(logsRef, orderBy('createdAt', 'desc'), limit(20)));
            }
            const data = snap.docs.map((d) => d.data());
            data.sort((a, b) => {
                const tA = typeof a.createdAt === 'number' ? a.createdAt : Date.parse(a.timestamp || '') || 0;
                const tB = typeof b.createdAt === 'number' ? b.createdAt : Date.parse(b.timestamp || '') || 0;
                return tB - tA;
            });
            setLogs(data);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
            setLogs([]);
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
                Valkommen till Offertverktyg Pro
            </h2>

            <div className="flex gap-8 justify-center flex-wrap w-full max-w-5xl">
                <button
                    onClick={onStartQuote}
                    className="flex-1 min-w-[300px] max-w-[400px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                >
                    <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">[OFFERT]</div>
                    <h3 className="text-2xl font-semibold text-text-primary mb-2">Skapa Ny Offert</h3>
                    <p className="text-text-secondary leading-relaxed m-0">
                        Starta ett nytt offertflode for kund. Konfigurera produkter, priser och generera PDF.
                    </p>
                </button>

                {canViewEverything && (
                    <button
                        onClick={onOpenInventory}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">[LAGER]</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Hantera Lagersaldo</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Uppdatera lagersaldon for BaHaMa och ClickitUP. Se loggar och historik.
                        </p>
                    </button>
                )}

                {canViewEverything && (
                    <button
                        onClick={onOpenSketch}
                        className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">[SKISS]</div>
                        <h3 className="text-2xl font-semibold text-text-primary mb-2">Rita Uteservering</h3>
                        <p className="text-text-secondary leading-relaxed m-0">
                            Skissa snabbt en rektangel for att automatiskt berakna optimala ClickitUP-sektioner.
                        </p>
                    </button>
                )}
            </div>

            {canViewEverything && (
                <div className="mt-16 w-full max-w-[800px]">
                    <div className="flex justify-between items-center gap-4 border-b border-panel-border pb-4 mb-6">
                        <h3 className="text-xl font-semibold text-text-primary m-0">Senaste Handelser</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                        {logsLoading ? (
                            <p className="text-text-secondary text-center italic">Laddar loggar...</p>
                        ) : logs.length === 0 ? (
                            <p className="text-text-secondary text-center italic">Inga loggade handelser annu.</p>
                        ) : (
                            logs.slice(0, 10).map((entry, idx) => {
                                const time = typeof entry.createdAt === 'number' ? entry.createdAt : Date.parse(entry.timestamp || '') || Date.now();
                                const date = new Date(time);
                                const { icon, color } = getLogVisual(entry);
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
                                                    {entry.system}: {entry.action}
                                                </span>
                                                <span className="text-xs text-text-secondary whitespace-nowrap">
                                                    {date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}{' '}
                                                    {date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="text-sm text-text-primary">{entry.targetId || entry.element || '-'}</div>
                                            <div className="text-xs text-text-secondary">{entry.details || '-'}</div>
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
