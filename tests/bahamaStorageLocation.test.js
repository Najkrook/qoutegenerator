import { describe, expect, it } from 'vitest';
import {
    formatBahamaStorageLocation,
    groupBahamaInventoryByStorageLocation,
    normalizeBahamaStorageLocation,
    parseBahamaStorageLocation,
    serializeBahamaStorageLocation
} from '../src/services/bahamaStorageLocation';

function inventoryItem(qrId, location) {
    return {
        qrId,
        id: `BA-${qrId}`,
        type: 'Jumbrella',
        size: '4x4',
        status: 'available',
        location,
        properties: { stativ: '7016', textil: '', fot: '', belysning: '', varme: '' },
        comment: '',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        updatedByUid: 'admin-1',
        updatedByEmail: 'admin@example.com'
    };
}

describe('BaHaMa Lagerplats', () => {
    it('tolkar en kanonisk Lagerplats till Grenställ, Våning och Djupplats', () => {
        expect(parseBahamaStorageLocation('Grenställ 3 våning 4 främre plats')).toEqual({
            rack: 3,
            floor: 4,
            depth: 'front'
        });
        expect(parseBahamaStorageLocation('Grenställ 1 våning 5 bakre plats')).toEqual({
            rack: 1,
            floor: 5,
            depth: 'back'
        });
    });

    it('tolererar skiftläge och blanksteg men avvisar tomma, äldre, okända och utanförliggande platser', () => {
        const tolerated = '  gRENSTÄLL   2  VÅNING  1   BAKRE   PLATS  ';

        expect(parseBahamaStorageLocation(tolerated)).toEqual({ rack: 2, floor: 1, depth: 'back' });
        expect(tolerated).toBe('  gRENSTÄLL   2  VÅNING  1   BAKRE   PLATS  ');

        [
            '',
            '   ',
            'Grenställ 3',
            'Grenställ 3 våning 5',
            'Grenställ 5 våning 1 främre plats',
            'Grenställ 1 våning 6 bakre plats',
            'A-12',
            'Okänd lagerplats'
        ].forEach((value) => expect(parseBahamaStorageLocation(value)).toBeNull());
    });

    it('normaliserar enbart till en härledd kanonisk vy och serialiserar Ej placerad som tom location', () => {
        expect(normalizeBahamaStorageLocation('  GRENSTÄLL 4 VÅNING 5 FRÄMRE PLATS '))
            .toBe('Grenställ 4 våning 5 främre plats');
        expect(normalizeBahamaStorageLocation('Grenställ 6 våning 7')).toBeNull();
        expect(formatBahamaStorageLocation({ rack: 1, floor: 2, depth: 'front' }))
            .toBe('Grenställ 1 våning 2 främre plats');
        expect(serializeBahamaStorageLocation({ rack: 2, floor: 3, depth: 'back' }))
            .toBe('Grenställ 2 våning 3 bakre plats');
        expect(serializeBahamaStorageLocation(null)).toBe('');
    });

    it('bygger 40 platser och bevarar varje artikel i fulla, lediga och Ej placerade grupper', () => {
        const placed = Array.from({ length: 5 }, (_, floorIndex) => floorIndex + 1)
            .flatMap((floor) => ['front', 'back'].map((depth) => inventoryItem(
                `qr-${floor}-${depth}`,
                `Grenställ 1 våning ${floor} ${depth === 'front' ? 'främre' : 'bakre'} plats`
            )));
        const unplaced = [
            inventoryItem('qr-empty', ''),
            inventoryItem('qr-legacy', 'Grenställ 3 våning 5'),
            inventoryItem('qr-outside', 'Grenställ 6 våning 7 bakre plats'),
            inventoryItem('qr-unknown', 'Utomhuslager')
        ];
        const items = [...placed, ...unplaced];

        const grouping = groupBahamaInventoryByStorageLocation(items);
        const rackOne = grouping.racks[0];
        const rackTwo = grouping.racks[1];
        const groupedQrIds = [
            ...grouping.racks.flatMap((rack) => rack.slots.flatMap((slot) => slot.item ? [slot.item.qrId] : [])),
            ...grouping.unplacedItems.map((item) => item.qrId)
        ];

        expect(grouping.racks).toHaveLength(4);
        expect(grouping.racks.flatMap((rack) => rack.slots)).toHaveLength(40);
        expect(rackOne).toMatchObject({ rack: 1, occupiedCount: 10, emptyCount: 0, conflictCount: 0 });
        expect(rackTwo).toMatchObject({ rack: 2, occupiedCount: 0, emptyCount: 10, conflictCount: 0 });
        expect(grouping.unplacedItems).toEqual(unplaced);
        expect(groupedQrIds.sort()).toEqual(items.map((item) => item.qrId).sort());
    });

    it('markerar dubbla Lagerplatser som konflikt utan vinnare eller beläggning', () => {
        const first = inventoryItem('qr-first', 'Grenställ 2 våning 4 främre plats');
        const second = inventoryItem('qr-second', '  grenställ 2 VÅNING 4 FRÄMRE plats ');

        const grouping = groupBahamaInventoryByStorageLocation([first, second]);
        const rack = grouping.racks[1];
        const conflictedSlot = rack.slots.find((slot) => (
            slot.canonicalLocation === 'Grenställ 2 våning 4 främre plats'
        ));

        expect(conflictedSlot).toMatchObject({
            status: 'conflict',
            item: null,
            conflictingQrIds: ['qr-first', 'qr-second']
        });
        expect(rack).toMatchObject({ occupiedCount: 0, emptyCount: 9, conflictCount: 1 });
        expect(grouping.unplacedItems).toEqual([first, second]);
    });

    it('avvisar saknade och dubbla qrId innan artiklar grupperas', () => {
        expect(() => groupBahamaInventoryByStorageLocation([
            inventoryItem('', 'Grenställ 1 våning 1 främre plats')
        ])).toThrow(/QR-ID/);

        expect(() => groupBahamaInventoryByStorageLocation([
            inventoryItem('qr-shared', 'Grenställ 1 våning 1 främre plats'),
            inventoryItem('qr-shared', 'Grenställ 2 våning 1 främre plats')
        ])).toThrow(/Dubblett/);
    });

    it('ordnar varje Grenställ uppifrån så att Våning 1 ligger längst ned', () => {
        const rack = groupBahamaInventoryByStorageLocation([]).racks[0];

        expect(rack.slots.map((slot) => slot.location.floor)).toEqual([
            5, 5, 4, 4, 3, 3, 2, 2, 1, 1
        ]);
        expect(rack.slots.map((slot) => slot.location.depth)).toEqual([
            'front', 'back', 'front', 'back', 'front', 'back', 'front', 'back', 'front', 'back'
        ]);
    });

    it('förhindrar att serialisering skapar Lagerplatser utanför den fysiska modellen', () => {
        expect(() => formatBahamaStorageLocation({ rack: 5, floor: 1, depth: 'front' }))
            .toThrow(/Ogiltig Lagerplats/);
        expect(() => formatBahamaStorageLocation({ rack: 1, floor: 6, depth: 'back' }))
            .toThrow(/Ogiltig Lagerplats/);
        expect(() => formatBahamaStorageLocation({ rack: 1, floor: 1, depth: 'middle' }))
            .toThrow(/Ogiltig Lagerplats/);
    });
});
