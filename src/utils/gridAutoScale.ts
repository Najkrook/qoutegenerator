import type {
    EffectiveGridAddonState,
    EffectiveGridLineSelection,
    GridAddonDiscountSyncMode,
    GridAddonState,
    GridAddonSyncMode,
    GridCatalogAddonOption,
    GridCatalogLineData,
    GridCustomAddonRow,
    GridCustomItemRow,
    GridLineSelection
} from '../types/contracts';

interface GridAddonResolutionInput {
    addonDef?: GridCatalogAddonOption | null;
    addonState?: Partial<GridAddonState> | null;
}

interface GridAddonQtyInput extends GridAddonResolutionInput {
    itemsQtyTotal: number;
}

interface GridSelectionOptions {
    globalDiscountPct?: number;
}

function normalizeNonNegativeInt(value: unknown): number {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeDiscountPct(value: unknown): number {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, parsed));
}

function nearlyEqual(a: number, b: number): boolean {
    return Math.abs(a - b) < 0.0001;
}

function getCatalogAddonMap(lineData?: Partial<GridCatalogLineData> | null): Record<string, GridCatalogAddonOption> {
    const addonMap: Record<string, GridCatalogAddonOption> = {};
    (lineData?.addonCategories || []).forEach((category) => {
        (category.items || []).forEach((addon) => {
            addonMap[addon.id] = addon;
        });
    });
    return addonMap;
}

export function getGridItemsQtyTotal(selections: Partial<GridLineSelection> = {}): number {
    const itemsTotal = Object.values(selections.items || {}).reduce(
        (sum, entry) => sum + normalizeNonNegativeInt(entry?.qty),
        0
    );
    const customItemsTotal = (selections.customItems || []).reduce(
        (sum, entry) => sum + normalizeNonNegativeInt(entry?.qty),
        0
    );
    return itemsTotal + customItemsTotal;
}

export function getGridAddonSyncMode({
    addonDef,
    addonState
}: GridAddonResolutionInput): GridAddonSyncMode {
    if (!addonDef?.autoScale) {
        return 'manual';
    }
    if (addonState?.syncMode === 'auto' || addonState?.syncMode === 'manual') {
        return addonState.syncMode;
    }
    if (addonState) {
        return 'manual';
    }
    return 'auto';
}

export function getGridAddonDiscountSyncMode({
    addonDef,
    addonState
}: GridAddonResolutionInput): GridAddonDiscountSyncMode {
    if (!addonDef?.autoScale) {
        return 'manual';
    }
    if (addonState?.discountSyncMode === 'global' || addonState?.discountSyncMode === 'manual') {
        return addonState.discountSyncMode;
    }
    if (addonState && Object.prototype.hasOwnProperty.call(addonState, 'discountPct')) {
        return 'manual';
    }
    return 'global';
}

export function getEffectiveGridAddonQty({
    addonDef,
    addonState,
    itemsQtyTotal
}: GridAddonQtyInput): number {
    const syncMode = getGridAddonSyncMode({ addonDef, addonState });
    if (addonDef?.autoScale && syncMode === 'auto') {
        return normalizeNonNegativeInt(itemsQtyTotal);
    }
    return normalizeNonNegativeInt(addonState?.qty);
}

export function getEffectiveGridAddonDiscountPct({
    addonDef,
    addonState,
    globalDiscountPct = 0
}: GridAddonResolutionInput & { globalDiscountPct?: number }): number {
    const discountSyncMode = getGridAddonDiscountSyncMode({ addonDef, addonState });
    if (addonDef?.autoScale && discountSyncMode === 'global') {
        return normalizeDiscountPct(globalDiscountPct);
    }
    return normalizeDiscountPct(addonState?.discountPct);
}

