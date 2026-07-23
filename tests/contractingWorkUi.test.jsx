// @vitest-environment jsdom

import React, { useReducer } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ContractingWorkEditor } from '../src/components/features/ContractingWorkEditor';
import {
    ContractingWorkPricing,
    normalizeAtaPercentInput,
    normalizeContractingPriceInput,
    normalizeMarginPercentInput
} from '../src/components/features/ContractingWorkPricing';
import { ProductLineSelection } from '../src/views/ProductLineSelection';
import { Configuration } from '../src/views/Configuration';
import { Pricing } from '../src/views/Pricing';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext, quoteReducer } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

vi.mock('../src/components/features/PricingTable', () => ({
    PricingTable: () => <div>Product pricing table</div>
}));

vi.mock('../src/components/features/CustomCosts', () => ({
    CustomCosts: () => <div>Product custom costs</div>
}));

vi.mock('../src/components/features/MarginSummaryPanel', () => ({
    MarginSummaryPanel: () => <div>Product margin summary</div>
}));

const baseAuth = {
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
    isRetailer: false
};

function TestProviders({ children, initialState, auth = {} }) {
    const [state, dispatch] = useReducer(quoteReducer, initialState);

    return (
        <AuthContext.Provider value={{ ...baseAuth, ...auth }}>
            <QuoteContext.Provider value={{ state, dispatch }}>
                {children}
                <output data-testid="contracting-state">
                    {JSON.stringify(state.contractingWork)}
                </output>
            </QuoteContext.Provider>
        </AuthContext.Provider>
    );
}

