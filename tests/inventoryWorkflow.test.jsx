// @vitest-environment jsdom
import { useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInventoryWorkflow } from '../src/services/useInventoryWorkflow';
import { getInventoryChanges } from '../src/services/inventoryChanges';
import { planBahamaInventoryMove, undoBahamaInventoryMove } from '../src/services/bahamaInventoryMove';

vi.mock('../src/services/firebase', () => ({ db: {}, doc: vi.fn(), collection: vi.fn(), writeBatch: vi.fn() }));
afterEach(cleanup);

const actor = { uid: 'admin', email: 'admin@example.com' };
const item = {
    qrId: '11111111-1111-4111-8111-111111111111', id: 'BA-001', type: 'Parasoll', size: '4x4',
    status: 'available', location: '', properties: { stativ: '', textil: '', fot: '', belysning: '', varme: '' },
    comment: '', createdAt: '', updatedAt: '', updatedByUid: '', updatedByEmail: ''
};
const initial = () => ({ bahama: [], bahamaV2: [structuredClone(item)], clickitup: {}, notes: '' });

function setup(persist) {
    return renderHook(() => {
        const [inventory, updateDraft] = useState(initial);
        const [baseline, updateBaseline] = useState(initial);
        const workflow = useInventoryWorkflow({ inventory, baseline, updateDraft, updateBaseline, persist });
        return { ...workflow, inventory, baseline, updateDraft };
    });
}

function move(result, rack) {
    act(() => {
        const plan = planBahamaInventoryMove(result.current.inventory.bahamaV2, item.qrId,
            { rack, floor: 1, depth: 'front' }, { updatedAt: `2026-09-20T12:0${rack}:00Z`, updatedByUid: actor.uid, updatedByEmail: actor.email });
        result.current.updateDraft({ ...result.current.inventory, bahamaV2: plan.items });
        result.current.setMoveHistory((history) => [...history, { changes: plan.changes, label: 'move', sourceQrId: item.qrId }]);
    });
}

function undo(result) {
    act(() => {
        result.current.updateDraft({ ...result.current.inventory,
            bahamaV2: undoBahamaInventoryMove(result.current.inventory.bahamaV2, result.current.moveHistory.at(-1).changes) });
        result.current.setMoveHistory((history) => history.slice(0, -1));
    });
}

describe('inventory workflow', () => {
    it('uses the same changes for preview and persistence, and keeps notes out of the existing log schema', async () => {
        const persist = vi.fn(async () => {});
        const { result } = setup(persist);
        act(() => result.current.updateDraft({ ...result.current.inventory, notes: 'note',
            bahamaV2: [{ ...item, comment: 'changed' }], clickitup: { '100': { sektion: 2 } } }));
        const preview = result.current.changes;
        await act(async () => { await result.current.save(actor); });
        expect(persist.mock.calls[0][0].changes).toEqual(preview);
        expect(preview).toHaveLength(3);
        expect(preview.filter((change) => change.log).map((change) => change.log.action)).toEqual(['Ändrades', 'Justering']);
        expect(result.current.changes).toEqual([]);
    });

    it('keeps draft and undo history after failure and allows retry', async () => {
        const persist = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
        const { result } = setup(persist);
        move(result, 1);
        const draft = result.current.inventory;
        await act(async () => { await expect(result.current.save(actor)).rejects.toThrow('offline'); });
        expect(result.current.inventory).toEqual(draft);
        expect(result.current.baseline).toEqual(initial());
        expect(result.current.moveHistory).toHaveLength(1);
        expect(result.current.isSaving).toBe(false);
        await act(async () => { await result.current.save(actor); });
        expect(persist.mock.calls[1][0]).toEqual(persist.mock.calls[0][0]);
        expect(result.current.moveHistory).toEqual([]);
        expect(result.current.changes).toEqual([]);
    });

    it('preserves edits and new move history during a delayed save and prevents duplicate submissions', async () => {
        let finish;
        const persist = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
        const { result } = setup(persist);
        move(result, 1);
        let pending;
        act(() => { pending = result.current.save(actor); });
        await act(async () => { expect(await result.current.save(actor)).toBe(false); });
        move(result, 2);
        act(() => result.current.updateDraft({ ...result.current.inventory, notes: 'during save' }));
        await act(async () => { finish(); await pending; });
        expect(persist).toHaveBeenCalledTimes(1);
        expect(result.current.baseline.bahamaV2[0].location).toContain('Grenställ 1');
        expect(result.current.inventory.bahamaV2[0].location).toContain('Grenställ 2');
        expect(result.current.inventory.notes).toBe('during save');
        expect(result.current.moveHistory).toHaveLength(1);
        undo(result);
        expect(result.current.inventory.bahamaV2).toEqual(result.current.baseline.bahamaV2);
        expect(result.current.changes.map((change) => change.key)).toEqual(['inventory-notes']);
    });

    it('treats undo during saving as a new pending change against the saved snapshot', async () => {
        let finish;
        const { result } = setup(() => new Promise((resolve) => { finish = resolve; }));
        move(result, 1);
        let pending;
        act(() => { pending = result.current.save(actor); });
        undo(result);
        await act(async () => { finish(); await pending; });
        expect(result.current.inventory).toEqual(initial());
        expect(result.current.baseline.bahamaV2[0].location).toContain('Grenställ 1');
        expect(result.current.changes).toHaveLength(1);
    });

    it('describes additions, deletions, renamed IDs and removed ClickitUp sizes consistently', () => {
        const before = { ...initial(), clickitup: { '100': { sektion: 3 } } };
        const after = { ...initial(), bahamaV2: [{ ...item, id: 'BA-002' }] };
        const changes = getInventoryChanges(after, before);
        expect(changes.map((change) => change.log.action)).toEqual(['Lades Till', 'Togs Bort', 'Justering']);
        expect(changes.at(-1).log.delta).toBe(-3);
    });
});
