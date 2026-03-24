import { describe, expect, it, vi } from 'vitest';
import { quoteReducer } from '../src/store/QuoteContext.jsx';
import {
    CURRENT_STATE_VERSION,
    createInitialQuoteState,
    hydrateQuoteState
} from '../src/store/quoteStateSchema.js';

describe('quoteStateSchema', () => {
    it('returns current defaults for empty input', () => {
        const hydrated = hydrateQuoteState(null);

        expect(hydrated).toEqual(createInitialQuoteState());
        expect(hydrated.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(hydrated.hideZeroDiscountReferencesInPdf).toBe(false);
        expect(hydrated.customerInfo.customerReference).toBe('');
        expect(hydrated.gridSelections).toEqual({});
    });

    it('migrates an unversioned legacy blob to the current shape', () => {
        const hydrated = hydrateQuoteState({
            step: 3,
            selectedLines: ['ClickitUP'],
            builderItems: [{ id: 'b1', line: 'BaHaMa', model: 'Jumbrella', size: '4x4 Kvadrat', qty: 2 }],
            gridSelections: {
                ClickitUP: {
                    items: {
                        'ClickitUP Section|1500': { qty: 3, discountPct: 0 }
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

        expect(hydrated.stateVersion).toBe(1);
        expect(hydrated.step).toBe(3);
        expect(hydrated.selectedLines).toEqual(['ClickitUP']);
        expect(hydrated.builderItems).toHaveLength(1);
        expect(hydrated.gridSelections.ClickitUP.items['ClickitUP Section|1500'].qty).toBe(3);
        expect(hydrated.gridSelections.ClickitUP.customAddonsByCategory).toEqual({});
        expect(hydrated.customCosts).toHaveLength(1);
        expect(hydrated.customerInfo.name).toBe('Ada');
        expect(hydrated.customerInfo.customerReference).toBe('ER-14');
        expect(hydrated.quoteValidityDays).toBe(14);
        expect(hydrated.customerInfo.validity).toBe('14 dagar');
        expect(hydrated.inventoryData).toEqual({ bahama: [], clickitup: {} });
        expect(hydrated.scriveStatus).toBe('not_sent');
        expect(hydrated.hideZeroDiscountReferencesInPdf).toBe(false);
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
            selectedLines: ['ClickitUP'],
            customerInfo: {
                name: 'Revision Kund'
            },
            activeQuoteId: 'quote_123',
            activeQuoteVersion: 4,
            quoteStatus: 'sent'
        });

        expect(hydrated.stateVersion).toBe(1);
        expect(hydrated.activeQuoteId).toBe('quote_123');
        expect(hydrated.activeQuoteVersion).toBe(4);
        expect(hydrated.quoteStatus).toBe('sent');
        expect(hydrated.customerInfo.name).toBe('Revision Kund');
        expect(hydrated.customerInfo.customerReference).toBe('');
    });

    it('survives malformed nested objects without crashing', () => {
        const hydrated = hydrateQuoteState({
            customerInfo: null,
            gridSelections: null,
            inventoryData: 'broken',
            scriveStatus: 'bad-status'
        });

        expect(hydrated.customerInfo).toEqual(createInitialQuoteState().customerInfo);
        expect(hydrated.gridSelections).toEqual({});
        expect(hydrated.inventoryData).toEqual({ bahama: [], clickitup: {} });
        expect(hydrated.scriveStatus).toBe('not_sent');
    });

    it('hydrates custom grid add-ons with safe defaults for older and partial state', () => {
        const hydrated = hydrateQuoteState({
            gridSelections: {
                ClickitUP: {
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

        expect(hydrated.gridSelections.ClickitUP.customAddonsByCategory.recommended[0]).toEqual({
            id: 'row_1',
            name: 'Egen profil',
            price: 680,
            qty: 0,
            discountPct: 5
        });
        expect(hydrated.gridSelections.ClickitUP.customAddonsByCategory.recommended[1]).toMatchObject({
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
                    addons: [
                        { id: 'heater', qty: '3', discountPct: '5' },
                        {
                            id: 'custom_1',
                            qty: '2',
                            discountPct: '7',
                            isCustom: true,
                            name: 'Speciallack',
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
            discountPct: 4
        });
        expect(hydrated.builderItems[0].addons[0]).toEqual({
            id: 'heater',
            qty: 3,
            discountPct: 5
        });
        expect(hydrated.builderItems[0].addons[1]).toEqual({
            id: 'custom_1',
            qty: 2,
            discountPct: 7,
            isCustom: true,
            name: 'Speciallack',
            price: 900,
            categoryId: 'installationsalternativ'
        });
    });

    it('conservatively hydrates forward-version blobs and warns', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const hydrated = hydrateQuoteState({
            stateVersion: 99,
            selectedLines: ['ClickitUP'],
            customerInfo: { name: 'Future' }
        });

        expect(warnSpy).toHaveBeenCalled();
        expect(hydrated.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(hydrated.selectedLines).toEqual(['ClickitUP']);
        expect(hydrated.customerInfo.name).toBe('Future');
        expect(hydrated.customerInfo.customerReference).toBe('');

        warnSpy.mockRestore();
    });

    it('reset path returns the initial schema shape', () => {
        const initial = createInitialQuoteState();
        const dirtyState = hydrateQuoteState({
            step: 4,
            selectedLines: ['ClickitUP'],
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
                selectedLines: ['ClickitUP'],
                customerInfo: { validity: '60 dagar' }
            }
        });

        expect(nextState.stateVersion).toBe(CURRENT_STATE_VERSION);
        expect(nextState.selectedLines).toEqual(['ClickitUP']);
        expect(nextState.quoteValidityDays).toBe(60);
        expect(nextState.customerInfo.validity).toBe('60 dagar');
        expect(nextState.customerInfo.customerReference).toBe('');
    });

    it('supports toggling the PDF zero-discount discount-reference flag through the reducer', () => {
        const initial = createInitialQuoteState();

        const nextState = quoteReducer(initial, {
            type: 'SET_HIDE_ZERO_DISCOUNT_REFERENCES_IN_PDF',
            payload: true
        });

        expect(nextState.hideZeroDiscountReferencesInPdf).toBe(true);
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
