import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuote } from '../../store/QuoteContext';
import { useAuth } from '../../store/AuthContext';
import {
    LEGAL_TEMPLATES,
    DEFAULT_TEMPLATE_ID,
    getTemplateById,
    isBuiltinTemplateId
} from '../../../config/legalTemplates.shared.js';
import {
    fetchUserTemplates,
    fetchAllTemplates,
    saveTemplate,
    deleteTemplate
} from '../../services/templateService.js';
import toast from 'react-hot-toast';

function normalizePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function TermsAndPaymentPanel() {
    const { state, dispatch } = useQuote();
    const { user, canViewEverything } = useAuth();
    const [paymentDaysInput, setPaymentDaysInput] = useState(String(state.paymentTermsDays));
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [customTemplates, setCustomTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);

    const legalTemplatesEnabled = typeof window === 'undefined'
        ? true
        : window.FEATURE_PDF_LEGAL_TEMPLATES !== false;

    // Load custom templates from Firestore
    const loadCustomTemplates = useCallback(async () => {
        if (!user?.uid) return;
        setLoadingTemplates(true);
        try {
            const templates = canViewEverything
                ? await fetchAllTemplates()
                : await fetchUserTemplates(user.uid);
            setCustomTemplates(templates);
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    }, [user?.uid, canViewEverything]);

    useEffect(() => {
        loadCustomTemplates();
    }, [loadCustomTemplates]);

    const allTemplates = useMemo(
        () => [...LEGAL_TEMPLATES, ...customTemplates],
        [customTemplates]
    );

    const selectedTemplateId = state.termsTemplateId || DEFAULT_TEMPLATE_ID;

    useEffect(() => {
        setPaymentDaysInput(String(state.paymentTermsDays));
    }, [state.paymentTermsDays]);

    const handleApplyTemplate = () => {
        const template = getTemplateById(selectedTemplateId, customTemplates);
        dispatch({ type: 'SET_TERMS_TEMPLATE_ID', payload: template.id });
        dispatch({ type: 'SET_TERMS_TEXT', payload: template.body });
        dispatch({ type: 'SET_TERMS_CUSTOMIZED', payload: false });
    };

    const handleSaveTemplate = async () => {
        const name = newTemplateName.trim();
        if (!name) {
            toast.error('Ange ett namn för mallen');
            return;
        }
        const currentText = state.termsText || '';
        if (!currentText.trim()) {
            toast.error('Villkorstexten är tom');
            return;
        }
        if (!user?.uid) {
            toast.error('Du måste vara inloggad för att spara mallar');
            return;
        }
        setSavingTemplate(true);
        try {
            const newId = await saveTemplate(user.uid, name, currentText, user.email);
            dispatch({ type: 'SET_TERMS_TEMPLATE_ID', payload: newId });
            dispatch({ type: 'SET_TERMS_CUSTOMIZED', payload: false });
            await loadCustomTemplates();
            setShowSaveDialog(false);
            setNewTemplateName('');
            toast.success(`Mall "${name}" sparad`);
        } catch (err) {
            console.error('Failed to save template:', err);
            toast.error('Kunde inte spara mallen');
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleDeleteTemplate = async () => {
        if (isBuiltinTemplateId(selectedTemplateId)) {
            toast.error('Standardmallar kan inte tas bort');
            return;
        }
        const template = getTemplateById(selectedTemplateId, customTemplates);
        const ownerUid = template.ownerUid || user?.uid;
        if (!ownerUid) return;

        try {
            await deleteTemplate(ownerUid, selectedTemplateId);
            dispatch({ type: 'SET_TERMS_TEMPLATE_ID', payload: DEFAULT_TEMPLATE_ID });
            await loadCustomTemplates();
            toast.success(`Mall "${template.label}" borttagen`);
        } catch (err) {
            console.error('Failed to delete template:', err);
            toast.error('Kunde inte ta bort mallen');
        }
    };

    const commitPaymentDays = () => {
        const normalized = normalizePositiveInt(paymentDaysInput, 30);
        setPaymentDaysInput(String(normalized));
        dispatch({ type: 'SET_PAYMENT_TERMS_DAYS', payload: normalized });
    };

    const isCustomSelected = !isBuiltinTemplateId(selectedTemplateId);
    const canDeleteSelected = isCustomSelected && (
        canViewEverything ||
        customTemplates.find((t) => t.id === selectedTemplateId)?.ownerUid === user?.uid
    );

    return (
        <section className="bg-panel-bg border border-panel-border rounded-lg p-6 shadow-sm">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-text-primary">Villkor & Betalning</h3>
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                        type="checkbox"
                        checked={state.includeTerms !== false}
                        onChange={(e) => dispatch({ type: 'SET_INCLUDE_TERMS', payload: e.target.checked })}
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
                            onChange={(e) => dispatch({ type: 'SET_TERMS_TEMPLATE_ID', payload: e.target.value })}
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
                            onClick={() => { setShowSaveDialog(true); setNewTemplateName(''); }}
                            className="px-4 py-2 bg-primary/20 border border-primary/40 text-primary rounded-md text-sm font-semibold hover:bg-primary/30 transition-colors"
                        >
                            💾 Spara mall
                        </button>
                        {canDeleteSelected && (
                            <button
                                type="button"
                                onClick={handleDeleteTemplate}
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
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                            placeholder="T.ex. Mina standardvillkor"
                            autoFocus
                            className="w-full bg-input-bg border border-panel-border text-text-primary rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleSaveTemplate}
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
                onChange={(e) => {
                    dispatch({ type: 'SET_TERMS_TEXT', payload: e.target.value });
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
                                onChange={(e) => setPaymentDaysInput(e.target.value)}
                                onBlur={commitPaymentDays}
                                className="w-full bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-5 mt-4">
                        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                            <input
                                type="checkbox"
                                checked={state.includePaymentBox === true}
                                onChange={(e) => dispatch({ type: 'SET_INCLUDE_PAYMENT_BOX', payload: e.target.checked })}
                                className="w-4 h-4 accent-primary"
                            />
                            Visa betalningsruta i PDF
                        </label>
                        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                            <input
                                type="checkbox"
                                checked={state.includeSignatureBlock === true}
                                onChange={(e) => dispatch({ type: 'SET_INCLUDE_SIGNATURE_BLOCK', payload: e.target.checked })}
                                className="w-4 h-4 accent-primary"
                            />
                            Visa signeringsruta i PDF
                        </label>
                    </div>
                </>
            )}
        </section>
    );
}
