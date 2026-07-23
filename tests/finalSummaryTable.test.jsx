import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FinalSummaryTable } from '../src/components/features/FinalSummaryTable';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function renderSummary(stateOverrides = {}) {
    const state = {
        ...createInitialQuoteState(),
        selectedLines: ['ClickitUp', 'ClickitUpFixed'],
        builderItems: [],
        gridSelections: {
            ClickitUp: {
                items: {
                    'ClickitUp Sektion|1000': { qty: 1, discountPct: 10 }
                },
                addons: {
                    frakt_glas: { qty: 1, discountPct: 10 }
                },
                customAddonsByCategory: {}
            },
            ClickitUpFixed: {
                items: {
                    'ClickitUp Dörr|1000': { qty: 1, discountPct: 10 }
                },
                addons: {},
                customAddonsByCategory: {}
            }
        },
        globalDiscountPct: 10,
        includesVat: true,
        ...stateOverrides
    };

    return renderToStaticMarkup(
        <QuoteContext.Provider value={{ state, dispatch: vi.fn() }}>
            <FinalSummaryTable />
        </QuoteContext.Provider>
    );
}

describe('FinalSummaryTable localization', () => {
    it('renders English customer-facing headings, totals, and ClickitUp rows', () => {
        const html = renderSummary({ exportLanguage: 'en' });

        expect(html).toContain('ClickitUp section');
        expect(html).toContain('Add-on: Glass freight – special pallet');
        expect(html).toContain('CiUFixedDoor');
        expect(html).toContain('Model');
        expect(html).toContain('Size');
        expect(html).toContain('Your Price (Incl. VAT)');
        expect(html).toContain('Recommended Price (Incl. VAT)');
        expect(html).toContain('Gross (Incl. VAT):');
        expect(html).toContain('Total Discount (Incl. VAT):');
        expect(html).toContain('VAT 25%');
        expect(html).toContain('Total amount due (Incl. VAT)');
        expect(html).toContain('Visa priser inklusive 25% moms');
    });

    it('keeps the existing Swedish summary terminology', () => {
        const html = renderSummary({ exportLanguage: 'sv' });

        expect(html).toContain('ClickitUp Sektion');
        expect(html).toContain('Tillval: Glasfrakt Specialpall');
        expect(html).toContain('ClickitUp Dörr');
        expect(html).toContain('Ert pris (Inkl. moms)');
        expect(html).toContain('Brutto (inkl. moms):');
        expect(html).toContain('Totalt att betala (inkl. moms)');
    });
});
