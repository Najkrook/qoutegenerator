function normalizeNonNegativeInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeDiscountPct(value) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, parsed));
}

function getCatalogAddonMap(lineData = {}) {
    const addonMap = {};
    (lineData.addonCategories || []).forEach((category) => {
        (category.items || []).forEach((addon) => {
            addonMap[addon.id] = addon;
        });
    });
    return addonMap;
}

export function getGridItemsQtyTotal(items = {}) {
    return Object.values(items).reduce((sum, entry) => sum + normalizeNonNegativeInt(entry?.qty), 0);
}

export function getGridAddonSyncMode({ addonDef, addonState }) {
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

export function getGridAddonDiscountSyncMode({ addonDef, addonState }) {
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

export function getEffectiveGridAddonQty({ addonDef, addonState, itemsQtyTotal }) {
    const syncMode = getGridAddonSyncMode({ addonDef, addonState });
    if (addonDef?.autoScale && syncMode === 'auto') {
        return normalizeNonNegativeInt(itemsQtyTotal);
    }
    return normalizeNonNegativeInt(addonState?.qty);
}

export function getEffectiveGridAddonDiscountPct({ addonDef, addonState, globalDiscountPct = 0 }) {
    const discountSyncMode = getGridAddonDiscountSyncMode({ addonDef, addonState });
    if (addonDef?.autoScale && discountSyncMode === 'global') {
        return normalizeDiscountPct(globalDiscountPct);
    }
    return normalizeDiscountPct(addonState?.discountPct);
}

export function buildEffectiveGridSelections(lineData = {}, selections = {}, options = {}) {
    const items = selections.items || {};
    const persistedAddons = selections.addons || {};
    const itemsQtyTotal = getGridItemsQtyTotal(items);
    const catalogAddonMap = getCatalogAddonMap(lineData);
    const addons = {};
    const globalDiscountPct = normalizeDiscountPct(options.globalDiscountPct);

    Object.entries(catalogAddonMap).forEach(([addonId, addonDef]) => {
        const addonState = persistedAddons[addonId];
        const syncMode = getGridAddonSyncMode({ addonDef, addonState });
        const discountSyncMode = getGridAddonDiscountSyncMode({ addonDef, addonState });
        addons[addonId] = {
            ...(addonState || {}),
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

export function applyGlobalDiscountToLineSelection(lineData = {}, lineSelection = {}, nextGlobalDiscount = 0) {
    const nextDiscount = normalizeDiscountPct(nextGlobalDiscount);
    const nextAddons = { ...(lineSelection.addons || {}) };
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
            const effectiveAddon = effectiveSelections.addons[addonId] || {};
            nextAddons[addonId] = {
                ...(addonState || {}),
                qty: addonState?.qty ?? effectiveAddon.qty ?? 0,
                discountPct: nextDiscount,
                syncMode: addonState?.syncMode ?? effectiveAddon.syncMode ?? 'auto',
                discountSyncMode: 'global'
            };
        });
    });

    return {
        ...lineSelection,
        addons: nextAddons
    };
}
