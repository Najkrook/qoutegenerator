import type { BahamaInventoryV2Item, ClickitupFieldKey, ClickitupStockMap, InventoryData } from '../types/contracts';
import { CLICKITUP_ACCESSORIES, CLICKITUP_SIZES, getAccessoryLabel, getClickitupCountKey } from './clickitupInventory';

export interface InventoryChange {
    key: string;
    title: string;
    desc: string;
    icon: string;
    color: string;
    log?: InventoryChangeLog;
}

export interface InventoryChangeLog {
    action: string;
    system: string;
    category: string;
    targetType: string;
    targetId: string;
    element: string;
    details: string;
    delta: number | null;
}

const CLICKITUP_FIELDS: ClickitupFieldKey[] = ['sektion', 'dorr_h', 'dorr_v', 'hane_h', 'hane_v'];

function formatBahamaDetails(item: BahamaInventoryV2Item): string {
    const properties = [
        item.properties.stativ,
        item.properties.textil,
        item.properties.fot,
        item.properties.belysning,
        item.properties.varme
    ].filter(Boolean).join(' / ');

    return [
        item.type,
        item.size,
        properties
    ].filter(Boolean).join(' - ') || item.id;
}

function bahamaLog(item: BahamaInventoryV2Item, action: string): InventoryChangeLog {
    return { action, system: 'BaHaMa', category: 'bahama', targetType: 'item', targetId: item.id,
        element: item.id, details: formatBahamaDetails(item), delta: null };
}

function buildBahamaMap(items: BahamaInventoryV2Item[]): Record<string, BahamaInventoryV2Item> {
    return items.reduce<Record<string, BahamaInventoryV2Item>>((acc, item) => {
        if (item.id) {
            acc[item.id] = item;
        }
        return acc;
    }, {});
}

function formatBahamaDescription(item: BahamaInventoryV2Item): string {
    return [item.id, item.type, item.size].filter(Boolean).join(' - ');
}

function formatClickitupField(field: ClickitupFieldKey): string {
    return field
        .replace('_h', ' Höger')
        .replace('_v', ' Vänster')
        .replace('dorr', 'Dörr')
        .replace('hane', 'Hane')
        .replace('sektion', 'Sektion');
}

export function getInventoryChanges(inventoryData: InventoryData, cloudInventoryData: InventoryData): InventoryChange[] {
    const changes: InventoryChange[] = [];

    const bahamaLocal = inventoryData.bahamaV2 || [];
    const bahamaCloud = cloudInventoryData.bahamaV2 || [];
    const cloudMap = buildBahamaMap(bahamaCloud);
    const localMap = buildBahamaMap(bahamaLocal);

    bahamaLocal.forEach((item) => {
        if (!cloudMap[item.id]) {
            changes.push({
                key: `add-${item.id}`,
                log: bahamaLog(item, 'Lades Till'),
                title: 'BaHaMa: Lades till',
                desc: formatBahamaDescription(item),
                icon: '+',
                color: 'var(--success)'
            });
        } else if (JSON.stringify(item) !== JSON.stringify(cloudMap[item.id])) {
            changes.push({
                key: `upd-${item.id}`,
                log: bahamaLog(item, 'Ändrades'),
                title: 'BaHaMa: Ändrades',
                desc: formatBahamaDescription(item),
                icon: 'upd',
                color: 'var(--primary)'
            });
        }
    });

    bahamaCloud.forEach((item) => {
        if (item.id && !localMap[item.id]) {
            changes.push({
                key: `del-${item.id}`,
                log: bahamaLog(item, 'Togs Bort'),
                title: 'BaHaMa: Togs bort',
                desc: formatBahamaDescription(item),
                icon: '-',
                color: 'var(--danger)'
            });
        }
    });

    const clickitupLocal: ClickitupStockMap = inventoryData.clickitup || {};
    const clickitupCloud: ClickitupStockMap = cloudInventoryData.clickitup || {};

    Array.from(new Set([...Object.keys(clickitupLocal), ...Object.keys(clickitupCloud)])).forEach((size) => {
        CLICKITUP_FIELDS.forEach((field) => {
            const localValue = clickitupLocal[size]?.[field] || 0;
            const cloudValue = clickitupCloud[size]?.[field] || 0;
            const delta = localValue - cloudValue;
            if (delta !== 0) {
                const sign = delta > 0 ? '+' : '';
                const color = delta > 0 ? 'var(--success)' : 'var(--danger)';
                changes.push({
                    key: `cu-${size}-${field}`,
                    log: { action: 'Justering', system: 'ClickitUp', category: 'clickitup', targetType: 'size', targetId: size, element: size, details: `${formatClickitupField(field)} (${sign}${delta})`, delta },
                    title: `ClickitUp ${size}`,
                    desc: formatClickitupField(field),
                    icon: `${sign}${delta}`,
                    color
                });
            }
        });
    });

    if (Object.keys(inventoryData.clickitupAccessories || {}).length > 0 && Object.keys(cloudInventoryData.clickitupAccessories || {}).length === 0) {
        changes.push({
            key: 'cu-accessories-initialized',
            title: 'ClickitUp tillbehör',
            desc: 'Excel-startsaldo förifyllt',
            icon: 'nytt',
            color: 'var(--primary)'
        });
    }

    CLICKITUP_ACCESSORIES.forEach(({ id }) => {
        const localValue = inventoryData.clickitupAccessories?.[id] || 0;
        const cloudValue = cloudInventoryData.clickitupAccessories?.[id] || 0;
        const delta = localValue - cloudValue;
        if (delta === 0) return;
        const sign = delta > 0 ? '+' : '';
        changes.push({
            key: `cu-accessory-${id}`,
            title: 'ClickitUp tillbehör',
            desc: getAccessoryLabel(id),
            icon: `${sign}${delta}`,
            color: delta > 0 ? 'var(--success)' : 'var(--danger)',
            log: {
                action: 'Justering', system: 'ClickitUp', category: 'clickitup', targetType: 'accessory',
                targetId: id, element: getAccessoryLabel(id), details: `${getAccessoryLabel(id)} (${sign}${delta})`, delta
            }
        });
    });

    const countRows = [
        ...CLICKITUP_SIZES.map((size) => ({ key: getClickitupCountKey('size', size), label: `${size} mm` })),
        ...CLICKITUP_ACCESSORIES.map(({ id }) => ({ key: getClickitupCountKey('accessory', id), label: getAccessoryLabel(id) }))
    ];
    countRows.forEach(({ key, label }) => {
        const localCounted = inventoryData.clickitupCounted?.[key] === true;
        const cloudCounted = cloudInventoryData.clickitupCounted?.[key] === true;
        if (localCounted === cloudCounted) return;
        changes.push({
            key: `cu-counted-${key}`,
            title: 'ClickitUp inventering',
            desc: label,
            icon: localCounted ? '✓' : '↺',
            color: 'var(--primary)'
        });
    });

    if (inventoryData.notes !== cloudInventoryData.notes) {
        changes.push({
            key: 'inventory-notes',
            title: 'Huvudnoteringar',
            desc: 'Noteringar har ändrats',
            icon: 'txt',
            color: 'var(--primary)'
        });
    }

    return changes;
}
