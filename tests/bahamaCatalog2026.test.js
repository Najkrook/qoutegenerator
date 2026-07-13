import { describe, expect, it } from 'vitest';
import { catalogData } from '../src/data/catalog';
import { computeQuoteTotals } from '../src/services/calculationEngine';

function getModel(modelName) {
    return catalogData.BaHaMa.models[modelName];
}

function getAddonItems(modelName) {
    return getModel(modelName).addonCategories.flatMap((category) => (
        category.items.map((item) => ({
            ...item,
            categoryId: category.id,
            categoryName: category.name
        }))
    ));
}

function getAddonMap(modelName) {
    return new Map(getAddonItems(modelName).map((item) => [item.id, item]));
}

function expectAddonPrices(modelName, expectedPrices) {
    const addons = getAddonMap(modelName);

    Object.entries(expectedPrices).forEach(([id, price]) => {
        expect(addons.get(id), `${modelName} missing addon ${id}`).toBeTruthy();
        expect(addons.get(id).price).toBe(price);
    });
}

function expectCategoryPrices(modelName, categoryId, expectedPrices) {
    const category = getModel(modelName).addonCategories.find((candidate) => candidate.id === categoryId);
    expect(category, `${modelName} missing category ${categoryId}`).toBeTruthy();

    const pricesById = Object.fromEntries(category.items.map((item) => [item.id, item.price]));
    expect(pricesById).toEqual(expectedPrices);
}

