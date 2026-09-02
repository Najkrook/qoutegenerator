// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Header } from '../src/components/layout/Header';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function createAuth(overrides = {}) {
    return {
        user: { uid: 'user-1', email: 'user@example.com' },
        loading: false,
        accessLevel: 'quote-only',
        canViewEverything: false,
        canStartQuote: true,
        canAccessSketch: false,
        canAccessQuoteHistory: true,
        canExportSketchToQuote: false,
        login: vi.fn(),
        logout: vi.fn(async () => {}),
        retailer: null,
        isRetailer: false,
        ...overrides
    };
}

function renderHeader({
    auth = createAuth(),
    route = '/',
    state = createInitialQuoteState(),
    dispatch = vi.fn()
} = {}) {
    const result = render(
        <MemoryRouter initialEntries={[route]}>
            <AuthContext.Provider value={auth}>
                <QuoteContext.Provider value={{ state, dispatch }}>
                    <Header />
                    <LocationProbe />
                </QuoteContext.Provider>
            </AuthContext.Provider>
        </MemoryRouter>
    );

    return { ...result, dispatch };
}

describe('AppShell navigation', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'requestAnimationFrame', {
            configurable: true,
            value: (callback) => {
                callback();
                return 1;
            }
        });
    });

    afterEach(() => {
        cleanup();
        document.body.style.overflow = '';
    });

    it('shows only the navigation groups available to a quote-only user', () => {
        renderHeader();

        expect(screen.getByRole('button', { name: 'Ny offert' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Prislista' }).getAttribute('href')).toBe('/price-list');
        expect(screen.getByRole('link', { name: 'Offerter' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Mer' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'CRM' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Lager' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Skiss' })).toBeNull();
    });

    it('shows admin and retailer destinations only for the matching role', () => {
        const admin = renderHeader({
            auth: createAuth({
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true,
                canExportSketchToQuote: true
            })
        });

        const adminPrimaryRow = screen.getByRole('group', { name: 'Primära funktioner' });
        const adminSecondaryRow = screen.getByRole('group', { name: 'Övriga funktioner' });
        expect(within(adminPrimaryRow).getByRole('link', { name: 'CRM' })).toBeTruthy();
        expect(within(adminSecondaryRow).getByRole('link', { name: 'Lager' })).toBeTruthy();
        expect(within(adminSecondaryRow).getByRole('link', { name: 'Orderförfrågningar' })).toBeTruthy();
        const masseKladdLink = within(adminSecondaryRow).getByRole('link', { name: 'Masse Kladd' });
        expect(masseKladdLink.getAttribute('href')).toBe('https://masse-kladd.web.app');
        expect(masseKladdLink.getAttribute('target')).toBe('_blank');
        expect(masseKladdLink.getAttribute('rel')).toBe('noopener noreferrer');
        expect(screen.queryByRole('button', { name: 'Mer' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Mina ordrar' })).toBeNull();

        admin.unmount();
        renderHeader({
            auth: createAuth({
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: { id: 'retailer-1', name: 'Nordvind' }
            })
        });

        const retailerPrimaryRow = screen.getByRole('group', { name: 'Primära funktioner' });
        const retailerSecondaryRow = screen.getByRole('group', { name: 'Övriga funktioner' });
        expect(within(retailerSecondaryRow).getByRole('link', { name: 'Mina ordrar' })).toBeTruthy();
        expect(within(retailerSecondaryRow).getByRole('link', { name: 'Dokument' })).toBeTruthy();
        expect(within(retailerPrimaryRow).getByRole('link', { name: 'Prislista' })).toBeTruthy();
        expect(within(retailerPrimaryRow).queryByRole('link', { name: 'Mina ordrar' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Mer' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'CRM' })).toBeNull();
    });

    it('shows QR destinations to admins and routes the generator click', () => {
        renderHeader({
            auth: createAuth({
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true
            })
        });

        fireEvent.click(screen.getByRole('button', { name: 'Meny' }));
        const mobileNavigation = screen.getByRole('navigation', { name: 'Mobil huvudnavigation' });
        expect(within(mobileNavigation).getByRole('link', { name: 'Skanna parasoll' }).getAttribute('href')).toBe('/scan');
        const qrLink = within(mobileNavigation).getByRole('link', { name: 'QR-etiketter' });
        expect(qrLink.getAttribute('href')).toBe('/inventory/qr');
        const mobileMasseKladdLink = within(mobileNavigation).getByRole('link', { name: 'Masse Kladd' });
        expect(mobileMasseKladdLink.getAttribute('href')).toBe('https://masse-kladd.web.app');
        expect(mobileMasseKladdLink.getAttribute('target')).toBe('_blank');

        fireEvent.click(qrLink);
        expect(screen.getByTestId('location').textContent).toBe('/inventory/qr');
    });

    it('shows every authorized admin destination directly in two desktop rows', () => {
        renderHeader({
            auth: createAuth({
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true
            })
        });
        const primaryRow = screen.getByRole('group', { name: 'Primära funktioner' });
        const secondaryRow = screen.getByRole('group', { name: 'Övriga funktioner' });

        expect(Array.from(primaryRow.querySelectorAll('a, button')).map((item) => item.textContent)).toEqual([
            'Hem',
            'Ny offert',
            'Prislista',
            'Offerter',
            'CRM'
        ]);
        expect(within(secondaryRow).getAllByRole('link').map((item) => item.textContent)).toEqual([
            'Orderförfrågningar',
            'Skiss',
            'Skanna parasoll',
            'Lager',
            'Planering',
            'Återförsäljare',
            'Dokument',
            'Aktiviteter',
            'Lagerloggar',
            'QR-etiketter',
            'Masse Kladd'
        ]);
        expect(secondaryRow.className).toContain('border-t');
        expect(screen.queryByRole('button', { name: 'Mer' })).toBeNull();
    });

    it('opens an accessible mobile drawer, closes with Escape, and restores focus', () => {
        renderHeader();
        const menuButton = screen.getByRole('button', { name: 'Meny' });

        fireEvent.click(menuButton);

        expect(menuButton.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('dialog', { name: 'Meny' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Stäng' })).toBe(document.activeElement);
        expect(document.body.style.overflow).toBe('hidden');

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog', { name: 'Meny' })).toBeNull();
        expect(menuButton.getAttribute('aria-expanded')).toBe('false');
        expect(menuButton).toBe(document.activeElement);
    });

    it('keeps locked quote steps focusable and explains their blocker', () => {
        renderHeader({ route: '/quote/new/product-lines' });

        const configurationStep = screen.getByRole('button', { name: /Konfiguration/ });
        expect(configurationStep.getAttribute('aria-disabled')).toBe('true');
        expect(configurationStep.hasAttribute('disabled')).toBe(false);
        const descriptionId = configurationStep.getAttribute('aria-describedby');
        expect(document.getElementById(descriptionId)?.textContent).toContain(
            'Slutför steg 1, Offertinnehåll'
        );

        configurationStep.focus();
        fireEvent.click(configurationStep);
        expect(screen.getByTestId('location').textContent).toBe('/quote/new/product-lines');
    });

    it('preserves CRM context between quote steps but drops it for a global new quote', () => {
        const state = {
            ...createInitialQuoteState(),
            selectedLines: ['BaHaMa'],
            builderItems: [{
                id: 'item-1',
                line: 'BaHaMa',
                model: 'Jumbrella',
                size: '4x4 Kvadrat',
                qty: 1,
                discountPct: 0,
                addons: []
            }]
        };
        const { unmount } = renderHeader({
            route: '/quote/new/pricing?crmDealId=deal-1&quoteOwnerUid=owner-1',
            state
        });

        fireEvent.click(screen.getByRole('link', { name: /Sammanställning/ }));
        expect(screen.getByTestId('location').textContent).toBe(
            '/quote/new/summary?crmDealId=deal-1&quoteOwnerUid=owner-1'
        );

        unmount();
        const emptyState = createInitialQuoteState();
        const second = renderHeader({
            route: '/quote/new/configuration?crmDealId=deal-1&quoteOwnerUid=owner-1',
            state: emptyState
        });

        fireEvent.click(screen.getByRole('button', { name: 'Ny offert' }));
        expect(screen.getByTestId('location').textContent).toBe('/quote/new/product-lines');
        expect(second.dispatch).toHaveBeenCalledWith({ type: 'RESET_QUOTE_DRAFT' });
    });

    it('marks CRM subroutes active and does not mark Lager active on Lagerloggar', () => {
        const auth = createAuth({
            accessLevel: 'full',
            canViewEverything: true,
            canAccessSketch: true
        });
        const first = renderHeader({ auth, route: '/crm/deals/deal-1' });
        expect(screen.getByRole('link', { name: 'CRM' }).getAttribute('aria-current')).toBe('page');

        first.unmount();
        renderHeader({ auth, route: '/inventory/logs' });
        expect(screen.getByRole('link', { name: 'Lagerloggar' }).getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('link', { name: 'Lager' }).getAttribute('aria-current')).toBeNull();
    });

    it('provides a skip link to the application content', () => {
        renderHeader();

        expect(screen.getByRole('link', { name: 'Hoppa till innehållet' }).getAttribute('href')).toBe('#main-content');
    });
});
