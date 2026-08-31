import type { BahamaInventoryV2Item } from '../types/contracts';
import {
    formatBahamaStorageLocation,
    normalizeBahamaStorageLocation,
    type BahamaStorageLocation
} from './bahamaStorageLocation';

export interface BahamaInventoryMoveAudit {
    updatedAt: string;
    updatedByUid: string;
    updatedByEmail: string;
}

export interface BahamaInventoryMoveChange {
    before: BahamaInventoryV2Item;
    after: BahamaInventoryV2Item;
}

interface BahamaInventoryMoveBasePlan {
    items: BahamaInventoryV2Item[];
    sourceItem: BahamaInventoryV2Item | null;
}

export interface BahamaInventoryMoveBlockedPlan extends BahamaInventoryMoveBasePlan {
    status: 'blocked';
    reason: 'source-not-found' | 'target-conflict';
}

export interface BahamaInventoryMoveNoopPlan extends BahamaInventoryMoveBasePlan {
    status: 'noop';
}

export interface BahamaInventoryMoveReadyPlan extends BahamaInventoryMoveBasePlan {
    status: 'ready';
    kind: 'move' | 'swap';
    requiresConfirmation: boolean;
    displacedItem: BahamaInventoryV2Item | null;
    changes: BahamaInventoryMoveChange[];
    targetLocation: string;
}

export type BahamaInventoryMovePlan =
    | BahamaInventoryMoveBlockedPlan
    | BahamaInventoryMoveNoopPlan
    | BahamaInventoryMoveReadyPlan;

function sameQrId(left: string, right: string): boolean {
    return left.trim().toLocaleLowerCase('sv-SE') === right.trim().toLocaleLowerCase('sv-SE');
}

function withMoveAudit(
    item: BahamaInventoryV2Item,
    location: string,
    audit: BahamaInventoryMoveAudit
): BahamaInventoryV2Item {
    return {
        ...item,
        location,
        ...audit
    };
}

function replaceChangedItems(
    items: BahamaInventoryV2Item[],
    changes: BahamaInventoryMoveChange[]
): BahamaInventoryV2Item[] {
    const afterByQrId = new Map(changes.map((change) => [change.after.qrId, change.after]));
    return items.map((item) => afterByQrId.get(item.qrId) || item);
}

export function planBahamaInventoryMove(
    items: BahamaInventoryV2Item[],
    sourceQrId: string,
    target: BahamaStorageLocation | null,
    audit: BahamaInventoryMoveAudit
): BahamaInventoryMovePlan {
    const sourceItem = items.find((item) => sameQrId(item.qrId, sourceQrId)) || null;
    if (!sourceItem) {
        return { status: 'blocked', reason: 'source-not-found', items, sourceItem: null };
    }

    const sourceCanonicalLocation = normalizeBahamaStorageLocation(sourceItem.location);
    const targetLocation = target ? formatBahamaStorageLocation(target) : '';
    if (sourceCanonicalLocation === targetLocation || (!sourceCanonicalLocation && !sourceItem.location.trim() && !target)) {
        return { status: 'noop', items, sourceItem };
    }

    const targetOccupants = target
        ? items.filter((item) => (
            !sameQrId(item.qrId, sourceItem.qrId)
            && normalizeBahamaStorageLocation(item.location) === targetLocation
        ))
        : [];

    if (targetOccupants.length > 1) {
        return { status: 'blocked', reason: 'target-conflict', items, sourceItem };
    }

    const sourceLocationOccupants = sourceCanonicalLocation
        ? items.filter((item) => normalizeBahamaStorageLocation(item.location) === sourceCanonicalLocation)
        : [];
    const displacedTargetLocation = sourceLocationOccupants.length === 1
        ? sourceCanonicalLocation || ''
        : '';
    const displacedItem = targetOccupants[0] || null;
    const changes: BahamaInventoryMoveChange[] = [{
        before: sourceItem,
        after: withMoveAudit(sourceItem, targetLocation, audit)
    }];

    if (displacedItem) {
        changes.push({
            before: displacedItem,
            after: withMoveAudit(displacedItem, displacedTargetLocation, audit)
        });
    }

    return {
        status: 'ready',
        kind: displacedItem ? 'swap' : 'move',
        requiresConfirmation: Boolean(displacedItem),
        displacedItem,
        changes,
        items: replaceChangedItems(items, changes),
        sourceItem,
        targetLocation
    };
}

export function undoBahamaInventoryMove(
    items: BahamaInventoryV2Item[],
    changes: BahamaInventoryMoveChange[]
): BahamaInventoryV2Item[] {
    const beforeByQrId = new Map(changes.map((change) => [change.before.qrId, change.before]));
    return items.map((item) => beforeByQrId.get(item.qrId) || item);
}
