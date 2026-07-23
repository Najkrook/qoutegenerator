import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { normalizeExportLanguage } from '../../services/exportLocalization';
import type { QuoteExportLanguage } from '../../types/contracts';

interface ExportLanguageSelectorProps {
    className?: string;
}

const LANGUAGE_OPTIONS: Array<{ value: QuoteExportLanguage; label: string }> = [
    { value: 'sv', label: 'SV' },
    { value: 'en', label: 'EN' }
];

export function ExportLanguageSelector({ className = '' }: ExportLanguageSelectorProps) {
    const { state, dispatch } = useQuote();
    const selectedLanguage = normalizeExportLanguage(state.exportLanguage);

    const handleLanguageChange = (exportLanguage: QuoteExportLanguage): void => {
        dispatch({ type: 'SET_EXPORT_LANGUAGE', payload: exportLanguage });
    };

    return (
        <div className={`flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary ${className}`.trim()}>
            Exportspråk
            <div
                className="grid h-[38px] grid-cols-2 overflow-hidden rounded-md border border-panel-border bg-panel-bg normal-case tracking-normal"
                role="group"
                aria-label="Exportspråk"
            >
                {LANGUAGE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => handleLanguageChange(option.value)}
                        aria-pressed={selectedLanguage === option.value}
                        className={`text-sm font-bold transition-colors ${selectedLanguage === option.value ? 'bg-primary text-white' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
