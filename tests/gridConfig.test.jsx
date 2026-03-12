import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const quoteState = vi.hoisted(() => ({
    value: {
        state: {
            gridSelections: {},
            globalDiscountPct: 0
        },
        dispatch: vi.fn()
    }
}));

vi.mock('../src/store/QuoteContext.jsx', () => ({
    useQuote: () => quoteState.value
}));

import { GridConfig } from '../src/components/features/GridConfig.jsx';

describe('GridConfig auto-scale add-ons', () => {
    beforeEach(() => {
        quoteState.value = {
            state: {
                globalDiscountPct: 0,
                gridSelections: {
                    ClickitUP: {
                        items: {
                            'ClickitUP Section|1500': { qty: 4, discountPct: 0 },
                            'ClickitUP Section|1600': { qty: 3, discountPct: 0 }
                        },
                        addons: {}
                    }
                }
            },
            dispatch: vi.fn()
        };
    });

    it('renders auto-sync controls for ClickitUp recommended add-ons by default', () => {
        const html = renderToStaticMarkup(<GridConfig lineId="ClickitUP" />);

        expect(html).toContain('Svartanodiserade profiler');
        expect(html).toContain('Stoppknapp 140 cm');
        expect((html.match(/aria-pressed=\"true\"/g) || []).length).toBe(2);
        expect((html.match(/value=\"7\"/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    it('renders a manual auto-scale row as inactive while leaving missing rows auto', () => {
        quoteState.value = {
            state: {
                globalDiscountPct: 0,
                gridSelections: {
                    ClickitUP: {
                        items: {
                            'ClickitUP Section|1500': { qty: 4, discountPct: 0 },
                            'ClickitUP Section|1600': { qty: 3, discountPct: 0 }
                        },
                        addons: {
                            svartanodiserade: { qty: 4, discountPct: 0, syncMode: 'manual' }
                        }
                    }
                }
            },
            dispatch: vi.fn()
        };

        const html = renderToStaticMarkup(<GridConfig lineId="ClickitUP" />);

        expect(html).toContain('Svartanodiserade profiler');
        expect(html).toContain('Stoppknapp 140 cm');
        expect(html).toContain('aria-pressed="false"');
        expect(html).toContain('aria-pressed="true"');
    });
});
