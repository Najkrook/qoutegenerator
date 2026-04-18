import type { BahamaInventoryItem, UnknownRecord } from '../types/contracts';

function isRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeInventoryText(text: string): string;
export function normalizeInventoryText<T>(text: T): T;
export function normalizeInventoryText(text: unknown): unknown {
    if (!text || typeof text !== 'string') return text;

    // Excel CSV exports on Swedish Windows often get read incorrectly by XLSX
    // unless codepages are strictly managed. This intercepts the common double-UTF8/ANSI
    // mojibake combinations and standardizes them back to native UTF-8 Swedish characters.
    return text
        .replaceAll('\u00e3\u00a4', 'ä')
        .replaceAll('\u00e3\u00b6', 'ö')
        .replaceAll('\u00e3\u00a5', 'å')
        .replaceAll('\u00c3\u00a4', 'ä')
        .replaceAll('\u00c3\u00b6', 'ö')
        .replaceAll('\u00c3\u00a5', 'å')
        .replaceAll('\u00c3\u201e', 'Ä')
        .replaceAll('\u00c3\u2013', 'Ö')
        .replaceAll('\u00c3\u2026', 'Å')
        .replaceAll('\u00c3\u00a9', 'é')
        .replaceAll('\u00c3\u00a7', 'ç')
        .replaceAll('\u00c3\u00bc', 'ü');
}

export function normalizeInventoryItem(item: unknown): BahamaInventoryItem {
    if (!isRecord(item)) return {};

    const normalized: BahamaInventoryItem = {};
    for (const [key, value] of Object.entries(item)) {
        const cleanKey = normalizeInventoryText(String(key).trim());
        normalized[cleanKey] = typeof value === 'string' ? normalizeInventoryText(value) : value;
    }

    return normalized;
}

export function normalizeInventoryList(jsonArr: unknown): BahamaInventoryItem[] {
    if (!Array.isArray(jsonArr)) return [];
    return jsonArr.map((item) => normalizeInventoryItem(item));
}