describe('BaHaMa 2026 catalog data', () => {
    it('matches the Pure 2026 add-on corrections and additions', () => {
        expectAddonPrices('Pure', {
            pure_powder_coat_crossframe: 230,
            pure_valance_35x3: 190,
            pure_valance_4x25: 190,
            pure_liro_mobile_stand: 2955,
            pure_delschen_mobile_stand: 1166,
            pure_fischer_bolts: 190,
            pure_multi_use_flange_plate: 240,
            pure_spacer_tipping: 310,
            pure_pole_extension: 180,
            pure_pole_reduction: 180,
            pure_soft_foam: 350,
            pure_print_on_membrane: 1100
        });

        expectCategoryPrices('Pure', 'pure_textil_valance_round', {
            pure_textil_valance_o2: 790,
            pure_textil_valance_o25: 790,
            pure_textil_valance_o3: 880,
            pure_textil_valance_o35: 980,
            pure_textil_valance_o4: 1100
        });
        expectCategoryPrices('Pure', 'pure_textil_valance_square', {
            pure_textil_valance_2x2: 860,
            pure_textil_valance_25x25: 890,
            pure_textil_valance_3x3: 1000,
            pure_textil_valance_35x35: 1110,
            pure_textil_valance_4x4: 1230
        });
        expectCategoryPrices('Pure', 'pure_textil_valance_rect', {
            pure_textil_valance_25x2: 790,
            pure_textil_valance_3x2: 790,
            pure_textil_valance_3x25: 910,
            pure_textil_valance_35x2: 910,
            pure_textil_valance_35x25: 990,
            pure_textil_valance_35x3: 1040,
            pure_textil_valance_4x2: 990,
            pure_textil_valance_4x25: 1040,
            pure_textil_valance_4x3: 1140,
            pure_textil_valance_4x35: 1220
        });
    });

    it('matches the Jumbrella 2026 add-on corrections and excludes the normal tipping base', () => {
        expectAddonPrices('Jumbrella', {
            jumb_v4a_maritime: 280,
            jumb_valance_o4: 250,
            jumb_valance_o63: 370,
            jumb_in_ground_tipping_base_electrical: 560,
            jumb_liro_mobile_stand: 2955,
            jumb_delschen_mobile_stand: 1166,
            jumb_spacer_steel_plate_base: 390,
            jumb_spacer_electrics: 430,
            jumb_fischer_bolts: 340,
            jumb_multi_use_flange_plate: 260,
            jumb_cover_basic: 140,
            jumb_soft_foam: 350,
            jumb_print_on_membrane: 1100
        });

        const jumbrellaAddons = getAddonMap('Jumbrella');
        expect(jumbrellaAddons.has('gjuthylsa_jumbrella')).toBe(true);
        expect(jumbrellaAddons.has('in_ground_sleeve')).toBe(false);
        expect(jumbrellaAddons.has('jumb_in_ground_tipping_base')).toBe(false);

        expectCategoryPrices('Jumbrella', 'jumb_textil_valance_round', {
            jumb_textil_valance_o3: 900,
            jumb_textil_valance_o35: 1010,
            jumb_textil_valance_o4: 1220,
            jumb_textil_valance_o45: 1450,
            jumb_textil_valance_o5: 1610,
            jumb_textil_valance_o56: 1940,
            jumb_textil_valance_o63: 2320,
            jumb_textil_valance_o7: 2420
        });
        expectCategoryPrices('Jumbrella', 'jumb_textil_valance_square', {
            jumb_textil_valance_3x3: 1070,
            jumb_textil_valance_35x35: 1410,
            jumb_textil_valance_4x4: 1540,
            jumb_textil_valance_45x45: 1750,
            jumb_textil_valance_5x5: 2220,
            jumb_textil_valance_6x6: 2460
        });
        expectCategoryPrices('Jumbrella', 'jumb_textil_valance_rect', {
            jumb_textil_valance_3x15: 830,
            jumb_textil_valance_3x35: 1330,
            jumb_textil_valance_4x2: 1050,
            jumb_textil_valance_4x3: 1390,
            jumb_textil_valance_4x35: 1450,
            jumb_textil_valance_45x3: 1450,
            jumb_textil_valance_45x35: 1500,
            jumb_textil_valance_45x4: 1590,
            jumb_textil_valance_5x25: 1390,
            jumb_textil_valance_5x3: 1460,
            jumb_textil_valance_5x375: 1780,
            jumb_textil_valance_5x4: 1780,
            jumb_textil_valance_6x3: 1780,
            jumb_textil_valance_6x4: 2100,
            jumb_textil_valance_6x45: 2420
        });
    });

    it('includes Jumbrella XL valance categories from the 2026 price list', () => {
        expectAddonPrices('Jumbrella XL', {
            xl_print_on_membrane: 1100
        });
        expectCategoryPrices('Jumbrella XL', 'valance_kvadrat', {
            xl_valance_5x5: 450,
            xl_valance_55x55: 500,
            xl_valance_6x6: 560,
            xl_valance_7x7: 780
        });
        expectCategoryPrices('Jumbrella XL', 'valance_rektangel', {
            xl_valance_6x514: 560,
            xl_valance_7x5: 670,
            xl_valance_7x6: 780
        });
    });

    it('includes representative new Pure and Jumbrella add-ons in quote totals', () => {
        const summary = computeQuoteTotals({
            catalogData,
            state: {
                exchangeRate: 10,
                builderItems: [
                    {
                        id: 'pure_1',
                        line: 'BaHaMa',
                        model: 'Pure',
                        size: '2x2',
                        qty: 1,
                        discountPct: 0,
                        addons: [
                            { id: 'pure_soft_foam', qty: 2, discountPct: 0 },
                            { id: 'pure_textil_valance_4x4', qty: 1, discountPct: 0 }
                        ]
                    },
                    {
                        id: 'jumbrella_1',
                        line: 'BaHaMa',
                        model: 'Jumbrella',
                        size: '3x3 Kvadrat',
                        qty: 1,
                        discountPct: 0,
                        addons: [
                            { id: 'jumb_spacer_electrics', qty: 1, discountPct: 0 },
                            { id: 'jumb_textil_valance_6x45', qty: 1, discountPct: 0 }
                        ]
                    }
                ],
                gridSelections: {},
                customCosts: []
            }
        });

        const addonRows = Object.fromEntries(
            summary.totals
                .filter((row) => row.source.type === 'builder-addon')
                .map((row) => [row.source.addonId, row])
        );

        expect(addonRows.pure_soft_foam.gross).toBe(7000);
        expect(addonRows.pure_textil_valance_4x4.unitPrice).toBe(12300);
        expect(addonRows.jumb_spacer_electrics.unitPrice).toBe(4300);
        expect(addonRows.jumb_textil_valance_6x45.unitPrice).toBe(24200);
        expect(summary.grossTotalSek).toBe(86300);
    });

    it('includes Jumbrella XL valance add-ons in quote totals', () => {
        const summary = computeQuoteTotals({
            catalogData,
            state: {
                exchangeRate: 10,
                builderItems: [
                    {
                        id: 'xl_1',
                        line: 'BaHaMa',
                        model: 'Jumbrella XL',
                        size: '7x6 Rektangel',
                        qty: 1,
                        discountPct: 0,
                        addons: [
                            { id: 'xl_valance_7x6', qty: 1, discountPct: 0 }
                        ]
                    }
                ],
                gridSelections: {},
                customCosts: []
            }
        });

        const addonRows = Object.fromEntries(
            summary.totals
                .filter((row) => row.source.type === 'builder-addon')
                .map((row) => [row.source.addonId, row])
        );

        expect(addonRows.xl_valance_7x6.unitPrice).toBe(7800);
        expect(addonRows.xl_valance_7x6.gross).toBe(7800);
        expect(summary.grossTotalSek).toBe(118800);
    });
});
