import React, {
    useCallback,
    useEffect,
    useState,
    type ChangeEvent,
    type KeyboardEvent
} from 'react';
import { useQuote } from '../../store/QuoteContext';
import { useAuth } from '../../store/AuthContext';
import {
    LEGAL_TEMPLATES,
    DEFAULT_TEMPLATE_ID,
    getTemplateById,
    isBuiltinTemplateId
} from '../../config/legalTemplates.shared';
import {
    fetchAllTemplates,
    fetchUserTemplates,
    saveTemplate,
    deleteTemplate
} from '../../services/templateService';
import { hasZeroDiscountSummary } from '../../services/exportDataBuilders';
import { notifyError, notifySuccess } from '../../services/notificationService';
import type { LegalTemplateOption, TermsAndPaymentPanelProps } from '../../types/contracts';

function normalizePositiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function TermsAndPaymentPanel({ summaryData }: TermsAndPaymentPanelProps) {
    const { state, dispatch } = useQuote();
    const { user, canViewEverything } = useAuth();
    const [paymentDaysInput, setPaymentDaysInput] = useState(String(state.paymentTermsDays));
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [customTemplates, setCustomTemplates] = useState<LegalTemplateOption[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);

    const legalTemplatesEnabled = typeof window === 'undefined'
        ? true
        : window.FEATURE_PDF_LEGAL_TEMPLATES !== false;
    const selectedTemplateId = state.termsTemplateId || DEFAULT_TEMPLATE_ID;

    const loadCustomTemplates = useCallback(async (): Promise<void> => {
        if (!user?.uid) return;

        setLoadingTemplates(true);
        try {
            const templates = (canViewEverything
                ? await fetchAllTemplates()
                : await fetchUserTemplates(user.uid)) as LegalTemplateOption[];
            setCustomTemplates(templates);
        } catch (error) {
            console.error('Failed to load templates:', error);
        } finally {
            setLoadingTemplates(false);
        }
    }, [canViewEverything, user?.uid]);

    useEffect(() => {
        void loadCustomTemplates();
    }, [loadCustomTemplates]);

    useEffect(() => {
        setPaymentDaysInput(String(state.paymentTermsDays));
    }, [state.paymentTermsDays]);

    const handleApplyTemplate = (): void => {
        const template = getTemplateById(selectedTemplateId, customTemplates) as LegalTemplateOption;
        dispatch({ type: 'SET_TERMS_TEMPLATE_ID', payload: template.id });
        dispatch({ type: 'SET_TERMS_TEXT', payload: template.body });
        dispatch({ type: 'SET_TERMS_CUSTOMIZED', payload: false });
    };

    const handleSaveTemplate = async (): Promise<void> => {
        const name = newTemplateName.trim();
        if (!name) {
            notifyError('Ange ett namn för mallen');
            return;
        }

        const currentText = state.termsText || '';
        if (!currentText.trim()) {
            notifyError('Villkorstexten är tom');
            return;
        }

        if (!user?.uid) {
            notifyError('Du måste vara inloggad för att spara mallar');
            return;
        }

        setSavingTemplate(true);
        try {
            const newId = await saveTemplate(user.uid, name, currentText, user.email || '');
            dispatch({ type: 'SET_TERMS_TEMPLATE_ID', payload: newId });
            dispatch({ type: 'SET_TERMS_CUSTOMIZED', payload: false });
            await loadCustomTemplates();
            setShowSaveDialog(false);
            setNewTemplateName('');
            notifySuccess(`Mall "${name}" sparad`);
        } catch (error) {
            console.error('Failed to save template:', error);
            notifyError('Kunde inte spara mallen');
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async (): Promise<void> => {
        if (isBuiltinTemplateId(selectedTemplateId)) {
            notifyError('Standardmallar kan inte tas bort');
            return;
        }

        const template = getTemplateById(selectedTemplateId, customTemplates) as LegalTemplateOption;
        const ownerUid = template.ownerUid || user?.uid;
        if (!ownerUid) return;

        try {
            await deleteTemplate(ownerUid, selectedTemplateId);
            dispatch({ type: 'SET_TERMS_TEMPLATE_ID', payload: DEFAULT_TEMPLATE_ID });
            await loadCustomTemplates();
            notifySuccess(`Mall "${template.label}" borttagen`);
        } catch (error) {
            console.error('Failed to delete template:', error);
            notifyError('Kunde inte ta bort mallen');
        }
    };

    const commitPaymentDays = (): void => {
        const normalized = normalizePositiveInt(paymentDaysInput, 30);
        setPaymentDaysInput(String(normalized));
        dispatch({ type: 'SET_PAYMENT_TERMS_DAYS', payload: normalized });
    };

    const isCustomSelected = !isBuiltinTemplateId(selectedTemplateId);
    const canDeleteSelected = isCustomSelected && (
        canViewEverything ||
        customTemplates.find((template) => template.id === selectedTemplateId)?.ownerUid === user?.uid
    );

    return (
        <section className="bg-panel-bg border border-panel-border rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-text-primary">Villkor & Betalning</h3>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                        type="checkbox"
                        checked={state.includeTerms !== false}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => dispatch({
                            type: 'SET_INCLUDE_TERMS',
                            payload: event.target.checked
                        })}
                        className="w-4 h-4 accent-primary"
                    />
                    Inkludera i PDF
                </label>
            </div>

            {legalTemplatesEnabled && (
                <div className="flex flex-col md:flex-row gap-3 md:items-end mb-3">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold uppercase text-text-secondary mb-1 tracking-wider">
                            Juridisk textmall
                        </label>
                        <select
                            value={selectedTemplateId}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => dispatch({
                                type: 'SET_TERMS_TEMPLATE_ID',
                                payload: event.target.value
                            })}
                            className="w-full bg-input-bg border border-panel-border text-text-primary rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                            disabled={loadingTemplates}
                        >
                            <optgroup label="Standardmallar">
                                {LEGAL_TEMPLATES.map((template) => (
                                    <option key={template.id} value={template.id} className="bg-panel-bg text-text-primary">
                                        {template.label}
                                    </option>
                                ))}
                            </optgroup>
                            {customTemplates.length > 0 && (
                                <optgroup label={canViewEverything ? 'Sparade mallar (alla användare)' : 'Mina mallar'}>
                                    {customTemplates.map((template) => (
                                        <option key={template.id} value={template.id} className="bg-panel-bg text-text-primary">
                                            {template.label}
                                            {canViewEverything && template.ownerEmail ? ` (${template.ownerEmail})` : ''}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleApplyTemplate}
                            className="px-4 py-2 bg-panel-bg border border-panel-border text-text-primary rounded-md text-sm font-semibold hover:bg-white/5 transition-colors"
                        >
                            Använd mall
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowSaveDialog(true);
                                setNewTemplateName('');
                            }}
                            className="px-4 py-2 bg-primary/20 border border-primary/40 text-primary rounded-md text-sm font-semibold hover:bg-primary/30 transition-colors"
                        >
                            💾 Spara mall
                        </button>
                        {canDeleteSelected && (
                            <button
                                type="button"
                                onClick={() => {
                                    void handleDeleteTemplate();
                                }}
                                className="px-3 py-2 bg-danger/20 border border-danger/40 text-danger rounded-md text-sm font-semibold hover:bg-danger/30 transition-colors"
                                title="Ta bort vald mall"
                            >
                                🗑
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showSaveDialog && (
                <div className="bg-black/30 border border-primary/30 rounded-lg p-4 mb-3 flex flex-col md:flex-row gap-3 md:items-end animate-fade-in">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold uppercase text-text-secondary mb-1 tracking-wider">
                            Mallnamn
                        </label>
                        <input
                            type="text"
                            value={newTemplateName}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setNewTemplateName(event.target.value)}
                            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                                if (event.key === 'Enter') {
                                    void handleSaveTemplate();
                                }
                            }}
                            placeholder="T.ex. Mina standardvillkor"
                            autoFocus
                            className="w-full bg-input-bg border border-panel-border text-text-primary rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                void handleSaveTemplate();
                            }}
                            disabled={savingTemplate}
                            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50"
                        >
                            {savingTemplate ? 'Sparar...' : 'Spara'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowSaveDialog(false)}
                            className="px-4 py-2 bg-panel-bg border border-panel-border text-text-secondary rounded-md text-sm font-semibold hover:bg-white/5 transition-colors"
                        >
                            Avbryt
                        </button>
                    </div>
                </div>
            )}

            <textarea
                rows={6}
                value={state.termsText || ''}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                    dispatch({ type: 'SET_TERMS_TEXT', payload: event.target.value });
                    dispatch({ type: 'SET_TERMS_CUSTOMIZED', payload: true });
                }}
                className="w-full text-sm leading-relaxed bg-black/20 border border-panel-border rounded-md p-3 resize-y focus:border-primary outline-none transition-colors"
            />

            {legalTemplatesEnabled && (
                <>
                    <div className="grid grid-cols-1 gap-4 mt-4">
                        <div className="max-w-[360px]">
                            <label className="block text-xs font-semibold uppercase text-text-secondary mb-1 tracking-wider">
                                Betalningsvillkor (dagar)
                            </label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={paymentDaysInput}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => setPaymentDaysInput(event.target.value)}
                                onBlur={commitPaymentDays}
                                className="w-full bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                            />
                        </div>
                    </div>

                </>
            )}
        </section>
    );
}
