import React, { useEffect, useMemo, useState } from 'react';
import { useQuote } from '../../store/QuoteContext';
import {
    LEGAL_TEMPLATES,
    DEFAULT_TEMPLATE_ID,
    getTemplateById,
    isLegalTemplateId
} from '../../../config/legalTemplates.shared.js';

function normalizePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function TermsAndPaymentPanel() {
    const { state, dispatch } = useQuote();
    const [paymentDaysInput, setPaymentDaysInput] = useState(String(state.paymentTermsDays));

    const legalTemplatesEnabled = typeof window === 'undefined'
        ? true
        : window.FEATURE_PDF_LEGAL_TEMPLATES !== false;

    const selectedTemplateId = useMemo(
        () => (isLegalTemplateId(state.termsTemplateId) ? state.termsTemplateId : DEFAULT_TEMPLATE_ID),
        [state.termsTemplateId]
    );

    useEffect(() => {
        setPaymentDaysInput(String(state.paymentTermsDays));
    }, [state.paymentTermsDays]);

    const handleApplyTemplate = () => {
        const template = getTemplateById(selectedTemplateId);
        dispatch({ type: 'SET_TERMS_TEMPLATE_ID', payload: template.id });
        dispatch({ type: 'SET_TERMS_TEXT', payload: template.body });
        dispatch({ type: 'SET_TERMS_CUSTOMIZED', payload: false });
    };

    const commitPaymentDays = () => {
        const normalized = normalizePositiveInt(paymentDaysInput, 30);
        setPaymentDaysInput(String(normalized));
        dispatch({ type: 'SET_PAYMENT_TERMS_DAYS', payload: normalized });
    };

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
                        >
                            {LEGAL_TEMPLATES.map((template) => (
                                <option key={template.id} value={template.id} className="bg-panel-bg text-text-primary">
                                    {template.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={handleApplyTemplate}
                        className="px-4 py-2 bg-panel-bg border border-panel-border text-text-primary rounded-md text-sm font-semibold hover:bg-white/5 transition-colors"
                    >
                        Använd mall
                    </button>
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