function createContractingState(overrides = {}) {
    return {
        ...createInitialQuoteState(),
        contractingWork: {
            enabled: true,
            projectName: 'Designer Village',
            rows: [{
                id: 'work-1',
                workPackage: 'Markarbete',
                scope: 'Schaktning och gjutning av fundament.',
                unit: 'Samlat arbetspaket',
                priceExVatSek: 0
            }],
            margin: {
                enabled: false,
                percent: 15
            },
            ata: {
                enabled: false,
                percent: 15
            },
            ...overrides
        }
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('contracting-work quote UI', () => {
    it('shows the fifth offer-content card for full and quote-only users but never retailers', () => {
        const initialState = createInitialQuoteState();
        const { unmount } = render(
            <TestProviders initialState={initialState}>
                <ProductLineSelection onNext={() => {}} />
            </TestProviders>
        );

        expect(screen.getByTestId('contracting-work-option')).toBeTruthy();
        unmount();

        const fullAccessRender = render(
            <TestProviders
                initialState={initialState}
                auth={{ accessLevel: 'full', canViewEverything: true }}
            >
                <ProductLineSelection onNext={() => {}} />
            </TestProviders>
        );

        expect(screen.getByTestId('contracting-work-option')).toBeTruthy();
        fullAccessRender.unmount();

        render(
            <TestProviders
                initialState={initialState}
                auth={{
                    accessLevel: 'retailer',
                    isRetailer: true,
                    retailer: {
                        id: 'retailer-1',
                        name: 'Retailer',
                        email: 'retailer@example.com',
                        productLines: { BaHaMa: { enabled: true, discountPct: 10 } }
                    }
                }}
            >
                <ProductLineSelection onNext={() => {}} />
            </TestProviders>
        );

        expect(screen.queryByTestId('contracting-work-option')).toBeNull();
        expect(screen.queryByText('Entreprenadarbete')).toBeNull();
    });

    it('keeps contracting rows when the offer-content card is deselected', () => {
        render(
            <TestProviders initialState={createContractingState()}>
                <ProductLineSelection onNext={() => {}} />
            </TestProviders>
        );

        fireEvent.click(screen.getByRole('checkbox', { name: /Entreprenadarbete/i }));

        const nextState = JSON.parse(screen.getByTestId('contracting-state').textContent);
        expect(nextState.enabled).toBe(false);
        expect(nextState.rows).toHaveLength(1);
        expect(nextState.rows[0].workPackage).toBe('Markarbete');
    });

    it('supports adding, editing, and removing free-text work packages', () => {
        const emptyContractingState = createContractingState({ rows: [] });
        render(
            <TestProviders initialState={emptyContractingState}>
                <ContractingWorkEditor />
            </TestProviders>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Lägg till första arbetspaketet' }));
        const workPackageInput = screen.getByLabelText('Arbetspaket');
        const scopeInput = screen.getByLabelText('Omfattning');
        const unitInput = screen.getByLabelText('Enhet');

        fireEvent.change(workPackageInput, { target: { value: 'Fundament' } });
        fireEvent.change(scopeInput, { target: { value: 'Schaktning, armering och gjutning.' } });
        fireEvent.change(unitInput, { target: { value: 'Fast pris' } });

        let nextState = JSON.parse(screen.getByTestId('contracting-state').textContent);
        expect(nextState.rows[0]).toMatchObject({
            workPackage: 'Fundament',
            scope: 'Schaktning, armering och gjutning.',
            unit: 'Fast pris'
        });

        fireEvent.click(screen.getByRole('button', { name: 'Ta bort arbetspaket 1' }));
        nextState = JSON.parse(screen.getByTestId('contracting-state').textContent);
        expect(nextState.rows).toEqual([]);
    });

    it('requires a named work package before a contracting-only quote can continue', () => {
        const unnamedState = createContractingState({
            rows: [{
                id: 'work-1',
                workPackage: '',
                scope: 'Omfattning utan rubrik',
                unit: '',
                priceExVatSek: 0
            }]
        });
        const { unmount } = render(
            <TestProviders initialState={unnamedState}>
                <Configuration onNext={() => {}} onPrev={() => {}} />
            </TestProviders>
        );

        expect(screen.getByRole('button', { name: /Fortsätt till Prissättning/i }).disabled).toBe(true);
        expect(screen.getByText('Ange ett namn på minst ett arbetspaket för att fortsätta.')).toBeTruthy();
        unmount();

        render(
            <TestProviders initialState={createContractingState()}>
                <Configuration onNext={() => {}} onPrev={() => {}} />
            </TestProviders>
        );

        expect(screen.getByRole('button', { name: /Fortsätt till Prissättning/i }).disabled).toBe(false);
    });

    it('prices contracting work separately, adds an optional margin, and applies ATA to the customer total', () => {
        render(
            <TestProviders initialState={createContractingState()}>
                <ContractingWorkPricing />
            </TestProviders>
        );

        const matchesSek = (expected) => (content) => (
            content.replace(/\s/g, '') === `${expected}SEK`
        );
        const priceInput = screen.getByLabelText('Grundpris exkl. moms för Markarbete');
        const internalSummary = screen.getByLabelText('Intern entreprenadsummering');

        expect(screen.getByRole('columnheader', { name: 'Grundpris exkl. moms' })).toBeTruthy();
        expect(screen.queryByRole('columnheader', { name: 'Kundpris exkl. moms' })).toBeNull();
        fireEvent.change(priceInput, { target: { value: '-50' } });
        expect(Number(priceInput.value)).toBe(0);

        fireEvent.change(priceInput, { target: { value: '586180' } });
        expect(Number(priceInput.value)).toBe(586180);
        expect(within(internalSummary).getAllByText(matchesSek('586180'))).toHaveLength(2);

        const marginToggle = screen.getByRole('checkbox', { name: 'Lägg på marginal/påslag' });
        const marginInput = screen.getByLabelText('Marginal/påslag (%)');
        expect(marginInput.disabled).toBe(true);
        expect(Number(marginInput.value)).toBe(15);
        fireEvent.click(marginToggle);

        expect(marginInput.disabled).toBe(false);
        expect(screen.getByRole('columnheader', { name: 'Kundpris exkl. moms' })).toBeTruthy();
        expect(screen.getByText('Läggs ovanpå samtliga entreprenadpriser och visas inte separat i kundofferten.')).toBeTruthy();
        expect(within(internalSummary).getByText(matchesSek('87927'))).toBeTruthy();
        expect(within(internalSummary).getByText(matchesSek('674107'))).toBeTruthy();
        expect(screen.getAllByText(matchesSek('674107')).length).toBeGreaterThanOrEqual(2);

        const ataToggle = screen.getByRole('checkbox', { name: 'Visa indikativt ÄTA-intervall' });
        const ataInput = screen.getByLabelText('ÄTA-reserv (%)');
        expect(ataInput.disabled).toBe(true);
        fireEvent.click(ataToggle);
        expect(ataInput.disabled).toBe(false);
        expect(within(internalSummary).getByText(matchesSek('101116'))).toBeTruthy();
        expect(within(internalSummary).getByText(matchesSek('572991'))).toBeTruthy();
        expect(within(internalSummary).getByText(matchesSek('775223'))).toBeTruthy();
    });

    it('hides product discounts and margins in a contracting-only pricing flow', () => {
        render(
            <TestProviders initialState={createContractingState()}>
                <Pricing onNext={() => {}} onPrev={() => {}} />
            </TestProviders>
        );

        expect(screen.getByRole('heading', { name: 'Entreprenadarbete' })).toBeTruthy();
        expect(screen.queryByText('Product pricing table')).toBeNull();
        expect(screen.queryByText('Product custom costs')).toBeNull();
        expect(screen.queryByText('Product margin summary')).toBeNull();
        expect(screen.queryByText('Övergripande offertrabatt (%)')).toBeNull();
    });

    it('normalizes price and ATA inputs to their supported ranges', () => {
        expect(normalizeContractingPriceInput('-100')).toBe(0);
        expect(normalizeContractingPriceInput('2500.5')).toBe(2500.5);
        expect(normalizeContractingPriceInput('invalid')).toBe(0);
        expect(normalizeAtaPercentInput('-1')).toBe(0);
        expect(normalizeAtaPercentInput('101')).toBe(100);
        expect(normalizeAtaPercentInput('15')).toBe(15);
        expect(normalizeMarginPercentInput('-1')).toBe(0);
        expect(normalizeMarginPercentInput('101')).toBe(100);
        expect(normalizeMarginPercentInput('15')).toBe(15);
    });
});
