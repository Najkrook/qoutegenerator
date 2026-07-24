import React, { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { notifyError, notifySuccess } from '../../services/notificationService';
import { crmRepository } from '../../services/crmRepository';
import { useAuth } from '../../store/AuthContext';
import type { CrmActivity, CrmDeal, CrmDealStage } from '../../types/crm';
import { getCrmActor } from './crmHooks';

export const CRM_PATHS = {
    dashboard: '/crm',
    pipeline: '/crm/pipeline',
    customers: '/crm/customers',
    activities: '/crm/activities',
    company: (companyId: string) => `/crm/customers/${encodeURIComponent(companyId)}`,
    contact: (contactId: string) => `/crm/contacts/${encodeURIComponent(contactId)}`,
    deal: (dealId: string) => `/crm/deals/${encodeURIComponent(dealId)}`
} as const;

export const CRM_DEAL_STAGES: CrmDealStage[] = ['lead', 'quote', 'won', 'lost'];

export const CRM_STAGE_LABELS: Record<CrmDealStage, string> = {
    lead: 'Lead',
    quote: 'Offert',
    won: 'Vunnen',
    lost: 'Förlorad'
};

const STAGE_TONES: Record<CrmDealStage, string> = {
    lead: 'border-primary/35 bg-primary/10 text-primary',
    quote: 'border-warning/35 bg-warning/10 text-warning',
    won: 'border-success/35 bg-success/10 text-success',
    lost: 'border-danger/35 bg-danger/10 text-danger'
};

const ACTIVITY_LABELS: Record<string, string> = {
    note: 'Anteckning',
    call: 'Samtal',
    email: 'Mejl',
    meeting: 'Möte',
    task: 'Uppgift'
};

const NAV_ITEMS = [
    { to: CRM_PATHS.dashboard, label: 'Översikt', end: true },
    { to: CRM_PATHS.pipeline, label: 'Pipeline' },
    { to: CRM_PATHS.customers, label: 'Kunder' },
    { to: CRM_PATHS.activities, label: 'Aktiviteter' }
] as const;

export const primaryButtonClass =
    'inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/15 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClass =
    'inline-flex min-h-10 items-center justify-center rounded-md border border-panel-border bg-panel-bg px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50';

export const dangerButtonClass =
    'inline-flex min-h-10 items-center justify-center rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50';

export const inputClass =
    'w-full rounded-md border border-panel-border bg-black/10 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/15';

function resolveMilliseconds(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    if (value && typeof value === 'object') {
        const candidate = value as {
            toMillis?: () => number;
            seconds?: number;
            _seconds?: number;
        };
        if (typeof candidate.toMillis === 'function') {
            return candidate.toMillis();
        }
        const seconds = candidate.seconds ?? candidate._seconds;
        if (typeof seconds === 'number') {
            return seconds * 1000;
        }
    }

    return 0;
}

export function formatCurrencySek(value: number): string {
    return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

export function getSafeExternalUrl(value: string): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) return null;

    try {
        const parsed = new URL(normalized);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
            ? parsed.toString()
            : null;
    } catch {
        return null;
    }
}

