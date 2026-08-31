import { describe, expect, it } from 'vitest';
import {
    planBahamaInventoryMove,
    undoBahamaInventoryMove
} from '../src/services/bahamaInventoryMove';

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

const audit = {
    updatedAt: '2026-08-31T12:00:00.000Z',
    updatedByUid: 'admin-2',
    updatedByEmail: 'other-admin@example.com'
};

describe('BaHaMa lagerflytt', () => {
    it('stages a move to an empty slot without mutating the input', () => {
        const items = [inventoryItem('source', 'Grenställ 1 våning 1 främre plats')];
        const before = structuredClone(items);

        const plan = planBahamaInventoryMove(items, 'source', {
            rack: 3,
            floor: 5,
            depth: 'back'
        }, audit);

        expect(plan).toMatchObject({ status: 'ready', kind: 'move', requiresConfirmation: false });
        expect(plan.items[0]).toMatchObject({
            qrId: 'source',
            location: 'Grenställ 3 våning 5 bakre plats',
            ...audit
        });
        expect(items).toEqual(before);
    });

    it('plans an atomic confirmed swap and can undo both changes exactly', () => {
        const source = inventoryItem('source', 'Grenställ 1 våning 1 främre plats');
        const occupied = inventoryItem('occupied', 'Grenställ 4 våning 2 bakre plats');
        const untouched = inventoryItem('untouched', 'Grenställ 2 våning 3 främre plats');
        const items = [source, occupied, untouched];

        const plan = planBahamaInventoryMove(items, 'source', {
            rack: 4,
            floor: 2,
            depth: 'back'
        }, audit);

        expect(plan).toMatchObject({
            status: 'ready',
            kind: 'swap',
            requiresConfirmation: true,
            displacedItem: occupied
        });
        expect(plan.items.find((item) => item.qrId === 'source').location)
            .toBe('Grenställ 4 våning 2 bakre plats');
        expect(plan.items.find((item) => item.qrId === 'occupied').location)
            .toBe('Grenställ 1 våning 1 främre plats');
        expect(plan.items.find((item) => item.qrId === 'untouched')).toBe(untouched);
        expect(undoBahamaInventoryMove(plan.items, plan.changes)).toEqual(items);
    });

    it('makes the displaced item explicitly unplaced when the source was unplaced or conflicted', () => {
        const unplaced = inventoryItem('unplaced', 'Äldre fritextplats');
        const occupied = inventoryItem('occupied', 'Grenställ 2 våning 4 främre plats');
        const plan = planBahamaInventoryMove([unplaced, occupied], 'unplaced', {
            rack: 2,
            floor: 4,
            depth: 'front'
        }, audit);

        expect(plan.status).toBe('ready');
        expect(plan.items.find((item) => item.qrId === 'unplaced').location)
            .toBe('Grenställ 2 våning 4 främre plats');
        expect(plan.items.find((item) => item.qrId === 'occupied').location).toBe('');
    });

    it('clears a legacy or canonical location when moved to Ej placerade', () => {
        const source = inventoryItem('source', 'Grenställ 1 våning 5 bakre plats');
        const plan = planBahamaInventoryMove([source], 'source', null, audit);

        expect(plan).toMatchObject({ status: 'ready', kind: 'move', requiresConfirmation: false });
        expect(plan.items[0].location).toBe('');
    });

    it('blocks a conflicting target without changing, dropping or overwriting an item', () => {
        const source = inventoryItem('source', 'Grenställ 1 våning 1 främre plats');
        const first = inventoryItem('first', 'Grenställ 3 våning 2 bakre plats');
        const second = inventoryItem('second', '  grenställ 3 VÅNING 2 BAKRE plats ');
        const items = [source, first, second];

        const plan = planBahamaInventoryMove(items, 'source', {
            rack: 3,
            floor: 2,
            depth: 'back'
        }, audit);

        expect(plan).toMatchObject({ status: 'blocked', reason: 'target-conflict', items });
        expect(plan.items).toHaveLength(3);
        expect(plan.items).toEqual(items);
    });

    it('treats the current canonical slot and an already empty location as no-ops', () => {
        const placed = inventoryItem('placed', '  GRENSTÄLL 1 VÅNING 3 FRÄMRE PLATS ');
        const unplaced = inventoryItem('unplaced', '');

        expect(planBahamaInventoryMove([placed], 'placed', {
            rack: 1,
            floor: 3,
            depth: 'front'
        }, audit)).toMatchObject({ status: 'noop' });
        expect(planBahamaInventoryMove([unplaced], 'unplaced', null, audit))
            .toMatchObject({ status: 'noop' });
    });
});
