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

        expect(screen.getByRole('link', { name: 'CRM' })).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'Lager' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Mer' }));
        expect(screen.getByRole('link', { name: 'Lager' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Orderförfrågningar' })).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'Mina ordrar' })).toBeNull();

        admin.unmount();
        renderHeader({
            auth: createAuth({
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: { id: 'retailer-1', name: 'Nordvind' }
            })
        });

        expect(screen.getByRole('link', { name: 'Mina ordrar' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Dokument' })).toBeTruthy();
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

        fireEvent.click(qrLink);
        expect(screen.getByTestId('location').textContent).toBe('/inventory/qr');
    });

    it('opens the compact desktop disclosure and restores focus with Escape', () => {
        renderHeader({
            auth: createAuth({
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true
            })
        });
        const moreButton = screen.getByRole('button', { name: 'Mer' });

        expect(moreButton.getAttribute('aria-expanded')).toBe('false');
        expect(moreButton.getAttribute('aria-haspopup')).toBe('true');
        expect(screen.queryByRole('region', { name: 'Fler destinationer' })).toBeNull();

        fireEvent.click(moreButton);

        expect(moreButton.getAttribute('aria-expanded')).toBe('true');
        const morePanel = screen.getByRole('region', { name: 'Fler destinationer' });
        expect(morePanel).toBeTruthy();
        expect(morePanel.className).toContain('w-[min(22rem,calc(100vw-2rem))]');
        expect(morePanel.querySelector('.grid-cols-2')).toBeNull();
        expect(screen.getByText('Drift').tagName).toBe('P');
        expect(
            Array.from(morePanel.querySelectorAll('section')).every(
                (section) => !section.className.includes('rounded-control')
            )
        ).toBe(true);
        expect(screen.getByRole('link', { name: 'Planering' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Återförsäljare' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Aktiviteter' })).toBeTruthy();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('region', { name: 'Fler destinationer' })).toBeNull();
        expect(moreButton.getAttribute('aria-expanded')).toBe('false');
        expect(moreButton).toBe(document.activeElement);
    });

    it('closes the compact desktop disclosure when focus moves outside it', () => {
        renderHeader({
            auth: createAuth({
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true
            })
        });
        const moreButton = screen.getByRole('button', { name: 'Mer' });
        const homeLink = screen.getByRole('link', { name: 'Hem' });

        fireEvent.click(moreButton);
        expect(screen.getByRole('region', { name: 'Fler destinationer' })).toBeTruthy();

        homeLink.focus();
        fireEvent.focusIn(homeLink);

        expect(screen.queryByRole('region', { name: 'Fler destinationer' })).toBeTruthy();

        screen.getByText('Brixx portal').focus();
        fireEvent.focusIn(document.body);

        expect(screen.queryByRole('region', { name: 'Fler destinationer' })).toBeNull();
    });

    it('closes the compact desktop disclosure on an outside pointer press', () => {
        renderHeader({
            auth: createAuth({
                accessLevel: 'full',
                canViewEverything: true,
                canAccessSketch: true
            })
        });
        const moreButton = screen.getByRole('button', { name: 'Mer' });

        fireEvent.click(moreButton);
        expect(screen.getByRole('region', { name: 'Fler destinationer' })).toBeTruthy();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByRole('region', { name: 'Fler destinationer' })).toBeNull();
        expect(moreButton.getAttribute('aria-expanded')).toBe('false');
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
        const moreButton = screen.getByRole('button', { name: 'Mer, aktuell sida: Lagerloggar' });
        expect(moreButton.textContent).toBe('Mer');
        fireEvent.click(moreButton);
        expect(screen.getByRole('link', { name: 'Lagerloggar' }).getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('link', { name: 'Lager' }).getAttribute('aria-current')).toBeNull();
    });

    it('provides a skip link to the application content', () => {
        renderHeader();

        expect(screen.getByRole('link', { name: 'Hoppa till innehållet' }).getAttribute('href')).toBe('#main-content');
    });
});