export function formatCrmDate(value: unknown, includeTime = false): string {
    const milliseconds = resolveMilliseconds(value);
    if (!milliseconds) return 'Ej angivet';

    return new Intl.DateTimeFormat('sv-SE', includeTime
        ? {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }
        : {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(milliseconds));
}

export function isSameLocalDay(left: number, right: number): boolean {
    if (!left || !right) return false;
    const leftDate = new Date(left);
    const rightDate = new Date(right);
    return leftDate.getFullYear() === rightDate.getFullYear()
        && leftDate.getMonth() === rightDate.getMonth()
        && leftDate.getDate() === rightDate.getDate();
}

export function isOpenDeal(deal: CrmDeal): boolean {
    return !deal.archived && (deal.stage === 'lead' || deal.stage === 'quote');
}

export function isOpenTask(activity: CrmActivity): boolean {
    return !activity.archived && activity.type === 'task' && activity.status !== 'completed';
}

export function isOverdueTask(activity: CrmActivity, now = Date.now()): boolean {
    return isOpenTask(activity) && Boolean(activity.dueAtMs) && activity.dueAtMs < now
        && !isSameLocalDay(activity.dueAtMs, now);
}

export function getActivityTypeLabel(type: string): string {
    return ACTIVITY_LABELS[type] || 'Aktivitet';
}

export function StageBadge({ stage }: { stage: CrmDealStage }) {
    return (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${STAGE_TONES[stage]}`}>
            {CRM_STAGE_LABELS[stage]}
        </span>
    );
}

export function TagChips({
    tags,
    className = ''
}: {
    tags?: string[] | null;
    className?: string;
}) {
    const visibleTags = (tags || []).filter(Boolean);
    if (visibleTags.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-1.5 ${className}`}>
            {visibleTags.map((tag) => (
                <span
                    key={tag}
                    className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                >
                    {tag}
                </span>
            ))}
        </div>
    );
}

