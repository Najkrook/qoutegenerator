// @vitest-environment jsdom

import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    BahamaRackDetail,
    BahamaStorageMap,
    BahamaStorageSidebar
} from '../src/components/features/BahamaStorageMap';
import { getBahamaTubeLabel } from '../src/components/features/bahamaStoragePresentation';
import { groupBahamaInventoryByStorageLocation } from '../src/services/bahamaStorageLocation';

function inventoryItem(qrId, location, overrides = {}) {
    return {
        qrId,
        id: `BA-${qrId}`,
        type: 'Jumbrella',
        size: '4x4',
        status: 'available',
        location,
        properties: { stativ: 'RAL 7016', textil: '', fot: '', belysning: '', varme: '' },
        comment: '',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        updatedByUid: 'admin-1',
        updatedByEmail: 'admin@example.com',
        ...overrides
    };
}

function location(rack, floor, depth) {
    return `Grenställ ${rack} våning ${floor} ${depth === 'front' ? 'främre' : 'bakre'} plats`;
}

function MapSelectionHarness({ grouping, rack = 1 }) {
    const [selectedItem, setSelectedItem] = useState(null);
    return (
        <div>
            <BahamaRackDetail
                rack={grouping.racks[rack - 1]}
                selectedItemQrId={selectedItem?.qrId || null}
                onSelectItem={setSelectedItem}
                onOpenRack={() => {}}
                onBackToMap={() => {}}
            />
            <BahamaStorageSidebar
                grouping={grouping}
                selectedRack={rack}
                selectedItemQrId={selectedItem?.qrId || null}
                onSelectItem={setSelectedItem}
                onOpenRack={() => {}}
                inspector={<output data-testid="article-inspector">{selectedItem?.id || 'Ingen artikel vald'}</output>}
            />
        </div>
    );
}

afterEach(() => {
    cleanup();
});

