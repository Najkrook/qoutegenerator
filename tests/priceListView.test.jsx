/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PriceList } from '../src/views/PriceList';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function renderPriceList({ auth = {}, route = '/price-list' } = {}) {
    const dispatch = vi.fn();
    const authValue = {
        user: { uid: 'user-1', email: 'user@example.com' },
        loading: false,
        accessLevel: 'quote-only',
        canViewEverything: false,
        canStartQuote: true,
        canAccessSketch: false,
        canAccessQuoteHistory: true,
        canExportSketchToQuote: false,
        login: vi.fn(),
        logout: vi.fn(),
        retailer: null,
        isRetailer: false,
        ...auth
    };

    const result = render(
        <MemoryRouter initialEntries={[route]}>
            <AuthContext.Provider value={authValue}>
                <QuoteContext.Provider value={{ state: createInitialQuoteState(), dispatch }}>
                    <PriceList />
                </QuoteContext.Provider>
            </AuthContext.Provider>
        </MemoryRouter>
    );

    return { ...result, dispatch };
}

afterEach(cleanup);

describe('PriceList', () => {
    it('starts categories collapsed and reveals labeled shape groups when opened', () => {
        renderPriceList({
            route: '/price-list?line=BaHaMa&kind=product&q=Jumbrella'
        });

        const summary = screen.getByText('Jumbrella', { selector: 'h3' }).closest('summary');
        const details = summary.closest('details');
        const categories = Array.from(document.querySelectorAll('details'));

        expect(categories.length).toBeGreaterThan(1);
        expect(categories.every((category) => category.open === false)).toBe(true);
        expect(details.open).toBe(false);
        expect(summary.getAttribute('aria-label')).toContain('Visa eller dölj Jumbrella');

        fireEvent.click(summary);

        expect(details.open).toBe(true);
        const jumbrellaTable = screen.getByRole('table', {
            name: 'Prislista för BaHaMa, Jumbrella'
        });
        const categoryLabels = Array.from(
            jumbrellaTable.querySelectorAll('tbody th[scope="rowgroup"]')
        ).map((heading) => heading.textContent.trim());

        expect(categoryLabels).toEqual(['Kvadrat', 'Runda', 'Rektangel']);
    });

    it('supports URL filters and interactive search without changing quote state', () => {
        const { container, dispatch } = renderPriceList({
            route: '/price-list?line=ClickitUp&kind=product&q=sektion%20700'
        });

        expect(screen.getByRole('heading', { level: 1, name: 'Prislista' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'ClickitUp' }).getAttribute('aria-pressed')).toBe('true');
        expect(container.textContent).toContain('ClickitUp Sektion');
        expect(container.textContent).not.toContain('Jumbrella');

        fireEvent.change(screen.getByRole('searchbox', { name: 'Sök i prislistan' }), {
            target: { value: 'curved' }
        });

        expect(container.textContent).toContain('Curved Rundat Hörn');
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('shows only enabled retailer lines and calculates the agreed price', () => {
        const { container } = renderPriceList({
            auth: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: {
                    id: 'retailer-1',
                    name: 'Markishuset',
                    productLines: {
                        BaHaMa: { enabled: true, discountPct: 20 },
                        ClickitUp: { enabled: false, discountPct: 10 }
                    }
                }
            },
            route: '/price-list?line=BaHaMa&q=3x3%20Kvadrat&kind=product'
        });

        expect(screen.getByRole('button', { name: 'BaHaMa' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'ClickitUp' })).toBeNull();
        expect(container.textContent).toContain('20% rabatt');
        expect(container.textContent).toContain('2 390 EUR');
        expect(container.textContent).toContain('29 158 SEK');
        expect(container.textContent).toContain('23 326 SEK');
        expect(container.textContent).not.toContain('ClickitUp Sektion');
    });

    it('renders price-on-request rows without calculated amounts', () => {
        const { container } = renderPriceList({
            route: '/price-list?line=BaHaMa&q=outside_classic_light_4'
        });

        expect(container.textContent).toContain('Inga priser matchar sökningen');

        fireEvent.change(screen.getByRole('searchbox', { name: 'Sök i prislistan' }), {
            target: { value: 'LED-Lighting with 4 RGBW-LED strips' }
        });

        expect(container.textContent).toContain('Pris på förfrågan');
    });
});