export function CrmShell({
    title,
    description,
    actions,
    children
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    const { canViewEverything } = useAuth();

    if (!canViewEverything) {
        return (
            <section className="mx-auto max-w-2xl rounded-2xl border border-danger/30 bg-danger/10 p-8 text-center">
                <h2 className="text-xl font-semibold text-text-primary">CRM är inte tillgängligt</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    Den här arbetsytan är endast tillgänglig för BRIXX-administratörer.
                </p>
                <Link to="/" className={`${secondaryButtonClass} mt-6`}>
                    Till startsidan
                </Link>
            </section>
        );
    }

    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-16 animate-slide-in">
            <section className="overflow-hidden rounded-2xl border border-panel-border bg-panel-bg shadow-sm">
                <div className="flex flex-col gap-5 px-5 py-6 sm:px-7 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <h2 className="m-0 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                            {title}
                        </h2>
                        {description ? (
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
                </div>
                <nav
                    className="flex gap-1 overflow-x-auto border-t border-panel-border px-3 py-2 sm:px-5"
                    aria-label="CRM-navigation"
                >
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={'end' in item ? item.end : false}
                            className={({ isActive }) => (
                                `whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                                    isActive
                                        ? 'bg-primary text-white'
                                        : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                                }`
                            )}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </section>
            {children}
        </div>
    );
}

export function CrmPanel({
    title,
    description,
    actions,
    children,
    className = ''
}: {
    title?: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={`rounded-2xl border border-panel-border bg-panel-bg p-5 shadow-sm sm:p-6 ${className}`}>
            {title || actions ? (
                <div className="mb-5 flex flex-col gap-3 border-b border-panel-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        {title ? <h3 className="m-0 text-lg font-semibold text-text-primary">{title}</h3> : null}
                        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
                    </div>
                    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
                </div>
            ) : null}
            {children}
        </section>
    );
}

export function CrmMetric({
    label,
    value,
    supportingText,
    tone = 'default'
}: {
    label: string;
    value: ReactNode;
    supportingText?: string;
    tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
    const toneClass = {
        default: 'border-panel-border',
        success: 'border-success/35',
        warning: 'border-warning/35',
        danger: 'border-danger/35'
    }[tone];

    return (
        <div className={`min-w-0 border-l-2 ${toneClass} px-4 py-2`}>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-text-secondary">{label}</p>
            <p className="mt-2 truncate text-2xl font-semibold text-text-primary">{value}</p>
            {supportingText ? <p className="mt-1 text-xs text-text-secondary">{supportingText}</p> : null}
        </div>
    );
}

export function LoadingState({ label = 'Laddar CRM-data...' }: { label?: string }) {
    return (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-panel-border bg-black/5 p-8">
            <p className="text-sm text-text-secondary">{label}</p>
        </div>
    );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-5">
            <p className="m-0 text-sm font-semibold text-text-primary">{message}</p>
            {onRetry ? (
                <button type="button" onClick={onRetry} className={`${secondaryButtonClass} mt-4`}>
                    Försök igen
                </button>
            ) : null}
        </div>
    );
}

export function EmptyState({
    title,
    description,
    action
}: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-dashed border-panel-border bg-black/5 px-5 py-10 text-center">
            <h4 className="m-0 text-base font-semibold text-text-primary">{title}</h4>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-text-secondary">{description}</p>
            {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
        </div>
    );
}

export function CrmModal({
    open,
    title,
    description,
    onClose,
    children
}: {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const titleId = useId();
    const descriptionId = useId();
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return undefined;

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape') return;
            const openDialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
            if (openDialogs.item(openDialogs.length - 1) === modalRef.current) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, open]);

    if (!open) return null;

    return (
        <div
            ref={modalRef}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            onMouseDown={(event) => {
                if (event.currentTarget === event.target) onClose();
            }}
        >
            <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-panel-border bg-panel-bg shadow-2xl">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-panel-border bg-panel-bg px-5 py-4 sm:px-6">
                    <div>
                        <h2 id={titleId} className="m-0 text-xl font-semibold text-text-primary">{title}</h2>
                        {description ? <p id={descriptionId} className="mt-1 text-sm text-text-secondary">{description}</p> : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-panel-border bg-black/10 text-lg text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                        aria-label="Stäng"
                    >
                        ×
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export interface DuplicateReviewMatch {
    id: string;
    label: string;
    details?: string;
    archived?: boolean;
}

export function DuplicateReviewDialog({
    open,
    entityLabel,
    matches,
    saving,
    onOpenExisting,
    onCreateAnyway,
    onCancel
}: {
    open: boolean;
    entityLabel: 'kund' | 'kontakt';
    matches: DuplicateReviewMatch[];
    saving: boolean;
    onOpenExisting: (match: DuplicateReviewMatch) => void;
    onCreateAnyway: () => void;
    onCancel: () => void;
}) {
    return (
        <CrmModal
            open={open}
            title="Möjlig dubblett"
            description={`Vi hittade ${matches.length === 1 ? `en ${entityLabel}` : `flera ${entityLabel}er`} med samma namn eller kontaktuppgifter.`}
            onClose={onCancel}
        >
            <div className="space-y-3 px-5 py-5 sm:px-6">
                {matches.map((match) => (
                    <article
                        key={match.id}
                        className="flex flex-col gap-3 rounded-xl border border-panel-border bg-black/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="min-w-0">
                            <p className="font-semibold text-text-primary">{match.label}</p>
                            {match.details ? <p className="mt-1 break-words text-sm text-text-secondary">{match.details}</p> : null}
                            {match.archived ? <p className="mt-1 text-xs font-semibold text-warning">Arkiverad</p> : null}
                        </div>
                        <button
                            type="button"
                            className={`${secondaryButtonClass} shrink-0`}
                            onClick={() => onOpenExisting(match)}
                            disabled={saving}
                        >
                            Öppna befintlig
                        </button>
                    </article>
                ))}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-panel-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button type="button" className={secondaryButtonClass} onClick={onCancel} disabled={saving}>
                    Avbryt
                </button>
                <button type="button" className={primaryButtonClass} onClick={onCreateAnyway} disabled={saving}>
                    {saving ? 'Skapar...' : 'Skapa ändå'}
                </button>
            </div>
        </CrmModal>
    );
}

export function FormField({
    label,
    htmlFor,
    hint,
    children
}: {
    label: string;
    htmlFor: string;
    hint?: string;
    children: ReactNode;
}) {
    return (
        <div>
            <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">
                {label}
            </label>
            {children}
            {hint ? <p className="mt-1.5 text-xs text-text-secondary">{hint}</p> : null}
        </div>
    );
}

function toLocalDateTimeValue(milliseconds: number): string {
    const date = new Date(milliseconds);
    const pad = (value: number): string => String(value).padStart(2, '0');
    return [
        date.getFullYear(),
        '-',
        pad(date.getMonth() + 1),
        '-',
        pad(date.getDate()),
        'T',
        pad(date.getHours()),
        ':',
        pad(date.getMinutes())
    ].join('');
}

export function getQuickRescheduleAt(
    activity: Pick<CrmActivity, 'dueAtMs'>,
    calendarDays: 1 | 7,
    now = Date.now()
): number {
    const currentDue = new Date(activity.dueAtMs || now);
    const target = new Date(now);
    target.setDate(target.getDate() + calendarDays);
    target.setHours(
        currentDue.getHours(),
        currentDue.getMinutes(),
        currentDue.getSeconds(),
        currentDue.getMilliseconds()
    );
    return target.getTime();
}

export function TaskRescheduleControl({
    activity,
    onRescheduled
}: {
    activity: CrmActivity;
    onRescheduled?: (activity: CrmActivity) => void;
}) {
    const { user } = useAuth();
    const detailsRef = useRef<HTMLDetailsElement>(null);
    const [moving, setMoving] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [customValue, setCustomValue] = useState('');
    const [customError, setCustomError] = useState('');

    const closeMenu = (): void => {
        detailsRef.current?.removeAttribute('open');
    };

    const moveTask = async (dueAtMs: number): Promise<void> => {
        if (moving) return;
        closeMenu();
        setMoving(true);
        setCustomError('');
        try {
            const updated = await crmRepository.rescheduleActivity({
                activityId: activity.id,
                actor: getCrmActor(user),
                dueAtMs
            });
            setCustomOpen(false);
            notifySuccess(`Uppgiften flyttades till ${formatCrmDate(updated.dueAtMs, true)}.`);
            onRescheduled?.(updated);
        } catch (rescheduleError) {
            console.error('Failed to reschedule CRM activity:', rescheduleError);
            notifyError('Kunde inte flytta uppgiften. Försök igen.');
        } finally {
            setMoving(false);
        }
    };

    const openCustom = (): void => {
        closeMenu();
        setCustomValue(toLocalDateTimeValue(getQuickRescheduleAt(activity, 1)));
        setCustomError('');
        setCustomOpen(true);
    };

    const submitCustom = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        const dueAtMs = new Date(customValue).getTime();
        if (!Number.isFinite(dueAtMs) || dueAtMs <= Date.now()) {
            const message = 'Välj en giltig tidpunkt i framtiden.';
            setCustomError(message);
            notifyError(message);
            return;
        }
        await moveTask(dueAtMs);
    };

    return (
        <>
            <details ref={detailsRef} className="relative">
                <summary
                    className={`${secondaryButtonClass} min-h-9 cursor-pointer list-none px-3 py-1.5 text-xs [&::-webkit-details-marker]:hidden`}
                    aria-label={`Flytta ${activity.subject || 'uppgift'}`}
                    aria-disabled={moving}
                    onClick={(event) => {
                        if (moving) event.preventDefault();
                    }}
                >
                    {moving ? 'Flyttar...' : 'Flytta'}
                </summary>
                <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-panel-border bg-panel-bg p-1 shadow-xl">
                    <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-white/5"
                        onClick={() => void moveTask(getQuickRescheduleAt(activity, 1))}
                    >
                        Imorgon
                    </button>
                    <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-white/5"
                        onClick={() => void moveTask(getQuickRescheduleAt(activity, 7))}
                    >
                        Nästa vecka
                    </button>
                    <button
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-xs font-semibold text-text-primary hover:bg-white/5"
                        onClick={openCustom}
                    >
                        Välj datum
                    </button>
                </div>
            </details>
            <CrmModal
                open={customOpen}
                title="Flytta uppgift"
                description="Välj när uppgiften ska följas upp."
                onClose={() => {
                    if (!moving) setCustomOpen(false);
                }}
            >
                <form onSubmit={(event) => void submitCustom(event)}>
                    <div className="space-y-3 px-5 py-5 sm:px-6">
                        <FormField label="Nytt datum och tid *" htmlFor={`crm-reschedule-${activity.id}`}>
                            <input
                                id={`crm-reschedule-${activity.id}`}
                                type="datetime-local"
                                className={inputClass}
                                value={customValue}
                                min={toLocalDateTimeValue(Date.now() + 60_000)}
                                onChange={(event) => {
                                    setCustomValue(event.target.value);
                                    setCustomError('');
                                }}
                                required
                                autoFocus
                            />
                        </FormField>
                        {customError ? <p role="alert" className="text-sm font-semibold text-danger">{customError}</p> : null}
                    </div>
                    <div className="flex flex-col-reverse gap-3 border-t border-panel-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <button type="button" className={secondaryButtonClass} onClick={() => setCustomOpen(false)} disabled={moving}>
                            Avbryt
                        </button>
                        <button type="submit" className={primaryButtonClass} disabled={moving || !customValue}>
                            {moving ? 'Flyttar...' : 'Flytta uppgift'}
                        </button>
                    </div>
                </form>
            </CrmModal>
        </>
    );
}

export function ActivityTimeline({
    activities,
    onComplete,
    completingId,
    onRescheduled
}: {
    activities: CrmActivity[];
    onComplete?: (activity: CrmActivity) => void;
    completingId?: string | null;
    onRescheduled?: (activity: CrmActivity) => void;
}) {
    if (activities.length === 0) {
        return (
            <EmptyState
                title="Ingen aktivitet ännu"
                description="Registrera ett samtal, möte, mejl, en anteckning eller nästa uppgift."
            />
        );
    }

    return (
        <ol className="relative space-y-0 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-panel-border">
            {activities.map((activity) => {
                const openTask = isOpenTask(activity);
                const overdue = isOverdueTask(activity);
                return (
                    <li key={activity.id} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                        <div className={`relative z-[1] mt-1 flex h-9 w-9 items-center justify-center rounded-full border text-xs font-black ${
                            activity.status === 'completed'
                                ? 'border-success/40 bg-success/15 text-success'
                                : overdue
                                    ? 'border-danger/40 bg-danger/15 text-danger'
                                    : 'border-primary/40 bg-panel-bg text-primary'
                        }`}>
                            {activity.type === 'task' ? '✓' : '•'}
                        </div>
                        <article className="rounded-lg border border-panel-border bg-black/5 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-primary">
                                            {getActivityTypeLabel(activity.type)}
                                        </span>
                                        {overdue ? (
                                            <span className="rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">
                                                Försenad
                                            </span>
                                        ) : null}
                                        {activity.status === 'completed' ? (
                                            <span className="rounded-full border border-success/35 bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                                                Klar
                                            </span>
                                        ) : null}
                                    </div>
                                    <h4 className="mt-1 text-sm font-semibold text-text-primary">
                                        {activity.subject || getActivityTypeLabel(activity.type)}
                                    </h4>
                                </div>
                                <time className="shrink-0 text-xs text-text-secondary">
                                    {formatCrmDate(activity.dueAtMs || activity.occurredAtMs || activity.createdAtMs, true)}
                                </time>
                            </div>
                            {activity.notes ? (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                                    {activity.notes}
                                </p>
                            ) : null}
                            {openTask ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {onComplete ? (
                                        <button
                                            type="button"
                                            className={`${secondaryButtonClass} min-h-9 px-3 py-1.5 text-xs`}
                                            disabled={completingId === activity.id}
                                            onClick={() => onComplete(activity)}
                                        >
                                            {completingId === activity.id ? 'Markerar...' : 'Markera som klar'}
                                        </button>
                                    ) : null}
                                    <TaskRescheduleControl activity={activity} onRescheduled={onRescheduled} />
                                </div>
                            ) : null}
                        </article>
                    </li>
                );
            })}
        </ol>
    );
}
