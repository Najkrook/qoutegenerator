import type {
    AccessUser,
    CatalogData,
    RetailerProductLineConfig,
    RetailerRecord,
    RetailerWriteInput
} from '../types/contracts';
import {
    db,
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy
} from './firebase';
import { safeLogActivity } from './activityLogService';

interface RetailerPersistedRecord extends RetailerRecord {
    productLines: Record<string, RetailerProductLineConfig>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toRetailerRecord(value: unknown, id?: string): RetailerRecord {
    const raw = isRecord(value) ? value : {};
    return {
        id,
        ...raw,
        name: String(raw.name ?? ''),
        email: String(raw.email ?? ''),
        notes: String(raw.notes ?? ''),
        productLines: isRecord(raw.productLines)
            ? Object.entries(raw.productLines).reduce<Record<string, RetailerProductLineConfig>>((acc, [lineId, lineValue]) => {
                const safeLine = isRecord(lineValue) ? lineValue : {};
                acc[lineId] = {
                    enabled: Boolean(safeLine.enabled),
                    discountPct: Number.isFinite(Number(safeLine.discountPct)) ? Number(safeLine.discountPct) : 0
                };
                return acc;
            }, {})
            : {}
    };
}

/**
 * Normalize and validate retailer data before Firestore write.
 * Pure function and exported for unit testing.
 */
export function normalizeRetailerData(
    data: Partial<RetailerWriteInput> | Record<string, unknown>,
    catalogData: CatalogData
): RetailerPersistedRecord {
    const name = String(data?.name ?? '').trim();
    if (!name) {
        throw new Error('Retailer name is required.');
    }

    const validLineIds = new Set(Object.keys(catalogData || {}));
    const rawLines = isRecord(data?.productLines) ? data.productLines : {};
    const productLines = {} as Record<string, RetailerProductLineConfig>;

    for (const lineId of validLineIds) {
        const lineEntry = isRecord(rawLines[lineId]) ? rawLines[lineId] : {};
        const enabled = Boolean(lineEntry.enabled);
        let discountPct = Number(lineEntry.discountPct);
        if (!Number.isFinite(discountPct)) discountPct = 0;
        discountPct = Math.max(0, Math.min(100, discountPct));
        if (!enabled) discountPct = 0;

        productLines[lineId] = { enabled, discountPct };
    }

    const email = String(data?.email ?? '').trim().toLowerCase();
    if (!email) {
        throw new Error('Användare (E-post) är obligatoriskt.');
    }

    return {
        name,
        email,
        productLines,
        notes: String(data?.notes ?? '').trim()
    };
}

/**
 * Fetch all retailers, sorted by name.
 */
export async function fetchRetailers(): Promise<RetailerRecord[]> {
    const ref = collection(db, 'retailers');
    const snap = await getDocs(query(ref, orderBy('name', 'asc')));
    return snap.docs.map((docSnap) => toRetailerRecord(docSnap.data(), docSnap.id));
}

/**
 * Create a new retailer document.
 */
export async function createRetailer(
    data: Partial<RetailerWriteInput> | Record<string, unknown>,
    user: AccessUser | null,
    catalogData: CatalogData
): Promise<RetailerRecord> {
    const normalized = normalizeRetailerData(data, catalogData);
    const now = Date.now();

    const docData: RetailerRecord = {
        ...normalized,
        createdAt: now,
        updatedAt: now,
        createdBy: user?.email || '',
        createdByUid: user?.uid || '',
        updatedBy: user?.email || '',
        updatedByUid: user?.uid || ''
    };

    const ref = await addDoc(collection(db, 'retailers'), docData);

    await safeLogActivity({
        user,
        eventType: 'retailer_created',
        system: 'retailer',
        targetType: 'retailer',
        targetId: ref.id,
        details: `Återförsäljare "${normalized.name}" skapad`,
        metadata: { retailerName: normalized.name }
    });

    return { id: ref.id, ...docData };
}

/**
 * Update an existing retailer document.
 */
export async function updateRetailer(
    id: string,
    data: Partial<RetailerWriteInput> | Record<string, unknown>,
    user: AccessUser | null,
    catalogData: CatalogData
): Promise<RetailerRecord> {
    const normalized = normalizeRetailerData(data, catalogData);
    const now = Date.now();

    const updates: RetailerRecord = {
        ...normalized,
        updatedAt: now,
        updatedBy: user?.email || '',
        updatedByUid: user?.uid || ''
    };

    const ref = doc(db, 'retailers', id);
    await updateDoc(ref, updates);

    await safeLogActivity({
        user,
        eventType: 'retailer_updated',
        system: 'retailer',
        targetType: 'retailer',
        targetId: id,
        details: `Återförsäljare "${normalized.name}" uppdaterad`,
        metadata: { retailerName: normalized.name }
    });

    return { id, ...updates };
}

/**
 * Delete a retailer document.
 */
export async function deleteRetailer(
    id: string,
    retailerName: string | undefined,
    user: AccessUser | null
): Promise<void> {
    const ref = doc(db, 'retailers', id);
    await deleteDoc(ref);

    await safeLogActivity({
        user,
        eventType: 'retailer_deleted',
        system: 'retailer',
        targetType: 'retailer',
        targetId: id,
        details: `Återförsäljare "${retailerName || id}" borttagen`,
        metadata: { retailerName: retailerName || '' }
    });
}
