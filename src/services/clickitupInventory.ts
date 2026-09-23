import type { ClickitupFieldKey, ClickitupStockEntry, ClickitupStockMap, InventoryData } from '../types/contracts';

export const CLICKITUP_SIZES = ['700', '1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900', '2000', '980 special'] as const;

export const CLICKITUP_FIELDS = [
    { key: 'sektion', label: 'Sektion' },
    { key: 'dorr_h', label: 'Dörr H' },
    { key: 'dorr_v', label: 'Dörr V' },
    { key: 'hane_h', label: 'Hane H' },
    { key: 'hane_v', label: 'Hane V' }
] as const;

export const CLICKITUP_ACCESSORIES = [
    { id: 'stickfot_std_singel', group: 'Standard', label: 'Singel', openingBalance: 206 },
    { id: 'stickfot_std_dubbel', group: 'Standard', label: 'Dubbel', openingBalance: 178 },
    { id: 'stickfot_std_kapad', group: 'Standard', label: 'Kapad', openingBalance: 26 },
    { id: 'stickfot_std_rostfri', group: 'Standard', label: 'Rostfri', openingBalance: 0 },
    { id: 'stickfot_plus30_singel', group: '+30', label: 'Singel', openingBalance: 196 },
    { id: 'stickfot_plus30_dubbel', group: '+30', label: 'Dubbel', openingBalance: 53 },
    { id: 'stickfot_plus30_kapad', group: '+30', label: 'Kapad', openingBalance: 0 },
    { id: 'stickfot_plus30_rostfri', group: '+30', label: 'Rostfri', openingBalance: 0 },
    { id: 'stickfot_plus60_singel', group: '+60', label: 'Singel', openingBalance: 40 },
    { id: 'stickfot_plus60_dubbel', group: '+60', label: 'Dubbel', openingBalance: 31 },
    { id: 'stickfot_plus60_kapad', group: '+60', label: 'Kapad', openingBalance: 0 },
    { id: 'stickfot_plus60_rostfri', group: '+60', label: 'Rostfri', openingBalance: 0 },
    { id: 'gangjarn_hane_v', group: 'Gångjärn', label: 'Hane vänster', openingBalance: 23 },
    { id: 'gangjarn_hane_h', group: 'Gångjärn', label: 'Hane höger', openingBalance: 23 },
    { id: 'gangjarn_dorr_v', group: 'Gångjärn', label: 'Dörr vänster', openingBalance: 20 },
    { id: 'gangjarn_dorr_h', group: 'Gångjärn', label: 'Dörr höger', openingBalance: 19 },
    { id: 'stolpe', group: 'Stolpe och smådelar', label: 'Stolpe', openingBalance: 26 },
    { id: 'stolpe_hane_h', group: 'Stolpe och smådelar', label: 'Stolpe hane höger', openingBalance: 1 },
    { id: 'stolpe_svart_klister', group: 'Stolpe och smådelar', label: 'Stolpe svart klister', openingBalance: 1 }
] as const;

export type ClickitupAccessoryId = typeof CLICKITUP_ACCESSORIES[number]['id'];
export type ClickitupCountKey = `size:${string}` | `accessory:${ClickitupAccessoryId}`;

const accessoryIds = new Set<string>(CLICKITUP_ACCESSORIES.map((item) => item.id));
const countKeys = new Set<string>([
    ...CLICKITUP_SIZES.map((size) => `size:${size}`),
    ...CLICKITUP_ACCESSORIES.map((item) => `accessory:${item.id}`)
]);

export function normalizeStockQuantity(value: unknown): number {
    const number = typeof value === 'number' || typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

export function normalizeClickitupAccessories(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id]) => accessoryIds.has(id)).map(([id, quantity]) => [id, normalizeStockQuantity(quantity)]));
}

export function normalizeClickitupCounted(value: unknown): Record<string, true> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, counted]) => countKeys.has(key) && counted === true).map(([key]) => [key, true]));
}

export function getOpeningAccessoryBalances(): Record<string, number> {
    return Object.fromEntries(CLICKITUP_ACCESSORIES.map(({ id, openingBalance }) => [id, openingBalance]));
}

export function seedMissingClickitupAccessories(inventory: InventoryData, raw: unknown): InventoryData {
    if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'clickitupAccessories')) return inventory;
    return { ...inventory, clickitupAccessories: getOpeningAccessoryBalances() };
}

export function getClickitupCountKey(type: 'size' | 'accessory', id: string): string {
    return `${type}:${id}`;
}

export function getClickitupCountProgress(counted: Record<string, true>): { done: number; total: number } {
    return { done: Object.keys(counted).filter((key) => countKeys.has(key)).length, total: countKeys.size };
}

export function setClickitupSizeQuantity(inventory: InventoryData, size: string, field: ClickitupFieldKey, value: number): InventoryData {
    const quantity = normalizeStockQuantity(value);
    if ((inventory.clickitup[size]?.[field] || 0) === quantity) return inventory;
    const clickitupCounted = { ...inventory.clickitupCounted };
    delete clickitupCounted[getClickitupCountKey('size', size)];
    return {
        ...inventory,
        clickitup: {
            ...inventory.clickitup,
            [size]: { sektion: 0, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0, ...inventory.clickitup[size], [field]: quantity }
        },
        clickitupCounted
    };
}

export function setClickitupAccessoryQuantity(inventory: InventoryData, id: string, value: number): InventoryData {
    const quantity = normalizeStockQuantity(value);
    if ((inventory.clickitupAccessories[id] || 0) === quantity) return inventory;
    const clickitupCounted = { ...inventory.clickitupCounted };
    delete clickitupCounted[getClickitupCountKey('accessory', id)];
    return {
        ...inventory,
        clickitupAccessories: { ...inventory.clickitupAccessories, [id]: quantity },
        clickitupCounted
    };
}

export function toggleClickitupCounted(inventory: InventoryData, type: 'size' | 'accessory', id: string): InventoryData {
    const key = getClickitupCountKey(type, id);
    if (!countKeys.has(key)) return inventory;
    const clickitupCounted = { ...inventory.clickitupCounted };
    if (clickitupCounted[key]) delete clickitupCounted[key];
    else clickitupCounted[key] = true;
    return { ...inventory, clickitupCounted };
}

export function getAccessoryLabel(id: string): string {
    const item = CLICKITUP_ACCESSORIES.find((candidate) => candidate.id === id);
    return item ? `${item.group === 'Gångjärn' || item.group === 'Stolpe och smådelar' ? '' : `${item.group} `}${item.label}` : id;
}

export function normalizeClickitupStockMap(value: unknown): ClickitupStockMap {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).map(([size, raw]) => {
        const entry = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
        const normalized: ClickitupStockEntry = {
            sektion: normalizeStockQuantity(entry.sektion),
            dorr_h: normalizeStockQuantity(entry.dorr_h),
            dorr_v: normalizeStockQuantity(entry.dorr_v),
            hane_h: normalizeStockQuantity(entry.hane_h),
            hane_v: normalizeStockQuantity(entry.hane_v)
        };
        return [size, normalized];
    }));
}
