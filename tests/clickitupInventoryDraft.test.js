import { describe, expect, it } from 'vitest';
import {
    createClickitupDraftSnapshot,
    readClickitupInventoryDraft,
    restoreClickitupInventoryDraft,
    writeClickitupInventoryDraft
} from '../src/services/clickitupInventoryDraft';
import { createDefaultInventoryData } from '../src/views/inventoryData';

function createStorage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key)
    };
}

describe('ClickitUp local inventory draft', () => {
    it('stores unsaved rows per user and removes a fully saved draft', () => {
        const storage = createStorage();
        const base = createClickitupDraftSnapshot(createDefaultInventoryData());
        const current = { ...base, clickitupAccessories: { stolpe: 26 } };
        writeClickitupInventoryDraft('a', base, current, storage);
        expect(readClickitupInventoryDraft('a', storage)?.current.clickitupAccessories).toEqual({ stolpe: 26 });
        expect(readClickitupInventoryDraft('b', storage)).toBeNull();
        writeClickitupInventoryDraft('a', current, current, storage);
        expect(readClickitupInventoryDraft('a', storage)).toBeNull();
    });

    it('reapplies only locally changed fields and identifies a same-field cloud conflict', () => {
        const oldCloud = createDefaultInventoryData();
        oldCloud.clickitup['700'] = { sektion: 2, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0 };
        oldCloud.clickitupAccessories = { stolpe: 26 };
        const current = structuredClone(oldCloud);
        current.clickitup['700'].sektion = 4;
        current.clickitupAccessories.stolpe = 30;
        current.clickitupCounted['accessory:stolpe'] = true;
        const cloud = structuredClone(oldCloud);
        cloud.clickitup['700'].dorr_h = 7;
        cloud.clickitupAccessories.stolpe = 28;
        const draft = {
            version: 1,
            baseline: createClickitupDraftSnapshot(oldCloud),
            current: createClickitupDraftSnapshot(current)
        };
        const recovery = restoreClickitupInventoryDraft(cloud, draft);
        expect(recovery.conflicts).toEqual(['stolpe']);
        expect(recovery.inventory.clickitup['700']).toMatchObject({ sektion: 4, dorr_h: 7 });
        expect(recovery.inventory.clickitupAccessories.stolpe).toBe(30);
        expect(recovery.inventory.clickitupCounted['accessory:stolpe']).toBe(true);
        expect(cloud.clickitup['700'].sektion).toBe(2);
    });
});
