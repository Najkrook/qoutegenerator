import { describe, expect, it } from 'vitest';
import {
    applyGlobalDiscountToGridCustomAddons,
    applyGlobalDiscountToLineSelection,
    buildEffectiveGridSelections
} from '../src/utils/gridAutoScale.js';
import { createCatalogFixture } from './fixtures/calculationFixtures.js';

    function createLineData() {
        const catalog = createCatalogFixture();
        catalog.ClickitUP.addonCategories.push({
            id: 'recommended',
            items: [
                { id: 'svartanodiserade', name: 'Svartanodiserade profiler', price: 340, autoScale: true },
                { id: 'stoppknapp', name: 'Stoppknapp 140 cm', price: 564, autoScale: true }
            ]
    });
    return catalog.ClickitUP;
}

describe('gridAutoScale discount follow', () => {
    it('creates missing auto-scale addon entries when global discount changes', () => {
        const lineData = createLineData();
        const lineSelection = {
            items: {
                'ClickitUP Section|1000': { qty: 4, discountPct: 0 },
                'ClickitUP Section|1200': { qty: 3, discountPct: 0 }
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
                'ClickitUP Section|1000': { qty: 4, discountPct: 0 },
                'ClickitUP Section|1200': { qty: 3, discountPct: 0 }
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
});
