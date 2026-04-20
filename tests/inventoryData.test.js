import { describe, expect, it } from 'vitest';
import {
    buildImportedInventoryItem,
    createDefaultInventoryData,
    DEFAULT_CLICKITUP_ENTRY,
    normalizeClickitupEntry,
    normalizeInventorySheetHeaders,
    normalizeStoredInventoryData
} from '../src/views/inventoryData';

describe('inventoryData helpers', () => {
    it('normalizes stored inventory payloads without trusting Firestore shapes', () => {
        const normalized = normalizeStoredInventoryData({
            bahama: [{ BESKRIVNING: 'Testartikel' }],
            clickitup: {
                '3m': { sektion: '2', dorr_h: '1', hane_v: '4' },
                bad: null
            },
            notes: 'Intern anteckning'
        });

        expect(normalized).toEqual({
            bahama: [{ BESKRIVNING: 'Testartikel' }],
            clickitup: {
                '3m': { sektion: 2, dorr_h: 1, dorr_v: 0, hane_h: 0, hane_v: 4 },
                bad: DEFAULT_CLICKITUP_ENTRY
            },
            notes: 'Intern anteckning'
        });
    });

    it('falls back to an empty inventory shape for non-object payloads', () => {
        expect(normalizeStoredInventoryData('broken')).toEqual(createDefaultInventoryData());
    });

    it('builds imported inventory rows from normalized headers and preserves hasData', () => {
        const headers = normalizeInventorySheetHeaders(['BESKRIVNING', 'Antal', '', null]);
        const { item, hasData } = buildImportedInventoryItem(headers, ['Parasollfot', 3, 'ignored', 'ignored']);

        expect(hasData).toBe(true);
        expect(item).toEqual({
            BESKRIVNING: 'Parasollfot',
            Antal: 3
        });
    });

    it('normalizes malformed clickitup entries to zeroed numeric fields', () => {
        expect(normalizeClickitupEntry({ sektion: 'bad', dorr_v: 2 })).toEqual({
            sektion: 0,
            dorr_h: 0,
            dorr_v: 2,
            hane_h: 0,
            hane_v: 0
        });
    });
});
