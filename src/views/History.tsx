import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconLayoutList, IconPlus, IconSearch, IconTable } from '@tabler/icons-react';
import { Button } from '../components/ui/Button';
import { HistoryQuoteList, HISTORY_STATUS_LABELS, historyQuoteKey, formatHistorySek } from './HistoryQuoteList';
import { useAuth } from '../store/AuthContext';
import { quoteRepository } from '../services/quoteRepositoryClient';
import { normalizeQuoteStatus, applyQuoteFilters, sortQuotes } from '../services/quoteRepository';
import { notifyError, notifyInfo, notifySuccess, notifyWarn, confirmAction } from '../services/notificationService';
import { db, collection, getDocs } from '../services/firebase';
import { getErrorMessage } from '../utils/runtime';
import { buildQuoteRevisionLink, parseQuoteRevisionLinkParams } from '../navigation/quoteLinks';
import { buildHistoryOpenQuotePayload } from './historyPayload';
import { QuotePdfPreview } from '../components/features/QuotePdfPreview';
import type { QuotePreparationAudience } from '../services/quotePreparation';
import type {
    HistoryOwnerOption,
    HistoryProps,
    HistoryQuoteRow,
    QuoteRevision
} from '../types/contracts';

type HistoryOwnerSelection = '__mine__' | '__all__' | string;

