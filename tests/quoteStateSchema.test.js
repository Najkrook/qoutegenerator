import { describe, expect, it, vi } from 'vitest';
import { quoteReducer } from '../src/store/QuoteContext';
import {
    CURRENT_STATE_VERSION,
    createInitialQuoteState,
    hydrateQuoteState
} from '../src/store/quoteStateSchema';

describe('quoteStateSchema', () => {
    it('returns current defaults for empty input', () => {
        const hydrated = hydrateQuoteState(null);

        expect(hydrated).toEqual(createInitialQuoteState());
        expect(hydrated.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(hydrated.hideZeroDiscountReferencesInPdf).toBe(false);
        expect(hydrated.pdfThemeId).toBe('brixx');
        expect(hydrated.exportLanguage).toBe('sv');
        expect(hydrated.customerInfo.customerReference).toBe('');
        expect(hydrated.gridSelections).toEqual({});
        expect(hydrated.contractingWork).toEqual({
            enabled: false,
            projectName: '',
            rows: [],
            margin: {
                enabled: false,
                percent: 15
            },
            ata: {
                enabled: false,
                percent: 15
            }
        });
    });

    it('migrates an unversioned legacy blob to the current shape', () => {
        const hydrated = hydrateQuoteState({
            step: 3,
            selectedLines: ['ClickitUp'],
            builderItems: [{ id: 'b1', line: 'BaHaMa', model: 'Jumbrella', size: '4x4 Kvadrat', qty: 2 }],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1500': { qty: 3, discountPct: 0 }
                    },
                    addons: {}
                }
            },
            customCosts: [{ description: 'Frakt', price: 1000, qty: 1 }],
            customerInfo: {
                name: 'Ada',
                customerReference: 'ER-14',
                validity: '14 dagar'
            }
        });

        expect(hydrated.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(hydrated.step).toBe(3);
        expect(hydrated.selectedLines).toEqual(['ClickitUp']);
        expect(hydrated.builderItems).toHaveLength(1);
        expect(hydrated.gridSelections.ClickitUp.items['ClickitUp Section|1500'].qty).toBe(3);
        expect(hydrated.gridSelections.ClickitUp.customAddonsByCategory).toEqual({});
        expect(hydrated.customCosts).toHaveLength(1);
        expect(hydrated.customerInfo.name).toBe('Ada');
        expect(hydrated.customerInfo.customerReference).toBe('ER-14');
        expect(hydrated.quoteValidityDays).toBe(14);
        expect(hydrated.customerInfo.validity).toBe('14 dagar');
        expect(hydrated.inventoryData).toEqual({ bahama: [], bahamaV2: [], clickitup: {}, notes: '' });
        expect(hydrated.hideZeroDiscountReferencesInPdf).toBe(false);
        expect(hydrated.pdfThemeId).toBe('brixx');
        expect(hydrated.exportLanguage).toBe('sv');
    });

    it('strips CRM linkage fields from hydrated quote state', () => {
        const hydrated = hydrateQuoteState({
            customerInfo: { name: 'Ada' },
            crmDealId: 'deal-should-not-persist',
            quoteOwnerUid: 'owner-should-not-persist'
        });

        expect(hydrated.customerInfo.name).toBe('Ada');
        expect(hydrated).not.toHaveProperty('crmDealId');
        expect(hydrated).not.toHaveProperty('quoteOwnerUid');
    });

    it('migrates v3 state with safe contracting-work defaults', () => {
        const hydrated = hydrateQuoteState({
            stateVersion: 3,
            selectedLines: ['ClickitUp']
        });

        expect(hydrated.stateVersion).toBe(5);
        expect(hydrated.selectedLines).toEqual(['ClickitUp']);
        expect(hydrated.contractingWork).toEqual({
            enabled: false,
            projectName: '',
            rows: [],
            margin: {
                enabled: false,
                percent: 15
            },
            ata: {
                enabled: false,
                percent: 15
            }
        });
    });

    it('migrates v4 contracting work with safe margin defaults', () => {
        const hydrated = hydrateQuoteState({
            stateVersion: 4,
            contractingWork: {
                enabled: true,
                projectName: 'Projekt',
                rows: [{
                    id: 'row_1',
                    workPackage: 'Installation',
                    scope: 'Text',
                    unit: 'paket',
                    priceExVatSek: 1000
                }],
                ata: {
                    enabled: false,
                    percent: 15
                }
            }
        });

        expect(hydrated.stateVersion).toBe(5);
        expect(hydrated.contractingWork.margin).toEqual({
            enabled: false,
            percent: 15
        });
        expect(hydrated.contractingWork.rows[0].workPackage).toBe('Installation');
    });

    it('normalizes contracting work while preserving user-entered text verbatim', () => {
        const hydrated = hydrateQuoteState({
            stateVersion: 4,
            contractingWork: {
                enabled: true,
                projectName: '  Designer Village, Löddeköpinge  ',
                rows: [
                    {
                        id: '',
                        workPackage: '  Markarbete  ',
                        scope: 'Rad 1\nRad 2',
                        unit: ' samlat arbetspaket ',
                        priceExVatSek: -100
                    },
                    {
                        workPackage: '',
                        scope: '',
                        unit: '',
                        priceExVatSek: '395500'
                    },
                    {
                        id: 'kept-id',
                        workPackage: 'Installation',
                        scope: 'Oförändrad text',
                        unit: 'st',
                        priceExVatSek: 'invalid'
                    }
                ],
                margin: {
                    enabled: true,
                    percent: -25
                },
                ata: {
                    enabled: true,
                    percent: 125
                }
            }
        });

        expect(hydrated.contractingWork).toEqual({
            enabled: true,
            projectName: '  Designer Village, Löddeköpinge  ',
            rows: [
                {
                    id: 'contracting_work_row_1',
                    workPackage: '  Markarbete  ',
                    scope: 'Rad 1\nRad 2',
                    unit: ' samlat arbetspaket ',
                    priceExVatSek: 0
                },
                {
                    id: 'contracting_work_row_2',
                    workPackage: '',
                    scope: '',
                    unit: '',
                    priceExVatSek: 395500
                },
                {
                    id: 'kept-id',
                    workPackage: 'Installation',
                    scope: 'Oförändrad text',
                    unit: 'st',
                    priceExVatSek: 0
                }
            ],
            margin: {
                enabled: true,
                percent: 0
            },
            ata: {
                enabled: true,
                percent: 100
            }
        });
    });

    it('normalizes legacy validity and terms defaults safely', () => {
        const hydrated = hydrateQuoteState({
            customerInfo: {
                name: 'Ada',
                validity: 'Giltig i 45 dagar'
            },
            termsText: '',
            termsTemplateId: 'standard'
        });

        expect(hydrated.quoteValidityDays).toBe(45);
        expect(hydrated.customerInfo.validity).toBe('45 dagar');
        expect(hydrated.termsText).toContain('BETALNINGSVILLKOR');
        expect(hydrated.termsTemplateId).toBe('standard');
    });

    it('hydrates revision payloads into the current shape', () => {
        const hydrated = hydrateQuoteState({
            selectedLines: ['ClickitUp'],
            customerInfo: {
                name: 'Revision Kund'
            },
            activeQuoteId: 'quote_123',
            quoteNumber: 'BRIXX - 260422-103',
            activeQuoteVersion: 4,
            quoteStatus: 'sent'
        });

        expect(hydrated.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(hydrated.activeQuoteId).toBe('quote_123');
        expect(hydrated.quoteNumber).toBe('BRIXX - 260422-103');
        expect(hydrated.activeQuoteVersion).toBe(4);
        expect(hydrated.quoteStatus).toBe('sent');
        expect(hydrated.customerInfo.name).toBe('Revision Kund');
        expect(hydrated.customerInfo.customerReference).toBe('');
    });

    it('hydrates PDF theme selection with a conservative default', () => {
        expect(hydrateQuoteState({ pdfThemeId: 'custom' }).pdfThemeId).toBe('custom');
        expect(hydrateQuoteState({ pdfThemeId: 'brixx' }).pdfThemeId).toBe('brixx');
        expect(hydrateQuoteState({ pdfThemeId: 'unknown_theme' }).pdfThemeId).toBe('brixx');
        expect(hydrateQuoteState({}).pdfThemeId).toBe('brixx');
    });

    it('hydrates export language with a conservative Swedish default', () => {
        expect(hydrateQuoteState({ exportLanguage: 'en' }).exportLanguage).toBe('en');
        expect(hydrateQuoteState({ exportLanguage: 'sv' }).exportLanguage).toBe('sv');
        expect(hydrateQuoteState({ exportLanguage: 'de' }).exportLanguage).toBe('sv');
        expect(hydrateQuoteState({}).exportLanguage).toBe('sv');
    });

    it('switches built-in uncustomized terms when changing export language', () => {
        const initial = createInitialQuoteState();

        const englishState = quoteReducer(initial, {
            type: 'SET_EXPORT_LANGUAGE',
            payload: 'en'
        });

        expect(englishState.exportLanguage).toBe('en');
        expect(englishState.termsTemplateId).toBe('standard_en');
        expect(englishState.termsText).toContain('QUOTE AND PRICES');

        const customState = {
            ...englishState,
            termsTemplateId: 'custom-template',
            termsText: 'Custom legal text',
            termsCustomized: true
        };
        const swedishState = quoteReducer(customState, {
            type: 'SET_EXPORT_LANGUAGE',
            payload: 'sv'
        });

        expect(swedishState.exportLanguage).toBe('sv');
        expect(swedishState.termsTemplateId).toBe('custom-template');
        expect(swedishState.termsText).toBe('Custom legal text');
    });

    it('survives malformed nested objects without crashing', () => {
        const hydrated = hydrateQuoteState({
            customerInfo: null,
            gridSelections: null,
            inventoryData: 'broken',
            contractingWork: 'broken'
        });

        expect(hydrated.customerInfo).toEqual(createInitialQuoteState().customerInfo);
        expect(hydrated.gridSelections).toEqual({});
        expect(hydrated.inventoryData).toEqual({ bahama: [], bahamaV2: [], clickitup: {}, notes: '' });
        expect(hydrated.contractingWork).toEqual(createInitialQuoteState().contractingWork);
    });

    it('normalizes persisted grid maps and clickitup stock rows into concrete numeric shapes', () => {
        const hydrated = hydrateQuoteState({
            inventoryData: {
                bahama: [{ ID: 'B-1', BESKRIVNING: 'Parasollfot' }],
                bahamaV2: [{
                    id: ' BA-001 ',
                    type: ' Parasoll ',
                    size: ' 4x4 ',
                    status: 'reserved',
                    location: ' Grenställ 3 ',
                    properties: {
                        stativ: ' RAL 7016 ',
                        textil: ' MUSHROOM ',
                        fot: ' TIPP ',
                        belysning: ' Classic Light ',
                        varme: ' Infra '
                    },
                    comment: ' Kontroll ',
                    createdAt: '2026-06-01T10:00:00.000Z',
                    updatedAt: '2026-06-02T10:00:00.000Z',
                    updatedByUid: 'admin-1',
                    updatedByEmail: 'admin@example.com'
                }],
                clickitup: {
                    '3m': { sektion: '2', dorr_h: '3', hane_v: '4' },
                    broken: null
                },
                notes: 'Lagernotis'
            },
            gridSelections: {
                ClickitUp: {
                    items: {
                        section_1500: { qty: '3', discountPct: '5' },
                        broken_item: null
                    },
                    addons: {
                        led: { qty: '2', discountPct: '4', syncMode: 'manual', discountSyncMode: 'global' },
                        broken_addon: { qty: 'bad', discountPct: null, syncMode: 'weird' }
                    },
                    customAddonsByCategory: {}
                }
            }
        });

        expect(hydrated.inventoryData).toEqual({
            bahama: [{ ID: 'B-1', BESKRIVNING: 'Parasollfot' }],
            bahamaV2: [{
                id: 'BA-001',
                type: 'Parasoll',
                size: '4x4',
                status: 'reserved',
                location: 'Grenställ 3',
                properties: {
                    stativ: 'RAL 7016',
                    textil: 'MUSHROOM',
                    fot: 'TIPP',
                    belysning: 'Classic Light',
                    varme: 'Infra'
                },
                comment: 'Kontroll',
                createdAt: '2026-06-01T10:00:00.000Z',
                updatedAt: '2026-06-02T10:00:00.000Z',
                updatedByUid: 'admin-1',
                updatedByEmail: 'admin@example.com'
            }],
            clickitup: {
                '3m': { sektion: 2, dorr_h: 3, dorr_v: 0, hane_h: 0, hane_v: 4 },
                broken: { sektion: 0, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0 }
            },
            notes: 'Lagernotis'
        });
        expect(hydrated.gridSelections.ClickitUp.items).toEqual({
            section_1500: { qty: 3, discountPct: 5 },
            broken_item: { qty: 0, discountPct: 0 }
        });
        expect(hydrated.gridSelections.ClickitUp.addons).toEqual({
            led: { qty: 2, discountPct: 4, syncMode: 'manual', discountSyncMode: 'global' },
            broken_addon: { qty: 0, discountPct: 0 }
        });
    });

    it('hydrates custom grid add-ons with safe defaults for older and partial state', () => {
        const hydrated = hydrateQuoteState({
            gridSelections: {
                ClickitUp: {
                    items: {},
                    addons: {},
                    customAddonsByCategory: {
                        recommended: [
                            { id: 'row_1', name: 'Egen profil', price: '680', qty: '0', discountPct: '5' },
                            { name: 'Rad utan id', price: null }
                        ]
                    }
                }
            }
        });

        expect(hydrated.gridSelections.ClickitUp.customAddonsByCategory.recommended[0]).toEqual({
            id: 'row_1',
            name: 'Egen profil',
            price: 680,
            qty: 0,
            discountPct: 5
        });
        expect(hydrated.gridSelections.ClickitUp.customAddonsByCategory.recommended[1]).toMatchObject({
            name: 'Rad utan id',
            price: 0,
            qty: 1,
            discountPct: 0
        });
    });

    it('hydrates custom builder add-ons with safe defaults while preserving catalog add-ons', () => {
        const hydrated = hydrateQuoteState({
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: '2',
                    discountPct: '4',
                    displayName: 'Produktnamn override',
                    addons: [
                        { id: 'heater', qty: '3', discountPct: '5', displayName: 'Tillval override' },
                        {
                            id: 'custom_1',
                            qty: '2',
                            discountPct: '7',
                            isCustom: true,
                            name: 'Speciallack',
                            displayName: 'Custom override',
                            price: '900',
                            categoryId: 'installationsalternativ'
                        }
                    ]
                }
            ]
        });

        expect(hydrated.builderItems[0]).toMatchObject({
            id: 'builder_1',
            line: 'BaHaMa',
            model: 'Jumbrella',
            size: '4x4 Kvadrat',
            qty: 2,
            discountPct: 4,
            displayName: 'Produktnamn override'
        });
        expect(hydrated.builderItems[0].addons[0]).toEqual({
            id: 'heater',
            qty: 3,
            discountPct: 5,
            displayName: 'Tillval override'
        });
        expect(hydrated.builderItems[0].addons[1]).toEqual({
            id: 'custom_1',
            qty: 2,
            discountPct: 7,
            isCustom: true,
            name: 'Speciallack',
            displayName: 'Custom override',
            price: 900,
            categoryId: 'installationsalternativ'
        });
    });

    it('drops blank builder displayName overrides during hydration', () => {
        const hydrated = hydrateQuoteState({
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    addons: [
                        { id: 'heater', qty: 1, discountPct: 0, displayName: '   ' }
                    ],
                    displayName: ' '
                }
            ]
        });

        expect(hydrated.builderItems[0].displayName).toBeUndefined();
        expect(hydrated.builderItems[0].addons[0].displayName).toBeUndefined();
    });

    it('conservatively hydrates forward-version blobs and warns', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const hydrated = hydrateQuoteState({
            stateVersion: 99,
            selectedLines: ['ClickitUp'],
            customerInfo: { name: 'Future' }
        });

        expect(warnSpy).toHaveBeenCalled();
        expect(hydrated.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(hydrated.selectedLines).toEqual(['ClickitUp']);
        expect(hydrated.customerInfo.name).toBe('Future');
        expect(hydrated.customerInfo.customerReference).toBe('');

        warnSpy.mockRestore();
    });

    it('reset path returns the initial schema shape', () => {
        const initial = createInitialQuoteState();
        const dirtyState = hydrateQuoteState({
            step: 4,
            selectedLines: ['ClickitUp'],
            customerInfo: { name: 'Dirty' }
        });

        const reset = quoteReducer(dirtyState, { type: 'RESET_STATE' });

        expect(reset).toEqual(initial);
        expect(reset).not.toBe(initial);
    });

    it('hydrate action routes external payloads through the same schema path', () => {
        const initial = createInitialQuoteState();

        const nextState = quoteReducer(initial, {
            type: 'HYDRATE_STATE',
            payload: {
                selectedLines: ['ClickitUp'],
                customerInfo: { validity: '60 dagar' }
            }
        });

        expect(nextState.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(nextState.selectedLines).toEqual(['ClickitUp']);
        expect(nextState.quoteValidityDays).toBe(60);
        expect(nextState.customerInfo.validity).toBe('60 dagar');
        expect(nextState.customerInfo.customerReference).toBe('');
    });

    it('hydrate action supports the history reopen payload shape used by the app shell', () => {
        const initial = createInitialQuoteState();

        const nextState = quoteReducer(initial, {
            type: 'HYDRATE_STATE',
            payload: {
                step: 1,
                activeQuoteId: 'quote_123',
                quoteNumber: 'BRIXX - 260422-105',
                activeQuoteVersion: 5,
                quoteStatus: 'sent',
                customerInfo: {
                    name: 'Historik Kund',
                    company: 'Brixx AB'
                }
            }
        });

        expect(nextState.step).toBe(1);
        expect(nextState.activeQuoteId).toBe('quote_123');
        expect(nextState.quoteNumber).toBe('BRIXX - 260422-105');
        expect(nextState.activeQuoteVersion).toBe(5);
        expect(nextState.quoteStatus).toBe('sent');
        expect(nextState.customerInfo.name).toBe('Historik Kund');
        expect(nextState.customerInfo.company).toBe('Brixx AB');
    });

    it('update action persists sketch draft patches from the sketch flow without disturbing quote state', () => {
        const initial = createInitialQuoteState();

        const nextState = quoteReducer(initial, {
            type: 'UPDATE_STATE',
            payload: {
                sketchDraft: {
                    config: {
                        width: 9000,
                        depth: 4000,
                        depthLeft: 4000,
                        depthRight: 4000,
                        equalDepth: true,
                        includeBack: false,
                        prioMode: 'symmetrical',
                        targetLength: 1500,
                        doorSegmentsByEdge: {},
                        manualSectionsByEdge: {},
                        sectionCountByEdge: {},
                        activeMode: 'clickitup',
                        parasols: [],
                        selectedParasolId: null,
                        selectedParasolPresetId: 'default',
                        fiestaItems: [],
                        selectedFiestaId: null
                    },
                    workspace: {
                        camera: { zoom: 1.1, panX: 20, panY: 10 },
                        selection: { edgeKey: 'front', segmentIndex: null },
                        uiDensity: 'desktop'
                    }
                },
                sketchMeta: {
                    addedBahamaLine: true,
                    addedFiestaLine: false
                }
            }
        });

        expect(nextState.sketchDraft?.config.width).toBe(9000);
        expect(nextState.sketchDraft?.workspace.camera.zoom).toBe(1.1);
        expect(nextState.sketchMeta).toEqual({
            addedBahamaLine: true,
            addedFiestaLine: false
        });
        expect(nextState.activeQuoteId).toBeNull();
    });

    it('supports toggling the PDF zero-discount discount-reference flag through the reducer', () => {
        const initial = createInitialQuoteState();

        const nextState = quoteReducer(initial, {
            type: 'SET_HIDE_ZERO_DISCOUNT_REFERENCES_IN_PDF',
            payload: true
        });

        expect(nextState.hideZeroDiscountReferencesInPdf).toBe(true);
    });

    it('normalizes contracting work through its typed reducer action', () => {
        const initial = createInitialQuoteState();

        const nextState = quoteReducer(initial, {
            type: 'SET_CONTRACTING_WORK',
            payload: {
                enabled: true,
                projectName: ' Projekt ',
                rows: [{
                    id: 'row_1',
                    workPackage: 'Grundarbete',
                    scope: 'Text',
                    unit: 'paket',
                    priceExVatSek: -50
                }],
                margin: {
                    enabled: true,
                    percent: 150
                },
                ata: {
                    enabled: true,
                    percent: -5
                }
            }
        });

        expect(nextState.contractingWork.projectName).toBe(' Projekt ');
        expect(nextState.contractingWork.rows[0].priceExVatSek).toBe(0);
        expect(nextState.contractingWork.margin).toEqual({ enabled: true, percent: 100 });
        expect(nextState.contractingWork.ata).toEqual({ enabled: true, percent: 0 });
    });

    it('supports changing the PDF theme through the reducer', () => {
        const initial = createInitialQuoteState();

        const nextState = quoteReducer(initial, {
            type: 'SET_PDF_THEME_ID',
            payload: 'custom'
        });

        expect(nextState.pdfThemeId).toBe('custom');
    });

    it('preserves sketch metadata for both parasol and fiesta exports', () => {
        const hydrated = hydrateQuoteState({
            sketchMeta: {
                addedBahamaLine: true,
                addedFiestaLine: true
            }
        });

        expect(hydrated.sketchMeta).toEqual({
            addedBahamaLine: true,
            addedFiestaLine: true
        });
    });
});
