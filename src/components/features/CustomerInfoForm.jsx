import React from 'react';
import { useQuote } from '../../store/QuoteContext';

export function CustomerInfoForm() {
    const { state, dispatch } = useQuote();
    const { customerInfo, quoteValidityDays } = state;

    const handleChange = (field, value) => {
        dispatch({
            type: 'SET_CUSTOMER_INFO',
            payload: { [field]: value }
        });
    };

    return (
        <div className="bg-panel-bg border border-panel-border rounded-lg p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-primary text-xl">👤</span> Kundinformation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Företag / Organisation</label>
                    <input
                        type="text"
                        value={customerInfo.company || ''}
                        onChange={(e) => handleChange('company', e.target.value)}
                        placeholder="Företagsnamn"
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">E-post (för offert / signering)</label>
                    <input
                        type="email"
                        value={customerInfo.email || ''}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="kund@exempel.se"
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Projektreferens</label>
                    <input
                        type="text"
                        value={customerInfo.reference || ''}
                        onChange={(e) => handleChange('reference', e.target.value)}
                        placeholder="Referens eller projektnamn"
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Er referens</label>
                    <input
                        type="text"
                        value={customerInfo.customerReference || ''}
                        onChange={(e) => handleChange('customerReference', e.target.value)}
                        placeholder="Kundens referens"
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Offertdatum</label>
                    <input
                        type="date"
                        value={customerInfo.date || new Date().toISOString().split('T')[0]}
                        onChange={(e) => handleChange('date', e.target.value)}
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Giltig i (dagar)</label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={quoteValidityDays}
                        onChange={(e) => dispatch({ type: 'SET_QUOTE_VALIDITY_DAYS', payload: e.target.value })}
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
            </div>
        </div>
    );
}
