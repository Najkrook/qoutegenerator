import { describe, expect, it } from 'vitest';

import { createInitialQuoteState } from '../src/store/quoteStateSchema';
import {
    createQuoteCommercialSnapshot,
    prepareQuote,
    QuotePreparationError
} from '../src/services/quotePreparation';

function createRow(overrides = {}) {
    return {
        model: 'Jumbrella',
        size: '3x3',
        unitPrice: 1000,
        qty: 2,
        gross: 2000,
        discountPct: 10,
        discountSek: 200,
        net: 1800,
        isAddon: false,
        source: { type: 'builder', itemId: 'item-1' },
        line: 'BaHaMa',
        sortModel: 'Jumbrella',
        sortSizeRaw: '3x3',
        sortKind: 'dimension',
        sortDimensions: [3, 3],
        originalIndex: 0,
        ...overrides
    };
}

function createTotals(overrides = {}) {
    return {
        totals: [createRow()],
        grossTotalSek: 2000,
        totalDiscountSek: 200,
        finalTotalSek: 1800,
        globalDiscountAmt: 0,
        ...overrides
    };
}

function createState(overrides = {}) {
    return {
        ...createInitialQuoteState(),
        customerInfo: {
            ...createInitialQuoteState().customerInfo,
            name: 'Ada Lovelace',
            company: 'Analytical AB',
            email: 'ada@example.com',
            reference: 'PROJECT-1',
            customerReference: 'CUSTOMER-9',
            date: '2026-08-12',
            validity: '30 dagar',
            extraNotes: 'Handle with care'
        },
        quoteNumber: 'BRIXX - 260812-101',
        activeQuoteId: 'quote-1',
        activeQuoteVersion: 2,
        includesVat: true,
        includeTerms: true,
        termsText: 'Terms text',
        includePaymentBox: true,
        includeSignatureBlock: true,
        paymentTermsDays: 30,
        quoteValidityDays: 30,
        ...overrides
    };
}

function prepare(overrides = {}) {
    return prepareQuote({
        state: createState(overrides.state),
        totals: createTotals(overrides.totals),
        fallbackDate: overrides.fallbackDate || '2026-08-12',
        audience: {
            isRetailer: false,
            allowedPdfThemes: [],
            ...overrides.audience
        }
    });
}

