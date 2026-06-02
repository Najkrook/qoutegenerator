import React, { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { getCatalogLineName } from '../../data/catalogLookup';
import { useAuth } from '../../store/AuthContext';
import {
    marginSettingsService,
    normalizeQuoteMarginSettings,
    QUOTE_MARGIN_LINE_IDS
} from '../../services/marginSettingsService';
import { notifyError, notifySuccess } from '../../services/notificationService';
import { getErrorMessage } from '../../utils/runtime';
import type { QuoteMarginLineId, QuoteMarginSettings } from '../../types/contracts';

interface AdminSettingsModalProps {
    open: boolean;
    onClose: () => void;
}

type MarginDrafts = Record<QuoteMarginLineId, number>;

function getDraftsFromSettings(settings: QuoteMarginSettings): MarginDrafts {
    return { ...settings.marginsByLine };
}

function normalizeDraftValue(value: string): number {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.max(0, Math.min(100, parsed));
}

export function AdminSettingsModal({ open, onClose }: AdminSettingsModalProps) {
    const { user, canViewEverything } = useAuth();
    const [settings, setSettings] = useState<QuoteMarginSettings>(() => normalizeQuoteMarginSettings(null));
    const [drafts, setDrafts] = useState<MarginDrafts>(() => getDraftsFromSettings(normalizeQuoteMarginSettings(null)));
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!open || !canViewEverything) {
            return undefined;
        }

        let cancelled = false;
        setIsLoading(true);

        void marginSettingsService.getQuoteMarginSettings()
            .then((nextSettings) => {
                if (cancelled) return;
                setSettings(nextSettings);
                setDrafts(getDraftsFromSettings(nextSettings));
            })
            .catch((error) => {
                console.error('Failed to load quote margin settings:', error);
                notifyError('Kunde inte hämta marginalinställningar.');
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [canViewEverything, open]);

    if (!open || !canViewEverything) {
        return null;
    }

    const handleDraftChange = (lineId: QuoteMarginLineId) => (event: ChangeEvent<HTMLInputElement>): void => {
        const nextValue = normalizeDraftValue(event.target.value);
        setDrafts((currentDrafts) => ({
            ...currentDrafts,
            [lineId]: nextValue
        }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (isSaving) return;

        setIsSaving(true);
        try {
            const saved = await marginSettingsService.saveQuoteMarginSettings({
                marginsByLine: drafts,
                user
            });
            setSettings(saved);
            setDrafts(getDraftsFromSettings(saved));
            notifySuccess('Marginalinställningar sparade.');
        } catch (error) {
            console.error('Failed to save quote margin settings:', error);
            notifyError(`Kunde inte spara marginalinställningar: ${getErrorMessage(error, 'okänt fel')}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="w-full max-w-xl rounded-lg border border-panel-border bg-panel-bg shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-panel-border px-6 py-5">
                    <div>
                        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                            Admininställningar
                        </p>
                        <h2 className="mt-2 text-xl font-black text-text-primary">Offertmarginaler</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-panel-border bg-black/20 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                        aria-label="Stäng admininställningar"
                    >
                        x
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5">
                    <div className="space-y-4">
                        {QUOTE_MARGIN_LINE_IDS.map((lineId) => (
                            <label key={lineId} className="flex flex-col gap-2 rounded-md border border-panel-border bg-black/20 p-4">
                                <span className="text-sm font-bold text-text-primary">
                                    {getCatalogLineName(lineId) || lineId}
                                </span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={drafts[lineId]}
                                        onChange={handleDraftChange(lineId)}
                                        className="w-28 rounded-md border border-panel-border bg-input-bg p-2 text-right text-lg font-black text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                    />
                                    <span className="text-sm font-semibold text-text-secondary">% marginal på listpris</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="mt-5 rounded-md border border-panel-border bg-black/10 p-4 text-xs text-text-secondary">
                        {settings.updatedAt > 0 ? (
                            <span>
                                Senast sparad av {settings.updatedBy || '-'}.
                            </span>
                        ) : (
                            <span>Standardvärden används tills inställningarna sparas.</span>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-panel-border bg-panel-bg px-5 py-2.5 text-sm font-bold text-text-primary transition-colors hover:bg-white/5"
                        >
                            Stäng
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || isLoading}
                            className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? 'Sparar...' : isLoading ? 'Hämtar...' : 'Spara marginaler'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
