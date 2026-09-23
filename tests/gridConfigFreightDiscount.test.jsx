// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GridConfig } from '../src/components/features/GridConfig';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

afterEach(cleanup);

describe('ClickitUp freight discount defaults', () => {
    it.each(['ClickitUp', 'ClickitUpFixed'])('creates %s freight rows at zero percent', (lineId) => {
        const dispatch = vi.fn();
        const state = {
            ...createInitialQuoteState(),
            globalDiscountPct: 12,
            gridSelections: {
                [lineId]: {
                    items: { 'ClickitUp Sektion|1000': { qty: 1, discountPct: 12 } },
                    addons: {},
                    customAddonsByCategory: {},
                    customItems: []
                }
            }
        };

        render(
            <QuoteContext.Provider value={{ state, dispatch }}>
                <GridConfig lineId={lineId} />
            </QuoteContext.Provider>
        );

        fireEvent.click(screen.getAllByRole('button', { name: /Lägg till egen rad/ })[0]);
        expect(dispatch.mock.lastCall[0].payload[lineId].customAddonsByCategory.freight[0].discountPct).toBe(0);

        const freightRow = screen.getByText('Glasfrakt Specialpall').closest('tr');
        fireEvent.click(within(freightRow).getByRole('button', { name: '+' }));
        expect(dispatch.mock.lastCall[0].payload[lineId].addons.frakt_glas).toMatchObject({
            discountPct: 0,
            discountSyncMode: 'manual'
        });
    });
});