export function buildEffectiveGridSelections(
    lineData: Partial<GridCatalogLineData> = {},
    selections: Partial<GridLineSelection> = {},
    options: GridSelectionOptions = {}
): EffectiveGridLineSelection {
    const items = selections.items || {};
    const persistedAddons = selections.addons || {};
    const itemsQtyTotal = getGridItemsQtyTotal(selections);
    const catalogAddonMap = getCatalogAddonMap(lineData);
    const addons: Record<string, EffectiveGridAddonState> = {};
    const globalDiscountPct = normalizeDiscountPct(options.globalDiscountPct);

    Object.entries(catalogAddonMap).forEach(([addonId, addonDef]) => {
        const addonState = persistedAddons[addonId];
        const syncMode = getGridAddonSyncMode({ addonDef, addonState });
        const discountSyncMode = getGridAddonDiscountSyncMode({ addonDef, addonState });
        addons[addonId] = {
            ...(addonState || { qty: 0, discountPct: 0 }),
            qty: getEffectiveGridAddonQty({ addonDef, addonState, itemsQtyTotal }),
            discountPct: getEffectiveGridAddonDiscountPct({ addonDef, addonState, globalDiscountPct }),
            syncMode,
            discountSyncMode,
            isAutoScaled: addonDef.autoScale === true
        };
    });

    Object.entries(persistedAddons).forEach(([addonId, addonState]) => {
        if (addons[addonId]) {
            return;
        }
        addons[addonId] = {
            ...addonState,
            qty: normalizeNonNegativeInt(addonState?.qty),
            discountPct: normalizeDiscountPct(addonState?.discountPct),
            syncMode: 'manual',
            discountSyncMode: 'manual',
            isAutoScaled: false
        };
    });

    return {
        items,
        addons,
        itemsQtyTotal
    };
}

export function applyGlobalDiscountToLineSelection(
    lineData: Partial<GridCatalogLineData> = {},
    lineSelection: Partial<GridLineSelection> = {},
    nextGlobalDiscount = 0
): Partial<GridLineSelection> {
    const nextDiscount = normalizeDiscountPct(nextGlobalDiscount);
    const nextAddons: Record<string, GridAddonState> = { ...(lineSelection.addons || {}) };
    const effectiveSelections = buildEffectiveGridSelections(lineData, lineSelection, {
        globalDiscountPct: nextDiscount
    });

    (lineData.addonCategories || []).forEach((category) => {
        (category.items || []).forEach((addonDef) => {
            if (!addonDef?.autoScale) {
                return;
            }
            const addonId = addonDef.id;
            const addonState = lineSelection.addons?.[addonId];
            const discountSyncMode = getGridAddonDiscountSyncMode({ addonDef, addonState });
            if (discountSyncMode !== 'global') {
                return;
            }
            const effectiveAddon = effectiveSelections.addons[addonId];
            nextAddons[addonId] = {
                ...(addonState || { qty: 0, discountPct: 0 }),
                qty: addonState?.qty ?? effectiveAddon?.qty ?? 0,
                discountPct: nextDiscount,
                syncMode: addonState?.syncMode ?? effectiveAddon?.syncMode ?? 'auto',
                discountSyncMode: 'global'
            };
        });
    });

    return {
        ...lineSelection,
        addons: nextAddons
    };
}

export function applyGlobalDiscountToGridCustomAddons(
    lineSelection: Partial<GridLineSelection> = {},
    previousGlobalDiscount = 0,
    nextGlobalDiscount = 0
): Partial<GridLineSelection> {
    const previousDiscount = normalizeDiscountPct(previousGlobalDiscount);
    const nextDiscount = normalizeDiscountPct(nextGlobalDiscount);
    const customAddonsByCategory = lineSelection.customAddonsByCategory || {};

    const nextCustomAddonsByCategory = Object.entries(customAddonsByCategory).reduce<Record<string, GridCustomAddonRow[]>>(
        (acc, [categoryId, rows]) => {
            acc[categoryId] = Array.isArray(rows)
                ? rows.map((row) => {
                    const currentDiscount = normalizeDiscountPct(row?.discountPct);
                    return nearlyEqual(currentDiscount, previousDiscount)
                        ? { ...row, discountPct: nextDiscount }
                        : row;
                })
                : [];
            return acc;
        },
        {}
    );

    return {
        ...lineSelection,
        customAddonsByCategory: nextCustomAddonsByCategory
    };
}

export function applyGlobalDiscountToGridCustomItems(
    lineSelection: Partial<GridLineSelection> = {},
    previousGlobalDiscount = 0,
    nextGlobalDiscount = 0
): Partial<GridLineSelection> {
    const previousDiscount = normalizeDiscountPct(previousGlobalDiscount);
    const nextDiscount = normalizeDiscountPct(nextGlobalDiscount);
    const customItems = Array.isArray(lineSelection.customItems) ? lineSelection.customItems : [];

    const nextCustomItems: GridCustomItemRow[] = customItems.map((row) => {
        const currentDiscount = normalizeDiscountPct(row?.discountPct);
        return nearlyEqual(currentDiscount, previousDiscount)
            ? { ...row, discountPct: nextDiscount }
            : row;
    });

    return {
        ...lineSelection,
        customItems: nextCustomItems
    };
}
