import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';
import { quoteRepository } from '../services/quoteRepositoryClient';
import { normalizeQuoteStatus } from '../services/quoteRepository';
import { notifyError, notifyInfo, notifySuccess, confirmAction } from '../services/notificationService';
import { db, collection, getDocs } from '../services/firebase';

const STATUS_LABELS = {
    draft: 'Utkast',
    sent: 'Skickad',
    won: 'Vunnen',
    lost: 'Förlorad',
    archived: 'Arkiverad'
};

export function History({ onBack, onOpenQuote }) {
    const { user, canAccessQuoteHistory, canViewEverything } = useAuth();
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchFilter, setSearchFilter] = useState('');
    const [revisionCache, setRevisionCache] = useState({});
    const [visibleRevisions, setVisibleRevisions] = useState({});

    // Admin-only: user selector state
    const [allUsersQuotes, setAllUsersQuotes] = useState([]);
    const [userList, setUserList] = useState([]);
    const [selectedOwnerUid, setSelectedOwnerUid] = useState('__mine__');
    const [loadingAllUsers, setLoadingAllUsers] = useState(false);

    const quoteLifecycleEnabled = window.FEATURE_QUOTE_LIFECYCLE !== false;
    const isAdminBrowsing = canViewEverything && selectedOwnerUid !== '__mine__';

    // Load the user list for admins
    useEffect(() => {
        if (!user || !canViewEverything) return;

        let cancelled = false;
        const loadAllUsers = async () => {
            setLoadingAllUsers(true);
            try {
                const data = await quoteRepository.getAllUsersQuotes({ status: '', search: '' });
                if (cancelled) return;

                let retailersMap = new Map();
                try {
                    const snap = await getDocs(collection(db, 'retailers'));
                    snap.forEach(docSnap => {
                        const r = docSnap.data();
                        if (r.email) retailersMap.set(r.email.toLowerCase(), r.name);
                    });
                } catch (e) {
                    console.error('Failed to load retailers for history', e);
                }

                // Inject retailerName where matching email
                data.forEach(q => {
                    if (!q.retailerName) {
                        const email = (q.savedBy || q.ownerUid || '').toLowerCase();
                        if (retailersMap.has(email)) {
                            q.retailerName = retailersMap.get(email);
                        }
                    }
                });

                setAllUsersQuotes(data);

                // Build unique user list from ownerUid + savedBy (email)
                const userMap = new Map();
                data.forEach(q => {
                    if (q.ownerUid && !userMap.has(q.ownerUid)) {
                        userMap.set(q.ownerUid, {
                            uid: q.ownerUid,
                            email: q.savedBy || q.ownerUid,
                            retailerName: q.retailerName,
                            quoteCount: 0
                        });
                    }
                    if (q.ownerUid && userMap.has(q.ownerUid)) {
                        userMap.get(q.ownerUid).quoteCount += 1;
                    }
                });
                setUserList(Array.from(userMap.values()));
            } catch (err) {
                console.error('Failed to load all users quotes:', err);
            } finally {
                if (!cancelled) setLoadingAllUsers(false);
            }
        };
        loadAllUsers();
        return () => { cancelled = true; };
    }, [user, canViewEverything]);

    const loadQuotes = useCallback(async (status, search) => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            let data;
            if (selectedOwnerUid === '__mine__') {
                data = await quoteRepository.getUserQuotes({
                    userId: user.uid,
                    status,
                    search
                });
            } else if (selectedOwnerUid === '__all__') {
                // Show all users' quotes (admin)
                const all = allUsersQuotes.length > 0
                    ? allUsersQuotes
                    : await quoteRepository.getAllUsersQuotes({ status: '', search: '' });
                // Apply filters client-side
                data = all.filter(q => {
                    if (status && q.status !== status) return false;
                    if (!search) return true;
                    const haystack = `${q.searchText || ''} ${q.customerName || ''} ${q.reference || ''} ${q.customerReference || ''}`.toLowerCase();
                    return haystack.includes(search.toLowerCase());
                });
            } else {
                // Specific other user's quotes (admin)
                data = await quoteRepository.getUserQuotes({
                    userId: selectedOwnerUid,
                    status,
                    search
                });
            }
            setQuotes(data);
            setRevisionCache({});
            setVisibleRevisions({});
        } catch (err) {
            console.error('Failed to load quotes:', err);
            setError(err.message || 'Okänt fel');
        } finally {
            setLoading(false);
        }
    }, [user, selectedOwnerUid, allUsersQuotes]);

    useEffect(() => {
        if (!user || !canAccessQuoteHistory) return;
        const timer = setTimeout(() => {
            loadQuotes(statusFilter, searchFilter);
        }, 220); // matching debounce
        return () => clearTimeout(timer);
    }, [user, canAccessQuoteHistory, statusFilter, searchFilter, loadQuotes]);

    const formatDateTime = (ms) => {
        const dateObj = new Date(Number(ms) || Date.now());
        return dateObj.toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatSek = (value) => Math.round(Number(value) || 0).toLocaleString('sv-SE');

    // Resolve the effective userId for operations on a given quote
    const getQuoteOwnerUid = (quote) => {
        if (isAdminBrowsing || selectedOwnerUid === '__all__') {
            return quote.ownerUid || user.uid;
        }
        return user.uid;
    };

    const handleStatusChange = async (quote, nextStatus) => {
        if (!quoteLifecycleEnabled || !user) return;
        const ownerUid = getQuoteOwnerUid(quote);
        try {
            const updated = await quoteRepository.updateQuoteStatus({
                userId: ownerUid,
                quoteId: quote.quoteId,
                status: nextStatus
            });
            setQuotes(prev => prev.map(q => q.quoteId === quote.quoteId ? { ...updated, ownerUid: quote.ownerUid } : q));
            notifySuccess('Status uppdaterad.');
        } catch (err) {
            console.error('Failed to update quote status:', err);
            notifyError('Kunde inte uppdatera status.');
            loadQuotes(statusFilter, searchFilter);
        }
    };

    const toggleRevisions = async (quote) => {
        if (!quoteLifecycleEnabled || !user) return;
        const quoteId = quote.quoteId;
        const ownerUid = getQuoteOwnerUid(quote);
        
        const isVisible = visibleRevisions[quoteId];
        if (isVisible) {
            setVisibleRevisions(prev => ({ ...prev, [quoteId]: false }));
            return;
        }

        setVisibleRevisions(prev => ({ ...prev, [quoteId]: true }));
        
        if (!revisionCache[quoteId]) {
            try {
                const revisions = await quoteRepository.getQuoteRevisions({
                    userId: ownerUid,
                    quoteId,
                    limit: 5
                });
                setRevisionCache(prev => ({ ...prev, [quoteId]: revisions }));
            } catch (err) {
                console.error('Failed to load revisions:', err);
            }
        }
    };

    const openRevisionPayload = async (quoteId, revision) => {
        if (!revision?.state) {
            notifyInfo('Revisionen saknar sparat tillstånd.');
            return;
        }

        const metadata = quotes.find((q) => q.quoteId === quoteId);
        const nextState = {
            ...revision.state,
            customerInfo: {
                ...(revision.state?.customerInfo || {})
            },
            activeQuoteId: quoteId,
            activeQuoteVersion: Number(revision.version) || 1,
            quoteStatus: normalizeQuoteStatus(metadata?.status || 'draft')
        };

        if (onOpenQuote) {
            onOpenQuote(nextState);
        }
    };

    const openLatestQuote = async (quote) => {
        if (!user) return;
        const ownerUid = getQuoteOwnerUid(quote);
        try {
            const payload = await quoteRepository.getQuoteLatestRevision({
                userId: ownerUid,
                quoteId: quote.quoteId
            });

            if (!payload?.revision) {
                notifyInfo('Offerten saknar sparad revision.');
                return;
            }
            await openRevisionPayload(quote.quoteId, payload.revision);
        } catch (err) {
            console.error('Failed to open quote:', err);
            notifyError('Kunde inte öppna offerten: ' + err.message);
        }
    };

    const openSpecificRevision = async (quote, revisionId) => {
        const cached = revisionCache[quote.quoteId] || [];
        const revision = cached.find((row) => row.revisionId === revisionId);
        if (!revision) {
            notifyInfo('Revisionen kunde inte hittas.');
            return;
        }
        await openRevisionPayload(quote.quoteId, revision);
    };

    const deleteQuote = async (quote) => {
        const ok = await confirmAction({
            title: 'Ta bort offert',
            message: 'Är du säker på att du vill ta bort den här offerten och alla revisioner?',
            confirmText: 'Ta bort',
            cancelText: 'Avbryt',
            tone: 'danger'
        });
        if (!ok || !user) return;
        const ownerUid = getQuoteOwnerUid(quote);

        try {
            await quoteRepository.deleteQuote({ userId: ownerUid, quoteId: quote.quoteId });
            notifySuccess('Offerten togs bort.');
            loadQuotes(statusFilter, searchFilter);
        } catch (err) {
            console.error('Failed to delete quote:', err);
            notifyError('Kunde inte ta bort offerten: ' + err.message);
        }
    };

    if (!canAccessQuoteHistory) {
        return (
            <div className="empty-state text-center p-8 bg-panel-bg rounded">
                Ingen åtkomst till offerthistorik.
            </div>
        );
    }

    return (
        <div className="max-w-[900px] mx-auto py-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                <div className="flex gap-2 flex-wrap items-center">
                    {canViewEverything && (
                        <select
                            value={selectedOwnerUid}
                            onChange={e => setSelectedOwnerUid(e.target.value)}
                            className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[200px]"
                        >
                            <option value="__mine__">Mina offerter</option>
                            <option value="__all__">Alla användare</option>
                            {userList
                                .filter(u => u.uid !== user.uid)
                                .map(u => (
                                    <option key={u.uid} value={u.uid}>
                                        {u.retailerName ? `[ÅF] ${u.retailerName}` : u.email} ({u.quoteCount})
                                    </option>
                                ))}
                        </select>
                    )}
                    <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[180px]"
                    >
                        <option value="">Alla statusar</option>
                        <option value="draft">Utkast</option>
                        <option value="sent">Skickad</option>
                        <option value="won">Vunnen</option>
                        <option value="lost">Förlorad</option>
                        <option value="archived">Arkiverad</option>
                    </select>
                    <input 
                        type="text" 
                        value={searchFilter} 
                        onChange={e => setSearchFilter(e.target.value)}
                        placeholder="Sök företag eller referens"
                        className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[180px]"
                    />
                </div>
                <div className="text-sm text-text-secondary">
                    {loading || loadingAllUsers ? 'Laddar offerter...' : (quotes.length === 0 ? 'Inga offerter matchar filtret.' : `Visar ${quotes.length} offert${quotes.length === 1 ? '' : 'er'}.`)}
                </div>
            </div>

            <div>
                {loading ? (
                    <div className="text-center py-16 text-text-secondary">Laddar offerter...</div>
                ) : error ? (
                    <div className="text-center py-16 text-text-secondary bg-panel-bg border border-dashed border-panel-border rounded-lg">
                        <h3 className="mt-0 mb-2 text-lg font-semibold">Kunde inte ladda offerter</h3>
                        <p>{error}</p>
                    </div>
                ) : quotes.length === 0 ? (
                    <div className="text-center py-16 text-text-secondary bg-panel-bg border border-dashed border-panel-border rounded-lg">
                        <h3 className="mt-0 mb-2 text-lg font-semibold">Inga sparade offerter</h3>
                        <p>Skapa en ny offert i dashboarden och klicka på "Spara Offert".</p>
                    </div>
                ) : (
                    quotes.map(quote => {
                        const status = normalizeQuoteStatus(quote.status);
                        const isRevisionsVisible = visibleRevisions[quote.quoteId];
                        const revisions = revisionCache[quote.quoteId];
                        const showOwnerBadge = canViewEverything && selectedOwnerUid !== '__mine__' && quote.ownerUid;

                        return (
                            <article key={`${quote.ownerUid || ''}_${quote.quoteId}`} className="bg-panel-bg border border-panel-border rounded-lg p-6 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center transition-all hover:bg-gray-800 hover:border-white/30 gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="m-0 text-xl font-semibold">{quote.company || quote.customerName || 'Okänd kund'}</h3>
                                        <span className={`inline-flex items-center rounded-full text-[11px] tracking-wider uppercase font-bold px-2 py-0.5 status-${status}`}>
                                            {STATUS_LABELS[status]}
                                        </span>
                                    </div>
                                    <p className="m-0 text-text-secondary text-sm leading-relaxed">
                                        <strong>Företag:</strong> {quote.company || quote.customerName || '-'} &nbsp;|&nbsp; <strong>Projektreferens:</strong> {quote.reference || '-'} &nbsp;|&nbsp; <strong>Er referens:</strong> {quote.customerReference || '-'}
                                    </p>
                                    <p className="m-0 text-text-secondary text-sm leading-relaxed">
                                        <strong>Uppdaterad:</strong> {formatDateTime(quote.updatedAtMs)} &nbsp;|&nbsp; <strong>Version:</strong> v{quote.latestVersion}
                                    </p>
                                    {showOwnerBadge && (
                                        <p className="m-0 text-text-secondary text-xs leading-relaxed mt-1 opacity-70">
                                            <strong>Användare:</strong> {quote.retailerName ? `[ÅF] ${quote.retailerName}` : (quote.savedBy || quote.ownerUid)}
                                        </p>
                                    )}
                                    <div className="mt-2 text-success-color font-semibold">Totalt: {formatSek(quote.totalSek || 0)} SEK</div>
                                </div>
                                <div className="flex gap-2 flex-col items-stretch w-full md:w-auto mt-4 md:mt-0 min-w-[140px]">
                                    {quoteLifecycleEnabled && (
                                        <label className="flex flex-col gap-1 text-xs text-text-secondary mb-1">
                                            <span>Status</span>
                                            <select 
                                                value={status} 
                                                onChange={e => handleStatusChange(quote, e.target.value)}
                                                className="px-2 py-1.5 rounded-md border border-panel-border bg-panel-bg text-text-primary outline-none focus:border-white/50 w-full"
                                            >
                                                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                                                    <option key={k} value={k}>{label}</option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    <button className="px-4 py-2 text-sm w-full rounded font-semibold bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 transition-colors" onClick={() => openLatestQuote(quote)}>
                                        {quoteLifecycleEnabled ? 'Öppna senaste' : 'Öppna offert'}
                                    </button>
                                    {quoteLifecycleEnabled && (
                                        <button className="px-4 py-2 text-sm border border-panel-border bg-transparent text-text-primary hover:bg-white/5 rounded w-full" onClick={() => toggleRevisions(quote)}>
                                            Visa revisioner
                                        </button>
                                    )}
                                    <button className="px-4 py-2 text-sm bg-transparent border border-danger-color hover:bg-danger-color/10 text-danger-color rounded w-full" onClick={() => deleteQuote(quote)}>
                                        Ta bort
                                    </button>
                                </div>

                                {isRevisionsVisible && (
                                    <div className="mt-4 w-full" style={{ gridColumn: '1 / -1' }}>
                                        {!revisions ? (
                                            <p className="text-text-secondary text-sm m-0">Laddar revisioner...</p>
                                        ) : revisions.length === 0 ? (
                                            <p className="text-text-secondary text-sm m-0">Inga revisioner hittades.</p>
                                        ) : (
                                            <div className="flex flex-col gap-2 pt-2">
                                                {revisions.map(rev => (
                                                    <button 
                                                        key={rev.revisionId} 
                                                        className="w-full text-left border border-panel-border bg-white/5 hover:bg-white/10 rounded-md text-text-primary text-xs px-3 py-2 flex justify-between gap-3 cursor-pointer transition-colors"
                                                        onClick={() => openSpecificRevision(quote, rev.revisionId)}
                                                    >
                                                        <span>v{rev.version} - {formatDateTime(rev.savedAtMs)}</span>
                                                        <span>{rev.changeNote || ''}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })
                )}
            </div>
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
