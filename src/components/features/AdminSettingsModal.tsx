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
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

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
        <Modal
            open={open}
            onClose={onClose}
            title="Offertmarginaler"
            description="Admininställningar för interna listprismarginaler."
            maxWidthClassName="max-w-xl"
        >
                <form onSubmit={handleSubmit} className="px-6 py-5">
                    <div className="space-y-4">
                        {QUOTE_MARGIN_LINE_IDS.map((lineId) => (
                            <label key={lineId} htmlFor={`margin-${lineId}`} className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-4">
                                <span className="text-sm font-bold text-text">
                                    {getCatalogLineName(lineId) || lineId}
                                </span>
                                <div className="flex items-center gap-3">
                                    <input
                                        id={`margin-${lineId}`}
                                        name={`margin-${lineId}`}
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={drafts[lineId]}
                                        onChange={handleDraftChange(lineId)}
                                        className="w-28 rounded-control border border-control-border bg-input p-2 text-right text-lg font-black text-text"
                                    />
                                    <span className="text-sm font-semibold text-text-muted">% marginal på listpris</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="mt-5 rounded-panel border border-border bg-surface p-4 text-xs text-text-muted">
                        {settings.updatedAt > 0 ? (
                            <span>
                                Senast sparad av {settings.updatedBy || '-'}.
                            </span>
                        ) : (
                            <span>Standardvärden används tills inställningarna sparas.</span>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Button
                            onClick={onClose}
                        >
                            Stäng
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving || isLoading}
                            variant="primary"
                        >
                            {isSaving ? 'Sparar...' : isLoading ? 'Hämtar...' : 'Spara marginaler'}
                        </Button>
                    </div>
                </form>
        </Modal>
    );
}
