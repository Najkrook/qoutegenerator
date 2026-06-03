import { normalizeInventoryItem, normalizeInventoryList, normalizeInventoryText } from '../utils/csvNormalizer';
import { cloneSerializable, isUnknownRecord } from '../utils/runtime';
import type {
    BahamaInventoryItem,
    BahamaInventoryProperties,
    BahamaInventoryStatus,
    BahamaInventoryV2Item,
    ClickitupStockEntry,
    ClickitupStockMap,
    InventoryData,
    RawClickitupStockEntry,
    UnknownRecord
} from '../types/contracts';

export type InventorySheetCell = string | number | boolean | null | undefined;
export type InventorySheetRow = InventorySheetCell[];
export type InventorySheetHeaders = Array<string | null>;

export const BAHAMA_PROPERTY_HEADERS = ['Stativ', 'TEXTIL', 'Fot', 'Belysning', 'Värme', 'Kommentar'] as const;
export const BAHAMA_INVENTORY_STATUSES: BahamaInventoryStatus[] = ['available', 'reserved', 'needs-review', 'used', 'sold'];
export const DEFAULT_BAHAMA_STATUS: BahamaInventoryStatus = 'available';

export const EMPTY_BAHAMA_PROPERTIES: BahamaInventoryProperties = {
    stativ: '',
    textil: '',
    fot: '',
    belysning: '',
    varme: ''
};

export const DEFAULT_CLICKITUP_ENTRY: ClickitupStockEntry = {
    sektion: 0,
    dorr_h: 0,
    dorr_v: 0,
    hane_h: 0,
    hane_v: 0
};

export function createDefaultInventoryData(): InventoryData {
    return {
        bahama: [],
        bahamaV2: [],
        clickitup: {},
        notes: ''
    };
}

function normalizeString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeBahamaStatus(value: unknown): BahamaInventoryStatus {
    const normalized = normalizeString(value).toLowerCase();
    return BAHAMA_INVENTORY_STATUSES.includes(normalized as BahamaInventoryStatus)
        ? (normalized as BahamaInventoryStatus)
        : DEFAULT_BAHAMA_STATUS;
}

function normalizeBahamaProperties(value: unknown): BahamaInventoryProperties {
    const raw = isUnknownRecord(value) ? value : {};
    return {
        stativ: normalizeString(raw.stativ),
        textil: normalizeString(raw.textil),
        fot: normalizeString(raw.fot),
        belysning: normalizeString(raw.belysning),
        varme: normalizeString(raw.varme)
    };
}

export function createEmptyBahamaV2Item(now = new Date().toISOString()): BahamaInventoryV2Item {
    return {
        id: '',
        type: '',
        size: '',
        status: DEFAULT_BAHAMA_STATUS,
        location: '',
        properties: { ...EMPTY_BAHAMA_PROPERTIES },
        comment: '',
        createdAt: now,
        updatedAt: now,
        updatedByUid: '',
        updatedByEmail: ''
    };
}

export function normalizeBahamaV2Item(value: unknown): BahamaInventoryV2Item | null {
    if (!isUnknownRecord(value)) {
        return null;
    }

    const id = normalizeString(value.id);
    if (!id) {
        return null;
    }

    const now = new Date().toISOString();
    return {
        id,
        type: normalizeString(value.type),
        size: normalizeString(value.size),
        status: normalizeBahamaStatus(value.status),
        location: normalizeString(value.location),
        properties: normalizeBahamaProperties(value.properties),
        comment: normalizeString(value.comment),
        createdAt: normalizeString(value.createdAt) || now,
        updatedAt: normalizeString(value.updatedAt) || normalizeString(value.createdAt) || now,
        updatedByUid: normalizeString(value.updatedByUid),
        updatedByEmail: normalizeString(value.updatedByEmail)
    };
}

export function normalizeBahamaV2List(value: unknown): BahamaInventoryV2Item[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const seen = new Set<string>();
    const normalizedItems: BahamaInventoryV2Item[] = [];
    value.forEach((item) => {
        const normalized = normalizeBahamaV2Item(item);
        if (!normalized || seen.has(normalized.id)) {
            return;
        }
        seen.add(normalized.id);
        normalizedItems.push(normalized);
    });

    return normalizedItems;
}

