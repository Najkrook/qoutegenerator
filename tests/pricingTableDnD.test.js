import { describe, expect, it } from 'vitest';
import {
    isPricingTableDropAllowed,
    reorderBuilderAddonsByDrop,
    reorderBuilderItemsByDrop
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
});
