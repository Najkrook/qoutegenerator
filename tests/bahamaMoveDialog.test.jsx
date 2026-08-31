// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BahamaMoveDialog } from '../src/components/features/BahamaMoveDialog';
import { groupBahamaInventoryByStorageLocation } from '../src/services/bahamaStorageLocation';

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

afterEach(cleanup);

describe('BaHaMa Flytta-dialog', () => {
    it('selects a cross-rack occupied target and continues to the shared swap flow', async () => {
        const source = inventoryItem('source', 'Grenställ 1 våning 1 främre plats');
        const occupied = inventoryItem('occupied', 'Grenställ 4 våning 2 bakre plats');
        const grouping = groupBahamaInventoryByStorageLocation([source, occupied]);
        const onMove = vi.fn(async () => true);
        const onClose = vi.fn();
        render(
            <BahamaMoveDialog
                grouping={grouping}
                initialRack={1}
                item={source}
                onClose={onClose}
                onMove={onMove}
            />
        );

        fireEvent.change(screen.getByLabelText('Målgrenställ'), { target: { value: '4' } });
        fireEvent.change(screen.getByLabelText('Målvåning'), { target: { value: '2' } });
        fireEvent.change(screen.getByLabelText('Måldjup'), { target: { value: 'back' } });

        expect(screen.getByRole('status').textContent).toContain('BA-occupied');
        fireEvent.click(screen.getByRole('button', { name: 'Fortsätt till platsväxling' }));

        await vi.waitFor(() => expect(onMove).toHaveBeenCalledWith({ rack: 4, floor: 2, depth: 'back' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('moves to Ej placerade without requiring rack controls', async () => {
        const source = inventoryItem('source', 'Grenställ 1 våning 1 främre plats');
        const onMove = vi.fn(async () => true);
        render(
            <BahamaMoveDialog
                grouping={groupBahamaInventoryByStorageLocation([source])}
                initialRack={1}
                item={source}
                onClose={() => {}}
                onMove={onMove}
            />
        );

        fireEvent.click(screen.getByRole('radio', { name: /Ej placerade/ }));
        expect(screen.queryByLabelText('Målgrenställ')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Flytta' }));

        await vi.waitFor(() => expect(onMove).toHaveBeenCalledWith(null));
    });

    it('blocks a conflict target in both status copy and submit state', () => {
        const source = inventoryItem('source', '');
        const first = inventoryItem('first', 'Grenställ 3 våning 5 främre plats');
        const second = inventoryItem('second', 'Grenställ 3 våning 5 främre plats');
        render(
            <BahamaMoveDialog
                grouping={groupBahamaInventoryByStorageLocation([source, first, second])}
                initialRack={3}
                item={source}
                onClose={() => {}}
                onMove={vi.fn(async () => true)}
            />
        );

        expect(screen.getByRole('alert').textContent).toContain('konflikt');
        expect(screen.getByRole('button', { name: 'Flytta' }).disabled).toBe(true);
    });
});
