import React, { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { quoteRepository } from '../services/quoteRepositoryClient';
import { normalizeQuoteStatus, applyQuoteFilters, sortQuotes } from '../services/quoteRepository';
import { notifyError, notifyInfo, notifySuccess, confirmAction } from '../services/notificationService';
import { db, collection, getDocs } from '../services/firebase';
import { getErrorMessage } from '../utils/runtime';
import { buildQuoteRevisionLink, parseQuoteRevisionLinkParams } from '../navigation/quoteLinks';
import { buildHistoryOpenQuotePayload } from './historyPayload';
import type {
    HistoryOwnerOption,
    HistoryProps,
    HistoryQuoteRow,
    QuoteRevision,
    QuoteStatus
} from '../types/contracts';

type HistoryOwnerSelection = '__mine__' | '__all__' | string;

const STATUS_LABELS: Record<QuoteStatus, string> = {
    draft: 'Utkast',
    sent: 'Skickad',
    won: 'Vunnen',
    lost: 'Förlorad',
    archived: 'Arkiverad'
};

export function History({ onBack, onOpenQuote }: HistoryProps) {
    const { user, canAccessQuoteHistory, canViewEverything } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [quotes, setQuotes] = useState<HistoryQuoteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchFilter, setSearchFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [originFilter, setOriginFilter] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [revisionCache, setRevisionCache] = useState<Record<string, QuoteRevision[]>>({});
    const [visibleRevisions, setVisibleRevisions] = useState<Record<string, boolean>>({});
    const [allUsersQuotes, setAllUsersQuotes] = useState<Array<HistoryQuoteRow & { ownerUid: string }>>([]);
    const [userList, setUserList] = useState<HistoryOwnerOption[]>([]);
    const [selectedOwnerUid, setSelectedOwnerUid] = useState<HistoryOwnerSelection>('__mine__');
    const [loadingAllUsers, setLoadingAllUsers] = useState(false);
    const allUsersQuotesRef = useRef<Array<HistoryQuoteRow & { ownerUid: string }>>([]);

    const quoteLifecycleEnabled = typeof window === 'undefined'
        ? true
        : window.FEATURE_QUOTE_LIFECYCLE !== false;
    const isAdminBrowsing = canViewEverything && selectedOwnerUid !== '__mine__';

    useEffect(() => {
        allUsersQuotesRef.current = allUsersQuotes;
    }, [allUsersQuotes]);

    const copyQuoteLink = useCallback(async ({
        quoteId,
        version,
        ownerUid
    }: {
        quoteId: string;
        version: number;
        ownerUid?: string | null;
    }): Promise<void> => {
        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Clipboard API unavailable.');
            }

            const path = buildQuoteRevisionLink({ quoteId, version, ownerUid });
            await navigator.clipboard.writeText(`${window.location.origin}${path}`);
            notifySuccess('L\u00e4nk kopierad.');
        } catch (copyError) {
            console.error('Failed to copy quote link:', copyError);
            notifyError('Kunde inte kopiera l\u00e4nken.');
        }
    }, []);

    useEffect(() => {
        if (!user?.uid || !canAccessQuoteHistory) return;

        const parsed = parseQuoteRevisionLinkParams(searchParams);
        if (!parsed) return;

        const requestedOwnerUid = parsed.ownerUid;
        const ownerUid = !requestedOwnerUid || requestedOwnerUid === user.uid
            ? user.uid
            : (canViewEverything ? requestedOwnerUid : null);

        if (!ownerUid) {
            notifyError('Du har inte beh\u00f6righet att \u00f6ppna den h\u00e4r offerten.');
            setSearchParams({}, { replace: true });
            return;
        }

        setSearchParams({}, { replace: true });

        void (async () => {
            try {
                const latestPayloadPromise = quoteRepository.getQuoteLatestRevision({
                    userId: ownerUid,
                    quoteId: parsed.quoteId
                });
                const revisionPromise = parsed.version > 0
                    ? quoteRepository.getQuoteRevisionByVersion({
                        userId: ownerUid,
                        quoteId: parsed.quoteId,
                        version: parsed.version
                    })
                    : Promise.resolve(null);

                const [latestPayload, specificRevision] = await Promise.all([
                    latestPayloadPromise,
                    revisionPromise
                ]);

                const revision = parsed.version > 0 ? specificRevision : latestPayload?.revision;
                if (!latestPayload?.metadata || !revision) {
                    notifyInfo('Offerten saknar sparad revision.');
                    return;
                }

                if (!revision.state) {
                    notifyInfo('Revisionen saknar sparat tillst\u00e5nd.');
                    return;
                }

                const nextState = buildHistoryOpenQuotePayload(
                    revision.state,
                    parsed.quoteId,
                    latestPayload.metadata.quoteNumber,
                    revision.version,
                    latestPayload.metadata.status
                );

                onOpenQuote?.(nextState);
            } catch (openError) {
                console.error('Failed to open quote link:', openError);
                notifyError(`Kunde inte \u00f6ppna offerten: ${getErrorMessage(openError, 'ok\u00e4nt fel')}`);
            }
        })();
    }, [canAccessQuoteHistory, canViewEverything, onOpenQuote, searchParams, setSearchParams, user?.uid]);

    useEffect(() => {
        if (!user?.uid || !canViewEverything) return;

        let cancelled = false;
        const loadAllUsers = async (): Promise<void> => {
            setLoadingAllUsers(true);
            try {
                const data = await quoteRepository.getAllUsersQuotes({ status: '', search: '' });
                if (cancelled) return;

                const retailersMap = new Map<string, string>();
                try {
                    const snapshot = await getDocs(collection(db, 'retailers'));
                    snapshot.forEach((docSnap) => {
                        const retailer = docSnap.data();
                        if (retailer.email) {
                            retailersMap.set(String(retailer.email).toLowerCase(), String(retailer.name || ''));
                        }
                    });
                } catch (innerError) {
                    console.error('Failed to load retailers for history', innerError);
                }

                data.forEach((quote) => {
                    if (!quote.retailerName) {
                        const email = String(quote.savedBy || quote.ownerUid || '').toLowerCase();
                        if (retailersMap.has(email)) {
                            quote.retailerName = retailersMap.get(email) || null;
                        }
                    }
                });

                setAllUsersQuotes(data);

                const userMap = new Map<string, HistoryOwnerOption>();
                data.forEach((quote) => {
                    if (quote.ownerUid && !userMap.has(quote.ownerUid)) {
                        userMap.set(quote.ownerUid, {
                            uid: quote.ownerUid,
                            email: quote.savedBy || quote.ownerUid,
                            retailerName: quote.retailerName || null,
                            quoteCount: 0
                        });
                    }

                    if (quote.ownerUid && userMap.has(quote.ownerUid)) {
                        const existing = userMap.get(quote.ownerUid);
                        if (existing) {
                            existing.quoteCount += 1;
                        }
                    }
                });

                setUserList(Array.from(userMap.values()));
            } catch (loadError) {
                console.error('Failed to load all users quotes:', loadError);
            } finally {
                if (!cancelled) {
                    setLoadingAllUsers(false);
                }
            }
        };

        void loadAllUsers();
        return () => {
            cancelled = true;
        };
    }, [canViewEverything, user?.uid]);

    const loadQuotes = useCallback(async (status: string, search: string, date: string, origin: string, sort: string): Promise<void> => {
        if (!user?.uid) return;

        setLoading(true);
        setError(null);

        try {
            let data: HistoryQuoteRow[];
            if (selectedOwnerUid === '__mine__') {
                data = await quoteRepository.getUserQuotes({
                    userId: user.uid,
                    status,
                    search,
                    dateFilter: date,
                    originFilter: origin,
                    sortBy: sort
                });
            } else if (selectedOwnerUid === '__all__') {
                const allQuotes = allUsersQuotesRef.current.length > 0
                    ? allUsersQuotesRef.current
                    : await quoteRepository.getAllUsersQuotes({ status: '', search: '' });

                data = sortQuotes(
                    applyQuoteFilters(allQuotes, { status, search, dateFilter: date, originFilter: origin }),
                    sort
                );
            } else {
                data = await quoteRepository.getUserQuotes({
                    userId: selectedOwnerUid,
                    status,
                    search,
                    dateFilter: date,
                    originFilter: origin,
                    sortBy: sort
                });
            }

            setQuotes(data);
            setRevisionCache({});
            setVisibleRevisions({});
        } catch (loadError) {
            console.error('Failed to load quotes:', loadError);
            setError(getErrorMessage(loadError, 'Okänt fel'));
        } finally {
            setLoading(false);
        }
    }, [selectedOwnerUid, user?.uid]);

    useEffect(() => {
        if (selectedOwnerUid !== '__all__' || allUsersQuotes.length === 0) {
            return;
        }

        void loadQuotes(statusFilter, searchFilter, dateFilter, originFilter, sortBy);
    }, [allUsersQuotes, dateFilter, loadQuotes, originFilter, searchFilter, selectedOwnerUid, sortBy, statusFilter]);

    useEffect(() => {
        if (!user?.uid || !canAccessQuoteHistory) return;

        const timer = setTimeout(() => {
            void loadQuotes(statusFilter, searchFilter, dateFilter, originFilter, sortBy);
        }, 220);

        return () => clearTimeout(timer);
    }, [canAccessQuoteHistory, loadQuotes, searchFilter, statusFilter, dateFilter, originFilter, sortBy, user?.uid]);

    const formatDateTime = (value: number): string => {
        const dateObj = new Date(Number(value) || Date.now());
        return dateObj.toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatSek = (value: number): string => Math.round(Number(value) || 0).toLocaleString('sv-SE');

    const getQuoteOwnerUid = (quote: HistoryQuoteRow): string => {
        if (quote.ownerUid) {
            return quote.ownerUid;
        }

        if (selectedOwnerUid !== '__mine__' && selectedOwnerUid !== '__all__') {
            return selectedOwnerUid;
        }

        if (isAdminBrowsing || selectedOwnerUid === '__all__') {
            return quote.ownerUid || user?.uid || '';
        }

        return user?.uid || '';
    };

    const getQuoteLinkOwnerUid = (quote: HistoryQuoteRow): string | null => (
        isAdminBrowsing ? (getQuoteOwnerUid(quote) || null) : null
    );

    const handleStatusChange = async (quote: HistoryQuoteRow, nextStatus: string): Promise<void> => {
        if (!quoteLifecycleEnabled || !user?.uid) return;

        const ownerUid = getQuoteOwnerUid(quote);
        try {
            const updated = await quoteRepository.updateQuoteStatus({
                userId: ownerUid,
                quoteId: quote.quoteId,
                status: nextStatus
            });
            setQuotes((previous) => previous.map((row) => (
                row.quoteId === quote.quoteId
                    ? { ...updated, ownerUid: quote.ownerUid }
                    : row
            )));
            notifySuccess('Status uppdaterad.');
        } catch (updateError) {
            console.error('Failed to update quote status:', updateError);
            notifyError('Kunde inte uppdatera status.');
            void loadQuotes(statusFilter, searchFilter, dateFilter, originFilter, sortBy);
        }
    };

    const toggleRevisions = async (quote: HistoryQuoteRow): Promise<void> => {
        if (!quoteLifecycleEnabled || !user?.uid) return;

        const quoteId = quote.quoteId;
        const ownerUid = getQuoteOwnerUid(quote);
        const isVisible = visibleRevisions[quoteId];

        if (isVisible) {
            setVisibleRevisions((previous) => ({ ...previous, [quoteId]: false }));
            return;
        }

        setVisibleRevisions((previous) => ({ ...previous, [quoteId]: true }));

        if (!revisionCache[quoteId]) {
            try {
                const revisions = await quoteRepository.getQuoteRevisions({
                    userId: ownerUid,
                    quoteId,
                    limit: 5
                });
                setRevisionCache((previous) => ({ ...previous, [quoteId]: revisions }));
            } catch (loadError) {
                console.error('Failed to load revisions:', loadError);
            }
        }
    };

    const openRevisionPayload = async (quoteId: string, revision: QuoteRevision): Promise<void> => {
        if (!revision.state) {
            notifyInfo('Revisionen saknar sparat tillstånd.');
            return;
        }

        const metadata = quotes.find((quote) => quote.quoteId === quoteId);
        const nextState = buildHistoryOpenQuotePayload(
            revision.state,
            quoteId,
            metadata?.quoteNumber || null,
            revision.version,
            metadata?.status || 'draft'
        );

        onOpenQuote?.(nextState);
    };

    const openLatestQuote = async (quote: HistoryQuoteRow): Promise<void> => {
        if (!user?.uid) return;

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
        } catch (openError) {
            console.error('Failed to open quote:', openError);
            notifyError(`Kunde inte öppna offerten: ${getErrorMessage(openError, 'okänt fel')}`);
        }
    };

    const duplicateQuote = async (quote: HistoryQuoteRow): Promise<void> => {
        if (!user?.uid) return;

        const ownerUid = getQuoteOwnerUid(quote);
        try {
            const payload = await quoteRepository.getQuoteLatestRevision({
                userId: ownerUid,
                quoteId: quote.quoteId
            });

            if (!payload?.revision) {
                notifyInfo('Offerten saknar sparad revision och kan inte dupliceras.');
                return;
            }
            if (!payload.revision.state) {
                notifyInfo('Offerten saknar sparat tillstånd och kan inte dupliceras.');
                return;
            }

            const nextState = buildHistoryOpenQuotePayload(
                payload.revision.state,
                null,
                null,
                0,
                'draft'
            );

            notifySuccess('Offert duplicerad som nytt utkast.');
            onOpenQuote?.(nextState);
        } catch (openError) {
            console.error('Failed to duplicate quote:', openError);
            notifyError(`Kunde inte duplicera offerten: ${getErrorMessage(openError, 'okänt fel')}`);
        }
    };

    const openSpecificRevision = async (quote: HistoryQuoteRow, revisionId: string): Promise<void> => {
        const cached = revisionCache[quote.quoteId] || [];
        const revision = cached.find((row) => row.revisionId === revisionId);
        if (!revision) {
            notifyInfo('Revisionen kunde inte hittas.');
            return;
        }

        await openRevisionPayload(quote.quoteId, revision);
    };

    const deleteQuote = async (quote: HistoryQuoteRow): Promise<void> => {
        const confirmed = await confirmAction({
            title: 'Ta bort offert',
            message: 'Är du säker på att du vill ta bort den här offerten och alla revisioner?',
            confirmText: 'Ta bort',
            cancelText: 'Avbryt',
            tone: 'danger'
        });
        if (!confirmed || !user?.uid) return;

        const ownerUid = getQuoteOwnerUid(quote);
        try {
            await quoteRepository.deleteQuote({ userId: ownerUid, quoteId: quote.quoteId });
            notifySuccess('Offerten togs bort.');
            void loadQuotes(statusFilter, searchFilter, dateFilter, originFilter, sortBy);
        } catch (deleteError) {
            console.error('Failed to delete quote:', deleteError);
            notifyError(`Kunde inte ta bort offerten: ${getErrorMessage(deleteError, 'okänt fel')}`);
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
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedOwnerUid(event.target.value)}
                            className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[200px]"
                        >
                            <option value="__mine__">Mina offerter</option>
                            <option value="__all__">Alla användare</option>
                            {userList
                                .filter((option) => option.uid !== user?.uid)
                                .map((option) => (
                                    <option key={option.uid} value={option.uid}>
                                        {option.retailerName ? `[ÅF] ${option.retailerName}` : option.email} ({option.quoteCount})
                                    </option>
                                ))}
                        </select>
                    )}
                    <select
                        value={statusFilter}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => setStatusFilter(event.target.value)}
                        className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[140px]"
                    >
                        <option value="">Alla statusar</option>
                        <option value="draft">Utkast</option>
                        <option value="sent">Skickad</option>
                        <option value="won">Vunnen</option>
                        <option value="lost">Förlorad</option>
                        <option value="archived">Arkiverad</option>
                    </select>
                    <select
                        value={dateFilter}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => setDateFilter(event.target.value)}
                        className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[140px]"
                    >
                        <option value="">Alla datum</option>
                        <option value="7days">Senaste 7 dagarna</option>
                        <option value="30days">Senaste 30 dagarna</option>
                        <option value="thisyear">I år</option>
                    </select>
                    {isAdminBrowsing && (
                        <select
                            value={originFilter}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => setOriginFilter(event.target.value)}
                            className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[140px]"
                        >
                            <option value="">Alla källor</option>
                            <option value="retailer">Endast Återförsäljare</option>
                            <option value="internal">Endast Interna</option>
                        </select>
                    )}
                    <select
                        value={sortBy}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => setSortBy(event.target.value)}
                        className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[140px]"
                    >
                        <option value="newest">Senast uppdaterad</option>
                        <option value="oldest">Äldst först</option>
                        <option value="highest-value">Högst värde</option>
                        <option value="lowest-value">Lägst värde</option>
                    </select>
                    <input
                        type="text"
                        value={searchFilter}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchFilter(event.target.value)}
                        placeholder="Sök företag eller referens"
                        className="px-3 py-2 rounded-md border border-panel-border bg-panel-bg text-text-primary min-w-[180px]"
                    />
                </div>
                <div className="text-sm text-text-secondary">
                    {loading || loadingAllUsers
                        ? 'Laddar offerter...'
                        : (quotes.length === 0 ? 'Inga offerter matchar filtret.' : `Visar ${quotes.length} offert${quotes.length === 1 ? '' : 'er'}.`)}
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
                        <p>Skapa en ny offert i dashboarden och klicka på "Spara offert".</p>
                    </div>
                ) : (
                    quotes.map((quote) => {
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
                                    {quote.latestChangeNote && (
                                        <p className="m-0 text-text-primary text-sm leading-relaxed mt-2 p-2 bg-black/20 rounded border border-white/5 italic">
                                            "{quote.latestChangeNote}"
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
                                                onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                                                    void handleStatusChange(quote, event.target.value);
                                                }}
                                                className="px-2 py-1.5 rounded-md border border-panel-border bg-panel-bg text-text-primary outline-none focus:border-white/50 w-full"
                                            >
                                                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                                    <option key={key} value={key}>{label}</option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm w-full rounded font-semibold bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 transition-colors"
                                        onClick={() => {
                                            void openLatestQuote(quote);
                                        }}
                                    >
                                        {quoteLifecycleEnabled ? 'Öppna senaste' : 'Öppna offert'}
                                    </button>
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm border border-panel-border bg-transparent text-text-primary hover:bg-white/5 rounded w-full transition-colors"
                                        onClick={() => {
                                            void duplicateQuote(quote);
                                        }}
                                    >
                                        Duplicera
                                    </button>
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm border border-panel-border bg-transparent text-text-primary hover:bg-white/5 rounded w-full transition-colors"
                                        onClick={() => {
                                            void copyQuoteLink({
                                                quoteId: quote.quoteId,
                                                version: quote.latestVersion,
                                                ownerUid: getQuoteLinkOwnerUid(quote)
                                            });
                                        }}
                                    >
                                        Kopiera länk
                                    </button>
                                    {quoteLifecycleEnabled && (
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm border border-panel-border bg-transparent text-text-primary hover:bg-white/5 rounded w-full"
                                            onClick={() => {
                                                void toggleRevisions(quote);
                                            }}
                                        >
                                            Visa revisioner
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="px-4 py-2 text-sm bg-transparent border border-danger-color hover:bg-danger-color/10 text-danger-color rounded w-full"
                                        onClick={() => {
                                            void deleteQuote(quote);
                                        }}
                                    >
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
                                                {revisions.map((revision) => (
                                                    <div
                                                        key={revision.revisionId}
                                                        className="w-full border border-panel-border bg-white/5 hover:bg-white/10 rounded-md text-text-primary text-xs px-3 py-2 flex items-center justify-between gap-3 transition-colors"
                                                    >
                                                        <button
                                                            type="button"
                                                            className="flex-1 text-left flex justify-between gap-3"
                                                            onClick={() => {
                                                                void openSpecificRevision(quote, revision.revisionId);
                                                            }}
                                                        >
                                                            <span>v{revision.version} - {formatDateTime(revision.savedAtMs)}</span>
                                                            <span>{revision.changeNote || ''}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="shrink-0 rounded border border-panel-border px-2 py-1 text-[11px] text-text-primary hover:bg-white/10"
                                                            onClick={() => {
                                                                void copyQuoteLink({
                                                                    quoteId: quote.quoteId,
                                                                    version: revision.version,
                                                                    ownerUid: getQuoteLinkOwnerUid(quote)
                                                                });
                                                            }}
                                                        >
                                                            Kopiera länk
                                                        </button>
                                                    </div>
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
                    <button type="button" onClick={onBack} className="px-4 py-2 bg-panel-bg border border-panel-border hover:bg-white/5 rounded text-text-primary transition-colors">
                        Tillbaka till Dashboard
                    </button>
                </div>
            )}
        </div>
    );
}
