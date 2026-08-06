import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    getQuoteStepLabel,
    getQuoteStepNavigationItems,
    getQuoteStepNumber,
    type QuoteStepBlocker,
    type QuoteRouteStepId
} from '../../navigation/routes';
import type { QuoteState } from '../../types/contracts';
import { Button } from '../ui/Button';
import { StatusChip } from '../ui/StatusChip';

interface QuoteContextBarProps {
    currentStep: QuoteRouteStepId;
    isRetailer: boolean;
    onResetQuote: () => void;
    state: QuoteState;
}

function withActiveCrmContext(path: string, search: string): string {
    const currentParams = new URLSearchParams(search);
    const crmDealId = currentParams.get('crmDealId')?.trim();
    if (!crmDealId) {
        return path;
    }

    const params = new URLSearchParams({ crmDealId });
    const quoteOwnerUid = currentParams.get('quoteOwnerUid')?.trim();
    if (quoteOwnerUid) {
        params.set('quoteOwnerUid', quoteOwnerUid);
    }
    return `${path}?${params.toString()}`;
}

function getBlockerText(blocker: QuoteStepBlocker): string {
    return `Slutför steg ${getQuoteStepNumber(blocker.step)}, ${getQuoteStepLabel(blocker.step)}, innan du går vidare.`;
}

export function QuoteContextBar({
    currentStep,
    isRetailer,
    onResetQuote,
    state
}: QuoteContextBarProps) {
    const location = useLocation();
    const steps = getQuoteStepNavigationItems(state, currentStep, { isRetailer });
    const firstBlocker = steps.find((step) => step.blocker)?.blocker || null;
    const customerLabel = String(state.customerInfo?.company || '').trim()
        || String(state.customerInfo?.name || '').trim()
        || 'Nytt offertutkast';
    const reference = String(state.customerInfo?.reference || '').trim()
        || String(state.customerInfo?.customerReference || '').trim();
    const crmDealId = new URLSearchParams(location.search).get('crmDealId')?.trim();

    return (
        <section aria-label="Pågående offert" className="border-b border-border bg-surface px-4 py-4 md:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                        Pågående offert
                    </p>
                    <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h2 className="m-0 truncate text-base font-semibold text-text-primary">
                            {customerLabel}
                        </h2>
                        {reference && (
                            <span className="text-xs text-text-secondary">Referens: {reference}</span>
                        )}
                        {state.quoteNumber && (
                            <span className="text-xs text-text-secondary">Offert {state.quoteNumber}</span>
                        )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusChip tone={state.activeQuoteId ? 'success' : 'neutral'}>
                            {state.activeQuoteId
                                ? `Sparad version ${Math.max(1, Number(state.activeQuoteVersion) || 1)}`
                                : 'Lokalt utkast'}
                        </StatusChip>
                        {crmDealId && <StatusChip>Kopplad till CRM</StatusChip>}
                    </div>
                </div>
                <Button
                    onClick={onResetQuote}
                    size="sm"
                    variant="danger"
                >
                    Rensa utkast
                </Button>
            </div>

            <ol className="mt-4 grid list-none grid-cols-4 gap-2 p-0" aria-label="Offertsteg">
                {steps.map((step) => {
                    const content = (
                        <>
                            <span
                                className={[
                                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                                    step.current
                                        ? 'border-action bg-action text-on-action'
                                        : step.status === 'past'
                                            ? 'border-success-border bg-success-bg text-success-text'
                                            : step.status === 'locked'
                                                ? 'border-border bg-surface-raised text-text-muted'
                                                : 'border-action/40 bg-action-soft text-action-soft-text'
                                ].join(' ')}
                            >
                                {step.number}
                            </span>
                            <span className="hidden min-w-0 text-left sm:block">
                                <span className="block truncate text-xs font-semibold">{step.label}</span>
                                <span className="block text-[10px] font-medium text-text-secondary">
                                    {step.current
                                        ? 'Aktuellt steg'
                                        : step.status === 'past'
                                            ? 'Klart'
                                            : step.status === 'locked'
                                                ? 'Låst'
                                                : 'Tillgängligt'}
                                </span>
                            </span>
                        </>
                    );

                    if (step.status === 'locked') {
                        const descriptionId = `quote-step-blocker-${step.step}`;
                        return (
                            <li key={step.step}>
                                <button
                                    type="button"
                                    aria-current={step.current ? 'step' : undefined}
                                    aria-disabled="true"
                                    aria-describedby={descriptionId}
                                    className="flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-control border border-border bg-surface-raised px-2 py-2 text-text-muted opacity-70 sm:justify-start"
                                >
                                    {content}
                                </button>
                                <span id={descriptionId} className="sr-only">
                                    {step.blocker ? getBlockerText(step.blocker) : ''}
                                </span>
                            </li>
                        );
                    }

                    return (
                        <li key={step.step}>
                            <NavLink
                                to={withActiveCrmContext(step.path, location.search)}
                                aria-current={step.current ? 'step' : undefined}
                                className={[
                                    'flex min-h-12 items-center justify-center gap-2 rounded-lg border px-2 py-2 no-underline transition-colors sm:justify-start',
                                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                    step.current
                                        ? 'border-action/50 bg-action-soft text-text'
                                        : 'border-border bg-surface-raised text-text-muted hover:border-action/40 hover:bg-surface-hover hover:text-text'
                                ].join(' ')}
                            >
                                {content}
                            </NavLink>
                        </li>
                    );
                })}
            </ol>

            {firstBlocker && (
                <p className="mb-0 mt-2 text-xs text-text-secondary">
                    {getBlockerText(firstBlocker)}
                </p>
            )}
        </section>
    );
}
