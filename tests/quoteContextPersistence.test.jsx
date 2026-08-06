// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuoteProvider, useQuote } from '../src/store/QuoteContext';
import { getQuoteStateStorageKey } from '../src/store/quoteStatePersistence';

function PersistenceHarness() {
    const { dispatch } = useQuote();
    return (
        <button
            type="button"
            onClick={() => dispatch({
                type: 'SET_CUSTOMER_INFO',
                payload: { company: 'Debounce AB' }
            })}
        >
            Uppdatera kund
        </button>
    );
}

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.useRealTimers();
});

describe('QuoteProvider persistence scheduling', () => {
    it('coalesces rapid state changes before writing the full quote state', () => {
        vi.useFakeTimers();
        const ownerUid = 'debounce-user';
        const storageKey = getQuoteStateStorageKey(ownerUid);

        render(
            <QuoteProvider ownerUid={ownerUid}>
                <PersistenceHarness />
            </QuoteProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Uppdatera kund' }));
        expect(localStorage.getItem(storageKey)).toBeNull();

        act(() => {
            vi.advanceTimersByTime(249);
        });
        expect(localStorage.getItem(storageKey)).toBeNull();

        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(JSON.parse(localStorage.getItem(storageKey)).customerInfo.company).toBe('Debounce AB');
    });
});
