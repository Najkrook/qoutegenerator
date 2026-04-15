import React, { type ChangeEvent } from 'react';
import { useQuote } from '../../store/QuoteContext';
import type { CustomerInfo } from '../../types/contracts';

type EditableCustomerField =
    | 'company'
    | 'email'
    | 'reference'
    | 'customerReference'
    | 'date'
    | 'extraNotes';

export function CustomerInfoForm() {
    const { state, dispatch } = useQuote();
    const { customerInfo, quoteValidityDays } = state;

    const handleChange = (field: EditableCustomerField, value: string): void => {
        dispatch({
            type: 'SET_CUSTOMER_INFO',
            payload: { [field]: value } as Partial<CustomerInfo>
        });
    };

    return (
        <div className="bg-panel-bg border border-panel-border rounded-lg p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-primary text-xl" aria-hidden="true">👤</span> Kundinformation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Företag / Organisation</label>
                    <input
                        type="text"
                        value={customerInfo.company || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('company', event.target.value)}
                        placeholder="Företagsnamn"
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">E-post (för offert / signering)</label>
                    <input
                        type="email"
                        value={customerInfo.email || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('email', event.target.value)}
                        placeholder="kund@exempel.se"
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Projektreferens</label>
                    <input
                        type="text"
                        value={customerInfo.reference || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('reference', event.target.value)}
                        placeholder="Referens eller projektnamn"
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Er referens</label>
                    <input
                        type="text"
                        value={customerInfo.customerReference || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('customerReference', event.target.value)}
                        placeholder="Kundens referens"
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Offertdatum</label>
                    <input
                        type="date"
                        value={customerInfo.date || new Date().toISOString().split('T')[0]}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('date', event.target.value)}
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
                        onChange={(event: ChangeEvent<HTMLInputElement>) => dispatch({
                            type: 'SET_QUOTE_VALIDITY_DAYS',
                            payload: Number.parseInt(event.target.value, 10) || 0
                        })}
                        className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors"
                    />
                </div>
            </div>
            <div className="mt-6 flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Extra noteringar (visas på PDF)</label>
                <textarea
                    value={customerInfo.extraNotes || ''}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => handleChange('extraNotes', event.target.value)}
                    placeholder={'T.ex. "Gäller lagerparasoller"'}
                    className="bg-black/20 border border-panel-border rounded-md px-3 py-2 text-sm focus:border-primary outline-none transition-colors min-h-[80px] resize-y"
                />
            </div>
        </div>
    );
}
