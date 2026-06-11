import { describe, expect, it } from 'vitest';
import {
    applyGlobalDiscountToGridCustomAddons,
    applyGlobalDiscountToLineSelection,
    buildEffectiveGridSelections
} from '../src/utils/gridAutoScale';
import { createCatalogFixture } from './fixtures/calculationFixtures';

    function createLineData() {
        const catalog = createCatalogFixture();
        catalog.ClickitUp.addonCategories.push({
            id: 'recommended',
            items: [
                { id: 'frakt_glas', name: 'Glasfrakt Specialpall', price: 2120, autoScale: true, autoScaleDivisor: 6 },
                { id: 'svartanodiserade', name: 'Svartanodiserade profiler', price: 340, autoScale: true },
                { id: 'stoppknapp', name: 'Stoppknapp 140 cm', price: 564, autoScale: true }
            ]
    });
    return catalog.ClickitUp;
}

describe('gridAutoScale discount follow', () => {
    it('creates missing auto-scale addon entries when global discount changes', () => {
        const lineData = createLineData();
        const lineSelection = {
            items: {
                'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
            },
            addons: {}
        };

        const nextLineSelection = applyGlobalDiscountToLineSelection(lineData, lineSelection, 10);

        expect(nextLineSelection.addons.svartanodiserade).toMatchObject({
            qty: 7,
            discountPct: 10,
            syncMode: 'auto',
            discountSyncMode: 'global'
        });
        expect(nextLineSelection.addons.stoppknapp).toMatchObject({
            qty: 7,
            discountPct: 10,
            syncMode: 'auto',
            discountSyncMode: 'global'
        });
    });

    it('preserves manual legacy discounts while still resolving missing rows to global', () => {
        const lineData = createLineData();
        const lineSelection = {
            items: {
                'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
            },
            addons: {
                svartanodiserade: { qty: 4, discountPct: 0 }
            }
        };

        const effectiveSelections = buildEffectiveGridSelections(lineData, lineSelection, {
            globalDiscountPct: 5
        });

        expect(effectiveSelections.addons.svartanodiserade.discountPct).toBe(0);
        expect(effectiveSelections.addons.stoppknapp.discountPct).toBe(5);
    });

    it('updates only custom grid rows that still follow the previous global discount', () => {
        const nextLineSelection = applyGlobalDiscountToGridCustomAddons({
            customAddonsByCategory: {
                recommended: [
                    { id: 'c1', name: 'Egen rad 1', price: 500, qty: 1, discountPct: 5 },
                    { id: 'c2', name: 'Egen rad 2', price: 700, qty: 1, discountPct: 2 }
                ]
            }
        }, 5, 10);

        expect(nextLineSelection.customAddonsByCategory.recommended).toEqual([
            { id: 'c1', name: 'Egen rad 1', price: 500, qty: 1, discountPct: 10 },
            { id: 'c2', name: 'Egen rad 2', price: 700, qty: 1, discountPct: 2 }
        ]);
    });

    it.each([
        [0, 0],
        [1, 1],
        [6, 1],
        [7, 2],
        [12, 2],
        [14, 3]
    ])('auto-scales freight pallets by rounding %i sections up to %i pallets', (sectionQty, expectedQty) => {
        const lineData = createLineData();
        const effectiveSelections = buildEffectiveGridSelections(lineData, {
            items: {
                'ClickitUp Section|1000': { qty: sectionQty, discountPct: 0 }
            },
            addons: {}
        });

        expect(effectiveSelections.addons.frakt_glas.qty).toBe(expectedQty);
    });

    it('keeps manual freight pallet overrides instead of applying the divisor', () => {
        const lineData = createLineData();
        const effectiveSelections = buildEffectiveGridSelections(lineData, {
            items: {
                'ClickitUp Section|1000': { qty: 14, discountPct: 0 }
            },
            addons: {
                frakt_glas: { qty: 5, discountPct: 0, syncMode: 'manual' }
            }
        });

        expect(effectiveSelections.addons.frakt_glas.qty).toBe(5);
        expect(effectiveSelections.addons.frakt_glas.syncMode).toBe('manual');
    });
});