describe('prepareQuote', () => {
    it('prepares one immutable internal Quote meaning with commercial, agreement, visibility, and persistence data', () => {
        const result = prepare({
            state: {
                hideZeroDiscountReferencesInPdf: true,
                contractingWork: {
                    enabled: true,
                    projectName: 'Terrace',
                    rows: [{
                        id: 'work-1',
                        workPackage: 'Installation',
                        scope: 'Complete installation',
                        unit: 'project',
                        priceExVatSek: 1000
                    }],
                    margin: { enabled: true, percent: 20 },
                    ata: { enabled: true, percent: 10 }
                }
            }
        });

        expect(result.presentation).toEqual({
            exportLanguage: 'sv',
            pdfThemeId: 'brixx',
            allowedPdfThemeIds: ['brixx', 'custom', 'roslagsmarkisen'],
            equivalenceKey: expect.any(String)
        });
        expect(result.commercial).toEqual({
            productRows: [expect.objectContaining({
                model: 'Jumbrella',
                qty: 2,
                unitPrice: 1000,
                discountPct: 10,
                priceUponRequest: false
            })],
            productTotals: {
                includesVat: true,
                grossTotalSek: 2000,
                totalDiscountSek: 200,
                finalTotalSek: 1800,
                globalDiscountAmt: 0,
                globalDiscountPct: 0,
                vatBasisSek: 1800,
                vatAmountSek: 450,
                totalWithVatSek: 2250
            },
            contractingWork: {
                projectName: 'Terrace',
                rows: [{
                    id: 'work-1',
                    workPackage: 'Installation',
                    scope: 'Complete installation',
                    unit: 'project',
                    priceExVatSek: 1200
                }],
                baseTotalSek: 1200,
                ataEnabled: true,
                ataPercent: 10,
                allowanceSek: 120,
                lowerIndicativeSek: 1080,
                upperIndicativeSek: 1320
            }
        });
        expect(result.agreement).toEqual({
            customerInfo: createState().customerInfo,
            effectiveQuoteDate: '2026-08-12',
            quoteIdentity: {
                quoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260812-101',
                version: 2,
                status: 'draft'
            },
            legalTerms: {
                included: true,
                text: 'Terms text',
                templateId: 'standard',
                customized: false
            },
            paymentTermsDays: 30,
            validityDays: 30,
            includePaymentBox: true,
            includeSignatureBlock: true
        });
        expect(result.visibility).toEqual({
            contractingWork: 'visible',
            discountReferenceEligibility: 'ineligible',
            discountReferences: 'visible',
            legalTerms: 'visible',
            paymentBox: 'visible',
            signatureBlock: 'visible'
        });
        expect(result.persistenceSnapshot.contractingWork.rows).toHaveLength(1);
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.commercial.productRows)).toBe(true);
    });

    it.each([
        {
            name: 'unsupported language falls back to Swedish',
            state: { exportLanguage: 'de' },
            audience: {},
            expected: {
                exportLanguage: 'sv',
                pdfThemeId: 'brixx',
                allowedPdfThemeIds: ['brixx', 'custom', 'roslagsmarkisen']
            }
        },
        {
            name: 'internal users may use every supported theme',
            state: { exportLanguage: 'en', pdfThemeId: 'roslagsmarkisen' },
            audience: {},
            expected: {
                exportLanguage: 'en',
                pdfThemeId: 'roslagsmarkisen',
                allowedPdfThemeIds: ['brixx', 'custom', 'roslagsmarkisen']
            }
        },
        {
            name: 'retailers may use an assigned theme',
            state: { pdfThemeId: 'roslagsmarkisen' },
            audience: { isRetailer: true, allowedPdfThemes: ['roslagsmarkisen'] },
            expected: {
                exportLanguage: 'sv',
                pdfThemeId: 'roslagsmarkisen',
                allowedPdfThemeIds: ['brixx', 'roslagsmarkisen']
            }
        },
        {
            name: 'retailer unauthorized themes fall back to the default',
            state: { pdfThemeId: 'custom' },
            audience: { isRetailer: true, allowedPdfThemes: [] },
            expected: {
                exportLanguage: 'sv',
                pdfThemeId: 'brixx',
                allowedPdfThemeIds: ['brixx']
            }
        },
        {
            name: 'missing themes fall back to the default',
            state: { pdfThemeId: null },
            audience: { isRetailer: true, allowedPdfThemes: ['roslagsmarkisen'] },
            expected: {
                exportLanguage: 'sv',
                pdfThemeId: 'brixx',
                allowedPdfThemeIds: ['brixx', 'roslagsmarkisen']
            }
        }
    ])('$name', ({ state, audience, expected }) => {
        const result = prepare({ state, audience });

        expect(result.presentation).toMatchObject(expected);
        expect(result.persistenceSnapshot.exportLanguage).toBe(expected.exportLanguage);
        expect(result.persistenceSnapshot.pdfThemeId).toBe(expected.pdfThemeId);
    });

    it('suppresses retailer contracting work everywhere without hiding customer product meaning', () => {
        const result = prepare({
            state: {
                contractingWork: {
                    enabled: true,
                    projectName: 'Secret project',
                    rows: [{
                        id: 'hidden',
                        workPackage: 'Hidden work',
                        scope: 'Hidden scope',
                        unit: 'project',
                        priceExVatSek: 50000
                    }],
                    margin: { enabled: true, percent: 40 },
                    ata: { enabled: true, percent: 15 }
                }
            },
            audience: { isRetailer: true }
        });
        const serialized = JSON.stringify(result);

        expect(result.visibility.contractingWork).toBe('suppressed-retailer');
        expect(result.commercial.contractingWork).toBeNull();
        expect(result.persistenceSnapshot.contractingWork).toMatchObject({
            enabled: false,
            projectName: '',
            rows: []
        });
        expect(serialized).not.toContain('Secret project');
        expect(serialized).not.toContain('Hidden work');
        expect(result.commercial.productRows).toHaveLength(1);
    });

    it.each([
        {
            name: 'zero-discount references are hidden when requested and all rows qualify',
            state: { hideZeroDiscountReferencesInPdf: true },
            totals: {
                totals: [createRow({ discountPct: 0, discountSek: 0, net: 2000 })],
                totalDiscountSek: 0,
                finalTotalSek: 2000
            },
            expected: 'hidden-zero',
            eligibility: 'eligible-zero'
        },
        {
            name: 'zero-discount references remain visible without the preference',
            state: { hideZeroDiscountReferencesInPdf: false },
            totals: {
                totals: [createRow({ discountPct: 0, discountSek: 0, net: 2000 })],
                totalDiscountSek: 0,
                finalTotalSek: 2000
            },
            expected: 'visible',
            eligibility: 'eligible-zero'
        },
        {
            name: 'non-zero discount references remain visible despite the preference',
            state: { hideZeroDiscountReferencesInPdf: true },
            totals: {},
            expected: 'visible',
            eligibility: 'ineligible'
        },
        {
            name: 'discount references remain visible when no product row qualifies',
            state: { hideZeroDiscountReferencesInPdf: true },
            totals: {
                totals: [],
                grossTotalSek: 0,
                totalDiscountSek: 0,
                finalTotalSek: 0
            },
            expected: 'visible',
            eligibility: 'ineligible'
        }
    ])('$name', ({ state, totals, expected, eligibility }) => {
        const visibility = prepare({ state, totals }).visibility;

        expect(visibility.discountReferences).toBe(expected);
        expect(visibility.discountReferenceEligibility).toBe(eligibility);
    });

    it('retains explicit price-on-request meaning instead of treating it as an ordinary zero-priced row', () => {
        const requestRow = createRow({
            priceUponRequest: true,
            unitPrice: 0,
            qty: 1,
            gross: 0,
            discountPct: 0,
            discountSek: 0,
            net: 0
        });
        const result = prepare({
            totals: {
                totals: [requestRow],
                grossTotalSek: 0,
                totalDiscountSek: 0,
                finalTotalSek: 0
            }
        });

        expect(result.commercial.productRows[0]).toMatchObject({
            priceUponRequest: true,
            unitPrice: 0,
            qty: 1
        });
    });

    it.each([
        { includeTerms: false, includePaymentBox: false, includeSignatureBlock: false },
        { includeTerms: true, includePaymentBox: false, includeSignatureBlock: true },
        { includeTerms: false, includePaymentBox: true, includeSignatureBlock: true }
    ])('represents legal/payment/signature decisions for %#', (variant) => {
        const result = prepare({ state: variant });

        expect(result.agreement.legalTerms.included).toBe(variant.includeTerms);
        expect(result.agreement.includePaymentBox).toBe(variant.includePaymentBox);
        expect(result.agreement.includeSignatureBlock).toBe(variant.includeSignatureBlock);
        expect(result.visibility.legalTerms).toBe(variant.includeTerms ? 'visible' : 'hidden');
        expect(result.visibility.paymentBox).toBe(variant.includePaymentBox ? 'visible' : 'hidden');
        expect(result.visibility.signatureBlock).toBe(variant.includeSignatureBlock ? 'visible' : 'hidden');
    });

    it('keeps a Quote without identity previewable', () => {
        const result = prepare({
            state: { activeQuoteId: null, quoteNumber: null, activeQuoteVersion: 0 }
        });

        expect(result.agreement.quoteIdentity).toEqual({
            quoteId: null,
            quoteNumber: null,
            version: 0,
            status: 'draft'
        });
    });

    it('uses an explicit allowlist and does not copy unknown or list-price margin data', () => {
        const state = createState();
        state.unknownSecret = 'do-not-copy';
        state.marginSettings = { BaHaMa: 42 };
        state.marginAnalysis = { profit: 999999 };
        state.inventoryData = {
            bahama: [{
                ID: 'inventory-1',
                BESKRIVNING: 'keep-inventory',
                unknownSecret: 'nested-inventory-secret',
                marginAnalysis: { profit: 111111 }
            }],
            bahamaV2: [],
            clickitup: {
                '1000': {
                    sektion: 1,
                    dorr_h: 0,
                    dorr_v: 0,
                    hane_h: 0,
                    hane_v: 0,
                    supplierPurchasePrice: 12345
                }
            },
            notes: 'keep-notes',
            profitabilityData: { profit: 777777 }
        };
        state.cloudInventoryData = {
            bahama: [],
            bahamaV2: [],
            clickitup: {},
            notes: 'keep-cloud-notes',
            unknownSecret: 'nested-cloud-secret'
        };
        state.inventoryBasket = [{
            ID: 'basket-1',
            BESKRIVNING: 'keep-basket',
            costPrice: 222222,
            unknownSecret: 'nested-basket-secret'
        }];
        state.sketchDraft = {
            config: {
                width: 8000,
                depth: 4000,
                unknownSecret: 'nested-sketch-secret',
                parasols: [{
                    id: 'parasol-1',
                    label: 'keep-sketch',
                    unknownSecret: 'nested-parasol-secret',
                    internalMargins: { BaHaMa: 333333 }
                }]
            },
            workspace: {
                camera: { zoom: 1, panX: 0, panY: 0, profitabilityData: { profit: 999 } },
                unknownSecret: 'nested-workspace-secret'
            }
        };
        state.advancedSketchDraft = {
            config: {
                nodes: [{ id: 'node-1', x: 10, y: 20, unknownSecret: 'nested-node-secret' }],
                edges: [],
                unknownSecret: 'nested-advanced-config-secret'
            },
            workspace: {
                camera: { zoom: 1, panX: 0, panY: 0 },
                uiDensity: 'desktop',
                grossProfit: 444444
            }
        };
        state.builderItems = [{
            id: 'builder-1',
            line: 'BaHaMa',
            model: 'Jumbrella',
            size: '3x3',
            qty: 1,
            discountPct: 0,
            addons: [],
            marginSettings: { BaHaMa: 55 }
        }];
        state.gridSelections = {
            ClickitUp: {
                items: {
                    'ClickitUp Sektion|500x500': {
                        qty: 1,
                        discountPct: 0,
                        marginAnalysis: { profit: 555555 }
                    }
                },
                addons: {},
                customAddonsByCategory: {}
            }
        };
        const totals = createTotals();
        totals.totals[0].unknownRowSecret = 'do-not-copy-row';
        totals.totals[0].marginAnalysis = { profit: 1000 };
        totals.totals[0].source.reviewCode = 'private-review-code';

        const serialized = JSON.stringify(prepareQuote({
            state,
            totals,
            audience: { isRetailer: false, allowedPdfThemes: [] }
        }));

        expect(serialized).not.toContain('do-not-copy');
        expect(serialized).not.toContain('marginSettings');
        expect(serialized).not.toContain('marginAnalysis');
        expect(serialized).not.toContain('999999');
        expect(serialized).not.toContain('costPrice');
        expect(serialized).not.toContain('internalMargins');
        expect(serialized).not.toContain('grossProfit');
        expect(serialized).not.toContain('reviewCode');
        expect(serialized).not.toContain('unknownSecret');
        expect(serialized).not.toContain('supplierPurchasePrice');
        expect(serialized).not.toContain('profitabilityData');
        expect(serialized).not.toContain('111111');
        expect(serialized).not.toContain('222222');
        expect(serialized).not.toContain('333333');
        expect(serialized).not.toContain('444444');
        expect(serialized).not.toContain('555555');
        expect(serialized).toContain('keep-inventory');
        expect(serialized).toContain('keep-basket');
        expect(serialized).toContain('keep-sketch');
        expect(serialized).toContain('keep-notes');
        expect(serialized).toContain('keep-cloud-notes');
    });

    it('resolves one deterministic effective date for persistence and every downstream adapter', () => {
        const state = createState({
            customerInfo: {
                ...createState().customerInfo,
                date: ''
            }
        });

        const first = prepareQuote({
            state,
            totals: createTotals(),
            fallbackDate: '2026-08-13',
            audience: { isRetailer: false }
        });
        const equivalent = prepareQuote({
            state: structuredClone(state),
            totals: createTotals(),
            fallbackDate: '2026-08-13',
            audience: { isRetailer: false }
        });
        const nextDay = prepareQuote({
            state: structuredClone(state),
            totals: createTotals(),
            fallbackDate: '2026-08-14',
            audience: { isRetailer: false }
        });

        expect(first.agreement.effectiveQuoteDate).toBe('2026-08-13');
        expect(first.agreement.customerInfo.date).toBe('');
        expect(first.persistenceSnapshot.customerInfo.date).toBe('2026-08-13');
        expect(equivalent.presentation.equivalenceKey).toBe(first.presentation.equivalenceKey);
        expect(nextDay.presentation.equivalenceKey).not.toBe(first.presentation.equivalenceKey);
    });

    it('fails deterministically when neither the quote nor caller supplies a valid date', () => {
        const state = createState({
            customerInfo: {
                ...createState().customerInfo,
                date: ''
            }
        });

        expect(() => prepareQuote({
            state,
            totals: createTotals(),
            audience: { isRetailer: false }
        })).toThrow(/customerInfo\.date/u);
        expect(() => prepareQuote({
            state,
            totals: createTotals(),
            fallbackDate: 'not-a-date',
            audience: { isRetailer: false }
        })).toThrow(/customerInfo\.date/u);
    });

    it('does not mutate inputs and produces equal values and keys for equivalent inputs', () => {
        const state = createState();
        const totals = createTotals();
        const stateBefore = structuredClone(state);
        const totalsBefore = structuredClone(totals);

        const first = prepareQuote({
            state,
            totals,
            audience: { isRetailer: false, allowedPdfThemes: ['custom'] }
        });
        const second = prepareQuote({
            state: structuredClone(state),
            totals: structuredClone(totals),
            audience: { isRetailer: false, allowedPdfThemes: ['roslagsmarkisen'] }
        });

        expect(state).toEqual(stateBefore);
        expect(totals).toEqual(totalsBefore);
        expect(second).toEqual(first);
        expect(second.presentation.equivalenceKey).toBe(first.presentation.equivalenceKey);
    });

    it('changes the equivalence key when prepared PDF meaning changes', () => {
        const baseline = prepare();
        const changed = prepare({
            state: {
                customerInfo: {
                    ...createState().customerInfo,
                    reference: 'PROJECT-2'
                }
            }
        });

        expect(changed.presentation.equivalenceKey).not.toBe(baseline.presentation.equivalenceKey);
    });

    it.each([
        ['totals is not an array', { totals: null }],
        ['quantity is non-finite', { totals: [createRow({ qty: Number.NaN })] }],
        ['quantity is not positive', { totals: [createRow({ qty: 0 })] }],
        ['unit price is non-finite', { totals: [createRow({ unitPrice: Number.POSITIVE_INFINITY })] }],
        ['gross price is non-finite', { totals: [createRow({ gross: Number.NaN })] }],
        ['discount percentage is non-finite', { totals: [createRow({ discountPct: Number.NaN })] }],
        ['discount percentage is below zero', { totals: [createRow({ discountPct: -1 })] }],
        ['discount percentage is above one hundred', { totals: [createRow({ discountPct: 101 })] }],
        ['discount amount is non-finite', { totals: [createRow({ discountSek: Number.NaN })] }],
        ['net price is non-finite', { totals: [createRow({ net: Number.NaN })] }],
        ['gross aggregate is non-finite', { grossTotalSek: Number.NaN }],
        ['discount aggregate is non-finite', { totalDiscountSek: Number.NaN }],
        ['final aggregate is non-finite', { finalTotalSek: Number.NaN }],
        ['global discount is non-finite', { globalDiscountAmt: Number.NaN }],
        ['row gross does not reconcile with price and quantity', {
            totals: [createRow({ unitPrice: 1100 })]
        }],
        ['row discount does not reconcile with its percentage', {
            totals: [createRow({ discountPct: 20 })]
        }],
        ['row net does not reconcile with gross and discount', {
            totals: [createRow({ net: 1700 })],
            finalTotalSek: 1700
        }],
        ['gross aggregate does not reconcile', { grossTotalSek: 2100 }],
        ['discount aggregate does not reconcile', { totalDiscountSek: 300 }],
        ['final aggregate does not reconcile', { finalTotalSek: 1700 }]
    ])('rejects invalid commercial data when %s', (_name, totals) => {
        let result;
        let thrown;

        try {
            result = prepare({ totals });
        } catch (error) {
            thrown = error;
        }

        expect(result).toBeUndefined();
        expect(thrown).toBeInstanceOf(QuotePreparationError);
        expect(thrown).toMatchObject({ code: 'INVALID_COMMERCIAL_DATA' });
    });

    it('rejects a non-finite visible contracting amount but suppresses the same malformed retailer-only data', () => {
        const contractingWork = {
            enabled: true,
            projectName: 'Terrace',
            rows: [{
                id: 'work-1',
                workPackage: 'Installation',
                scope: '',
                unit: 'project',
                priceExVatSek: Number.NaN
            }],
            margin: { enabled: false, percent: 15 },
            ata: { enabled: false, percent: 15 }
        };

        expect(() => prepare({ state: { contractingWork } })).toThrow(QuotePreparationError);
        expect(prepare({
            state: { contractingWork },
            audience: { isRetailer: true }
        }).commercial.contractingWork).toBeNull();
    });

    it('accepts exactly 200 product rows and rejects one row above the persistence limit', () => {
        const productRows = Array.from({ length: 200 }, (_, index) => createRow({
            model: `Product ${index + 1}`,
            qty: 1,
            gross: 1000,
            discountPct: 0,
            discountSek: 0,
            net: 1000,
            originalIndex: index
        }));
        const totalsAtLimit = {
            totals: productRows,
            grossTotalSek: 200000,
            totalDiscountSek: 0,
            finalTotalSek: 200000,
            globalDiscountAmt: 0
        };

        const preparedAtLimit = prepare({ totals: totalsAtLimit });
        expect(createQuoteCommercialSnapshot(preparedAtLimit).productRows).toHaveLength(200);

        const preparedAboveLimit = prepare({
            totals: {
                ...totalsAtLimit,
                totals: [...productRows, createRow({
                    model: 'Product 201',
                    qty: 1,
                    gross: 1000,
                    discountPct: 0,
                    discountSek: 0,
                    net: 1000,
                    originalIndex: 200
                })],
                grossTotalSek: 201000,
                finalTotalSek: 201000
            }
        });
        expect(() => createQuoteCommercialSnapshot(preparedAboveLimit)).toThrow(expect.objectContaining({
            name: 'QuotePreparationError',
            field: 'commercialSnapshot.productRows'
        }));
    });

    it('accepts exactly 100 contracting-work rows and rejects one row above the persistence limit', () => {
        const workRows = Array.from({ length: 100 }, (_, index) => ({
            id: `work-${index + 1}`,
            workPackage: `Work ${index + 1}`,
            scope: 'Complete installation',
            unit: 'project',
            priceExVatSek: 1000
        }));
        const contractingWork = {
            enabled: true,
            projectName: 'Terrace',
            rows: workRows,
            margin: { enabled: false, percent: 15 },
            ata: { enabled: false, percent: 15 }
        };

        const preparedAtLimit = prepare({ state: { contractingWork } });
        expect(createQuoteCommercialSnapshot(preparedAtLimit).contractingWork.rows).toHaveLength(100);

        const preparedAboveLimit = prepare({
            state: {
                contractingWork: {
                    ...contractingWork,
                    rows: [...workRows, {
                        id: 'work-101',
                        workPackage: 'Work 101',
                        scope: 'Complete installation',
                        unit: 'project',
                        priceExVatSek: 1000
                    }]
                }
            }
        });
        expect(() => createQuoteCommercialSnapshot(preparedAboveLimit)).toThrow(expect.objectContaining({
            name: 'QuotePreparationError',
            field: 'commercialSnapshot.contractingWork.rows'
        }));
    });
});
