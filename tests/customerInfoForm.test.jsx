import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerInfoForm } from '../src/components/features/CustomerInfoForm.jsx';
import { QuoteContext } from '../src/store/QuoteContext.jsx';

function renderForm(stateOverrides = {}) {
    const value = {
        state: {
            customerInfo: {
                name: '',
                company: 'Two Forks',
                email: 'kund@exempel.se',
                reference: 'PROJ-1',
                customerReference: 'ER-1',
                date: '2026-03-19',
                validity: '30 dagar'
            },
            quoteValidityDays: 30,
            ...stateOverrides
        },
        dispatch: vi.fn()
    };

    return renderToStaticMarkup(
        <QuoteContext.Provider value={value}>
            <CustomerInfoForm />
        </QuoteContext.Provider>
    );
}

describe('CustomerInfoForm', () => {
    it('does not render the legacy customer-name input', () => {
        const html = renderForm();

        expect(html).not.toContain('Kundnamn');
        expect(html).toContain('Företag / Organisation');
        expect(html).toContain('Er referens');
    });

    it('renders project reference before customer reference', () => {
        const html = renderForm();

        expect(html.indexOf('Projektreferens')).toBeLessThan(html.indexOf('Er referens'));
    });
});
