import type { BahamaInventoryV2Item } from '../types/contracts';

export type BahamaRackNumber = 1 | 2 | 3 | 4;
export type BahamaFloorNumber = 1 | 2 | 3 | 4 | 5;
export type BahamaStorageDepth = 'front' | 'back';

export interface BahamaStorageLocation {
    rack: BahamaRackNumber;
    floor: BahamaFloorNumber;
    depth: BahamaStorageDepth;
}

export interface BahamaStorageSlot {
    location: BahamaStorageLocation;
    canonicalLocation: string;
    status: 'empty' | 'occupied' | 'conflict';
    item: BahamaInventoryV2Item | null;
    conflictingQrIds: string[];
}

export interface BahamaStorageRackGroup {
    rack: BahamaRackNumber;
    slots: BahamaStorageSlot[];
    occupiedCount: number;
    emptyCount: number;
    conflictCount: number;
}

export interface BahamaStorageGrouping {
    racks: BahamaStorageRackGroup[];
    unplacedItems: BahamaInventoryV2Item[];
}

const LOCATION_PATTERN = /^grenställ\s+([1-4])\s+våning\s+([1-5])\s+(främre|bakre)\s+plats$/i;

export function parseBahamaStorageLocation(value: unknown): BahamaStorageLocation | null {
    if (typeof value !== 'string') {
        return null;
    }

    const match = value.trim().match(LOCATION_PATTERN);
    if (!match) {
        return null;
    }

    return {
        rack: Number(match[1]) as BahamaRackNumber,
        floor: Number(match[2]) as BahamaFloorNumber,
        depth: match[3].toLocaleLowerCase('sv-SE') === 'främre' ? 'front' : 'back'
    };
}

export function formatBahamaStorageLocation(location: BahamaStorageLocation): string {
    if (
        ![1, 2, 3, 4].includes(location.rack) ||
        ![1, 2, 3, 4, 5].includes(location.floor) ||
        !['front', 'back'].includes(location.depth)
    ) {
        throw new Error('Ogiltig Lagerplats för BaHaMa-lagret.');
    }
    const depth = location.depth === 'front' ? 'främre' : 'bakre';
    return `Grenställ ${location.rack} våning ${location.floor} ${depth} plats`;
}

export function serializeBahamaStorageLocation(location: BahamaStorageLocation | null): string {
    return location ? formatBahamaStorageLocation(location) : '';
}

/** Returns a canonical read model without mutating or replacing the persisted raw value. */
export function normalizeBahamaStorageLocation(value: unknown): string | null {
    const location = parseBahamaStorageLocation(value);
    return location ? formatBahamaStorageLocation(location) : null;
}

export function groupBahamaInventoryByStorageLocation(
    items: BahamaInventoryV2Item[]
): BahamaStorageGrouping {
    const seenQrIds = new Set<string>();
    items.forEach((item) => {
        const qrId = item.qrId.trim().toLowerCase();
        if (!qrId) {
            throw new Error(`Lagerartikel ${item.id} saknar ett stabilt QR-ID.`);
        }
        if (seenQrIds.has(qrId)) {
            throw new Error(`Dubblett av QR-ID på lagerartikel ${item.id}.`);
        }
        seenQrIds.add(qrId);
    });

    const itemsByLocation = new Map<string, BahamaInventoryV2Item[]>();

    items.forEach((item) => {
        const canonicalLocation = normalizeBahamaStorageLocation(item.location);
        if (!canonicalLocation) {
            return;
        }
        itemsByLocation.set(canonicalLocation, [...(itemsByLocation.get(canonicalLocation) || []), item]);
    });

    const unplacedItems = items.filter((item) => {
        const canonicalLocation = normalizeBahamaStorageLocation(item.location);
        return !canonicalLocation || (itemsByLocation.get(canonicalLocation)?.length || 0) > 1;
    });

    const racks = ([1, 2, 3, 4] as BahamaRackNumber[]).map((rack) => {
        const slots = ([5, 4, 3, 2, 1] as BahamaFloorNumber[]).flatMap((floor) => (
            (['front', 'back'] as BahamaStorageDepth[]).map((depth): BahamaStorageSlot => {
                const location: BahamaStorageLocation = { rack, floor, depth };
                const canonicalLocation = formatBahamaStorageLocation(location);
                const locationItems = itemsByLocation.get(canonicalLocation) || [];
                const item = locationItems.length === 1 ? locationItems[0] : null;
                const hasConflict = locationItems.length > 1;
                return {
                    location,
                    canonicalLocation,
                    status: hasConflict ? 'conflict' : item ? 'occupied' : 'empty',
                    item,
                    conflictingQrIds: hasConflict ? locationItems.map((entry) => entry.qrId) : []
                };
            })
        ));
        const occupiedCount = slots.filter((slot) => slot.status === 'occupied').length;
        const emptyCount = slots.filter((slot) => slot.status === 'empty').length;
        const conflictCount = slots.filter((slot) => slot.status === 'conflict').length;
        return {
            rack,
            slots,
            occupiedCount,
            emptyCount,
            conflictCount
        };
    });

    return { racks, unplacedItems };
}
