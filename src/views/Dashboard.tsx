import React, { useCallback, useEffect, useState } from 'react';
import {
    IconChevronRight,
    IconClipboardList,
    IconFileText,
    IconHistory,
    IconPackage,
    IconPencil,
    IconTargetArrow,
    type TablerIcon
} from '@tabler/icons-react';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import { getCatalogLineIds, getCatalogLineName } from '../data/catalogLookup';
import {
    formatActivityMetadata,
    getActivityLogVisual,
    normalizeActivityLog
} from '../services/activityLogService';
import { db, collection, query, orderBy, limit, getDocs } from '../services/firebase';
import {
    getOrderRequestStatusLabel,
    orderRequestService
} from '../services/orderRequestService';
import { useAuth } from '../store/AuthContext';
import type {
    DashboardProps,
    DashboardQuoteDraftSummary,
    OrderRequestRecord,
    RetailerRecord
} from '../types/contracts';

type ActivityLogEntry = ReturnType<typeof normalizeActivityLog>;
type StatusTone = 'neutral' | 'success' | 'warning';

const ADMIN_DASHBOARD_LIMIT = 3;

interface FormattedDateTime {
    dateTime: string;
    label: string;
}

interface RetailerLineSummary {
    id: string;
    name: string;
    discountPct: number;
}

interface QuoteDraftPanelProps {
    onContinueQuote?: () => void;
    onStartQuote?: () => void;
    quoteDraftSummary?: DashboardQuoteDraftSummary | null;
}

interface PriceListPanelProps {
    onOpenPriceList?: () => void;
}

interface DashboardLauncherCardProps {
    badgeBgClass?: string;
    description: string;
    emoji: string;
    href?: string;
    hoverBorderClass?: string;
    icon?: TablerIcon;
    label: string;
    onClick?: () => void;
}

