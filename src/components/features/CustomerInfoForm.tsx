import React, { type ChangeEvent } from 'react';
import { useQuote } from '../../store/QuoteContext';
import type { CustomerInfo } from '../../types/contracts';
import { Panel } from '../ui/Panel';

type EditableCustomerField =
    | 'company'
    | 'email'
    | 'reference'
    | 'customerReference'
    | 'date'
    | 'extraNotes';

function createCustomerInfoPatch<Field extends EditableCustomerField>(
    field: Field,
    value: CustomerInfo[Field]
): Pick<CustomerInfo, Field> {
    return { [field]: value } as Pick<CustomerInfo, Field>;
}

export function CustomerInfoForm() {
    const { state, dispatch } = useQuote();
    const { customerInfo, quoteValidityDays } = state;

    const handleChange = (field: EditableCustomerField, value: string): void => {
        dispatch({
            type: 'SET_CUSTOMER_INFO',
            payload: createCustomerInfoPatch(field, value)
        });
    };

    return (
        <Panel title="Kundinformation" className="mb-6">
            <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="customer-company" className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Företag / organisation *</label>
                    <input
                        id="customer-company"
                        name="customerCompany"
                        type="text"
                        autoComplete="organization"
                        required
                        value={customerInfo.company || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('company', event.target.value)}
                        placeholder="Företagsnamn"
                        className="rounded-control border border-control-border bg-input px-3 py-2 text-sm text-text transition-colors placeholder:text-text-muted"
                    />
                    <span className="text-xs text-text-muted">Krävs för att identifiera och spara offerten.</span>
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="customer-email" className="text-xs font-semibold uppercase text-text-secondary tracking-wider">E-post (för offert / signering)</label>
                    <input
                        id="customer-email"
                        name="customerEmail"
                        type="email"
                        autoComplete="email"
                        value={customerInfo.email || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('email', event.target.value)}
                        placeholder="kund@exempel.se"
                        className="rounded-control border border-control-border bg-input px-3 py-2 text-sm text-text transition-colors placeholder:text-text-muted"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="project-reference" className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Projektreferens</label>
                    <input
                        id="project-reference"
                        name="projectReference"
                        type="text"
                        value={customerInfo.reference || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('reference', event.target.value)}
                        placeholder="Referens eller projektnamn"
                        className="rounded-control border border-control-border bg-input px-3 py-2 text-sm text-text transition-colors placeholder:text-text-muted"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="customer-reference" className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Er referens</label>
                    <input
                        id="customer-reference"
                        name="customerReference"
                        type="text"
                        value={customerInfo.customerReference || ''}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('customerReference', event.target.value)}
                        placeholder="Kundens referens"
                        className="rounded-control border border-control-border bg-input px-3 py-2 text-sm text-text transition-colors placeholder:text-text-muted"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="quote-date" className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Offertdatum</label>
                    <input
                        id="quote-date"
                        name="quoteDate"
                        type="date"
                        value={customerInfo.date || new Date().toISOString().split('T')[0]}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange('date', event.target.value)}
                        className="rounded-control border border-control-border bg-input px-3 py-2 text-sm text-text transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="quote-validity-days" className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Giltig i (dagar)</label>
                    <input
                        id="quote-validity-days"
                        name="quoteValidityDays"
                        type="number"
                        min="1"
                        step="1"
                        value={quoteValidityDays}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => dispatch({
                            type: 'SET_QUOTE_VALIDITY_DAYS',
                            payload: Number.parseInt(event.target.value, 10) || 0
                        })}
                        className="rounded-control border border-control-border bg-input px-3 py-2 text-sm text-text transition-colors"
                    />
                </div>
            </div>
            <div className="flex flex-col gap-1.5 px-6 pb-6">
                <label htmlFor="customer-extra-notes" className="text-xs font-semibold uppercase text-text-secondary tracking-wider">Extra noteringar (visas på PDF)</label>
                <textarea
                    id="customer-extra-notes"
                    name="customerExtraNotes"
                    value={customerInfo.extraNotes || ''}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => handleChange('extraNotes', event.target.value)}
                    placeholder={'T.ex. "Gäller lagerparasoller"'}
                    className="min-h-[80px] resize-y rounded-control border border-control-border bg-input px-3 py-2 text-sm text-text transition-colors placeholder:text-text-muted"
                />
            </div>
        </Panel>
    );
}
