// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerInfoForm } from '../src/components/features/CustomerInfoForm';
import { QuoteContext } from '../src/store/QuoteContext';

function renderForm(stateOverrides = {}) {
    const dispatch = vi.fn();
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
        dispatch
    };

    const renderResult = render(
        <QuoteContext.Provider value={value}>
            <CustomerInfoForm />
        </QuoteContext.Provider>
    );

    return { ...renderResult, dispatch };
}

afterEach(() => {
    cleanup();
});

describe('CustomerInfoForm', () => {
    it('associates every customer field with a visible label and useful browser metadata', () => {
        renderForm();

        expect(screen.getByRole('heading', { name: 'Kundinformation' })).toBeTruthy();
        expect(screen.queryByLabelText('Kundnamn')).toBeNull();

        const company = screen.getByLabelText(/Företag \/ organisation/);
        const email = screen.getByLabelText('E-post (för offert / signering)');
        const projectReference = screen.getByLabelText('Projektreferens');
        const customerReference = screen.getByLabelText('Er referens');
        const date = screen.getByLabelText('Offertdatum');
        const validity = screen.getByLabelText('Giltig i (dagar)');
        const notes = screen.getByLabelText('Extra noteringar (visas på PDF)');

        expect(company.getAttribute('name')).toBe('customerCompany');
        expect(company.getAttribute('autocomplete')).toBe('organization');
        expect(company.hasAttribute('required')).toBe(true);
        expect(email.getAttribute('name')).toBe('customerEmail');
        expect(email.getAttribute('type')).toBe('email');
        expect(email.getAttribute('autocomplete')).toBe('email');
        expect(projectReference).toBeTruthy();
        expect(customerReference).toBeTruthy();
        expect(date.getAttribute('type')).toBe('date');
        expect(validity.getAttribute('type')).toBe('number');
        expect(validity.getAttribute('min')).toBe('1');
        expect(validity.getAttribute('step')).toBe('1');
        expect(notes.tagName).toBe('TEXTAREA');
    });

    it('renders project reference before customer reference', () => {
        const { container } = renderForm();

        expect(container.textContent.indexOf('Projektreferens'))
            .toBeLessThan(container.textContent.indexOf('Er referens'));
    });

    it('dispatches customer and validity changes with the expected actions', () => {
        const { dispatch } = renderForm();

        fireEvent.change(screen.getByLabelText(/Företag \/ organisation/), {
            target: { value: 'Nytt AB' }
        });
        fireEvent.change(screen.getByLabelText('Giltig i (dagar)'), {
            target: { value: '45' }
        });

        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_CUSTOMER_INFO',
            payload: { company: 'Nytt AB' }
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_QUOTE_VALIDITY_DAYS',
            payload: 45
        });
    });
});
