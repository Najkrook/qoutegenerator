import { describe, expect, it } from 'vitest';
import { catalogData } from '../src/data/catalog';
import { computeQuoteTotals } from '../src/services/calculationEngine';

describe('Jumbrella outSide Catalog & Calculations', () => {
    it('should be present in the BaHaMa catalog with exactly 6 sizes and correct base prices', () => {
        const bahama = catalogData.BaHaMa;
        expect(bahama).toBeDefined();
        expect(bahama.type).toBe('builder');

        const outsideModel = bahama.models['Jumbrella outSide'];
        expect(outsideModel).toBeDefined();
        expect(outsideModel.name).toBe('Jumbrella outSide');

        const sizes = outsideModel.sizes;
        const sizeKeys = Object.keys(sizes);
        expect(sizeKeys).toHaveLength(6);

        expect(sizes['3* Runda'].price).toBe(6780);
        expect(sizes['3,5* Runda'].price).toBe(6900);
        expect(sizes['4* Runda'].price).toBe(7110);
        expect(sizes['3x3 Kvadrat'].price).toBe(6900);
        expect(sizes['3,5x3,5 Kvadrat'].price).toBe(7110);
        expect(sizes['4x4 Kvadrat'].price).toBe(7320);
    });

    it('should contain stable category IDs and items for installations, cosmetics, and side panels', () => {
        const outsideModel = catalogData.BaHaMa.models['Jumbrella outSide'];
        const categories = outsideModel.addonCategories;

        // Verify categories exist
        const installations = categories.find(c => c.id === 'installationsalternativ');
        expect(installations).toBeDefined();
        expect(installations.name).toBe('Installationsalternativ');
        expect(installations.items.find(i => i.id === 'outside_tipping_base').price).toBe(630);

        const cosmetic = categories.find(c => c.id === 'cosmetic');
        expect(cosmetic).toBeDefined();
        expect(cosmetic.name).toBe('Cosmetic');
        // Precontraint 302 upgrade 3x3 Kvadrat (4m Runda / 3x3 Kvadrat)
        expect(cosmetic.items.find(i => i.id === 'outside_upgrade_precontraint_o4_kv3').price).toBe(370);

        const sidovaggar = categories.find(c => c.id === 'sidovaggar');
        expect(sidovaggar).toBeDefined();
        expect(sidovaggar.name).toBe('Sidoväggar');
        expect(sidovaggar.items.find(i => i.id === 'outside_side_no_window_3x3_betex').price).toBe(400);
    });

    it('should compute quote totals correctly with base prices and membrane upgrades converted via exchange rate', () => {
        // Prepare state: 1 Jumbrella outSide 3x3 Kvadrat (6900 EUR)
        // Add upgrade: Precontraint 302 upgrade (370 EUR)
        // Exchange rate: 11.00 (SEK/EUR)
        const state = {
            exchangeRate: 11.0,
            globalDiscountPct: 0,
            builderItems: [
                {
                    id: 'item_outside_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella outSide',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [
                        { id: 'outside_upgrade_precontraint_o4_kv3', qty: 1, discountPct: 0 }
                    ]
                }
            ],
            gridSelections: {},
            customCosts: []
        };

        const result = computeQuoteTotals({
            state,
            catalogData
        });

        // 6900 EUR * 11 = 75900 SEK
        // 370 EUR * 11 = 4070 SEK
        // Total = 79970 SEK
        expect(result.grossTotalSek).toBe(79970);
        expect(result.totalDiscountSek).toBe(0);
        expect(result.finalTotalSek).toBe(79970);

        expect(result.totals).toHaveLength(2);
        expect(result.totals[0]).toMatchObject({
            model: 'BaHaMa Jumbrella outSide',
            size: '3x3',
            unitPrice: 75900,
            qty: 1,
            gross: 75900,
            net: 75900
        });

        expect(result.totals[1]).toMatchObject({
            model: 'Tillval: Uppgradering: Precontraint 302 / elegance duk (4m Runda / 3x3 Kvadrat)',
            unitPrice: 4070,
            qty: 1,
            gross: 4070,
            net: 4070,
            isAddon: true
        });
    });
});