function getInventoryString(item: BahamaInventoryItem, key: keyof BahamaInventoryItem): string {
    const value = item[key];
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeHeaderKey(header: string): string {
    return header
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function matchDescriptionSegment(description: string, pattern: RegExp): string {
    const match = description.match(pattern);
    return match?.[1]?.trim().replace(/[.,;]+$/u, '') || '';
}

function deriveFotFromDescription(description: string): string {
    return matchDescriptionSegment(description, /\bmed\s+fot\s+(.+?)(?=\s+(?:i\s+RAL|med\s+textil|samt|och|utan)\b|[.;,]|$)/iu);
}

function deriveBelysningFromDescription(description: string): string {
    const knownLighting = [
        'Classic Light',
        'Classic-Light',
        'Bahama Light',
        'LED',
        'Belysning'
    ];
    const lowerDescription = description.toLowerCase();
    return knownLighting.find((term) => lowerDescription.includes(term.toLowerCase())) || '';
}

function deriveVarmeFromDescription(description: string): string {
    const match = description.match(/\b(?:värme|varme|heater|infra|infravärme|infravarme)\b[^.;,]*/iu);
    return match?.[0]?.trim().replace(/[.,;]+$/u, '') || '';
}

function normalizeBahamaInventoryKeys(item: BahamaInventoryItem): BahamaInventoryItem {
    const canonicalKeys: Record<string, keyof BahamaInventoryItem> = {
        id: 'ID',
        typ: 'TYP',
        storlek: 'STORLEK',
        stativ: 'Stativ',
        textil: 'TEXTIL',
        fot: 'Fot',
        belysning: 'Belysning',
        varme: 'Värme',
        beskrivning: 'BESKRIVNING',
        kommentar: 'Kommentar'
    };

    Object.entries(item).forEach(([key, value]) => {
        const canonicalKey = canonicalKeys[normalizeHeaderKey(key)];
        if (!canonicalKey || canonicalKey === key) return;
        if (item[canonicalKey] === undefined || item[canonicalKey] === '') {
            item[canonicalKey] = value;
        }
        delete item[key];
    });

    return item;
}

export function normalizeBahamaInventoryItem(item: unknown): BahamaInventoryItem {
    const normalized = normalizeBahamaInventoryKeys(normalizeInventoryItem(item));

    const description = getInventoryString(normalized, 'BESKRIVNING');

    if (!getInventoryString(normalized, 'Fot') && description) {
        const fot = deriveFotFromDescription(description);
        if (fot) {
            normalized.Fot = fot;
        }
    }

    if (!getInventoryString(normalized, 'Belysning') && description) {
        const belysning = deriveBelysningFromDescription(description);
        if (belysning) {
            normalized.Belysning = belysning;
        }
    }

    if (!getInventoryString(normalized, 'Värme') && description) {
        const varme = deriveVarmeFromDescription(description);
        if (varme) {
            normalized.Värme = varme;
        }
    }

    return normalized;
}

export function hasBahamaInventoryHeader(row: InventorySheetRow): boolean {
    const headerKeys = new Set(
        normalizeInventorySheetHeaders(row)
            .filter((header): header is string => Boolean(header))
            .map(normalizeHeaderKey)
    );

    if (headerKeys.has('beskrivning')) {
        return true;
    }

    return ['stativ', 'textil', 'fot', 'belysning', 'varme', 'kommentar'].some((header) => headerKeys.has(header));
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

    const bahama = normalizeInventoryList(value.bahama).map((item) => normalizeBahamaInventoryItem(item));
    const bahamaV2 = normalizeBahamaV2List(value.bahamaV2);
    const clickitup = isUnknownRecord(value.clickitup)
        ? Object.entries(value.clickitup).reduce<ClickitupStockMap>((acc, [size, entry]) => {
            acc[size] = normalizeClickitupEntry(entry);
            return acc;
        }, {})
        : {};

    const notes = typeof value.notes === 'string' ? value.notes : '';
    return { bahama, bahamaV2, clickitup, notes };
}

export function cloneInventoryData(inventory: InventoryData): InventoryData {
    return normalizeStoredInventoryData(cloneSerializable(inventory));
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
        item: normalizeBahamaInventoryItem(rawItem),
        hasData
    };
}