export function History({ onBack, onOpenQuote, onStartQuote }: HistoryProps) {
    const { user, canAccessQuoteHistory, canViewEverything, canStartQuote, isRetailer, retailer } = useAuth();
    const [pdfPreview, setPdfPreview] = useState<{
        quote: HistoryQuoteRow;
        ownerUid: string;
        version?: number;
        audience?: QuotePreparationAudience;
    } | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [source, setSource] = useState<{ userId: string; rows: HistoryQuoteRow[] }>({ userId: '', rows: [] });
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
    const [allUsersUid, setAllUsersUid] = useState('');
    const [ownerDirectory, setOwnerDirectory] = useState<HistoryOwnerOption[]>([]);
    const [selectedOwnerUid, setSelectedOwnerUid] = useState<HistoryOwnerSelection>('__mine__');
    const [loadingAllUsers, setLoadingAllUsers] = useState(false);
    const [allUsersError, setAllUsersError] = useState<string | null>(null);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [layout, setLayout] = useState<'cards' | 'table'>('cards');
    const [revisionErrors, setRevisionErrors] = useState<Record<string, string>>({});
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const pendingRef = useRef(new Set<string>());
    const revisionRequests = useRef(new Set<string>());
    const requestVersion = useRef(0);
    const quoteMutations = useRef(new Map<string, Partial<HistoryQuoteRow> | null>());

    const quoteLifecycleEnabled = typeof window === 'undefined'
        ? true
        : window.FEATURE_QUOTE_LIFECYCLE !== false;
    const ownerScope = canViewEverything ? selectedOwnerUid : '__mine__';
    const isAdminBrowsing = ownerScope !== '__mine__';
    const scopedQuotes = useMemo(() => isAdminBrowsing
        ? allUsersUid === user?.uid ? allUsersQuotes.filter((quote) => ownerScope === '__all__' || quote.ownerUid === ownerScope) : []
        : source.userId === user?.uid ? source.rows : [], [isAdminBrowsing, allUsersUid, allUsersQuotes, ownerScope, source, user?.uid]);
    const overviewQuotes = useMemo(() => applyQuoteFilters(scopedQuotes, {
        search: searchFilter, dateFilter, originFilter: isAdminBrowsing ? originFilter : ''
    }), [scopedQuotes, searchFilter, dateFilter, isAdminBrowsing, originFilter]);
    const quotes = sortQuotes(applyQuoteFilters(overviewQuotes, { status: statusFilter }), sortBy);
    const busy = isAdminBrowsing ? loadingAllUsers || allUsersUid !== user?.uid : loading || source.userId !== user?.uid;
    const loadError = isAdminBrowsing ? allUsersError : error;
    const userList = useMemo(() => {
        if (allUsersUid !== user?.uid) return [];
        const counts = new Map<string, number>();
        for (const quote of allUsersQuotes) {
            counts.set(quote.ownerUid, (counts.get(quote.ownerUid) || 0) + 1);
        }
        return ownerDirectory.map((owner) => ({ ...owner, quoteCount: counts.get(owner.uid) || 0 }));
    }, [allUsersQuotes, allUsersUid, ownerDirectory, user?.uid]);

    const updateQuoteRows = (quote: HistoryQuoteRow, patch: Partial<HistoryQuoteRow> | null): void => {
        quoteMutations.current.set(historyQuoteKey(quote), patch);
        const update = <T extends HistoryQuoteRow>(rows: T[]): T[] => rows.flatMap((row) => (
            historyQuoteKey(row) !== historyQuoteKey(quote) ? [row] : patch ? [{ ...row, ...patch }] : []
        ));
        setSource((previous) => ({ ...previous, rows: update(previous.rows) }));
        setAllUsersQuotes(update);
    };

    const runAction = async (quote: HistoryQuoteRow, action: () => void | Promise<void>): Promise<void> => {
        const key = historyQuoteKey(quote);
        if (!user?.uid || !canAccessQuoteHistory || (!canViewEverything && quote.ownerUid !== user.uid) || pendingRef.current.has(key)) return;
        pendingRef.current.add(key);
        setPending((previous) => ({ ...previous, [key]: true }));
        try { await action(); }
        catch (actionError) {
            console.error('Quote history action failed:', actionError);
            notifyError('Åtgärden kunde inte slutföras. Försök igen.');
        } finally {
            pendingRef.current.delete(key);
            setPending((previous) => ({ ...previous, [key]: false }));
        }
    };

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

                onOpenQuote?.(nextState, {
                    crmDealId: latestPayload.metadata.crmDealId,
                    quoteOwnerUid: ownerUid
                });
            } catch (openError) {
                console.error('Failed to open quote link:', openError);
                notifyError(`Kunde inte \u00f6ppna offerten: ${getErrorMessage(openError, 'ok\u00e4nt fel')}`);
            }
        })();
    }, [canAccessQuoteHistory, canViewEverything, onOpenQuote, searchParams, setSearchParams, user?.uid]);

    useEffect(() => {
        if (!user?.uid || !canAccessQuoteHistory || !canViewEverything) return;

        let cancelled = false;
        const loadAllUsers = async (): Promise<void> => {
            setLoadingAllUsers(true);
            setAllUsersError(null);
            setAllUsersQuotes([]);
            setAllUsersUid(user.uid);
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

                if (cancelled) return;
                const owners = new Map<string, HistoryOwnerOption>();
                for (const quote of data) {
                    owners.set(quote.ownerUid, { uid: quote.ownerUid, email: quote.savedBy || quote.ownerUid,
                        retailerName: quote.retailerName || null, quoteCount: 0 });
                }
                setOwnerDirectory(Array.from(owners.values()));
                setAllUsersQuotes(data.flatMap((quote) => {
                    const key = historyQuoteKey(quote);
                    const patch = quoteMutations.current.get(key);
                    return !quoteMutations.current.has(key) ? [quote] : patch ? [{ ...quote, ...patch, ownerUid: quote.ownerUid }] : [];
                }));
            } catch (loadError) {
                console.error('Failed to load all users quotes:', loadError);
                if (!cancelled) setAllUsersError(getErrorMessage(loadError, 'Okänt fel'));
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
    }, [canAccessQuoteHistory, canViewEverything, refreshVersion, user?.uid]);

    const loadQuotes = useCallback(async (): Promise<void> => {
        if (!user?.uid || !canAccessQuoteHistory) return;
        const version = ++requestVersion.current;
        setLoading(true);
        setError(null);
        try {
            const data = await quoteRepository.getUserQuotes({ userId: user.uid, status: '', search: '' });
            if (version !== requestVersion.current) return;
            setSource({ userId: user.uid, rows: data.map((quote) => ({ ...quote, ownerUid: quote.ownerUid || user.uid })) });
        } catch (loadError) {
            if (version !== requestVersion.current) return;
            setSource({ userId: user.uid, rows: [] });
            setError(getErrorMessage(loadError, 'Okänt fel'));
        } finally {
            if (version === requestVersion.current) setLoading(false);
        }
    }, [canAccessQuoteHistory, user?.uid]);

    useEffect(() => {
        quoteMutations.current.clear();
        setRevisionCache({});
        setVisibleRevisions({});
        setRevisionErrors({});
        void loadQuotes();
        return () => { requestVersion.current += 1; };
    }, [loadQuotes, refreshVersion]);

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

    const previewQuote = (quote: HistoryQuoteRow, version?: number): void => {
        if (!user?.uid || !canAccessQuoteHistory) return;
        const ownerUid = getQuoteOwnerUid(quote);
        if (ownerUid !== user.uid && !canViewEverything) return;
        setPdfPreview({
            quote,
            ownerUid,
            version,
            audience: isRetailer && ownerUid === user.uid
                ? { isRetailer: true, allowedPdfThemes: retailer?.pdfThemes || [] }
                : undefined
        });
    };

    const handleCrmRepair = async (quote: HistoryQuoteRow): Promise<void> => {
        if (!canViewEverything || !user?.uid || !quote.crmSynchronizationIssue) return;
        const quoteRef = {
            ownerUid: getQuoteOwnerUid(quote),
            quoteId: quote.quoteId
        };

        try {
            const { quoteSave } = await import('../services/quoteSaveService');
            let outcome = await quoteSave.repairCrm({
                actor: user,
                quote: quoteRef,
                canManageAllQuotes: true
            });

            if (outcome.status === 'needs-relink') {
                const confirmed = await confirmAction({
                    title: 'Koppla om CRM-länken?',
                    message: 'Affären eller offerten är redan kopplad. En omkoppling lossar den tidigare länken och kopplar den här offerten i stället.',
                    confirmText: 'Koppla om',
                    cancelText: 'Avbryt',
                    tone: 'danger'
                });
                if (!confirmed) return;
                outcome = await quoteSave.repairCrm({
                    actor: user,
                    quote: quoteRef,
                    canManageAllQuotes: true,
                    relink: true
                });
            }

            if (outcome.status === 'repaired' || outcome.status === 'no-repair-needed') {
                updateQuoteRows(quote, { crmSynchronizationIssue: null });
                notifySuccess('CRM-länken är reparerad.');
                return;
            }

            if (outcome.status === 'repair-pending') {
                notifyInfo('CRM-reparationen kunde inte slutföras ännu och försöks igen automatiskt.');
            }
        } catch (repairError) {
            console.error('Failed to repair CRM link:', repairError);
            notifyError('Kunde inte reparera CRM-länken.');
        }
    };

    const handleStatusChange = async (quote: HistoryQuoteRow, nextStatus: string): Promise<void> => {
        if (!quoteLifecycleEnabled || !user?.uid) return;

        const ownerUid = getQuoteOwnerUid(quote);
        try {
            let updated: HistoryQuoteRow;
            if (canViewEverything && quote.crmDealId) {
                const normalizedStatus = normalizeQuoteStatus(nextStatus);
                const { syncCrmDealFromQuote } = await import('../services/crmQuoteWorkflow');
                await syncCrmDealFromQuote({
                    metadata: {
                        ...quote,
                        status: normalizedStatus
                    },
                    quoteOwnerUid: ownerUid,
                    actor: {
                        uid: user.uid,
                        email: user.email || ''
                    }
                });
                updated = {
                    ...quote,
                    status: normalizedStatus,
                    updatedAtMs: Date.now()
                };
            } else {
                updated = await quoteRepository.updateQuoteStatus({
                    userId: ownerUid,
                    quoteId: quote.quoteId,
                    status: nextStatus
                });
            }
            updateQuoteRows(quote, updated);
            notifySuccess('Status uppdaterad.');
        } catch (updateError) {
            console.error('Failed to update quote status:', updateError);
            notifyError('Kunde inte uppdatera status.');
        }
    };

    const loadRevisions = async (quote: HistoryQuoteRow): Promise<void> => {
        const key = historyQuoteKey(quote);
        const ownerUid = getQuoteOwnerUid(quote);
        if (!quoteLifecycleEnabled || !user?.uid || (!canViewEverything && ownerUid !== user.uid) || revisionRequests.current.has(key)) return;
        revisionRequests.current.add(key);
        setRevisionErrors((previous) => ({ ...previous, [key]: '' }));
        try {
            const revisions = await quoteRepository.getQuoteRevisions({ userId: ownerUid, quoteId: quote.quoteId, limit: 5 });
            setRevisionCache((previous) => ({ ...previous, [key]: revisions }));
        } catch (loadError) {
            console.error('Failed to load revisions:', loadError);
            setRevisionErrors((previous) => ({ ...previous, [key]: 'Kunde inte ladda revisioner.' }));
        } finally { revisionRequests.current.delete(key); }
    };

    const toggleRevisions = (quote: HistoryQuoteRow): void => {
        if (!quoteLifecycleEnabled) return;
        const key = historyQuoteKey(quote);
        setVisibleRevisions((previous) => ({ ...previous, [key]: !previous[key] }));
        if (!visibleRevisions[key] && !revisionCache[key]) void loadRevisions(quote);
    };

    const openRevisionPayload = async (
        quoteId: string,
        revision: QuoteRevision,
        quoteOwnerUid: string
    ): Promise<void> => {
        if (!revision.state) {
            notifyInfo('Revisionen saknar sparat tillstånd.');
            return;
        }

        const metadata = quotes.find((quote) => quote.quoteId === quoteId && getQuoteOwnerUid(quote) === quoteOwnerUid);
        const nextState = buildHistoryOpenQuotePayload(
            revision.state,
            quoteId,
            metadata?.quoteNumber || null,
            revision.version,
            metadata?.status || 'draft'
        );

        onOpenQuote?.(nextState, {
            crmDealId: metadata?.crmDealId,
            quoteOwnerUid
        });
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

            await openRevisionPayload(quote.quoteId, payload.revision, ownerUid);
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
        const cached = revisionCache[historyQuoteKey(quote)] || [];
        const revision = cached.find((row) => row.revisionId === revisionId);
        if (!revision) {
            notifyInfo('Revisionen kunde inte hittas.');
            return;
        }

        await openRevisionPayload(quote.quoteId, revision, getQuoteOwnerUid(quote));
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
            updateQuoteRows(quote, null);
            notifySuccess('Offerten togs bort.');
            if (canViewEverything && quote.crmDealId) {
                try {
                    const { crmRepository } = await import('../services/crmRepository');
                    await crmRepository.unlinkDealFromQuote({
                        dealId: quote.crmDealId,
                        user: {
                            uid: user.uid,
                            email: user.email || ''
                        }
                    });
                } catch (crmError) {
                    console.error('Failed to unlink deleted quote from CRM:', crmError);
                    notifyWarn('Offerten togs bort, men CRM-länken kunde inte rensas automatiskt.');
                }
            }
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

    const controlClass = 'min-h-10 max-w-full rounded-control border border-control-border bg-input px-3 py-2 text-xs text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';
    const clearFilters = () => { setSearchFilter(''); setStatusFilter(''); setDateFilter(''); setOriginFilter(''); setSortBy('newest'); };
    const overview = [
        { status: '', label: 'Alla offerter', dot: 'bg-action' },
        { status: 'draft', label: 'Utkast', dot: 'bg-warning-solid' },
        { status: 'sent', label: 'Skickade', dot: 'bg-info-solid' },
        { status: 'won', label: 'Vunna', dot: 'bg-success-solid' }
    ];

    return (
        <div className="mx-auto w-full max-w-6xl space-y-5 py-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-text">Offerter</h1>
                        {!busy && !loadError && <span className="rounded-full border border-border bg-panel-bg px-2.5 py-0.5 text-xs tabular-nums text-text-muted">{quotes.length} st</span>}
                    </div>
                    <p className="mt-1 text-sm text-text-muted">Hantera kundofferter, förhandsgranska PDF och följ upp revisioner.</p>
                </div>
                {canStartQuote && onStartQuote && <Button variant="primary" size="sm" onClick={onStartQuote}><IconPlus size={17} aria-hidden="true" /> <span className="ml-1.5">Ny offert</span></Button>}
            </header>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Offertöversikt">
                {overview.map((item) => {
                    const rows = item.status ? overviewQuotes.filter((quote) => normalizeQuoteStatus(quote.status) === item.status) : overviewQuotes;
                    return <button key={item.status} type="button" disabled={busy || Boolean(loadError)} aria-pressed={statusFilter === item.status}
                        onClick={() => setStatusFilter(item.status)}
                        className={`rounded-panel border bg-panel-bg p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-60 ${statusFilter === item.status ? 'border-action ring-1 ring-action' : 'border-border hover:border-control-border'}`}>
                        <span className="flex items-center justify-between gap-2 text-xs text-text-muted"><span>{item.label} {!busy && !loadError && `(${rows.length})`}</span><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} /></span>
                        <span className="mt-1.5 block break-words text-base font-semibold tabular-nums text-text">{busy || loadError ? '–' : `${formatHistorySek(rows.reduce((total, quote) => total + (Number(quote.totalSek) || 0), 0))} SEK`}</span>
                    </button>;
                })}
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-panel border border-border bg-panel-bg p-3" role="search" aria-label="Filtrera offerter">
                <label className="relative min-w-0 basis-full lg:flex-1 lg:basis-64">
                    <span className="sr-only">Sök företag eller referens</span>
                    <IconSearch size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder="Sök företag eller referens" className={`${controlClass} w-full pl-9 placeholder:text-text-muted`} />
                </label>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-none">
                    {canViewEverything && <select aria-label="Offertägare" value={ownerScope} onChange={(event) => setSelectedOwnerUid(event.target.value)} className={`${controlClass} max-w-52`}>
                        <option value="__mine__">Mina offerter</option><option value="__all__">Alla användare</option>
                        {userList.filter((option) => option.uid !== user?.uid).map((option) => <option key={option.uid} value={option.uid}>{option.retailerName ? `[ÅF] ${option.retailerName}` : option.email} ({option.quoteCount})</option>)}
                    </select>}
                    <select aria-label="Filtrera status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={controlClass}>
                        <option value="">Alla statusar</option>{Object.entries(HISTORY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select aria-label="Datum" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className={controlClass}>
                        <option value="">Alla datum</option><option value="7days">Senaste 7 dagarna</option><option value="30days">Senaste 30 dagarna</option><option value="thisyear">I år</option>
                    </select>
                    {isAdminBrowsing && <select aria-label="Källa" value={originFilter} onChange={(event) => setOriginFilter(event.target.value)} className={controlClass}>
                        <option value="">Alla källor</option><option value="retailer">Endast Återförsäljare</option><option value="internal">Endast Interna</option>
                    </select>}
                    <select aria-label="Sortering" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={controlClass}>
                        <option value="newest">Senast uppdaterad</option><option value="oldest">Äldst först</option><option value="highest-value">Högst värde</option><option value="lowest-value">Lägst värde</option>
                    </select>
                    <div className="ml-auto flex shrink-0 gap-1 rounded-control border border-border p-0.5" role="group" aria-label="Visningsläge">
                        <Button size="sm" variant={layout === 'cards' ? 'primary' : 'ghost'} aria-label="Kortvy" title="Kortvy" aria-pressed={layout === 'cards'} className="!px-2.5" onClick={() => setLayout('cards')}><IconLayoutList size={18} aria-hidden="true" /></Button>
                        <Button size="sm" variant={layout === 'table' ? 'primary' : 'ghost'} aria-label="Tabellvy" title="Tabellvy" aria-pressed={layout === 'table'} className="!px-2.5" onClick={() => setLayout('table')}><IconTable size={18} aria-hidden="true" /></Button>
                    </div>
                </div>
            </div>

            <div aria-live="polite" className="text-xs text-text-muted">{busy ? 'Laddar offerter...' : loadError ? 'Offerterna kunde inte laddas.' : `Visar ${quotes.length} av ${scopedQuotes.length} offerter.`}</div>
            {busy ? <div role="status" aria-label="Laddar offerter" className="space-y-3">{[0, 1, 2].map((item) => <div key={item} aria-hidden="true" className="h-32 animate-pulse rounded-panel border border-border bg-panel-bg motion-reduce:animate-none" />)}</div>
                : loadError ? <div role="alert" className="rounded-panel border border-border bg-panel-bg px-5 py-12 text-center">
                    <h2 className="text-lg font-semibold text-text">Kunde inte ladda offerter</h2><p className="my-3 text-sm text-text-muted">{loadError}</p><Button onClick={() => setRefreshVersion((value) => value + 1)}>Försök igen</Button>
                </div> : quotes.length === 0 ? <div className="rounded-panel border border-dashed border-border bg-panel-bg px-5 py-12 text-center">
                    <h2 className="text-lg font-semibold text-text">{scopedQuotes.length ? 'Inga offerter matchar filtret' : 'Inga sparade offerter'}</h2>
                    <p className="mb-4 mt-2 text-sm text-text-muted">{scopedQuotes.length ? 'Prova en annan sökning eller rensa filtren.' : 'Skapa en ny offert och klicka på ”Spara offert”.'}</p>
                    {scopedQuotes.length > 0 && <Button onClick={clearFilters}>Rensa filter</Button>}
                </div> : <HistoryQuoteList quotes={quotes} layout={layout} lifecycleEnabled={quoteLifecycleEnabled} showOwners={isAdminBrowsing} canRepair={canViewEverything}
                    pending={pending} visibleRevisions={visibleRevisions} revisionCache={revisionCache} revisionErrors={revisionErrors}
                    actions={{
                        open: (quote) => { void runAction(quote, () => openLatestQuote(quote)); },
                        preview: previewQuote,
                        copy: (quote, version) => { void runAction(quote, () => copyQuoteLink({ quoteId: quote.quoteId, version: version ?? quote.latestVersion, ownerUid: getQuoteLinkOwnerUid(quote) })); },
                        revisions: toggleRevisions,
                        retryRevisions: (quote) => { void loadRevisions(quote); },
                        openRevision: (quote, revisionId) => { void runAction(quote, () => openSpecificRevision(quote, revisionId)); },
                        duplicate: (quote) => { void runAction(quote, () => duplicateQuote(quote)); },
                        remove: (quote) => { void runAction(quote, () => deleteQuote(quote)); },
                        repair: (quote) => { void runAction(quote, () => handleCrmRepair(quote)); },
                        status: (quote, status) => { void runAction(quote, () => handleStatusChange(quote, status)); }
                    }} />}
            {pdfPreview && canAccessQuoteHistory && user?.uid && (canViewEverything || pdfPreview.ownerUid === user.uid) && (
                <QuotePdfPreview key={`${pdfPreview.ownerUid}/${pdfPreview.quote.quoteId}/${pdfPreview.version ?? 'latest'}`} {...pdfPreview} onClose={() => setPdfPreview(null)} />
            )}
            {onBack && <div className="pt-1 text-center"><Button onClick={onBack} variant="ghost" size="sm">Tillbaka till Dashboard</Button></div>}
        </div>
    );
}
