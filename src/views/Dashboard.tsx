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

interface DashboardLauncherCardProps {
    description: string;
    icon: TablerIcon;
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
                    <div className="mb-5 rounded-panel border border-action/30 bg-action/10 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="m-0 text-base font-semibold text-text">
                                    {quoteDraftSummary.customerLabel}
                                </p>
                                <p className="mb-0 mt-1 text-sm text-text-muted">
                                    {quoteDraftSummary.stepLabel}
                                </p>
                            </div>
                            <StatusChip>Utkast</StatusChip>
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
                                Senast ändrad {draftUpdatedAt.label}
                            </time>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-3">
                    {quoteDraftSummary && onContinueQuote && (
                        <Button onClick={onContinueQuote} size="lg" variant="primary">
                            Fortsätt offert
                        </Button>
                    )}
                    {onStartQuote && (
                        <Button
                            onClick={onStartQuote}
                            size="lg"
                            variant={quoteDraftSummary ? 'secondary' : 'primary'}
                        >
                            {quoteDraftSummary ? 'Ny offert' : 'Skapa ny offert'}
                        </Button>
                    )}
                </div>
            </div>
        </Panel>
    );
}

function DashboardLauncherCard({
    description,
    icon: Icon,
    label,
    onClick
}: DashboardLauncherCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={[
                'group grid min-h-36 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4',
                'rounded-panel border border-border bg-surface-raised p-5 text-left text-text',
                'transition-colors hover:border-control-border hover:bg-surface-hover',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                'disabled:cursor-not-allowed disabled:opacity-60 sm:gap-5'
            ].join(' ')}
        >
            <Icon
                aria-hidden="true"
                className="shrink-0 text-text"
                size={40}
                stroke={1.7}
            />
            <span className="min-w-0">
                <span className="block text-lg font-semibold tracking-tight text-text">
                    {label}
                </span>
                <span className="mt-2 line-clamp-2 block break-words text-sm leading-6 text-text-muted">
                    {description}
                </span>
            </span>
            <IconChevronRight
                aria-hidden="true"
                className="shrink-0 text-text-muted transition-colors group-hover:text-text"
                size={24}
                stroke={1.8}
            />
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
                                        <h2 className="m-0 text-base font-semibold text-text">{line.name}</h2>
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
                description: hasResumableDraft && quoteDraftSummary
                    ? `${quoteDraftSummary.customerLabel} · ${quoteDraftSummary.stepLabel}`
                    : 'Starta ett nytt offertflöde.',
                icon: IconFileText,
                label: hasResumableDraft ? 'Fortsätt offert' : 'Skapa ny offert',
                onClick: hasResumableDraft ? onContinueQuote : onStartQuote
            },
            {
                description: 'Samla kunder, affärer och erbjudanden.',
                icon: IconTargetArrow,
                label: 'Sälj-CRM',
                onClick: onOpenCrm
            },
            {
                description: 'Uppdatera lagersaldon och historik.',
                icon: IconPackage,
                label: 'Lagersaldo',
                onClick: onOpenInventory
            },
            {
                description: 'Skissa snabbt och beräkna optimalt.',
                icon: IconPencil,
                label: 'Rita uteservering',
                onClick: onOpenSketch
            },
            {
                description: 'Se skapade offerter och exporter.',
                icon: IconHistory,
                label: 'Aktivitetslogg',
                onClick: onOpenActivity
            },
            {
                description: 'Planera och följ upp projekt.',
                icon: IconClipboardList,
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
                                className="m-0 text-lg font-semibold text-text"
                            >
                                Senaste orderförfrågningar
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
                                                        {request.quoteNumber}
                                                    </span>
                                                    <StatusChip tone={getOrderRequestStatusTone(request.status)}>
                                                        {getOrderRequestStatusLabel(request.status)}
                                                    </StatusChip>
                                                </div>
                                                <p className="mb-0 mt-1 break-words text-xs text-text-muted">
                                                    {request.retailerName} · {customerLabel}
                                                </p>
                                            </div>
                                            <span
                                                className={[
                                                    'whitespace-nowrap text-sm font-semibold tabular-nums',
                                                    request.totalSek < 0 ? 'text-danger-text' : 'text-text'
                                                ].join(' ')}
                                            >
                                                {formatCurrencySek(request.totalSek)}
                                            </span>
                                            {createdAt ? (
                                                <time
                                                    className="whitespace-nowrap text-xs text-text-muted"
                                                    dateTime={createdAt.dateTime}
                                                >
                                                    {createdAt.label}
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
                                className="m-0 text-lg font-semibold text-text"
                            >
                                Senaste aktivitet
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
                                                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-action"
                                            />
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
                                                    {occurredAt.label}
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
        </div>
    );
}
