// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toastState = vi.hoisted(() => ({
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn()
}));

const fileUtilsState = vi.hoisted(() => ({
    downloadBlob: vi.fn(),
    saveBlobWithPicker: vi.fn(async () => 'saved')
}));

const activityState = vi.hoisted(() => ({
    safeLogActivity: vi.fn(async () => ({ ok: true }))
}));

vi.mock('react-hot-toast', () => ({
    default: toastState
}));

vi.mock('../src/services/calculationEngine', () => ({
    computeQuoteTotals: () => ({
        totals: [],
        finalTotalSek: 0,
        grossTotalSek: 0,
        totalDiscountSek: 0
    })
}));

vi.mock('../src/components/features/CustomerInfoForm', () => ({
    CustomerInfoForm: () => React.createElement('div', null, 'CustomerInfoFormMock')
}));

vi.mock('../src/components/features/FinalSummaryTable', () => ({
    FinalSummaryTable: () => React.createElement('div', null, 'FinalSummaryTableMock')
}));

vi.mock('../src/components/features/TermsAndPaymentPanel', () => ({
    TermsAndPaymentPanel: () => React.createElement('div', null, 'TermsAndPaymentPanelMock')
}));

vi.mock('../src/utils/fileUtils', () => ({
    downloadBlob: fileUtilsState.downloadBlob,
    saveBlobWithPicker: fileUtilsState.saveBlobWithPicker
}));

vi.mock('../src/services/quoteRepositoryClient', () => ({
    quoteRepository: {}
}));

vi.mock('../src/services/quoteSaveService', () => ({
    saveQuoteToRepository: vi.fn()
}));

vi.mock('../src/services/activityLogService', () => ({
    safeLogActivity: activityState.safeLogActivity
}));

vi.mock('../src/features/pdfExport', () => ({
    generatePDF: vi.fn(async () => new Blob(['pdf']))
}));

import { SummaryExport } from '../src/views/SummaryExport';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

const mountedRoots = [];

function createAuthValue(overrides = {}) {
    return {
        user: { uid: 'user-1', email: 'sales@example.com' },
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
        ...overrides
    };
}

function createQuoteState(overrides = {}) {
    return {
        ...createInitialQuoteState(),
        step: 4,
        customerInfo: {
            ...createInitialQuoteState().customerInfo,
            name: 'Ada',
            company: 'Brixx',
            date: '2026-04-23'
        },
        includeTerms: false,
        includePaymentBox: false,
        includeSignatureBlock: false,
        ...overrides
    };
}

async function renderSummaryExport({ stateOverrides = {}, authOverrides = {} } = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const dispatch = vi.fn();

    await act(async () => {
        root.render(
            <AuthContext.Provider value={createAuthValue(authOverrides)}>
                <QuoteContext.Provider value={{ state: createQuoteState(stateOverrides), dispatch }}>
                    <SummaryExport onPrev={() => {}} />
                </QuoteContext.Provider>
            </AuthContext.Provider>
        );
        await Promise.resolve();
    });

    mountedRoots.push({ root, container });
    return { container, dispatch };
}

function findButton(container, label) {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) => (
        candidate.textContent?.includes(label)
    ));

    expect(button).toBeTruthy();
    return button;
}

async function clickButton(container, label) {
    const button = findButton(container, label);

    await act(async () => {
        button.click();
        await Promise.resolve();
    });

    return button;
}

beforeEach(() => {
    fileUtilsState.downloadBlob.mockReset();
    fileUtilsState.saveBlobWithPicker.mockReset();
    fileUtilsState.saveBlobWithPicker.mockResolvedValue('saved');
    activityState.safeLogActivity.mockReset();
    activityState.safeLogActivity.mockResolvedValue({ ok: true });
    toastState.error.mockReset();
    toastState.success.mockReset();
    toastState.loading.mockReset();
    toastState.dismiss.mockReset();

    if (!globalThis.URL.createObjectURL) {
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
    } else {
        vi.spyOn(globalThis.URL, 'createObjectURL').mockImplementation(() => 'blob:preview');
    }

    if (!globalThis.URL.revokeObjectURL) {
        globalThis.URL.revokeObjectURL = vi.fn();
    } else {
        vi.spyOn(globalThis.URL, 'revokeObjectURL').mockImplementation(() => {});
    }
});

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }

    vi.restoreAllMocks();
});

describe('SummaryExport PDF override', () => {
    it('allows legacy export through Exportera ändå when quoteNumber is missing', async () => {
        const { container } = await renderSummaryExport({
            stateOverrides: { quoteNumber: null }
        });

        expect(container.textContent).toContain('Offerten saknar offertnummer');
        expect(findButton(container, 'Exportera som PDF').disabled).toBe(true);
        expect(findButton(container, 'Exportera ändå').disabled).toBe(false);

        await clickButton(container, 'Exportera ändå');

        expect(fileUtilsState.saveBlobWithPicker).toHaveBeenCalledTimes(1);
        expect(toastState.error).not.toHaveBeenCalled();
        expect(activityState.safeLogActivity).toHaveBeenCalledWith(expect.objectContaining({
            metadata: expect.objectContaining({
                missingQuoteNumber: true
            })
        }));
    });

    it('uses the normal PDF button when quoteNumber exists', async () => {
        const { container } = await renderSummaryExport({
            stateOverrides: { quoteNumber: 'BRIXX - 260423-101' }
        });

        expect(container.textContent).not.toContain('Exportera ändå');
        expect(findButton(container, 'Exportera som PDF').disabled).toBe(false);

        await clickButton(container, 'Exportera som PDF');

        expect(fileUtilsState.saveBlobWithPicker).toHaveBeenCalledTimes(1);
        expect(activityState.safeLogActivity).toHaveBeenCalledWith(expect.objectContaining({
            metadata: expect.objectContaining({
                missingQuoteNumber: false
            })
        }));
    });
});
