import { describe, expect, it } from 'vitest';
import { computeQuoteTotals } from '../src/services/calculationEngine.js';
import { createCatalogFixture, createStateFixture } from './fixtures/calculationFixtures.js';

describe('computeQuoteTotals', () => {
    function addClickitUpAutoScaleAddons(catalogData) {
        catalogData.ClickitUp.addonCategories.push({
            id: 'recommended',
            items: [
                { id: 'svartanodiserade', name: 'Svartanodiserade profiler', price: 340, autoScale: true },
                { id: 'stoppknapp', name: 'Stoppknapp 140 cm', price: 564, autoScale: true }
            ]
        });
        return catalogData;
    }

    it('computes mixed quote totals deterministically', () => {
        const summary = computeQuoteTotals({
            state: createStateFixture(),
            catalogData: createCatalogFixture()
        });

        expect(summary.totals).toHaveLength(5);
        expect(summary.grossTotalSek).toBe(79800);
        expect(summary.totalDiscountSek).toBe(7575);
        expect(summary.finalTotalSek).toBe(72225);
        expect(summary.globalDiscountAmt).toBe(0);
    });

    it('does not apply global discount as a second discount', () => {
        const state = createStateFixture({
            globalDiscountPct: 25,
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 15,
                    addons: []
                }
            ],
            gridSelections: {},
            customCosts: []
        });

        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        expect(summary.grossTotalSek).toBe(30000);
        expect(summary.totalDiscountSek).toBe(4500);
        expect(summary.finalTotalSek).toBe(25500);
        expect(summary.globalDiscountAmt).toBe(0);
    });

    it('includes custom builder add-ons as manual tillval rows without currency conversion', () => {
        const state = createStateFixture({
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [
                        {
                            id: 'custom_1',
                            qty: 2,
                            discountPct: 10,
                            isCustom: true,
                            name: 'Speciallack',
                            price: 500,
                            categoryId: 'installation'
                        }
                    ]
                }
            ],
            gridSelections: {},
            customCosts: [],
            exchangeRate: 12
        });
        const catalogData = createCatalogFixture();
        catalogData.BaHaMa.currency = 'EUR';

        const summary = computeQuoteTotals({ state, catalogData });
        const customRow = summary.totals.find((row) => row.source.type === 'builder-custom-addon');

        expect(customRow).toMatchObject({
            model: '  + Tillval: Speciallack',
            unitPrice: 500,
            qty: 2,
            gross: 1000,
            discountPct: 10,
            discountSek: 100,
            net: 900,
            source: {
                type: 'builder-custom-addon',
                itemId: 'builder_1',
                rowId: 'custom_1',
                categoryId: 'installation'
            }
        });
    });

    it('falls back to Egen rad for unnamed custom builder add-ons', () => {
        const state = createStateFixture({
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [
                        {
                            id: 'custom_1',
                            qty: 1,
                            discountPct: 0,
                            isCustom: true,
                            name: '',
                            price: 500,
                            categoryId: 'installation'
                        }
                    ]
                }
            ],
            gridSelections: {},
            customCosts: []
        });

        const summary = computeQuoteTotals({ state, catalogData: createCatalogFixture() });
        const customRow = summary.totals.find((row) => row.source.type === 'builder-custom-addon');

        expect(customRow.model).toBe('  + Tillval: Egen rad');
    });

    it('supports zero quantities, full discounts, and decimal exchange rates', () => {
        const state = createStateFixture({
            exchangeRate: 11.25,
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 0,
                    discountPct: 0,
                    addons: []
                }
            ],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1200': { qty: 2, discountPct: 100 }
                    },
                    addons: {}
                }
            },
            customCosts: []
        });

        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        expect(summary.grossTotalSek).toBe(27000);
        expect(summary.totalDiscountSek).toBe(27000);
        expect(summary.finalTotalSek).toBe(0);
        expect(summary.totals.every((row) => Number.isFinite(row.net))).toBe(true);
    });

    it('returns a stable empty result for empty configuration', () => {
        const summary = computeQuoteTotals({
            state: {
                builderItems: [],
                gridSelections: {},
                customCosts: [],
                exchangeRate: 12,
                globalDiscountPct: 0
            },
            catalogData: {}
        });

        expect(summary.totals).toEqual([]);
        expect(summary.grossTotalSek).toBe(0);
        expect(summary.totalDiscountSek).toBe(0);
        expect(summary.finalTotalSek).toBe(0);
        expect(summary.globalDiscountAmt).toBe(0);
    });

    it('sorts grid main rows by model order then ascending size', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|2000': { qty: 1, discountPct: 0 },
                        'ClickitUp Section|1400': { qty: 1, discountPct: 0 },
                        'ClickitUp Section|1700': { qty: 1, discountPct: 0 },
                        'ClickitUp Hane|1100': { qty: 1, discountPct: 0 },
                        'ClickitUp Hane|1000': { qty: 1, discountPct: 0 },
                        'ClickitUp Dörr|1100': { qty: 1, discountPct: 0 },
                        'ClickitUp Dörr|700': { qty: 1, discountPct: 0 }
                    },
                    addons: {}
                }
            }
        });

        const catalogData = createCatalogFixture();
        catalogData.ClickitUp.gridItems = [
            {
                model: 'ClickitUp Section',
                sizes: [
                    { size: '1400', price: 1400 },
                    { size: '1700', price: 1700 },
                    { size: '2000', price: 2000 }
                ]
            },
            {
                model: 'ClickitUp Hane',
                sizes: [
                    { size: '1000', price: 1000 },
                    { size: '1100', price: 1100 }
                ]
            },
            {
                model: 'ClickitUp Dörr',
                sizes: [
                    { size: '700', price: 700 },
                    { size: '1100', price: 1100 }
                ]
            }
        ];

        const summary = computeQuoteTotals({ state, catalogData });

        expect(summary.totals.filter((row) => !row.isAddon && !row.isCustom).map((row) => `${row.model}|${row.size}`)).toEqual([
            'ClickitUp Section|1400',
            'ClickitUp Section|1700',
            'ClickitUp Section|2000',
            'ClickitUp Hane|1000',
            'ClickitUp Hane|1100',
            'ClickitUp Dörr|700',
            'ClickitUp Dörr|1100'
        ]);
    });

    it('keeps addons after main rows and custom rows last', () => {
        const state = createStateFixture({
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [{ id: 'heater', qty: 1, discountPct: 0 }]
                }
            ],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1200': { qty: 1, discountPct: 0 }
                    },
                    addons: {
                        'door-right': { qty: 1, discountPct: 0 }
                    }
                }
            },
            customCosts: [
                { description: 'Montering', price: 1000, qty: 1 }
            ]
        });

        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        expect(summary.totals.map((row) => row.source.type)).toEqual([
            'builder',
            'grid',
            'builder-addon',
            'grid-addon',
            'custom'
        ]);
    });

    it('sorts builder dimensions with Swedish decimal parsing', () => {
        const state = createStateFixture({
            gridSelections: {},
            customCosts: [],
            builderItems: [
                { line: 'BaHaMa', model: 'Jumbrella', size: '6x4,5 Rektangel', qty: 1, discountPct: 0, addons: [] },
                { line: 'BaHaMa', model: 'Jumbrella', size: '3,5x3,5 Kvadrat', qty: 1, discountPct: 0, addons: [] },
                { line: 'BaHaMa', model: 'Jumbrella', size: '4x4 Kvadrat', qty: 1, discountPct: 0, addons: [] }
            ]
        });

        const catalogData = createCatalogFixture();
        catalogData.BaHaMa.models.Jumbrella.sizes = {
            '6x4,5 Rektangel': { price: 60000 },
            '3,5x3,5 Kvadrat': { price: 35000 },
            '4x4 Kvadrat': { price: 40000 }
        };

        const summary = computeQuoteTotals({ state, catalogData });

        expect(summary.totals.filter((row) => !row.isAddon && !row.isCustom).map((row) => row.size)).toEqual([
            '3,5x3,5',
            '4x4',
            '6x4,5'
        ]);
    });

    it('keeps stable order for equal sizes', () => {
        const state = createStateFixture({
            builderItems: [
                { line: 'BaHaMa', model: 'Jumbrella', size: '4x4 Kvadrat', qty: 1, discountPct: 0, addons: [] },
                { line: 'BaHaMa', model: 'Jumbrella', size: '4x4 Kvadrat', qty: 2, discountPct: 0, addons: [] }
            ],
            gridSelections: {},
            customCosts: []
        });

        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        expect(summary.totals.filter((row) => !row.isAddon && !row.isCustom).map((row) => row.qty)).toEqual([1, 2]);
    });

    it('auto-syncs ClickitUp auto-scale add-ons to section subtotal when entries are missing', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                        'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
                    },
                    addons: {}
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });
        const autoRows = summary.totals.filter((row) => row.source.type === 'grid-addon' && ['svartanodiserade', 'stoppknapp'].includes(row.source.addonId));

        expect(autoRows.map((row) => `${row.source.addonId}:${row.qty}`)).toEqual([
            'svartanodiserade:7',
            'stoppknapp:7'
        ]);
    });

    it('preserves a manual auto-scale addon while other missing auto-scale rows still sync', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                        'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
                    },
                    addons: {
                        svartanodiserade: { qty: 3, discountPct: 0, syncMode: 'manual' }
                    }
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });
        const svartanodiserade = summary.totals.find((row) => row.source.addonId === 'svartanodiserade');
        const stoppknapp = summary.totals.find((row) => row.source.addonId === 'stoppknapp');

        expect(svartanodiserade.qty).toBe(3);
        expect(stoppknapp.qty).toBe(7);
    });

    it('ignores stored qty when an auto-scale addon is explicitly set to auto', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                        'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
                    },
                    addons: {
                        stoppknapp: { qty: 2, discountPct: 0, syncMode: 'auto' }
                    }
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });
        const stoppknapp = summary.totals.find((row) => row.source.addonId === 'stoppknapp');

        expect(stoppknapp.qty).toBe(7);
    });

    it('treats legacy persisted auto-scale addon values without sync mode as manual', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                        'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
                    },
                    addons: {
                        svartanodiserade: { qty: 4, discountPct: 0 }
                    }
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });
        const svartanodiserade = summary.totals.find((row) => row.source.addonId === 'svartanodiserade');

        expect(svartanodiserade.qty).toBe(4);
    });

    it('omits auto-scale addon rows when section subtotal is zero', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            gridSelections: {
                ClickitUp: {
                    items: {},
                    addons: {}
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });

        expect(summary.totals.some((row) => ['svartanodiserade', 'stoppknapp'].includes(row.source?.addonId))).toBe(false);
    });

    it('uses the global discount by default for missing auto-scale add-on rows', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            globalDiscountPct: 5,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                        'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
                    },
                    addons: {}
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });
        const autoRows = summary.totals.filter((row) => row.source.type === 'grid-addon' && ['svartanodiserade', 'stoppknapp'].includes(row.source.addonId));

        expect(autoRows.map((row) => `${row.source.addonId}:${row.discountPct}`)).toEqual([
            'svartanodiserade:5',
            'stoppknapp:5'
        ]);
    });

    it('keeps legacy persisted auto-scale discounts manual when discount sync mode is missing', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            globalDiscountPct: 5,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                        'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
                    },
                    addons: {
                        svartanodiserade: { qty: 7, discountPct: 0 }
                    }
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });
        const svartanodiserade = summary.totals.find((row) => row.source.addonId === 'svartanodiserade');

        expect(svartanodiserade.discountPct).toBe(0);
    });

    it('uses global discount when an auto-scale row is explicitly marked as global', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            globalDiscountPct: 5,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                        'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
                    },
                    addons: {
                        stoppknapp: { qty: 7, discountPct: 0, discountSyncMode: 'global' }
                    }
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });
        const stoppknapp = summary.totals.find((row) => row.source.addonId === 'stoppknapp');

        expect(stoppknapp.discountPct).toBe(5);
    });

    it('preserves manual discount overrides for auto-scale add-ons', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            globalDiscountPct: 5,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 4, discountPct: 0 },
                        'ClickitUp Section|1200': { qty: 3, discountPct: 0 }
                    },
                    addons: {
                        svartanodiserade: { qty: 7, discountPct: 2, discountSyncMode: 'manual' }
                    }
                }
            }
        });
        const catalogData = addClickitUpAutoScaleAddons(createCatalogFixture());

        const summary = computeQuoteTotals({ state, catalogData });
        const svartanodiserade = summary.totals.find((row) => row.source.addonId === 'svartanodiserade');

        expect(svartanodiserade.discountPct).toBe(2);
    });

    it('includes custom grid add-ons as normal tillval rows', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 1, discountPct: 0 }
                    },
                    addons: {},
                    customAddonsByCategory: {
                        doors: [
                            { id: 'custom_1', name: 'Specialdörr', price: 1500, qty: 2, discountPct: 10 }
                        ]
                    }
                }
            }
        });

        const summary = computeQuoteTotals({ state, catalogData: createCatalogFixture() });
        const customRow = summary.totals.find((row) => row.source.type === 'grid-custom-addon');

        expect(customRow).toMatchObject({
            model: '  + Tillval: Specialdörr',
            unitPrice: 1500,
            qty: 2,
            gross: 3000,
            discountPct: 10,
            discountSek: 300,
            net: 2700,
            isAddon: true,
            source: {
                type: 'grid-custom-addon',
                lineId: 'ClickitUp',
                categoryId: 'doors',
                rowId: 'custom_1'
            }
        });
    });

    it('falls back to Egen rad for unnamed custom grid add-ons', () => {
        const state = createStateFixture({
            builderItems: [],
            customCosts: [],
            exchangeRate: 1,
            gridSelections: {
                ClickitUp: {
                    items: {},
                    addons: {},
                    customAddonsByCategory: {
                        doors: [
                            { id: 'custom_1', name: '', price: 500, qty: 1, discountPct: 0 }
                        ]
                    }
                }
            }
        });

        const summary = computeQuoteTotals({ state, catalogData: createCatalogFixture() });
        const customRow = summary.totals.find((row) => row.source.type === 'grid-custom-addon');

        expect(customRow.model).toBe('  + Tillval: Egen rad');
    });
});
