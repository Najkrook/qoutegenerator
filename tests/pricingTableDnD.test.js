import { describe, expect, it } from 'vitest';
import {
    isPricingTableDropAllowed,
    reorderBuilderAddonsByDrop,
    reorderBuilderItemsByDrop,
    reorderGridRowsByDrop
} from '../src/components/features/PricingTable';

describe('PricingTable drag-and-drop helpers', () => {
    it('reorders builder products before and after a target product', () => {
        const items = [
            { id: 'builder_a', addons: [] },
            { id: 'builder_b', addons: [] },
            { id: 'builder_c', addons: [] }
        ];

        const movedAfter = reorderBuilderItemsByDrop(items, 'builder_a', 'builder_b', 'after');
        const movedBefore = reorderBuilderItemsByDrop(items, 'builder_c', 'builder_a', 'before');

        expect(movedAfter.map((item) => item.id)).toEqual(['builder_b', 'builder_a', 'builder_c']);
        expect(movedBefore.map((item) => item.id)).toEqual(['builder_c', 'builder_a', 'builder_b']);
    });

    it('reorders builder addons inside the same product group', () => {
        const addons = [
            { id: 'heater', qty: 1, discountPct: 0 },
            { id: 'frame', qty: 1, discountPct: 0 },
            { id: 'valance', qty: 1, discountPct: 0 }
        ];

        const movedAfter = reorderBuilderAddonsByDrop(addons, 0, 1, 'after');
        const movedBefore = reorderBuilderAddonsByDrop(addons, 2, 0, 'before');

        expect(movedAfter.map((addon) => addon.id)).toEqual(['frame', 'heater', 'valance']);
        expect(movedBefore.map((addon) => addon.id)).toEqual(['valance', 'heater', 'frame']);
    });

    it('only allows product drops between products and addon drops inside the same builder item', () => {
        expect(isPricingTableDropAllowed(
            { type: 'builder', itemId: 'builder_a' },
            { type: 'builder', itemId: 'builder_b' }
        )).toBe(true);

        expect(isPricingTableDropAllowed(
            { type: 'builder-addon', itemId: 'builder_a', addonId: 'heater' },
            { type: 'builder-custom-addon', itemId: 'builder_a', rowId: 'custom_1', categoryId: 'frame' }
        )).toBe(true);

        expect(isPricingTableDropAllowed(
            { type: 'builder-addon', itemId: 'builder_a', addonId: 'heater' },
            { type: 'builder-addon', itemId: 'builder_b', addonId: 'frame' }
        )).toBe(false);

        expect(isPricingTableDropAllowed(
            { type: 'builder', itemId: 'builder_a' },
            { type: 'builder-addon', itemId: 'builder_a', addonId: 'heater' }
        )).toBe(false);
    });

    it('allows ClickitUp products and add-ons to move within one product line', () => {
        const product = { type: 'grid', lineId: 'ClickitUp', key: 'ClickitUp Sektion|1000' };
        const freight = { type: 'grid-addon', lineId: 'ClickitUp', addonId: 'frakt_glas' };
        const customAddon = { type: 'grid-custom-addon', lineId: 'ClickitUp', categoryId: 'extra', rowId: 'toplock' };

        expect(isPricingTableDropAllowed(freight, product)).toBe(true);
        expect(isPricingTableDropAllowed(customAddon, freight)).toBe(true);
        expect(isPricingTableDropAllowed(freight, { ...freight, lineId: 'ClickitUpFixed' })).toBe(false);
        expect(isPricingTableDropAllowed(freight, freight)).toBe(false);
        expect(isPricingTableDropAllowed(freight, { type: 'custom', index: 0 })).toBe(false);

        const keys = ['grid:ClickitUp:ClickitUp Sektion|1000', 'grid-addon:ClickitUp:frakt_glas', 'grid-custom-addon:ClickitUp:extra:toplock'];
        expect(reorderGridRowsByDrop(keys, keys[2], keys[0], 'before')).toEqual([keys[2], keys[0], keys[1]]);
        expect(reorderGridRowsByDrop(keys, keys[0], keys[1], 'after')).toEqual([keys[1], keys[0], keys[2]]);
    });
});
