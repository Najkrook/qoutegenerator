import { normalizeInventoryItem, normalizeInventoryList, normalizeInventoryText } from '../utils/csvNormalizer';
import type {
    BahamaInventoryItem,
    ClickitupStockEntry,
    ClickitupStockMap,
    InventoryData,
    RawClickitupStockEntry,
    UnknownRecord
} from '../types/contracts';

export type InventorySheetCell = string | number | boolean | null | undefined;
export type InventorySheetRow = InventorySheetCell[];
export type InventorySheetHeaders = Array<string | null>;

export const DEFAULT_CLICKITUP_ENTRY: ClickitupStockEntry = {
    sektion: 0,
    dorr_h: 0,
    dorr_v: 0,
    hane_h: 0,
    hane_v: 0
};

function isUnknownRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function createDefaultInventoryData(): InventoryData {
    return {
        bahama: [],
        clickitup: {},
        notes: ''
    };
}

export function normalizeClickitupEntry(value: unknown): ClickitupStockEntry {
    const raw: RawClickitupStockEntry = isUnknownRecord(value) ? value : {};
    return {
        sektion: Number(raw.sektion) || 0,
        dorr_h: Number(raw.dorr_h) || 0,
        dorr_v: Number(raw.dorr_v) || 0,
        hane_h: Number(raw.hane_h) || 0,
        hane_v: Number(raw.hane_v) || 0
    };
}

export function normalizeStoredInventoryData(value: unknown): InventoryData {
    if (!isUnknownRecord(value)) {
        return createDefaultInventoryData();
    }

    const bahama = normalizeInventoryList(value.bahama);
    const clickitup = isUnknownRecord(value.clickitup)
        ? Object.entries(value.clickitup).reduce<ClickitupStockMap>((acc, [size, entry]) => {
            acc[size] = normalizeClickitupEntry(entry);
            return acc;
        }, {})
        : {};

    const notes = typeof value.notes === 'string' ? value.notes : '';
    return { bahama, clickitup, notes };
}

export function normalizeInventorySheetHeaders(row: InventorySheetRow): InventorySheetHeaders {
    return row.map((header) => (
        typeof header === 'string' ? String(normalizeInventoryText(header.trim()) || '') : null
    ));
}

export function buildImportedInventoryItem(
    headers: InventorySheetHeaders,
    row: InventorySheetRow
): { item: BahamaInventoryItem; hasData: boolean } {
    const rawItem: UnknownRecord = {};
    let hasData = false;

    headers.forEach((header, index) => {
        if (!header) return;

        const value = row[index];
        rawItem[header] = value;
        if (value !== undefined && value !== '') {
            hasData = true;
        }
    });

    return {
        item: normalizeInventoryItem(rawItem),
        hasData
    };
}