function formatCurrencySek(value: number): string {
    return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatFeedDateTime(value: number | null | undefined): FormattedDateTime | null {
    if (!Number.isFinite(value) || Number(value) <= 0) {
        return null;
    }

    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return {
        dateTime: date.toISOString(),
        label: `${date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`
    };
}

function formatDraftUpdatedAt(value: number | null | undefined): FormattedDateTime | null {
    if (!Number.isFinite(value) || Number(value) <= 0) {
        return null;
    }

    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return {
        dateTime: date.toISOString(),
        label: new Intl.DateTimeFormat('sv-SE', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date)
    };
}

function getOrderRequestStatusTone(status: string): StatusTone {
    switch (status) {
        case 'completed':
            return 'success';
        case 'new':
            return 'warning';
        case 'reviewing':
        default:
            return 'neutral';
    }
}

function getOrderRequestStatusEmoji(status: string): string {
    switch (status) {
        case 'completed':
            return '✅';
        case 'new':
            return '🆕';
        case 'reviewing':
        default:
            return '🔍';
    }
}

function getProductLineEmoji(lineId: string): string {
    if (lineId === 'BaHaMa') return '☂️';
    if (lineId === 'ClickitUp') return '🪟';
    if (lineId === 'ClickitUpFixed') return '📐';
    return '🌿';
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

function QuoteDraftPanel({
    onContinueQuote,
    onStartQuote,
    quoteDraftSummary
}: QuoteDraftPanelProps) {
    const draftUpdatedAt = formatDraftUpdatedAt(quoteDraftSummary?.updatedAtMs);

    return (
        <Panel
            title={quoteDraftSummary ? 'Pågående offertutkast' : 'Skapa en offert'}
            description={quoteDraftSummary
                ? 'Fortsätt där du slutade eller starta om med ett tomt utkast.'
                : 'Välj produkter, konfigurera, prissätt och skapa kundens offert.'}
        >
            <div className="p-5 sm:p-6">
                {quoteDraftSummary && (
                    <div className="mb-5 rounded-panel border border-indigo-500/30 bg-indigo-500/10 p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="m-0 text-base font-semibold text-text">
                                    <span aria-hidden="true">👤 </span>{quoteDraftSummary.customerLabel}
                                </p>
                                <p className="mb-0 mt-1 text-sm text-text-muted">
                                    <span aria-hidden="true">📍 </span>{quoteDraftSummary.stepLabel}
                                </p>
                            </div>
                            <StatusChip tone="warning"><span aria-hidden="true">⚡ </span>Utkast</StatusChip>
                        </div>
                        {(quoteDraftSummary.reference || quoteDraftSummary.quoteNumber) && (
                            <p className="mb-0 mt-3 text-sm text-text-muted">
                                {quoteDraftSummary.reference ? `Referens: ${quoteDraftSummary.reference}` : null}
                                {quoteDraftSummary.reference && quoteDraftSummary.quoteNumber ? ' · ' : null}
                                {quoteDraftSummary.quoteNumber ? `Offert ${quoteDraftSummary.quoteNumber}` : null}
                            </p>
                        )}
                        {draftUpdatedAt && (
                            <time
                                className="mt-2 block text-xs text-text-muted"
                                dateTime={draftUpdatedAt.dateTime}
                            >
                                <span aria-hidden="true">⏱️ </span>Senast ändrad {draftUpdatedAt.label}
                            </time>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-3">
                    {quoteDraftSummary && onContinueQuote && (
                        <Button onClick={onContinueQuote} size="lg" variant="primary">
                            <span aria-hidden="true">▶️ </span>Fortsätt offert
                        </Button>
                    )}
                    {onStartQuote && (
                        <Button
                            onClick={onStartQuote}
                            size="lg"
                            variant={quoteDraftSummary ? 'secondary' : 'primary'}
                        >
                            <span aria-hidden="true">➕ </span>{quoteDraftSummary ? 'Ny offert' : 'Skapa ny offert'}
                        </Button>
                    )}
                </div>
            </div>
        </Panel>
    );
}

function PriceListPanel({ onOpenPriceList }: PriceListPanelProps) {
    return (
        <Panel
            title="Prislista"
            description="Sök snabbt bland produkter, storlekar och tillbehör utan att starta en offert."
        >
            <div className="p-5 sm:p-6">
                <Button onClick={onOpenPriceList} disabled={!onOpenPriceList} size="lg">
                    Öppna prislistan
                </Button>
            </div>
        </Panel>
    );
}

function DashboardLauncherCard({
    badgeBgClass = 'bg-action/10 text-action border border-action/20',
    description,
    emoji,
    href,
    hoverBorderClass = 'hover:border-action/60 hover:bg-action/5',
    icon: Icon,
    label,
    onClick
}: DashboardLauncherCardProps) {
    const className = [
        'group grid min-h-36 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4',
        'rounded-panel border border-border bg-surface-raised p-5 text-left text-text shadow-sm',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        hoverBorderClass,
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-60 sm:gap-5'
    ].join(' ');

    const content = (
        <>
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-inner transition-transform duration-200 group-hover:scale-110 ${badgeBgClass}`}>
                <span aria-hidden="true">{emoji}</span>
            </div>
            <span className="min-w-0">
                <span className="block text-lg font-semibold tracking-tight text-text group-hover:text-action">
                    {label}
                </span>
                <span className="mt-1 line-clamp-2 block break-words text-sm leading-6 text-text-muted">
                    {description}
                </span>
            </span>
            <IconChevronRight
                aria-hidden="true"
                className="shrink-0 text-text-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-action"
                size={24}
                stroke={1.8}
            />
        </>
    );

    if (href) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
            >
                {content}
            </a>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={className}
        >
            {content}
        </button>
    );
}

export function Dashboard({
    onStartQuote,
    onContinueQuote,
    onOpenCrm,
    onOpenInventory,
    onOpenPlanner,
    onOpenSketch,
    onOpenActivity,
    onOpenRetailerOrders,
    onOpenPriceList,
    quoteDraftSummary
}: DashboardProps) {
    const {
        canViewEverything,
        canStartQuote,
        canAccessSketch,
        isRetailer,
        retailer
    } = useAuth();
    const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
    const [logsLoading, setLogsLoading] = useState(canViewEverything);
    const [logsError, setLogsError] = useState(false);
    const [recentOrderRequests, setRecentOrderRequests] = useState<OrderRequestRecord[]>([]);
    const [orderRequestsLoading, setOrderRequestsLoading] = useState(canViewEverything);
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
            const snapshot = await getDocs(query(
                logsRef,
                orderBy('createdAt', 'desc'),
                limit(ADMIN_DASHBOARD_LIMIT)
            ));
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
            const nextRequests = await orderRequestService.listRecentOrderRequests({
                limit: ADMIN_DASHBOARD_LIMIT
            });
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

    if (isRetailer) {
        return (
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 animate-slide-in">
                <PageHeader
                    eyebrow="Återförsäljarportal"
                    title={`Välkommen, ${retailer?.name || 'er retailerprofil'}`}
                    description="Skapa offerter från de produktlinjer och rabatter som ingår i ert avtal."
                />

                <QuoteDraftPanel
                    onContinueQuote={onContinueQuote}
                    onStartQuote={canStartQuote ? onStartQuote : undefined}
                    quoteDraftSummary={quoteDraftSummary}
                />

                <PriceListPanel onOpenPriceList={onOpenPriceList} />

                <Panel
                    title="Aktiva produktlinjer och rabatter"
                    description="Rabatten används som utgångspunkt när ni väljer produktlinje i offertflödet."
                >
                    {retailerLineSummaries.length === 0 ? (
                        <p className="m-5 rounded-panel border border-warning/35 bg-warning-bg p-4 text-sm text-warning-text sm:m-6">
                            Inga produktlinjer är aktiva för kontot ännu. Kontakta Brixx om ni behöver utöka sortimentet.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
                            {retailerLineSummaries.map((line) => (
                                <article
                                    key={line.id}
                                    className="rounded-panel border border-border bg-surface p-5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-text">
                                            <span>{getProductLineEmoji(line.id)}</span>
                                            <span>{line.name}</span>
                                        </h2>
                                        <StatusChip tone="success">{line.discountPct}% rabatt</StatusChip>
                                    </div>
                                    <p className="mb-0 mt-3 text-sm text-text-muted">
                                        Standardrabatt för nya offerter inom produktlinjen.
                                    </p>
                                </article>
                            ))}
                        </div>
                    )}
                </Panel>
            </div>
        );
    }

    if (canAccessSketch && !canStartQuote) {
        return (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 animate-slide-in">
                <PageHeader
                    eyebrow="Din arbetsyta"
                    title="Skissverktyg"
                    description="Rita uteserveringar och beräkna lämpliga ClickitUp-sektioner."
                />
                <Panel>
                    <div className="p-6">
                        <h2 className="m-0 text-xl font-semibold text-text">Fortsätt till ritbordet</h2>
                        <p className="mb-5 mt-2 text-sm text-text-muted">
                            Skapa en ny skiss eller fortsätt på det senast sparade utkastet.
                        </p>
                        <Button onClick={onOpenSketch} size="lg" variant="primary">
                            Öppna skissverktyget
                        </Button>
                    </div>
                </Panel>
            </div>
        );
    }

    if (!canStartQuote && !canAccessSketch) {
        return (
            <div className="mx-auto w-full max-w-3xl animate-slide-in">
                <Panel title="Ingen arbetsyta tilldelad">
                    <p className="m-0 p-6 text-sm text-text-muted">
                        Kontakta administratören för att få åtkomst till en arbetsyta.
                    </p>
                </Panel>
            </div>
        );
    }

    if (canViewEverything) {
        const hasResumableDraft = Boolean(quoteDraftSummary && onContinueQuote);
        const launcherItems: DashboardLauncherCardProps[] = [
            {
                badgeBgClass: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/30',
                description: hasResumableDraft && quoteDraftSummary
                    ? `${quoteDraftSummary.customerLabel} · ${quoteDraftSummary.stepLabel}`
                    : 'Starta ett nytt offertflöde.',
                emoji: hasResumableDraft ? '📄' : '➕',
                hoverBorderClass: 'hover:border-indigo-500/60 hover:bg-indigo-500/5',
                label: hasResumableDraft ? 'Fortsätt offert' : 'Skapa ny offert',
                onClick: hasResumableDraft ? onContinueQuote : onStartQuote
            },
            {
                badgeBgClass: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-500/30',
                description: 'Sök produkter, storlekar och tillbehör.',
                emoji: '🏷️',
                hoverBorderClass: 'hover:border-cyan-500/60 hover:bg-cyan-500/5',
                label: 'Prislista',
                onClick: onOpenPriceList
            },
            {
                badgeBgClass: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/30',
                description: 'Samla kunder, affärer och erbjudanden.',
                emoji: '🎯',
                hoverBorderClass: 'hover:border-purple-500/60 hover:bg-purple-500/5',
                label: 'Sälj-CRM',
                onClick: onOpenCrm
            },
            {
                badgeBgClass: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30',
                description: 'Uppdatera lagersaldon och historik.',
                emoji: '📦',
                hoverBorderClass: 'hover:border-emerald-500/60 hover:bg-emerald-500/5',
                label: 'Lagersaldo',
                onClick: onOpenInventory
            },
            {
                badgeBgClass: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30',
                description: 'Skissa snabbt och beräkna optimalt.',
                emoji: '✏️',
                hoverBorderClass: 'hover:border-amber-500/60 hover:bg-amber-500/5',
                label: 'Rita uteservering',
                onClick: onOpenSketch
            },
            {
                badgeBgClass: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/30',
                description: 'Se skapade offerter och exporter.',
                emoji: '📜',
                hoverBorderClass: 'hover:border-sky-500/60 hover:bg-sky-500/5',
                label: 'Aktivitetslogg',
                onClick: onOpenActivity
            },
            {
                badgeBgClass: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/30',
                description: 'Planera och följ upp projekt.',
                emoji: '📋',
                hoverBorderClass: 'hover:border-rose-500/60 hover:bg-rose-500/5',
                label: 'Planering',
                onClick: onOpenPlanner
            }
        ];

        return (
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 pb-4 animate-slide-in sm:gap-8">
                <header className="px-2 pt-3 text-center sm:pt-5">
                    <h1 className="m-0 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
                        Välkommen till Brixx portal
                    </h1>
                    <p className="mx-auto mb-0 mt-2 max-w-lg text-sm leading-relaxed text-text-muted">
                        Snabb och visuell översikt över dina verktyg, offerter och aktiviteter.
                    </p>
                </header>

                <nav
                    aria-label="Administrationsverktyg"
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                    {launcherItems.map((item) => (
                        <DashboardLauncherCard key={item.label} {...item} />
                    ))}
                </nav>

                <div className="grid grid-cols-1 border-t border-border lg:grid-cols-2">
                    <section
                        aria-busy={orderRequestsLoading}
                        aria-labelledby="recent-order-requests-title"
                        className="min-w-0 py-5 lg:pr-8"
                    >
                        <header className="mb-2 flex min-h-10 items-center justify-between gap-4 px-1">
                            <h2
                                id="recent-order-requests-title"
                                className="m-0 flex items-center gap-2 text-lg font-semibold text-text"
                            >
                                <span aria-hidden="true" className="text-xl">📥</span> Senaste orderförfrågningar
                            </h2>
                            {onOpenRetailerOrders && (
                                <Button onClick={onOpenRetailerOrders} size="sm" variant="ghost">
                                    Visa alla
                                </Button>
                            )}
                        </header>

                        {orderRequestsLoading ? (
                            <p role="status" className="m-0 py-8 text-center text-sm text-text-muted">
                                Laddar orderförfrågningar…
                            </p>
                        ) : orderRequestsError ? (
                            <div
                                role="alert"
                                className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-danger-text"
                            >
                                <span>Kunde inte ladda orderförfrågningar just nu.</span>
                                <Button
                                    onClick={() => {
                                        void fetchRecentOrderRequests();
                                    }}
                                    size="sm"
                                    variant="ghost"
                                >
                                    Försök igen
                                </Button>
                            </div>
                        ) : recentOrderRequests.length === 0 ? (
                            <p className="m-0 py-8 text-center text-sm text-text-muted">
                                Inga orderförfrågningar har registrerats ännu.
                            </p>
                        ) : (
                            <ul className="m-0 list-none p-0">
                                {recentOrderRequests.slice(0, ADMIN_DASHBOARD_LIMIT).map((request) => {
                                    const createdAt = formatFeedDateTime(request.createdAtMs);
                                    const customerLabel = request.company
                                        || request.customerName
                                        || 'Okänd kund';

                                    return (
                                        <li
                                            key={request.id}
                                            className="grid min-w-0 grid-cols-1 gap-2 border-b border-border px-1 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold text-text">
                                                        📄 {request.quoteNumber}
                                                    </span>
                                                    <StatusChip tone={getOrderRequestStatusTone(request.status)}>
                                                        {getOrderRequestStatusEmoji(request.status)} {getOrderRequestStatusLabel(request.status)}
                                                    </StatusChip>
                                                </div>
                                                <p className="mb-0 mt-1 break-words text-xs text-text-muted">
                                                    🏢 {request.retailerName} · 👤 {customerLabel}
                                                </p>
                                            </div>
                                            <span
                                                className={[
                                                    'whitespace-nowrap text-sm font-semibold tabular-nums',
                                                    request.totalSek < 0 ? 'text-danger-text' : 'text-text'
                                                ].join(' ')}
                                            >
                                                💳 {formatCurrencySek(request.totalSek)}
                                            </span>
                                            {createdAt ? (
                                                <time
                                                    className="whitespace-nowrap text-xs text-text-muted"
                                                    dateTime={createdAt.dateTime}
                                                >
                                                    ⏱️ {createdAt.label}
                                                </time>
                                            ) : (
                                                <span className="whitespace-nowrap text-xs text-text-muted">
                                                    Okänd tid
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <section
                        aria-busy={logsLoading}
                        aria-labelledby="recent-activity-title"
                        className="min-w-0 border-t border-border py-5 lg:border-l lg:border-t-0 lg:pl-8"
                    >
                        <header className="mb-2 flex min-h-10 items-center justify-between gap-4 px-1">
                            <h2
                                id="recent-activity-title"
                                className="m-0 flex items-center gap-2 text-lg font-semibold text-text"
                            >
                                <span aria-hidden="true" className="text-xl">⚡</span> Senaste aktivitet
                            </h2>
                            {onOpenActivity && (
                                <Button onClick={onOpenActivity} size="sm" variant="ghost">
                                    Visa alla
                                </Button>
                            )}
                        </header>

                        {logsLoading ? (
                            <p role="status" className="m-0 py-8 text-center text-sm text-text-muted">
                                Laddar aktivitet…
                            </p>
                        ) : logsError ? (
                            <div
                                role="alert"
                                className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-danger-text"
                            >
                                <span>Kunde inte ladda senaste aktivitet just nu.</span>
                                <Button
                                    onClick={() => {
                                        void fetchLogs();
                                    }}
                                    size="sm"
                                    variant="ghost"
                                >
                                    Försök igen
                                </Button>
                            </div>
                        ) : logs.length === 0 ? (
                            <p className="m-0 py-8 text-center text-sm text-text-muted">
                                Inga loggade händelser ännu. Nya sparade offerter och exporter visas här.
                            </p>
                        ) : (
                            <ul className="m-0 list-none p-0">
                                {logs.slice(0, ADMIN_DASHBOARD_LIMIT).map((entry, index) => {
                                    const occurredAt = formatFeedDateTime(entry.resolvedMs);
                                    const { label } = getActivityLogVisual(entry);
                                    const metadataSummary = formatActivityMetadata(entry.metadata);
                                    const targetIdLabel = entry.metadata?.reference
                                        || (entry.targetId && entry.targetId !== '-' ? entry.targetId : '');
                                    const targetLabel = targetIdLabel || entry.targetType;
                                    const details = [
                                        entry.user || '-',
                                        targetLabel || '',
                                        entry.details || '',
                                        metadataSummary || ''
                                    ].filter(Boolean).join(' · ');

                                    return (
                                        <li
                                            key={entry.id || `${entry.resolvedMs}-${index}`}
                                            className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border px-1 py-4 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                                        >
                                            <span
                                                aria-hidden="true"
                                                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-action/10 text-xs text-action"
                                            >
                                                📌
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="m-0 text-sm font-semibold text-text">{label}</h3>
                                                <p className="mb-0 mt-1 line-clamp-2 break-words text-xs leading-5 text-text-muted">
                                                    {details}
                                                </p>
                                            </div>
                                            {occurredAt ? (
                                                <time
                                                    className="col-start-2 whitespace-nowrap text-xs text-text-muted sm:col-start-auto"
                                                    dateTime={occurredAt.dateTime}
                                                >
                                                    ⏱️ {occurredAt.label}
                                                </time>
                                            ) : (
                                                <span className="col-start-2 whitespace-nowrap text-xs text-text-muted sm:col-start-auto">
                                                    Okänd tid
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 animate-slide-in">
            <PageHeader
                eyebrow="Din arbetsöversikt"
                title="Välkommen till Brixx portal"
                description="Fortsätt med det viktigaste arbetet och följ de senaste händelserna."
            />

            {canStartQuote && (
                <QuoteDraftPanel
                    onContinueQuote={onContinueQuote}
                    onStartQuote={onStartQuote}
                    quoteDraftSummary={quoteDraftSummary}
                />
            )}

            {canStartQuote ? <PriceListPanel onOpenPriceList={onOpenPriceList} /> : null}
        </div>
    );
}
