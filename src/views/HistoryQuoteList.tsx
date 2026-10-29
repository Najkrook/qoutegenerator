import React, { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCopy, IconDotsVertical, IconFileTypePdf, IconHistory, IconLink, IconTool, IconTrash } from '@tabler/icons-react';
import { Button } from '../components/ui/Button';
import { normalizeQuoteStatus } from '../services/quoteRepository';
import type { HistoryQuoteRow, QuoteRevision, QuoteStatus } from '../types/contracts';

export const HISTORY_STATUS_LABELS: Record<QuoteStatus, string> = {
    draft: 'Utkast', sent: 'Skickad', won: 'Vunnen', lost: 'Förlorad', archived: 'Arkiverad'
};

const STATUS_CLASSES: Record<QuoteStatus, string> = {
    draft: 'border-warning-border bg-warning-bg text-warning-text',
    sent: 'border-info-border bg-info-bg text-info-text',
    won: 'border-success-border bg-success-bg text-success-text',
    lost: 'border-danger-border bg-danger-bg text-danger-text',
    archived: 'border-border bg-hover text-text-muted'
};

export const historyQuoteKey = (quote: HistoryQuoteRow): string => `${quote.ownerUid || ''}/${quote.quoteId}`;
export const historyQuoteTitle = (quote: HistoryQuoteRow): string => (
    quote.reference?.trim() || quote.quoteNumber || quote.company || quote.customerName || 'Okänd kund'
);
export const formatHistorySek = (value: number): string => Math.round(Number(value) || 0).toLocaleString('sv-SE');
const formatDate = (value: number): string => value
    ? new Date(value).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '–';

interface HistoryActions {
    open: (quote: HistoryQuoteRow) => void;
    preview: (quote: HistoryQuoteRow, version?: number) => void;
    copy: (quote: HistoryQuoteRow, version?: number) => void;
    revisions: (quote: HistoryQuoteRow) => void;
    retryRevisions: (quote: HistoryQuoteRow) => void;
    openRevision: (quote: HistoryQuoteRow, revisionId: string) => void;
    duplicate: (quote: HistoryQuoteRow) => void;
    remove: (quote: HistoryQuoteRow) => void;
    repair: (quote: HistoryQuoteRow) => void;
    status: (quote: HistoryQuoteRow, status: string) => void;
}

interface HistoryQuoteListProps {
    quotes: HistoryQuoteRow[];
    layout: 'cards' | 'table';
    lifecycleEnabled: boolean;
    showOwners: boolean;
    canRepair: boolean;
    pending: Record<string, boolean>;
    visibleRevisions: Record<string, boolean>;
    revisionCache: Record<string, QuoteRevision[]>;
    revisionErrors: Record<string, string>;
    actions: HistoryActions;
}

function MoreActions({ quote, canRepair, disabled, actions }: Pick<HistoryQuoteListProps, 'canRepair' | 'actions'> & { quote: HistoryQuoteRow; disabled: boolean }) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ left: 0, top: 0 });
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const id = useId();
    const close = (restoreFocus: boolean) => {
        setOpen(false);
        if (restoreFocus) trigger.current?.focus();
    };

    useLayoutEffect(() => {
        if (!open || !trigger.current || !menu.current) return;
        const rect = trigger.current.getBoundingClientRect();
        const height = menu.current.offsetHeight;
        setPosition({
            left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
            top: Math.max(8, rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 6 : rect.top - height - 6)
        });
        menu.current.querySelector('button')?.focus({ preventScroll: true });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const outside = (event: PointerEvent) => {
            if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close(false);
        };
        const dismiss = () => close(true);
        document.addEventListener('pointerdown', outside);
        window.addEventListener('resize', dismiss);
        window.addEventListener('scroll', dismiss, true);
        return () => {
            document.removeEventListener('pointerdown', outside);
            window.removeEventListener('resize', dismiss);
            window.removeEventListener('scroll', dismiss, true);
        };
    }, [open]);

    const items = [
        { label: 'Duplicera', icon: IconCopy, action: actions.duplicate, danger: false },
        ...(canRepair && quote.crmSynchronizationIssue ? [{ label: 'Reparera CRM-länk', icon: IconTool, action: actions.repair, danger: false }] : []),
        { label: 'Ta bort', icon: IconTrash, action: actions.remove, danger: true }
    ];

    return <>
        <Button ref={trigger} size="sm" variant="ghost" className="!px-2" disabled={disabled}
            aria-label="Fler åtgärder" title="Fler åtgärder" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
            onClick={() => setOpen(!open)}>
            <IconDotsVertical size={18} aria-hidden="true" />
        </Button>
        {open && createPortal(
            <div ref={menu} id={id} role="menu" aria-label={`Åtgärder för ${historyQuoteTitle(quote)}`}
                className="fixed z-50 w-56 rounded-panel border border-border bg-surface-raised p-1.5 text-sm text-text shadow-panel"
                style={position}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
                    if (event.key === 'Tab') { trigger.current?.focus(); close(false); }
                    const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') || []);
                    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                        : event.key === 'ArrowDown' ? (index + 1) % buttons.length
                            : event.key === 'ArrowUp' ? (index - 1 + buttons.length) % buttons.length : -1;
                    if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
                }}>
                {items.map(({ label, icon: Icon, action, danger }) => <button key={label} type="button" role="menuitem"
                    className={`flex min-h-10 w-full items-center gap-2 rounded-control px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-focus-ring ${danger ? 'mt-1 border-t border-border text-danger-text hover:bg-danger-bg' : 'hover:bg-hover'}`}
                    onClick={() => { close(true); action(quote); }}>
                    <Icon size={17} aria-hidden="true" />{label}
                </button>)}
            </div>, document.body
        )}
    </>;
}

