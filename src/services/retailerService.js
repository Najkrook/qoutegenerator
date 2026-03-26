import {
    db, collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
    query, orderBy
} from './firebase';
import { safeLogActivity } from './activityLogService';

/**
 * Normalize and validate retailer data before Firestore write.
 * Pure function — exported for unit testing.
 * @param {object} data - Raw retailer form data
 * @param {object} catalogData - Full catalog (used to derive valid product line IDs)
 * @returns {object} Normalized data ready for Firestore
 * @throws {Error} If name is empty or data is invalid
 */
export function normalizeRetailerData(data, catalogData) {
    const name = String(data?.name ?? '').trim();
    if (!name) {
        throw new Error('Retailer name is required.');
    }

    const validLineIds = new Set(Object.keys(catalogData || {}));
    const rawLines = data?.productLines || {};
    const productLines = {};

    for (const lineId of validLineIds) {
        const lineEntry = rawLines[lineId] || {};
        const enabled = Boolean(lineEntry.enabled);
        let discountPct = Number(lineEntry.discountPct);
        if (!Number.isFinite(discountPct)) discountPct = 0;
        discountPct = Math.max(0, Math.min(100, discountPct));
        if (!enabled) discountPct = 0;

        productLines[lineId] = { enabled, discountPct };
    }

    let emails = [];
    if (Array.isArray(data?.emails)) {
        emails = data.emails;
    } else if (typeof data?.emails === 'string') {
        emails = data.emails.split(/[\n,;]+/);
    }

    emails = emails
        .map(e => String(e).trim().toLowerCase())
        .filter(e => e.length > 0);

    emails = [...new Set(emails)];

    return {
        name,
        emails,
        productLines,
        notes: String(data?.notes ?? '').trim()
    };
}

/**
 * Fetch all retailers, sorted by name.
 */
export async function fetchRetailers() {
    const ref = collection(db, 'retailers');
    const snap = await getDocs(query(ref, orderBy('name', 'asc')));
    return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
    }));
}

/**
 * Create a new retailer document.
 */
export async function createRetailer(data, user, catalogData) {
    const normalized = normalizeRetailerData(data, catalogData);
    const now = Date.now();

    const docData = {
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
export async function updateRetailer(id, data, user, catalogData) {
    const normalized = normalizeRetailerData(data, catalogData);
    const now = Date.now();

    const updates = {
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
export async function deleteRetailer(id, retailerName, user) {
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
