import { db, doc, collection, writeBatch } from './firebase';
import { stageBahamaQrProjectionWrites } from './bahamaQrService';
import type { InventoryData } from '../types/contracts';
import type { InventoryChange } from './inventoryChanges';

export interface InventorySaveRequest {
    inventory: InventoryData;
    baseline: InventoryData;
    changes: InventoryChange[];
    actor: { uid?: string | null; email?: string | null };
}

export type InventorySaveAdapter = (request: InventorySaveRequest) => Promise<void>;

export const saveInventoryBatch: InventorySaveAdapter = async ({ inventory, baseline, changes, actor }) => {
    const batch = writeBatch(db);
    const createdAt = Date.now();
    const timestamp = new Date(createdAt).toISOString();
    batch.set(doc(db, 'stock', 'main_inventory'), inventory);
    stageBahamaQrProjectionWrites(batch, inventory.bahamaV2, baseline.bahamaV2, timestamp);
    const logs = collection(db, 'inventory_logs');
    for (const change of changes) {
        if (change.log) {
            batch.set(doc(logs), {
                ...change.log, timestamp, createdAt,
                user: actor.email || 'unknown', userUid: actor.uid || ''
            });
        }
    }
    await batch.commit();
};