function QuoteStatusControl({ quote, enabled, disabled, onChange }: { quote: HistoryQuoteRow; enabled: boolean; disabled: boolean; onChange: HistoryActions['status'] }) {
    const status = normalizeQuoteStatus(quote.status);
    const className = `max-w-full rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`;
    return enabled ? <select aria-label={`Status för ${historyQuoteTitle(quote)}`} value={status} disabled={disabled}
        className={`${className} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50`}
        onChange={(event) => onChange(quote, event.target.value)}>
        {Object.entries(HISTORY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select> : <span className={className}>{HISTORY_STATUS_LABELS[status]}</span>;
}

function QuoteActions({ quote, props }: { quote: HistoryQuoteRow; props: HistoryQuoteListProps }) {
    const key = historyQuoteKey(quote);
    const disabled = Boolean(props.pending[key]);
    const expanded = Boolean(props.visibleRevisions[key]);
    const openLabel = props.lifecycleEnabled ? 'Öppna senaste' : 'Öppna offert';
    return <div className={`flex shrink-0 items-center gap-1.5 ${props.layout === 'table' ? 'flex-nowrap' : 'flex-wrap'}`} aria-label={`Åtgärder för ${historyQuoteTitle(quote)}`}>
        <Button size="sm" variant="primary" aria-label={openLabel} disabled={disabled} onClick={() => props.actions.open(quote)}>
            {props.layout === 'table' ? 'Öppna' : openLabel}
        </Button>
        <Button size="sm" className="!px-2" aria-label="Förhandsgranska PDF" title="Förhandsgranska PDF" disabled={disabled} onClick={() => props.actions.preview(quote)}>
            <IconFileTypePdf size={18} aria-hidden="true" />
        </Button>
        <Button size="sm" className="!px-2" aria-label="Kopiera länk" title="Kopiera länk" disabled={disabled} onClick={() => props.actions.copy(quote)}>
            <IconLink size={18} aria-hidden="true" />
        </Button>
        {props.lifecycleEnabled && <Button size="sm" className={`!px-2 ${expanded ? 'bg-action-soft text-action-soft-text' : ''}`}
            aria-label={expanded ? 'Dölj revisioner' : 'Visa revisioner'} title={expanded ? 'Dölj revisioner' : 'Visa revisioner'}
            aria-expanded={expanded} aria-controls={expanded ? `revisions-${key}` : undefined} disabled={disabled} onClick={() => props.actions.revisions(quote)}>
            <IconHistory size={18} aria-hidden="true" />
        </Button>}
        <MoreActions quote={quote} disabled={disabled} canRepair={props.canRepair} actions={props.actions} />
    </div>;
}

function RevisionList({ quote, props }: { quote: HistoryQuoteRow; props: HistoryQuoteListProps }) {
    const key = historyQuoteKey(quote);
    const revisions = props.revisionCache[key];
    return <section id={`revisions-${key}`} aria-label={`Revisioner för ${historyQuoteTitle(quote)}`} className="border-t border-border pt-4">
        <h4 className="mb-3 text-xs font-semibold text-text-muted">Revisionshistorik · Senaste 5 versionerna</h4>
        {props.revisionErrors[key] ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger-text">
            Kunde inte ladda revisioner.<Button size="sm" onClick={() => props.actions.retryRevisions(quote)}>Försök igen</Button>
        </div> : !revisions ? <p role="status" className="text-sm text-text-muted">Laddar revisioner...</p>
            : revisions.length === 0 ? <p className="text-sm text-text-muted">Inga revisioner hittades.</p>
                : <div className="divide-y divide-border">{revisions.map((revision) => <div key={revision.revisionId} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text">
                        <span className="font-semibold">v{revision.version} - {formatDate(revision.savedAtMs)}</span>
                        <span className="break-words text-text-muted">{revision.changeNote}</span>
                    </div>
                    <Button size="sm" disabled={props.pending[key]} onClick={() => props.actions.openRevision(quote, revision.revisionId)}>Öppna v{revision.version}</Button>
                    <Button size="sm" disabled={props.pending[key]} onClick={() => props.actions.preview(quote, revision.version)}>Förhandsgranska PDF</Button>
                    <Button size="sm" disabled={props.pending[key]} onClick={() => props.actions.copy(quote, revision.version)}>Kopiera länk</Button>
                </div>)}</div>}
    </section>;
}

function OwnerLabel({ quote }: { quote: HistoryQuoteRow }) {
    return <span className="text-xs text-text-muted">Användare: {quote.retailerName ? `[ÅF] ${quote.retailerName}` : quote.savedBy || quote.ownerUid}</span>;
}

export function HistoryQuoteList(props: HistoryQuoteListProps) {
    const { quotes, layout, actions } = props;
    if (layout === 'table') return <div className="max-w-full overflow-x-auto rounded-panel border border-border bg-panel-bg">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
            <caption className="sr-only">Sparade offerter</caption>
            <thead className="bg-surface text-text-muted"><tr>
                {['Projektreferens & företag', 'Er referens', 'Version', 'Uppdaterad', 'Status', 'Totalt (SEK)', 'Åtgärder'].map((label) => <th key={label} scope="col" className={`px-4 py-3 font-semibold ${label.startsWith('Totalt') ? 'text-right' : ''}`}>{label}</th>)}
            </tr></thead>
            <tbody>{quotes.map((quote) => {
                const key = historyQuoteKey(quote);
                return <Fragment key={key}>
                    <tr className="border-t border-border align-middle hover:bg-hover">
                        <td className="max-w-72 px-4 py-4"><div className="break-words font-semibold text-text">{historyQuoteTitle(quote)}</div>
                            {historyQuoteTitle(quote) !== (quote.company || quote.customerName || 'Okänd kund') && <div className="mt-1 break-words text-text-muted">{quote.company || quote.customerName || 'Okänd kund'}</div>}
                            {quote.latestChangeNote && <p className="mt-1 break-words text-text-muted">{quote.latestChangeNote}</p>}
                            {props.showOwners && <OwnerLabel quote={quote} />}</td>
                        <td className="max-w-40 break-words px-4 py-3 text-text-muted">{quote.customerReference || '–'}</td>
                        <td className="px-4 py-3 text-text-muted">v{quote.latestVersion}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-text-muted">{formatDate(quote.updatedAtMs)}</td>
                        <td className="px-4 py-3"><QuoteStatusControl quote={quote} enabled={props.lifecycleEnabled} disabled={Boolean(props.pending[key])} onChange={actions.status} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-text">{formatHistorySek(quote.totalSek)}</td>
                        <td className="px-4 py-3"><QuoteActions quote={quote} props={props} /></td>
                    </tr>
                    {props.visibleRevisions[key] && <tr><td colSpan={7} className="bg-surface px-4 pb-4"><RevisionList quote={quote} props={props} /></td></tr>}
                </Fragment>;
            })}</tbody>
        </table>
    </div>;

    return <div className="space-y-3">{quotes.map((quote) => {
        const key = historyQuoteKey(quote);
        const customer = quote.company || quote.customerName || 'Okänd kund';
        return <article key={key} aria-label={historyQuoteTitle(quote)} className="rounded-panel border border-border bg-panel-bg p-4 transition-colors hover:border-control-border sm:p-5">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="min-w-0 break-words text-base font-semibold tracking-tight text-text">{historyQuoteTitle(quote)}</h3>
                        <span className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-text-muted">v{quote.latestVersion}</span>
                        <QuoteStatusControl quote={quote} enabled={props.lifecycleEnabled} disabled={Boolean(props.pending[key])} onChange={actions.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                        {historyQuoteTitle(quote) !== customer && <span className="break-words font-medium text-text">{customer}</span>}
                        <span className="break-words">Er referens: {quote.customerReference || '–'}</span>
                        <span>Uppdaterad {formatDate(quote.updatedAtMs)}</span>
                    </div>
                    {props.showOwners && <OwnerLabel quote={quote} />}
                    {quote.latestChangeNote && <p className="break-words text-xs italic text-text-muted">{quote.latestChangeNote}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3 xl:flex-col xl:items-end xl:border-t-0 xl:pt-0">
                    <span className="whitespace-nowrap text-base font-semibold tabular-nums text-text">{formatHistorySek(quote.totalSek)} <span className="text-xs font-normal text-text-muted">SEK</span></span>
                    <QuoteActions quote={quote} props={props} />
                </div>
            </div>
            {props.visibleRevisions[key] && <div className="mt-4"><RevisionList quote={quote} props={props} /></div>}
        </article>;
    })}</div>;
}