describe('BaHaMa Lagerkarta', () => {
    it('renders four Grenställ in map order with exact 5×2 occupancy and opens a rack', () => {
        const items = [
            inventoryItem('001', location(1, 1, 'front')),
            inventoryItem('002', location(1, 5, 'back')),
            inventoryItem('003', location(3, 2, 'front')),
            ...Array.from({ length: 7 }, (_, index) => inventoryItem(
                `4${index}`,
                location(4, Math.floor(index / 2) + 1, index % 2 === 0 ? 'front' : 'back')
            ))
        ];
        const grouping = groupBahamaInventoryByStorageLocation(items);
        const onOpenRack = vi.fn();
        const { container } = render(
            <BahamaStorageMap grouping={grouping} selectedRack={1} onOpenRack={onOpenRack} />
        );

        const map = screen.getByRole('region', { name: 'Lagerkarta' });
        const rackButtons = within(map).getAllByRole('button', { name: /Öppna Grenställ/ });
        expect(rackButtons.map((button) => button.getAttribute('aria-label').match(/Grenställ (\d)/)[1]))
            .toEqual(['1', '2', '3', '4']);
        expect(screen.getByRole('button', { name: 'Öppna Grenställ 1, 2/10 platser' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Öppna Grenställ 3, 1/10 platser' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Öppna Grenställ 4, 7/10 platser' })).toBeTruthy();
        expect(container.querySelectorAll('[data-slot-status]')).toHaveLength(40);

        fireEvent.click(screen.getByRole('button', { name: 'Öppna Grenställ 4, 7/10 platser' }));
        expect(onOpenRack).toHaveBeenCalledWith(4);
    });

    it('keeps every Grenställ navigable in the explicit empty state', () => {
        const grouping = groupBahamaInventoryByStorageLocation([]);
        render(<BahamaStorageMap grouping={grouping} selectedRack={1} onOpenRack={() => {}} />);

        expect(screen.getByText('Lagret är tomt. Lägg till en artikel för att börja.')).toBeTruthy();
        [1, 2, 3, 4].forEach((rack) => {
            expect(screen.getByRole('button', { name: `Öppna Grenställ ${rack}, 0/10 platser` })).toBeTruthy();
        });
    });

    it('renders five floors with Våning 1 at the bottom, two depths, status, partial labels and accessible controls', () => {
        const complete = inventoryItem('complete', location(4, 3, 'front'));
        const partial = inventoryItem('partial', location(4, 5, 'back'), {
            size: '',
            status: 'reserved',
            properties: { stativ: 'RAL 9016', textil: '', fot: '', belysning: '', varme: '' }
        });
        const missing = inventoryItem('missing', location(4, 1, 'front'), {
            size: '',
            status: 'needs-review',
            properties: { stativ: '', textil: '', fot: '', belysning: '', varme: '' }
        });
        const grouping = groupBahamaInventoryByStorageLocation([complete, partial, missing]);
        const { container } = render(
            <BahamaRackDetail
                rack={grouping.racks[3]}
                selectedItemQrId={null}
                onSelectItem={() => {}}
                onOpenRack={() => {}}
                onBackToMap={() => {}}
            />
        );

        const floorLabels = Array.from(container.querySelectorAll('[aria-label^="Våning "]'));
        expect(floorLabels.map((node) => node.getAttribute('aria-label'))).toEqual([
            'Våning 5', 'Våning 4', 'Våning 3', 'Våning 2', 'Våning 1'
        ]);
        expect(screen.getByText('Främre')).toBeTruthy();
        expect(screen.getByText('Bakre')).toBeTruthy();
        expect(getBahamaTubeLabel(complete)).toBe('4x4 – 7016');
        expect(getBahamaTubeLabel(partial)).toBe('9016');
        expect(getBahamaTubeLabel(missing)).toBe('Uppgifter saknas');
        expect(screen.getByRole('button', { name: /BA-complete, 4x4 – 7016, Tillgänglig, Våning 3, Främre/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /BA-partial, 9016, Reserverad, Våning 5, Bakre/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /BA-missing, Uppgifter saknas, Kontroll, Våning 1, Främre/ })).toBeTruthy();
        expect(screen.getAllByLabelText(/Tom plats, Våning/)).toHaveLength(7);
    });

    it('shows conflicts and every affected or unknown article under Ej placerade without hiding them', () => {
        const first = inventoryItem('first', location(2, 4, 'front'));
        const second = inventoryItem('second', location(2, 4, 'front'));
        const legacy = inventoryItem('legacy', 'Grenställ 6 våning 7');
        const grouping = groupBahamaInventoryByStorageLocation([first, second, legacy]);
        const onSelectItem = vi.fn();

        render(
            <div>
                <BahamaRackDetail
                    rack={grouping.racks[1]}
                    selectedItemQrId={null}
                    onSelectItem={onSelectItem}
                    onOpenRack={() => {}}
                    onBackToMap={() => {}}
                />
                <BahamaStorageSidebar
                    grouping={grouping}
                    selectedRack={2}
                    selectedItemQrId={null}
                    onSelectItem={onSelectItem}
                    onOpenRack={() => {}}
                />
            </div>
        );

        expect(screen.getByRole('status', { name: /Platskonflikt, Våning 4, Främre, 2 artiklar/ })).toBeTruthy();
        const unplaced = screen.getByRole('region', { name: 'Ej placerade' });
        expect(within(unplaced).getByText('3', { selector: 'span' })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Välj ej placerad artikel BA-first, Platskonflikt/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Välj ej placerad artikel BA-second, Platskonflikt/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Välj ej placerad artikel BA-legacy' })).toBeTruthy();
        expect(screen.getByText('Tidigare: Grenställ 6 våning 7')).toBeTruthy();
    });

    it('uses article selection to drive the inspector seam for placed and unplaced items', () => {
        const placed = inventoryItem('placed', location(1, 2, 'back'));
        const unplaced = inventoryItem('unplaced', 'Äldre fritextplats');
        const grouping = groupBahamaInventoryByStorageLocation([placed, unplaced]);
        render(<MapSelectionHarness grouping={grouping} />);

        fireEvent.click(screen.getByRole('button', { name: /Välj BA-placed/ }));
        expect(screen.getByTestId('article-inspector').textContent).toBe('BA-placed');

        fireEvent.click(screen.getByRole('button', { name: 'Välj ej placerad artikel BA-unplaced' }));
        expect(screen.getByTestId('article-inspector').textContent).toBe('BA-unplaced');
    });

    it('exposes drag targets, the Flytta alternative and restores focus to the moved article', () => {
        const placed = inventoryItem('placed', location(1, 2, 'back'));
        const unplaced = inventoryItem('unplaced', 'Äldre fritextplats');
        const grouping = groupBahamaInventoryByStorageLocation([placed, unplaced]);
        const onDropItem = vi.fn();
        const onOpenMoveDialog = vi.fn();
        const onDragStartItem = vi.fn();
        const dataTransfer = { dropEffect: 'none', effectAllowed: 'none', setData: vi.fn() };
        const { rerender } = render(
            <div>
                <BahamaRackDetail
                    rack={grouping.racks[0]}
                    selectedItemQrId={placed.qrId}
                    onSelectItem={() => {}}
                    onOpenRack={() => {}}
                    onBackToMap={() => {}}
                    draggingItemQrId={placed.qrId}
                    onDragStartItem={onDragStartItem}
                    onDropItem={onDropItem}
                    onOpenMoveDialog={onOpenMoveDialog}
                />
                <BahamaStorageSidebar
                    grouping={grouping}
                    selectedRack={1}
                    selectedItemQrId={placed.qrId}
                    onSelectItem={() => {}}
                    onOpenRack={() => {}}
                    draggingItemQrId={placed.qrId}
                    onDragStartItem={onDragStartItem}
                    onDropItem={onDropItem}
                    onOpenMoveDialog={onOpenMoveDialog}
                />
            </div>
        );

        const placedButton = screen.getByRole('button', { name: /Välj BA-placed/ });
        expect(placedButton.getAttribute('draggable')).toBe('true');
        fireEvent.dragStart(placedButton, { dataTransfer });
        expect(onDragStartItem).toHaveBeenCalledWith(placed, expect.objectContaining({ dataTransfer }));

        const emptyTarget = document.querySelector('[data-storage-drop-target="Grenställ 1 våning 5 främre plats"]');
        fireEvent.dragOver(emptyTarget, { dataTransfer });
        fireEvent.drop(emptyTarget, { dataTransfer });
        expect(dataTransfer.dropEffect).toBe('move');
        expect(onDropItem).toHaveBeenCalledWith(placed.qrId, { rack: 1, floor: 5, depth: 'front' });

        const unplacedTarget = document.querySelector('[data-storage-drop-target="unplaced"]');
        fireEvent.drop(unplacedTarget, { dataTransfer });
        expect(onDropItem).toHaveBeenCalledWith(placed.qrId, null);

        fireEvent.click(screen.getByRole('button', { name: 'Flytta BA-placed' }));
        expect(onOpenMoveDialog).toHaveBeenCalledWith(placed);

        rerender(
            <BahamaRackDetail
                rack={grouping.racks[0]}
                selectedItemQrId={placed.qrId}
                onSelectItem={() => {}}
                onOpenRack={() => {}}
                onBackToMap={() => {}}
                focusRequest={{ qrId: placed.qrId, sequence: 1 }}
            />
        );
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /Välj BA-placed/ }));
    });

    it('opens another Grenställ after a 600 ms drag hover', () => {
        vi.useFakeTimers();
        try {
            const placed = inventoryItem('placed', location(1, 2, 'back'));
            const grouping = groupBahamaInventoryByStorageLocation([placed]);
            const onOpenRack = vi.fn();
            render(
                <BahamaRackDetail
                    rack={grouping.racks[0]}
                    selectedItemQrId={placed.qrId}
                    onSelectItem={() => {}}
                    onOpenRack={onOpenRack}
                    onBackToMap={() => {}}
                    draggingItemQrId={placed.qrId}
                />
            );

            fireEvent.dragEnter(screen.getByRole('button', { name: 'Visa Grenställ 3' }));
            vi.advanceTimersByTime(599);
            expect(onOpenRack).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);
            expect(onOpenRack).toHaveBeenCalledWith(3);
        } finally {
            vi.useRealTimers();
        }
    });
});
