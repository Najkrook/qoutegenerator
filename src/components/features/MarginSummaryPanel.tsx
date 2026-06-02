import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { analyzeQuoteMargins, getQuoteMarginReviewLabel } from '../../services/marginAnalysis';
import { marginSettingsService, normalizeQuoteMarginSettings } from '../../services/marginSettingsService';
import type { QuoteMarginReviewCode, QuoteMarginSettings, QuoteTotalsResult } from '../../types/contracts';

interface MarginSummaryPanelProps {
    summaryData: QuoteTotalsResult;
    className?: string;
}

const REVIEW_CODES: QuoteMarginReviewCode[] = [
    'price-upon-request',
    'missing-margin',
    'manual-pricing',
    'other-line',
    'non-positive-net',
    'negative-profit'
];

function formatSek(value: number): string {
    return `${Math.round(value).toLocaleString('sv-SE')} SEK`;
}

function formatPercent(value: number | null): string {
    if (value == null || !Number.isFinite(value)) {
        return '-';
    }

    return `${value.toFixed(1).replace('.', ',')}%`;
}

export function MarginSummaryPanel({ summaryData, className = '' }: MarginSummaryPanelProps) {
    const { canViewEverything } = useAuth();
    const [settings, setSettings] = useState<QuoteMarginSettings>(() => normalizeQuoteMarginSettings(null));
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!canViewEverything) {
            return undefined;
        }

        let cancelled = false;
        setIsLoading(true);

        void marginSettingsService.getQuoteMarginSettings()
            .then((nextSettings) => {
                if (!cancelled) {
                    setSettings(nextSettings);
                }
            })
            .catch((error) => {
                console.error('Failed to load quote margin settings:', error);
                if (!cancelled) {
                    setSettings(normalizeQuoteMarginSettings(null));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [canViewEverything]);

    const analysis = useMemo(
        () => analyzeQuoteMargins(summaryData, settings),
        [settings, summaryData]
    );

    if (!canViewEverything) {
        return null;
    }

    const reviewBadges = REVIEW_CODES
        .map((code) => ({ code, count: analysis.reviewCounts[code] || 0 }))
        .filter((item) => item.count > 0);

    return (
        <section className={`rounded-lg border border-panel-border bg-panel-bg p-6 shadow-sm ${className}`}>
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                        Intern marginal
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-text-primary">Marginalöversikt</h3>
                </div>
                {isLoading && (
                    <span className="rounded-full border border-panel-border bg-black/20 px-3 py-1 text-xs text-text-secondary">
                        Hämtar inställningar...
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-panel-border bg-black/20 p-4">
                    <div className="text-xs font-bold uppercase text-text-secondary">Estimerad kostnad</div>
                    <div className="mt-2 text-xl font-black text-text-primary">{formatSek(analysis.totalEstimatedCostSek)}</div>
                </div>
                <div className="rounded-md border border-panel-border bg-black/20 p-4">
                    <div className="text-xs font-bold uppercase text-text-secondary">Estimerad bruttovinst</div>
                    <div className={`mt-2 text-xl font-black ${analysis.totalEstimatedGrossProfitSek < 0 ? 'text-danger' : 'text-success'}`}>
                        {formatSek(analysis.totalEstimatedGrossProfitSek)}
                    </div>
                </div>
                <div className="rounded-md border border-panel-border bg-black/20 p-4">
                    <div className="text-xs font-bold uppercase text-text-secondary">Aktuell marginal</div>
                    <div className={`mt-2 text-xl font-black ${(analysis.actualMarginPct || 0) < 10 ? 'text-warning' : 'text-primary'}`}>
                        {formatPercent(analysis.actualMarginPct)}
                    </div>
                </div>
                <div className="rounded-md border border-panel-border bg-black/20 p-4">
                    <div className="text-xs font-bold uppercase text-text-secondary">Rabattpåverkan</div>
                    <div className="mt-2 text-xl font-black text-danger">-{formatSek(analysis.totalDiscountImpactSek)}</div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-panel-border bg-black/20 px-3 py-1 text-xs font-semibold text-text-secondary">
                    {analysis.includedRowCount} rader i marginaltotal
                </span>
                {reviewBadges.length === 0 ? (
                    <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                        Ingen marginalgranskning krävs
                    </span>
                ) : (
                    reviewBadges.map(({ code, count }) => (
                        <span
                            key={code}
                            className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning"
                        >
                            {getQuoteMarginReviewLabel(code)}: {count}
                        </span>
                    ))
                )}
            </div>
        </section>
    );
}
