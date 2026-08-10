// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const toastState = vi.hoisted(() => Object.assign(vi.fn(), {
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

const excelExportState = vi.hoisted(() => ({
    generateExcel: vi.fn()
}));

const quoteSaveState = vi.hoisted(() => ({
    repairCrm: vi.fn(async () => ({ status: 'no-repair-needed' })),
    save: vi.fn(async () => ({
        saved: { quoteId: 'quote-1' },
        isNewQuote: false,
        statePatch: {
            activeQuoteId: 'quote-1',
            activeQuoteVersion: 3,
            quoteNumber: 'BRIXX - 260423-101',
            quoteStatus: 'draft'
        }
    }))
}));

const orderRequestState = vi.hoisted(() => ({
    getOrderRequestByQuoteVersion: vi.fn(async () => null),
    createOrderRequest: vi.fn(async () => ({
        id: 'quote-1__v2',
        quoteId: 'quote-1',
        quoteNumber: 'BRIXX - 260423-101',
        quoteVersion: 2,
        retailerName: 'Nordvind',
        retailerEmail: 'retailer@example.com',
        retailerId: 'retailer-1',
        customerName: 'Ada',
        company: 'Brixx',
        reference: 'REF-1',
        customerReference: 'ER-1',
        selectedLines: ['BaHaMa'],
        totalSek: 0,
        status: 'new',
        createdAtMs: 1,
        updatedAtMs: 1,
        createdByUid: 'user-1',
        createdByEmail: 'sales@example.com',
        statusUpdatedByUid: 'user-1',
        statusUpdatedByEmail: 'sales@example.com',
        quoteOwnerUid: 'user-1'
    }))
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

vi.mock('../src/services/quotePdfService', () => ({
    createQuotePdfBlob: vi.fn(async () => new Blob(['pdf']))
}));

vi.mock('../src/features/excelExport', () => ({
    generateExcel: excelExportState.generateExcel
}));

vi.mock('../src/services/quoteRepositoryClient', () => ({
    quoteRepository: {}
}));

vi.mock('../src/services/quoteSaveService', () => ({
    quoteSave: {
        save: quoteSaveState.save,
        repairCrm: quoteSaveState.repairCrm
    }
}));

vi.mock('../src/services/activityLogService', () => ({
    safeLogActivity: activityState.safeLogActivity
}));

vi.mock('../src/services/orderRequestService', () => ({
    getOrderRequestStatusLabel: (status) => ({
        new: 'Ny',
        reviewing: 'Under behandling',
        completed: 'Slutförd'
    }[status] || 'Ny'),
    getRetailerOrderRequestStatusLabel: (status) => ({
        new: 'Skickad',
        reviewing: 'I väntar',
        completed: 'Accepterad'
    }[status] || 'Skickad'),
    orderRequestService: {
        getOrderRequestByQuoteVersion: orderRequestState.getOrderRequestByQuoteVersion,
        createOrderRequest: orderRequestState.createOrderRequest
    }
}));

import { SummaryExport } from '../src/views/SummaryExport';
import { AuthContext } from '../src/store/AuthContext';
import { QuoteContext } from '../src/store/QuoteContext';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';
import { createQuotePdfBlob } from '../src/services/quotePdfService';

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

async function renderSummaryExport({ stateOverrides = {}, authOverrides = {}, props = {} } = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const dispatch = vi.fn();

    await act(async () => {
        root.render(
            <AuthContext.Provider value={createAuthValue(authOverrides)}>
                <QuoteContext.Provider value={{ state: createQuoteState(stateOverrides), dispatch }}>
                    <SummaryExport onPrev={() => {}} {...props} />
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

async function waitForPreviewDebounce() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 450));
        await Promise.resolve();
    });
}

beforeEach(() => {
    globalThis.sessionStorage.clear();
    fileUtilsState.downloadBlob.mockReset();
    fileUtilsState.saveBlobWithPicker.mockReset();
    fileUtilsState.saveBlobWithPicker.mockResolvedValue('saved');
    activityState.safeLogActivity.mockReset();
    activityState.safeLogActivity.mockResolvedValue({ ok: true });
    excelExportState.generateExcel.mockReset();
    excelExportState.generateExcel.mockResolvedValue(undefined);
    quoteSaveState.save.mockReset();
    quoteSaveState.repairCrm.mockReset();
    quoteSaveState.repairCrm.mockResolvedValue({ status: 'no-repair-needed' });
    quoteSaveState.save.mockResolvedValue({
        saved: { quoteId: 'quote-1' },
        isNewQuote: false,
        statePatch: {
            activeQuoteId: 'quote-1',
            activeQuoteVersion: 3,
            quoteNumber: 'BRIXX - 260423-101',
            quoteStatus: 'draft'
        }
    });
    orderRequestState.getOrderRequestByQuoteVersion.mockReset();
    orderRequestState.getOrderRequestByQuoteVersion.mockResolvedValue(null);
    orderRequestState.createOrderRequest.mockReset();
    orderRequestState.createOrderRequest.mockResolvedValue({
        id: 'quote-1__v2',
        quoteId: 'quote-1',
        quoteNumber: 'BRIXX - 260423-101',
        quoteVersion: 2,
        retailerName: 'Nordvind',
        retailerEmail: 'retailer@example.com',
        retailerId: 'retailer-1',
        customerName: 'Ada',
        company: 'Brixx',
        reference: 'REF-1',
        customerReference: 'ER-1',
        selectedLines: ['BaHaMa'],
        totalSek: 0,
        status: 'new',
        createdAtMs: 1,
        updatedAtMs: 1,
        createdByUid: 'user-1',
        createdByEmail: 'sales@example.com',
        statusUpdatedByUid: 'user-1',
        statusUpdatedByEmail: 'sales@example.com',
        quoteOwnerUid: 'user-1'
    });
    toastState.error.mockReset();
    toastState.success.mockReset();
    toastState.mockReset();
    toastState.loading.mockReset();
    toastState.dismiss.mockReset();
    createQuotePdfBlob.mockClear();

    Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: {
            writeText: vi.fn(async () => {})
        },
        configurable: true
    });

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
    it('renders the shared export language selector beside the PDF preview', async () => {
        const { container } = await renderSummaryExport();
        const languageGroup = container.querySelector('[role="group"][aria-label="Exportspråk"]');

        expect(container.textContent).toContain('Exportspråk');
        expect(languageGroup).toBeTruthy();
        expect(languageGroup.querySelectorAll('button')).toHaveLength(2);
    });

    it('renders the offer theme dropdown and dispatches theme changes', async () => {
        const { container, dispatch } = await renderSummaryExport();
        const select = container.querySelector('select[name="pdfThemeId"]');

        expect(container.textContent).toContain('Offert tema');
        expect(select).toBeTruthy();
        expect(select.value).toBe('brixx');
        expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['BRIXX', 'Eget tema', 'Roslagsmarkisen']);

        await act(async () => {
            select.value = 'custom';
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await Promise.resolve();
        });

        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_PDF_THEME_ID',
            payload: 'custom'
        });
    });

    it('renders the export language selector, dispatches language changes, and uses it for preview', async () => {
        const { container, dispatch } = await renderSummaryExport({
            stateOverrides: { exportLanguage: 'en' }
        });
        await waitForPreviewDebounce();

        expect(container.textContent).toContain('Exportspråk');
        expect(findButton(container, 'EN').getAttribute('aria-pressed')).toBe('true');
        expect(createQuotePdfBlob).toHaveBeenCalledWith(
            expect.objectContaining({ exportLanguage: 'en' }),
            expect.any(Object)
        );

        await clickButton(container, 'SV');

        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_EXPORT_LANGUAGE',
            payload: 'sv'
        });
    });

    it('restricts PDF themes for retailers and allows all for admins', async () => {
        const { container: adminContainer } = await renderSummaryExport({
            authOverrides: { accessLevel: 'admin', isRetailer: false }
        });
        const adminSelect = adminContainer.querySelector('select[name="pdfThemeId"]');
        expect(Array.from(adminSelect.options).map(o => o.value)).toEqual(['brixx', 'custom', 'roslagsmarkisen']);

        const { container: retailerContainer1 } = await renderSummaryExport({
            authOverrides: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: { id: 'ret-1', pdfThemes: [] }
            }
        });
        const retSelect1 = retailerContainer1.querySelector('select[name="pdfThemeId"]');
        expect(Array.from(retSelect1.options).map(o => o.value)).toEqual(['brixx']);

        const { container: retailerContainer2 } = await renderSummaryExport({
            authOverrides: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: { id: 'ret-2', pdfThemes: ['roslagsmarkisen'] }
            }
        });
        const retSelect2 = retailerContainer2.querySelector('select[name="pdfThemeId"]');
        expect(Array.from(retSelect2.options).map(o => o.value)).toEqual(['brixx', 'roslagsmarkisen']);
    });

    it('forces fallback to default theme if an unauthorized theme is loaded in state', async () => {
        const { dispatch } = await renderSummaryExport({
            authOverrides: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: { id: 'ret-1', pdfThemes: [] }
            },
            stateOverrides: { pdfThemeId: 'custom' }
        });
        
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_PDF_THEME_ID',
            payload: 'brixx'
        });
    });

    it('shows one save action and keeps legacy PDF export inside the warning when quoteNumber is missing', async () => {
        const { container } = await renderSummaryExport({
            stateOverrides: { quoteNumber: null }
        });

        expect(container.textContent).toContain('Offerten saknar offertnummer');
        expect(Array.from(container.querySelectorAll('button')).filter((button) => (
            button.textContent?.trim() === 'Spara offert'
        ))).toHaveLength(1);
        expect(container.textContent).not.toContain('Skapa PDF');
        expect(container.textContent).not.toContain('Exportera Excel');
        expect(findButton(container, 'Exportera PDF utan offertnummer').disabled).toBe(false);

        await clickButton(container, 'Exportera PDF utan offertnummer');

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

        expect(container.textContent).not.toContain('Exportera PDF utan offertnummer');
        expect(findButton(container, 'Skapa PDF').disabled).toBe(false);
        expect(findButton(container, 'Spara offert').disabled).toBe(false);

        await clickButton(container, 'Skapa PDF');

        expect(fileUtilsState.saveBlobWithPicker).toHaveBeenCalledTimes(1);
        expect(activityState.safeLogActivity).toHaveBeenCalledWith(expect.objectContaining({
            metadata: expect.objectContaining({
                missingQuoteNumber: false
            })
        }));
    });

    it('reuses the completed preview blob for export when the quote has not changed', async () => {
        const { container } = await renderSummaryExport({
            stateOverrides: { quoteNumber: 'BRIXX - 260423-102' }
        });
        await waitForPreviewDebounce();

        expect(createQuotePdfBlob).toHaveBeenCalledTimes(1);
        await clickButton(container, 'Skapa PDF');

        expect(createQuotePdfBlob).toHaveBeenCalledTimes(1);
        expect(fileUtilsState.saveBlobWithPicker).toHaveBeenCalledTimes(1);
    });

    it('shows one version-save action and blocks delivery actions while saving', async () => {
        let resolveSave;
        quoteSaveState.save.mockReturnValueOnce(new Promise((resolve) => {
            resolveSave = resolve;
        }));
        const { container } = await renderSummaryExport({
            authOverrides: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: {
                    id: 'retailer-1',
                    name: 'Nordvind',
                    email: 'retailer@example.com'
                }
            },
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2
            }
        });

        expect(Array.from(container.querySelectorAll('button')).filter((button) => (
            button.textContent?.trim() === 'Spara ny version'
        ))).toHaveLength(1);

        await clickButton(container, 'Spara ny version');

        expect(findButton(container, 'Skapa PDF').disabled).toBe(true);
        expect(findButton(container, 'Exportera Excel').disabled).toBe(true);
        expect(findButton(container, 'Kopiera länk').disabled).toBe(true);
        expect(findButton(container, 'Skicka orderförfrågan').disabled).toBe(true);

        await act(async () => {
            resolveSave({
                saved: { quoteId: 'quote-1' },
                isNewQuote: false,
                statePatch: {
                    activeQuoteId: 'quote-1',
                    activeQuoteVersion: 3,
                    quoteNumber: 'BRIXX - 260423-101',
                    quoteStatus: 'draft'
                }
            });
            await Promise.resolve();
        });

        expect(findButton(container, 'Skapa PDF').disabled).toBe(false);
    });

    it('dispatches the saved identity and reports a durable CRM repair outcome', async () => {
        quoteSaveState.save.mockResolvedValueOnce({
            status: 'saved-needs-crm-repair',
            quote: { ownerUid: 'user-1', quoteId: 'quote-1' },
            isNewQuote: false,
            statePatch: {
                activeQuoteId: 'quote-1',
                activeQuoteVersion: 3,
                quoteNumber: 'BRIXX - 260423-101',
                quoteStatus: 'draft'
            },
            crm: { dealId: 'deal-1', status: 'repair-pending' }
        });
        const { container, dispatch } = await renderSummaryExport({
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2
            },
            props: { crmDealId: 'deal-1' }
        });

        await clickButton(container, 'Spara ny version');

        expect(quoteSaveState.save).toHaveBeenCalledWith(expect.objectContaining({
            actor: expect.objectContaining({ uid: 'user-1' }),
            state: expect.any(Object),
            target: {
                kind: 'existing',
                quote: { ownerUid: 'user-1', quoteId: 'quote-1' },
                crmDealId: 'deal-1'
            }
        }));
        expect(dispatch).toHaveBeenCalledWith({
            type: 'UPDATE_STATE',
            payload: expect.objectContaining({ activeQuoteVersion: 3 })
        });
        expect(toastState.success).toHaveBeenCalled();
        expect(toastState).toHaveBeenCalledWith(
            expect.stringContaining('repareras automatiskt'),
            expect.any(Object)
        );
        expect(activityState.safeLogActivity).not.toHaveBeenCalled();
    });

    it('retains an ambiguous Save Intent across a refresh for the same draft', async () => {
        quoteSaveState.save
            .mockResolvedValueOnce({
                status: 'not-saved',
                failure: {
                    code: 'persistence-ambiguous',
                    message: 'Transport response lost.',
                    retryable: true
                },
                retry: { saveIntentId: 'save-retry-1' }
            })
            .mockResolvedValueOnce({
                status: 'saved',
                quote: { ownerUid: 'user-1', quoteId: 'quote-1' },
                isNewQuote: false,
                statePatch: {
                    activeQuoteId: 'quote-1',
                    activeQuoteVersion: 3,
                    quoteNumber: 'BRIXX - 260423-101',
                    quoteStatus: 'draft'
                }
            });
        const stateOverrides = {
            activeQuoteId: 'quote-1',
            quoteNumber: 'BRIXX - 260423-101',
            activeQuoteVersion: 2
        };
        const { container, dispatch } = await renderSummaryExport({
            stateOverrides
        });

        await clickButton(container, 'Spara ny version');
        expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_STATE' }));

        const refreshed = await renderSummaryExport({
            stateOverrides
        });
        await clickButton(refreshed.container, 'Spara ny version');

        expect(quoteSaveState.save.mock.calls[0][0].retrySaveIntentId).toBeNull();
        expect(quoteSaveState.save.mock.calls[1][0].retrySaveIntentId).toBe('save-retry-1');
        expect(refreshed.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_STATE' }));
    });

    it('does not reuse an ambiguous Save Intent after the draft changes', async () => {
        quoteSaveState.save
            .mockResolvedValueOnce({
                status: 'not-saved',
                failure: {
                    code: 'persistence-ambiguous',
                    message: 'Transport response lost.',
                    retryable: true
                },
                retry: { saveIntentId: 'save-retry-1' }
            })
            .mockResolvedValueOnce({
                status: 'saved',
                quote: { ownerUid: 'user-1', quoteId: 'quote-1' },
                isNewQuote: false,
                statePatch: {
                    activeQuoteId: 'quote-1',
                    activeQuoteVersion: 4,
                    quoteNumber: 'BRIXX - 260423-101',
                    quoteStatus: 'sent'
                }
            });
        const original = await renderSummaryExport({
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2
            }
        });

        await clickButton(original.container, 'Spara ny version');

        const edited = await renderSummaryExport({
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2,
                quoteStatus: 'sent'
            }
        });
        await clickButton(edited.container, 'Spara ny version');

        expect(quoteSaveState.save.mock.calls[0][0].retrySaveIntentId).toBeNull();
        expect(quoteSaveState.save.mock.calls[1][0].retrySaveIntentId).toBeNull();
        expect(edited.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'UPDATE_STATE' }));
    });

    it('logs the English Excel filename when exporting in English', async () => {
        const { container } = await renderSummaryExport({
            stateOverrides: {
                quoteNumber: 'BRIXX - 260423-101',
                exportLanguage: 'en'
            }
        });

        await clickButton(container, 'Exportera Excel');

        expect(excelExportState.generateExcel).toHaveBeenCalledWith(
            expect.objectContaining({ exportLanguage: 'en' }),
            expect.any(Object)
        );
        expect(activityState.safeLogActivity).toHaveBeenCalledWith(expect.objectContaining({
            details: 'Excel exporterad: Quote.xlsx',
            metadata: expect.objectContaining({
                fileName: 'Quote.xlsx'
            })
        }));
    });

    it('removes persisted contracting work from retailer preview and export payloads', async () => {
        const { container } = await renderSummaryExport({
            authOverrides: {
                accessLevel: 'retailer',
                isRetailer: true,
                retailer: {
                    id: 'retailer-1',
                    name: 'Nordvind',
                    email: 'retailer@example.com',
                    pdfThemes: []
                }
            },
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2,
                contractingWork: {
                    enabled: true,
                    projectName: 'Hidden retailer project',
                    rows: [{
                        id: 'hidden-work',
                        workPackage: 'Hidden retailer work',
                        scope: 'Must not be exported',
                        unit: 'work',
                        priceExVatSek: 50000
                    }],
                    margin: { enabled: true, percent: 40 },
                    ata: { enabled: true, percent: 15 }
                }
            }
        });
        await waitForPreviewDebounce();

        expect(container.textContent).not.toContain('Hidden retailer work');
        expect(createQuotePdfBlob).toHaveBeenCalledWith(
            expect.objectContaining({
                contractingWork: {
                    enabled: false,
                    projectName: '',
                    rows: [],
                    margin: { enabled: false, percent: 15 },
                    ata: { enabled: false, percent: 15 }
                }
            }),
            expect.any(Object)
        );

        await clickButton(container, 'Exportera Excel');

        expect(excelExportState.generateExcel).toHaveBeenCalledWith(
            expect.objectContaining({
                contractingWork: expect.objectContaining({
                    enabled: false,
                    rows: [],
                    margin: { enabled: false, percent: 15 }
                })
            }),
            expect.any(Object)
        );

        await clickButton(container, 'Spara ny version');

        expect(quoteSaveState.save).toHaveBeenCalledWith(
            expect.objectContaining({
                state: expect.objectContaining({
                    contractingWork: expect.objectContaining({
                        enabled: false,
                        rows: [],
                        margin: { enabled: false, percent: 15 }
                    })
                })
            })
        );

        await clickButton(container, 'Skicka orderförfrågan');

        expect(orderRequestState.createOrderRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                state: expect.objectContaining({
                    contractingWork: expect.objectContaining({
                        enabled: false,
                        rows: [],
                        margin: { enabled: false, percent: 15 }
                    })
                })
            })
        );
    });

    it('shows the retailer order request CTA only for retailer users', async () => {
        const { container: retailerContainer } = await renderSummaryExport({
            authOverrides: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer-1',
                    name: 'Nordvind',
                    email: 'retailer@example.com'
                },
                isRetailer: true
            },
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2
            }
        });

        expect(retailerContainer.textContent).toContain('Skicka orderförfrågan');

        const { container: nonRetailerContainer } = await renderSummaryExport();
        expect(nonRetailerContainer.textContent).not.toContain('Skicka orderförfrågan');
    });

    it('disables retailer order requests until the quote has been saved', async () => {
        const { container } = await renderSummaryExport({
            authOverrides: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer-1',
                    name: 'Nordvind',
                    email: 'retailer@example.com'
                },
                isRetailer: true
            },
            stateOverrides: {
                activeQuoteId: null,
                quoteNumber: null,
                activeQuoteVersion: 0
            }
        });

        expect(findButton(container, 'Skicka orderförfrågan').disabled).toBe(true);
        expect(container.textContent).toContain('Spara offerten först för att kunna skicka en orderförfrågan.');
    });

    it('creates an order request, shows a thank-you panel, and links to sent orders afterwards', async () => {
        const onOpenRetailerOrderHistory = vi.fn();
        const { container } = await renderSummaryExport({
            authOverrides: {
                accessLevel: 'retailer',
                retailer: {
                    id: 'retailer-1',
                    name: 'Nordvind',
                    email: 'retailer@example.com'
                },
                isRetailer: true
            },
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2
            },
            props: {
                onOpenRetailerOrderHistory
            }
        });

        await clickButton(container, 'Skicka orderförfrågan');

        expect(orderRequestState.createOrderRequest).toHaveBeenCalledTimes(1);
        expect(findButton(container, 'Orderförfrågan registrerad för v2').disabled).toBe(true);
        expect(container.textContent).toContain('Registrerad för version v2.');
        expect(container.textContent).toContain('Tack för din order!');
        expect(container.textContent).toContain('Skickad');

        await clickButton(container, 'Se skickade ordrar');
        expect(onOpenRetailerOrderHistory).toHaveBeenCalledTimes(1);
    });

    it('hides quote link copying until the quote has been saved', async () => {
        const { container } = await renderSummaryExport({
            stateOverrides: {
                activeQuoteId: null,
                activeQuoteVersion: 0
            }
        });

        expect(container.textContent).not.toContain('Kopiera länk');
    });

    it('copies the saved quote link', async () => {
        const { container } = await renderSummaryExport({
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2
            }
        });

        await clickButton(container, 'Kopiera länk');

        expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000/quotes?openQuote=quote-1&version=2');
        expect(toastState.success).toHaveBeenCalled();
    });

    it('shows an error when copying the saved quote link fails', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        globalThis.navigator.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
        const { container } = await renderSummaryExport({
            stateOverrides: {
                activeQuoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260423-101',
                activeQuoteVersion: 2
            }
        });

        await clickButton(container, 'Kopiera länk');

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(toastState.error).toHaveBeenCalled();
    });
});
