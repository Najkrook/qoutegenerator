import { describe, expect, it } from 'vitest';
import {
    buildImportedInventoryItem,
    cloneInventoryData,
    createDefaultInventoryData,
    DEFAULT_CLICKITUP_ENTRY,
    hasBahamaInventoryHeader,
    normalizeClickitupEntry,
    normalizeInventorySheetHeaders,
    normalizeStoredInventoryData
} from '../src/views/inventoryData';

describe('inventoryData helpers', () => {
    it('normalizes stored inventory payloads without trusting Firestore shapes', () => {
        const normalized = normalizeStoredInventoryData({
            bahama: [{ BESKRIVNING: 'Jumbrella med fot TIPP samt Classic Light.' }],
            clickitup: {
                '3m': { sektion: '2', dorr_h: '1', hane_v: '4' },
                bad: null
            },
            notes: 'Intern anteckning'
        });

        expect(normalized).toEqual({
            bahama: [{
                BESKRIVNING: 'Jumbrella med fot TIPP samt Classic Light.',
                Fot: 'TIPP',
                Belysning: 'Classic Light'
            }],
            bahamaV2: [],
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

    it('clones inventory data without sharing nested references', () => {
        const original = normalizeStoredInventoryData({
            bahama: [{ BESKRIVNING: 'Parasollfot' }],
            bahamaV2: [{
                id: 'BA-001',
                type: 'Parasoll',
                size: '4x4',
                status: 'available',
                location: 'Grenställ 3',
                properties: {
                    stativ: 'RAL 7016',
                    textil: 'MUSHROOM',
                    fot: 'TIPP',
                    belysning: '',
                    varme: ''
                },
                comment: 'Kontrollera textil',
                createdAt: '2026-06-01T10:00:00.000Z',
                updatedAt: '2026-06-01T10:00:00.000Z',
                updatedByUid: 'admin-1',
                updatedByEmail: 'admin@example.com'
            }],
            clickitup: {
                '4m': { sektion: 1, dorr_h: 2, dorr_v: 3, hane_h: 4, hane_v: 5 }
            },
            notes: 'Intern notering'
        });

        const cloned = cloneInventoryData(original);
        cloned.bahama[0].BESKRIVNING = 'Ändrad';
        cloned.bahamaV2[0].properties.stativ = 'Ändrat stativ';
        cloned.clickitup['4m'].sektion = 99;
        cloned.notes = 'Ny notering';

        expect(original).toEqual({
            bahama: [{ BESKRIVNING: 'Parasollfot' }],
            bahamaV2: [{
                id: 'BA-001',
                type: 'Parasoll',
                size: '4x4',
                status: 'available',
                location: 'Grenställ 3',
                properties: {
                    stativ: 'RAL 7016',
                    textil: 'MUSHROOM',
                    fot: 'TIPP',
                    belysning: '',
                    varme: ''
                },
                comment: 'Kontrollera textil',
                createdAt: '2026-06-01T10:00:00.000Z',
                updatedAt: '2026-06-01T10:00:00.000Z',
                updatedByUid: 'admin-1',
                updatedByEmail: 'admin@example.com'
            }],
            clickitup: {
                '4m': { sektion: 1, dorr_h: 2, dorr_v: 3, hane_h: 4, hane_v: 5 }
            },
            notes: 'Intern notering'
        });
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

    it('detects both legacy and property-based BaHaMa headers', () => {
        expect(hasBahamaInventoryHeader(['ID', 'BESKRIVNING'])).toBe(true);
        expect(hasBahamaInventoryHeader(['ID', 'Stativ', 'Textil', 'Fot', 'Belysning', 'Värme', 'Kommentar'])).toBe(true);
        expect(hasBahamaInventoryHeader(['Artikel', 'Antal'])).toBe(false);
    });

    it('imports new property columns without requiring BESKRIVNING', () => {
        const headers = normalizeInventorySheetHeaders(['ID', 'TYP', 'STORLEK', 'Stativ', 'Textil', 'Fot', 'Belysning', 'Värme', 'Kommentar']);
        const { item, hasData } = buildImportedInventoryItem(headers, ['3.5.1', 'JB', '4x4', 'RAL 7016', 'MUSHROOM', 'TIPP', 'Classic Light', 'Infra', 'Reserverad']);

        expect(hasData).toBe(true);
        expect(item).toEqual({
            ID: '3.5.1',
            TYP: 'JB',
            STORLEK: '4x4',
            Stativ: 'RAL 7016',
            TEXTIL: 'MUSHROOM',
            Fot: 'TIPP',
            Belysning: 'Classic Light',
            Värme: 'Infra',
            Kommentar: 'Reserverad'
        });
    });

    it('derives safe legacy properties from BESKRIVNING without inventing uncertain values', () => {
        const headers = normalizeInventorySheetHeaders(['ID', 'BESKRIVNING']);
        const { item } = buildImportedInventoryItem(headers, ['3.5.1', 'Jumbrella 4x4m med fot TIPP i RAL 7016 med textilfärg MUSHROOM samt Classic Light.']);

        expect(item).toMatchObject({
            ID: '3.5.1',
            BESKRIVNING: 'Jumbrella 4x4m med fot TIPP i RAL 7016 med textilfärg MUSHROOM samt Classic Light.',
            Fot: 'TIPP',
            Belysning: 'Classic Light'
        });
        expect(item.Stativ).toBeUndefined();
        expect(item.Värme).toBeUndefined();
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

    it('starts BaHaMa V2 empty when only legacy BaHaMa rows exist', () => {
        const normalized = normalizeStoredInventoryData({
            bahama: [{ ID: 'legacy-1', BESKRIVNING: 'Gammal rad' }],
            clickitup: {}
        });

        expect(normalized.bahama).toHaveLength(1);
        expect(normalized.bahamaV2).toEqual([]);
    });

    it('normalizes BaHaMa V2 rows and drops duplicate or blank IDs', () => {
        const normalized = normalizeStoredInventoryData({
            bahamaV2: [
                {
                    id: ' BA-001 ',
                    type: ' Parasoll ',
                    size: ' 4x4 ',
                    status: 'reserved',
                    location: ' Grenställ 3 ',
                    properties: {
                        stativ: ' RAL 7016 ',
                        textil: ' MUSHROOM ',
                        fot: ' TIPP ',
                        belysning: ' Classic Light ',
                        varme: ' Infra '
                    },
                    comment: ' Reserverad ',
                    createdAt: '2026-06-01T10:00:00.000Z',
                    updatedAt: '2026-06-02T10:00:00.000Z',
                    updatedByUid: 'admin-1',
                    updatedByEmail: 'admin@example.com'
                },
                { id: 'BA-001', type: 'Dubblett' },
                { id: '   ', type: 'Saknar ID' }
            ]
        });

        expect(normalized.bahamaV2).toEqual([{
            id: 'BA-001',
            type: 'Parasoll',
            size: '4x4',
            status: 'reserved',
            location: 'Grenställ 3',
            properties: {
                stativ: 'RAL 7016',
                textil: 'MUSHROOM',
                fot: 'TIPP',
                belysning: 'Classic Light',
                varme: 'Infra'
            },
            comment: 'Reserverad',
            createdAt: '2026-06-01T10:00:00.000Z',
            updatedAt: '2026-06-02T10:00:00.000Z',
            updatedByUid: 'admin-1',
            updatedByEmail: 'admin@example.com'
        }]);
    });
});
