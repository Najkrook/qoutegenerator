import React, { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { db, collection, query, orderBy, limit, getDocs } from '../services/firebase';

function getLogVisual(entry) {
    if (entry.action === "Lades Till" || (entry.action === "Justering" && Number(entry.delta) > 0)) {
        return { icon: '📥', color: 'var(--success)' };
    } else if (entry.action === "Togs Bort" || (entry.action === "Justering" && Number(entry.delta) < 0)) {
        return { icon: '📤', color: 'var(--danger)' };
    } else if (entry.action === "Massuppdatering") {
        return { icon: '🔄', color: 'var(--primary)' };
    }
    return { icon: '📝', color: 'var(--primary)' };
}

export function Dashboard({ onStartQuote, onOpenInventory, onOpenSketch }) {
    const { user, login, logout } = useAuth();
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [loginForm, setLoginForm] = useState({ email: '', password: '', error: '' });
    const [loggingIn, setLoggingIn] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const logsRef = collection(db, "inventory_logs");
            let snap;
            try {
                snap = await getDocs(query(logsRef, orderBy("timestamp", "desc"), limit(20)));
            } catch {
                snap = await getDocs(query(logsRef, orderBy("createdAt", "desc"), limit(20)));
            }
            const data = snap.docs.map(d => d.data());
            data.sort((a, b) => {
                const tA = typeof a.createdAt === 'number' ? a.createdAt : Date.parse(a.timestamp || '') || 0;
                const tB = typeof b.createdAt === 'number' ? b.createdAt : Date.parse(b.timestamp || '') || 0;
                return tB - tA;
            });
            setLogs(data);
        } catch (err) {
            console.error("Failed to fetch logs:", err);
            setLogs([]);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoggingIn(true);
        setLoginForm(f => ({ ...f, error: '' }));
        try {
            await login(loginForm.email, loginForm.password);
        } catch (err) {
            setLoginForm(f => ({ ...f, error: 'Fel e-post eller lösenord.' }));
        } finally {
            setLoggingIn(false);
        }
    };

    return (
        <div className="flex flex-col items-center animate-slide-in">
            <h2 className="text-center mb-12 text-4xl font-semibold tracking-tight text-text-primary">
                Välkommen till Offertverktyg Pro
            </h2>

            {/* Auth Section */}
            <div className="w-full max-w-5xl mb-10">
                {user ? (
                    <div className="flex items-center justify-end gap-3 text-sm">
                        <span className="text-text-secondary">👤 {user.email}</span>
                        <button
                            onClick={logout}
                            className="text-xs text-text-secondary border border-panel-border bg-transparent px-3 py-1.5 rounded cursor-pointer hover:bg-white/5"
                        >
                            Logga ut
                        </button>
                    </div>
                ) : (
                    <div className="bg-panel-bg border border-panel-border rounded-xl p-6 max-w-md mx-auto">
                        <h4 className="text-sm font-semibold text-text-primary uppercase mb-4 m-0">Logga in</h4>
                        <form onSubmit={handleLogin} className="space-y-3">
                            <input
                                type="email"
                                placeholder="E-post"
                                value={loginForm.email}
                                onChange={(e) => setLoginForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                            />
                            <input
                                type="password"
                                placeholder="Lösenord"
                                value={loginForm.password}
                                onChange={(e) => setLoginForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                            />
                            {loginForm.error && <p className="text-danger text-xs m-0">{loginForm.error}</p>}
                            <button
                                type="submit"
                                disabled={loggingIn}
                                className="w-full py-2.5 bg-primary text-white border-none rounded-lg font-semibold cursor-pointer hover:brightness-110 disabled:opacity-60"
                            >
                                {loggingIn ? 'Loggar in...' : 'Logga in'}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {/* Action Cards */}
            <div className="flex gap-8 justify-center flex-wrap w-full max-w-5xl">
                <button
                    onClick={onStartQuote}
                    className="flex-1 min-w-[300px] max-w-[400px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                >
                    <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">&#x1F4C4;</div>
                    <h3 className="text-2xl font-semibold text-text-primary mb-2">Skapa Ny Offert</h3>
                    <p className="text-text-secondary leading-relaxed m-0">
                        Starta ett nytt offertflöde för kund. Konfigurera produkter, priser och generera PDF.
                    </p>
                </button>

                <button
                    onClick={onOpenInventory}
                    className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                >
                    <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">&#x1F4E6;</div>
                    <h3 className="text-2xl font-semibold text-text-primary mb-2">Hantera Lagersaldo</h3>
                    <p className="text-text-secondary leading-relaxed m-0">
                        Uppdatera lagersaldon för BaHaMa och ClickitUP. Se loggar och historik.
                    </p>
                </button>

                <button
                    onClick={onOpenSketch}
                    className="flex-1 min-w-[250px] max-w-[350px] bg-panel-bg border border-panel-border rounded-xl p-12 cursor-pointer text-center transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary group"
                >
                    <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">&#x270F;&#xFE0F;</div>
                    <h3 className="text-2xl font-semibold text-text-primary mb-2">Rita Uteservering</h3>
                    <p className="text-text-secondary leading-relaxed m-0">
                        Skissa snabbt en rektangel för att automatiskt beräkna optimala ClickitUP-sektioner.
                    </p>
                </button>
            </div>

            {/* Activity Log */}
            <div className="mt-16 w-full max-w-[800px]">
                <div className="flex justify-between items-center gap-4 border-b border-panel-border pb-4 mb-6">
                    <h3 className="text-xl font-semibold text-text-primary m-0">Senaste Händelser</h3>
                </div>
                <div className="flex flex-col gap-3">
                    {logsLoading ? (
                        <p className="text-text-secondary text-center italic">Laddar loggar...</p>
                    ) : logs.length === 0 ? (
                        <p className="text-text-secondary text-center italic">Inga loggade händelser ännu.</p>
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
                                                {date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })} {date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
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
        </div>
    );
}
