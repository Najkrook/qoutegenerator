import type { ClickitupStockMap, InventoryData } from '../types/contracts';
import { CLICKITUP_FIELDS, normalizeClickitupAccessories, normalizeClickitupCounted, normalizeClickitupStockMap } from './clickitupInventory';

export interface ClickitupDraftSnapshot {
    clickitup: ClickitupStockMap;
    clickitupAccessories: Record<string, number>;
    clickitupCounted: Record<string, true>;
    notes: string;
}

export interface ClickitupInventoryDraft {
    version: 1;
    baseline: ClickitupDraftSnapshot;
    current: ClickitupDraftSnapshot;
}

function storageKey(uid: string): string {
    return `clickitup-inventory-draft:v1:${uid}`;
}

export function createClickitupDraftSnapshot(inventory: InventoryData): ClickitupDraftSnapshot {
    return {
        clickitup: normalizeClickitupStockMap(inventory.clickitup),
        clickitupAccessories: normalizeClickitupAccessories(inventory.clickitupAccessories),
        clickitupCounted: normalizeClickitupCounted(inventory.clickitupCounted),
        notes: typeof inventory.notes === 'string' ? inventory.notes : ''
    };
}

export function hasClickitupDraftChanges(baseline: ClickitupDraftSnapshot, current: ClickitupDraftSnapshot): boolean {
    return JSON.stringify(baseline) !== JSON.stringify(current);
}

export function readClickitupInventoryDraft(uid: string | null | undefined, storage: Storage | undefined = globalThis.localStorage): ClickitupInventoryDraft | null {
    if (!uid || !storage) return null;
    try {
        const text = storage.getItem(storageKey(uid));
        if (!text) return null;
        const raw = JSON.parse(text);
        if (raw?.version !== 1 || !raw.baseline || !raw.current) return null;
        const baseline = {
            clickitup: normalizeClickitupStockMap(raw.baseline.clickitup),
            clickitupAccessories: normalizeClickitupAccessories(raw.baseline.clickitupAccessories),
            clickitupCounted: normalizeClickitupCounted(raw.baseline.clickitupCounted),
            notes: typeof raw.baseline.notes === 'string' ? raw.baseline.notes : ''
        };
        const current = {
            clickitup: normalizeClickitupStockMap(raw.current.clickitup),
            clickitupAccessories: normalizeClickitupAccessories(raw.current.clickitupAccessories),
            clickitupCounted: normalizeClickitupCounted(raw.current.clickitupCounted),
            notes: typeof raw.current.notes === 'string' ? raw.current.notes : ''
        };
        return hasClickitupDraftChanges(baseline, current) ? { version: 1, baseline, current } : null;
    } catch {
        return null;
    }
}

export function writeClickitupInventoryDraft(
    uid: string | null | undefined,
    baseline: ClickitupDraftSnapshot,
    current: ClickitupDraftSnapshot,
    storage: Storage | undefined = globalThis.localStorage
): void {
    if (!uid || !storage) return;
    try {
        if (hasClickitupDraftChanges(baseline, current)) {
            storage.setItem(storageKey(uid), JSON.stringify({ version: 1, baseline, current } satisfies ClickitupInventoryDraft));
        } else {
            storage.removeItem(storageKey(uid));
        }
    } catch (error) {
        console.error('Could not store ClickitUp inventory draft:', error);
    }
}

export function clearClickitupInventoryDraft(uid: string | null | undefined, storage: Storage | undefined = globalThis.localStorage): void {
    if (!uid || !storage) return;
    try { storage.removeItem(storageKey(uid)); } catch { /* storage can be unavailable */ }
}

export function restoreClickitupInventoryDraft(cloud: InventoryData, draft: ClickitupInventoryDraft): { inventory: InventoryData; conflicts: string[] } {
    const next: InventoryData = {
        ...cloud,
        clickitup: structuredClone(cloud.clickitup),
        clickitupAccessories: { ...cloud.clickitupAccessories },
        clickitupCounted: { ...cloud.clickitupCounted }
    };
    const conflicts: string[] = [];
    const { baseline, current } = draft;

    for (const size of new Set([...Object.keys(baseline.clickitup), ...Object.keys(current.clickitup)])) {
        for (const field of CLICKITUP_FIELDS) {
            const before = baseline.clickitup[size]?.[field.key] || 0;
            const local = current.clickitup[size]?.[field.key] || 0;
            if (before === local) continue;
            const remote = cloud.clickitup[size]?.[field.key] || 0;
            if (remote !== before && remote !== local) conflicts.push(`${size} ${field.label}`);
            next.clickitup[size] = { sektion: 0, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0, ...next.clickitup[size], [field.key]: local };
        }
    }
    for (const id of new Set([...Object.keys(baseline.clickitupAccessories), ...Object.keys(current.clickitupAccessories)])) {
        const before = baseline.clickitupAccessories[id] || 0;
        const local = current.clickitupAccessories[id] || 0;
        if (before === local) continue;
        const remote = cloud.clickitupAccessories[id] || 0;
        if (remote !== before && remote !== local) conflicts.push(id);
        next.clickitupAccessories[id] = local;
    }
    for (const key of new Set([...Object.keys(baseline.clickitupCounted), ...Object.keys(current.clickitupCounted)])) {
        const before = baseline.clickitupCounted[key] === true;
        const local = current.clickitupCounted[key] === true;
        if (before === local) continue;
        const remote = cloud.clickitupCounted[key] === true;
        if (remote !== before && remote !== local) conflicts.push(key);
        if (local) next.clickitupCounted[key] = true;
        else delete next.clickitupCounted[key];
    }
    if (baseline.notes !== current.notes) {
        if ((cloud.notes || '') !== baseline.notes && (cloud.notes || '') !== current.notes) conflicts.push('Noteringar');
        next.notes = current.notes;
    }
    return { inventory: next, conflicts };
}
