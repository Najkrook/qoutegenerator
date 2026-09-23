import { describe, expect, it } from 'vitest';
import {
    CLICKITUP_ACCESSORIES,
    CLICKITUP_SIZES,
    getClickitupCountProgress,
    getOpeningAccessoryBalances,
    normalizeClickitupAccessories,
    normalizeClickitupCounted,
    normalizeStockQuantity,
    seedMissingClickitupAccessories,
    setClickitupAccessoryQuantity,
    setClickitupSizeQuantity,
    toggleClickitupCounted
} from '../src/services/clickitupInventory';
import { getInventoryChanges } from '../src/services/inventoryChanges';
import { createDefaultInventoryData, normalizeStoredInventoryData } from '../src/views/inventoryData';
import { hydrateQuoteState } from '../src/store/quoteStateSchema';

describe('ClickitUp inventory', () => {
    it('contains every Excel variant and seeds only a missing accessory field', () => {
        const opening = getOpeningAccessoryBalances();
        expect(CLICKITUP_SIZES).toHaveLength(13);
        expect(CLICKITUP_ACCESSORIES).toHaveLength(19);
        expect(Object.values(opening).reduce((sum, value) => sum + value, 0)).toBe(843);
        expect(opening).toMatchObject({
            stickfot_std_singel: 206,
            stickfot_std_dubbel: 178,
            stickfot_std_kapad: 26,
            stickfot_std_rostfri: 0,
            stickfot_plus30_singel: 196,
            stickfot_plus30_dubbel: 53,
            stickfot_plus60_singel: 40,
            stickfot_plus60_dubbel: 31,
            gangjarn_hane_v: 23,
            gangjarn_hane_h: 23,
            gangjarn_dorr_v: 20,
            gangjarn_dorr_h: 19,
            stolpe: 26,
            stolpe_hane_h: 1,
            stolpe_svart_klister: 1
        });
        const oldCloud = normalizeStoredInventoryData({ clickitup: { '700': { sektion: 2 } } });
        const seeded = seedMissingClickitupAccessories(oldCloud, { clickitup: {} });
        expect(oldCloud.clickitupAccessories).toEqual({});
        expect(seeded.clickitupAccessories).toEqual(opening);
        expect(getInventoryChanges(seeded, oldCloud).filter((change) => change.log?.targetType === 'accessory')).toHaveLength(14);
        expect(seedMissingClickitupAccessories(oldCloud, { clickitupAccessories: {} }).clickitupAccessories).toEqual({});
        const allZero = { ...seeded, clickitupAccessories: Object.fromEntries(Object.keys(opening).map((id) => [id, 0])) };
        expect(getInventoryChanges(allZero, oldCloud).map((change) => change.key)).toContain('cu-accessories-initialized');
    });

    it('normalizes old, partial and malformed quantities and markers', () => {
        expect(normalizeStockQuantity('-2')).toBe(0);
        expect(normalizeStockQuantity(1.5)).toBe(0);
        expect(normalizeStockQuantity(Infinity)).toBe(0);
        expect(normalizeClickitupAccessories({ stickfot_std_singel: '8', unknown: 7, gangjarn_hane_v: -1 })).toEqual({ stickfot_std_singel: 8, gangjarn_hane_v: 0 });
        expect(normalizeClickitupCounted({ 'size:700': true, 'accessory:stolpe': true, 'size:bad': true, 'size:1000': 'yes' })).toEqual({ 'size:700': true, 'accessory:stolpe': true });
        const hydrated = hydrateQuoteState({ inventoryData: { clickitupAccessories: { stolpe: 3 }, clickitupCounted: { 'accessory:stolpe': true } } });
        expect(hydrated.inventoryData.clickitupAccessories).toEqual({ stolpe: 3 });
        expect(hydrated.inventoryData.clickitupCounted).toEqual({ 'accessory:stolpe': true });
        expect(normalizeStoredInventoryData({ clickitup: { '700': { sektion: -3, dorr_h: 2.5 } } }).clickitup['700']).toEqual({ sektion: 0, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0 });
    });

    it('clears a checked row when its quantity changes and tracks marker-only changes', () => {
        const baseline = createDefaultInventoryData();
        const checked = toggleClickitupCounted(toggleClickitupCounted(baseline, 'size', '700'), 'accessory', 'stolpe');
        expect(getClickitupCountProgress(checked.clickitupCounted)).toEqual({ done: 2, total: 32 });
        expect(getInventoryChanges(checked, baseline)).toHaveLength(2);
        expect(getInventoryChanges(checked, baseline).every((change) => !change.log)).toBe(true);
        const changedSize = setClickitupSizeQuantity(checked, '700', 'sektion', 4);
        expect(changedSize.clickitupCounted['size:700']).toBeUndefined();
        const changedAccessory = setClickitupAccessoryQuantity(changedSize, 'stolpe', 5);
        expect(changedAccessory.clickitupCounted['accessory:stolpe']).toBeUndefined();
        expect(changedAccessory.clickitupAccessories.stolpe).toBe(5);
        expect(getInventoryChanges(changedAccessory, baseline).flatMap((change) => change.log ? [change.log.delta] : [])).toEqual([4, 5]);
        expect(toggleClickitupCounted(checked, 'size', '700').clickitupCounted['size:700']).toBeUndefined();
        expect(normalizeStoredInventoryData({ ...checked, clickitupCounted: {} }).clickitup['700']).toBeUndefined();
    });
});
