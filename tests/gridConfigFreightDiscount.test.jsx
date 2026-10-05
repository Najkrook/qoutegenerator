// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GridConfig } from '../src/components/features/GridConfig';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState, hydrateQuoteState } from '../src/store/quoteStateSchema';

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


describe('custom freight deductions', () => {
    it('accepts a leading minus and decimal comma, displays the deduction, and preserves it after hydration', () => {
        let latestState;
        function Harness() {
            const [state, setState] = useState({
                ...createInitialQuoteState(),
                gridSelections: {
                    ClickitUp: {
                        items: {}, addons: {}, customItems: [],
                        customAddonsByCategory: {
                            freight: [{ id: 'return', name: 'Pallet return', price: 680, qty: 3, discountPct: 0 }]
                        }
                    }
                }
            });
            latestState = state;
            return <QuoteContext.Provider value={{ state, dispatch: (action) => setState({ ...state, gridSelections: action.payload }) }}>
                <GridConfig lineId="ClickitUp" />
            </QuoteContext.Provider>;
        }
        render(<Harness />);
        const row = screen.getByDisplayValue('Pallet return').closest('tr');
        const input = within(row).getByDisplayValue('680');
        fireEvent.change(input, { target: { value: '-' } });
        expect(input.value).toBe('-');
        fireEvent.change(input, { target: { value: '-680' } });
        expect(row.lastElementChild.textContent).toBe(`${(-2040).toLocaleString('sv-SE')} SEK`);
        fireEvent.change(input, { target: { value: '-680,50' } });
        fireEvent.blur(input);
        expect(input.value).toBe('-680.5');
        const restored = hydrateQuoteState(JSON.parse(JSON.stringify(latestState)));
        expect(restored.gridSelections.ClickitUp.customAddonsByCategory.freight[0]).toMatchObject({ price: -680.5, qty: 3 });
        expect(within(row).getByRole('spinbutton').min).toBe('0');
    });
});
