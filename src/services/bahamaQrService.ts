import type { WriteBatch } from 'firebase/firestore';
import { db, doc, getDoc } from './firebase';
import type {
    BahamaInventoryProperties,
    BahamaInventoryStatus,
    BahamaInventoryV2Item,
    BahamaQrActiveRecord,
    BahamaQrArchivedRecord,
    BahamaQrRecord
} from '../types/contracts';
import { isUnknownRecord } from '../utils/runtime';

export const BAHAMA_QR_COLLECTION = 'bahama_qr_items';
export const BAHAMA_QR_SCHEMA_VERSION = 1 as const;

const QR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_STATUSES: BahamaInventoryStatus[] = ['available', 'reserved', 'needs-review', 'used', 'sold'];

function randomHex(bytes: Uint8Array): string {
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function createBahamaQrId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    if (bytes.every((value) => value === 0)) {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = randomHex(bytes);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizeBahamaQrId(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isBahamaQrId(value: unknown): value is string {
    return QR_ID_PATTERN.test(normalizeBahamaQrId(value));
}

export function ensureBahamaQrIds(items: BahamaInventoryV2Item[]): BahamaInventoryV2Item[] {
    const seen = new Set<string>();
    return items.map((item) => {
        let qrId = normalizeBahamaQrId(item.qrId);
        if (qrId && !isBahamaQrId(qrId)) {
            throw new Error(`Ogiltigt QR-ID på lagerartikel ${item.id}.`);
        }
        if (!qrId) {
            do {
                qrId = createBahamaQrId();
            } while (seen.has(qrId));
        }
        if (seen.has(qrId)) {
            throw new Error(`Dubblett av QR-ID på lagerartikel ${item.id}.`);
        }
        seen.add(qrId);
        return qrId === item.qrId ? item : { ...item, qrId };
    });
}

export function getBahamaQrPath(qrId: string): string {
    return `/p/${encodeURIComponent(normalizeBahamaQrId(qrId))}`;
}

export function getBahamaQrUrl(qrId: string, origin: string): string {
    return new URL(getBahamaQrPath(qrId), origin).toString();
}

export function parseBahamaQrInput(value: string, expectedOrigin?: string): string | null {
    const raw = value.trim();
    if (isBahamaQrId(raw)) {
        return normalizeBahamaQrId(raw);
    }

    try {
        const base = expectedOrigin || (typeof window !== 'undefined' ? window.location.origin : 'https://brixx.invalid');
        const parsed = new URL(raw, base);
        if (expectedOrigin && parsed.origin !== new URL(expectedOrigin).origin) {
            return null;
        }
        const match = parsed.pathname.match(/^\/p\/([^/]+)\/?$/);
        const qrId = match ? decodeURIComponent(match[1]) : '';
        return isBahamaQrId(qrId) ? normalizeBahamaQrId(qrId) : null;
    } catch {
        return null;
    }
}

export function toBahamaQrActiveRecord(item: BahamaInventoryV2Item): BahamaQrActiveRecord {
    if (!isBahamaQrId(item.qrId)) {
        throw new Error(`Lagerartikel ${item.id} saknar ett giltigt QR-ID.`);
    }
    return {
        schemaVersion: BAHAMA_QR_SCHEMA_VERSION,
        qrId: normalizeBahamaQrId(item.qrId),
        inventoryId: item.id,
        active: true,
        type: item.type,
        size: item.size,
        status: item.status,
        location: item.location,
        properties: { ...item.properties },
        comment: item.comment,
        updatedAt: item.updatedAt
    };
}

export function toBahamaQrArchivedRecord(
    item: BahamaInventoryV2Item,
    archivedAt: string
): BahamaQrArchivedRecord {
    if (!isBahamaQrId(item.qrId)) {
        throw new Error(`Lagerartikel ${item.id} saknar ett giltigt QR-ID.`);
    }
    return {
        schemaVersion: BAHAMA_QR_SCHEMA_VERSION,
        qrId: normalizeBahamaQrId(item.qrId),
        inventoryId: item.id,
        active: false,
        archivedAt,
        updatedAt: archivedAt
    };
}

export function stageBahamaQrProjectionWrites(
    batch: WriteBatch,
    currentItems: BahamaInventoryV2Item[],
    previousItems: BahamaInventoryV2Item[],
    now: string
): void {
    const previousByQrId = new Map(previousItems.filter((item) => isBahamaQrId(item.qrId)).map((item) => [item.qrId, item]));
    const currentQrIds = new Set(currentItems.map((item) => item.qrId));

    currentItems.forEach((item) => {
        const previous = previousByQrId.get(item.qrId);
        const nextRecord = toBahamaQrActiveRecord(item);
        if (!previous || JSON.stringify(nextRecord) !== JSON.stringify(toBahamaQrActiveRecord(previous))) {
            batch.set(doc(db, BAHAMA_QR_COLLECTION, item.qrId), nextRecord);
        }
    });

    previousItems.forEach((item) => {
        if (isBahamaQrId(item.qrId) && !currentQrIds.has(item.qrId)) {
            batch.set(doc(db, BAHAMA_QR_COLLECTION, item.qrId), toBahamaQrArchivedRecord(item, now));
        }
    });
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function propertiesValue(value: unknown): BahamaInventoryProperties {
    const properties = isUnknownRecord(value) ? value : {};
    return {
        stativ: stringValue(properties.stativ),
        textil: stringValue(properties.textil),
        fot: stringValue(properties.fot),
        belysning: stringValue(properties.belysning),
        varme: stringValue(properties.varme)
    };
}

export function normalizeBahamaQrRecord(value: unknown, expectedQrId: string): BahamaQrRecord | null {
    if (!isUnknownRecord(value) || value.schemaVersion !== 1 || value.qrId !== expectedQrId || typeof value.active !== 'boolean') {
        return null;
    }
    const inventoryId = stringValue(value.inventoryId);
    const updatedAt = stringValue(value.updatedAt);
    if (!inventoryId || !updatedAt) return null;
    if (value.active === false) {
        const archivedAt = stringValue(value.archivedAt);
        return archivedAt ? {
            schemaVersion: 1,
            qrId: expectedQrId,
            inventoryId,
            active: false,
            archivedAt,
            updatedAt
        } : null;
    }
    const status = stringValue(value.status) as BahamaInventoryStatus;
    if (!VALID_STATUSES.includes(status)) return null;
    return {
        schemaVersion: 1,
        qrId: expectedQrId,
        inventoryId,
        active: true,
        type: stringValue(value.type),
        size: stringValue(value.size),
        status,
        location: stringValue(value.location),
        properties: propertiesValue(value.properties),
        comment: stringValue(value.comment),
        updatedAt
    };
}

export async function getBahamaQrRecord(qrIdInput: string): Promise<BahamaQrRecord | null> {
    const qrId = normalizeBahamaQrId(qrIdInput);
    if (!isBahamaQrId(qrId)) return null;
    const snapshot = await getDoc(doc(db, BAHAMA_QR_COLLECTION, qrId));
    return snapshot.exists() ? normalizeBahamaQrRecord(snapshot.data(), qrId) : null;
}
