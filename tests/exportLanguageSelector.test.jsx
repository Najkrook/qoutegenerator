// @vitest-environment jsdom

import React, { useReducer } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportLanguageSelector } from '../src/components/features/ExportLanguageSelector';
import { QuoteContext, quoteReducer } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function SelectorHarness({ onDispatch }) {
    const [state, reducerDispatch] = useReducer(quoteReducer, createInitialQuoteState());
    const dispatch = (action) => {
        onDispatch(action);
        reducerDispatch(action);
    };

    return (
        <QuoteContext.Provider value={{ state, dispatch }}>
            <ExportLanguageSelector />
            <ExportLanguageSelector />
        </QuoteContext.Provider>
    );
}

describe('ExportLanguageSelector', () => {
    it('keeps multiple instances synchronized through quote state', () => {
        const dispatch = vi.fn();
        render(<SelectorHarness onDispatch={dispatch} />);

        const englishButtons = screen.getAllByRole('button', { name: 'EN' });
        fireEvent.click(englishButtons[0]);

        expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_EXPORT_LANGUAGE', payload: 'en' });
        expect(screen.getAllByRole('button', { name: 'EN' }).every((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);

        fireEvent.click(screen.getAllByRole('button', { name: 'SV' })[1]);

        expect(dispatch).toHaveBeenLastCalledWith({ type: 'SET_EXPORT_LANGUAGE', payload: 'sv' });
        expect(screen.getAllByRole('button', { name: 'SV' }).every((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);
        expect(screen.getAllByRole('group', { name: 'Exportspråk' })).toHaveLength(2);
    });
});
