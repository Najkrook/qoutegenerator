import type { ChangeEvent, ReactNode } from 'react';
import { useQuote } from '../../store/QuoteContext';
import { getBuilderCatalogLine } from '../../data/catalogLookup';
import type {
    BuilderAddon,
    BuilderCatalogAddonCategory,
    BuilderCatalogAddonOption,
    BuilderCatalogLineData,
    BuilderCatalogModelData,
    BuilderItem as QuoteBuilderItem,
    BuilderItemProps,
    CatalogBuilderAddon,
    CustomBuilderAddon
} from '../../types/contracts';

const BUILDER_UNCATEGORIZED_CATEGORY_ID = '__uncategorized__';
export const ADDONS_ONLY_SIZE = '__addons_only__';

interface NormalizedBuilderAddonCategory extends BuilderCatalogAddonCategory {
    id: string;
}

function createBuilderItemId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isCustomBuilderAddon(addon: BuilderAddon): addon is CustomBuilderAddon {
    return 'isCustom' in addon && addon.isCustom === true;
}

function getBuilderLine(lineId: string): BuilderCatalogLineData | null {
    return getBuilderCatalogLine(lineId);
}

function createCustomAddon(itemQty: number, globalDiscountPct: number, categoryId: string): CustomBuilderAddon {
    return {
        id: createBuilderItemId('builder_custom'),
        qty: itemQty,
        discountPct: globalDiscountPct,
        isCustom: true,
        name: '',
        price: 0,
        categoryId
    };
}

function getBuilderCategoryId(category: BuilderCatalogAddonCategory, index: number): string {
    return String(category.id || `category_${index}`);
}

function getBuilderAddonCategories(modelData: BuilderCatalogModelData | null): NormalizedBuilderAddonCategory[] {
    const categories = Array.isArray(modelData?.addonCategories)
        ? modelData.addonCategories.map((category, index) => ({
            ...category,
            id: getBuilderCategoryId(category, index),
            items: Array.isArray(category.items) ? category.items : []
        }))
        : [];

    if (Array.isArray(modelData?.addons) && modelData.addons.length > 0) {
        categories.push({
            id: BUILDER_UNCATEGORIZED_CATEGORY_ID,
            name: 'Övriga tillval',
            items: modelData.addons
        });
    }

    return categories;
}

function getPriceSek(price: number, lineData: BuilderCatalogLineData | null, exchangeRate: number): number {
    return lineData?.currency === 'EUR' ? Math.round(price * exchangeRate) : price;
}

function buildSizeOptionGroups(sizes: BuilderCatalogModelData['sizes']): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    const noGroup: string[] = [];

    Object.keys(sizes).forEach((sizeLabel) => {
        let matchedGroup: string | null = null;
        const lower = sizeLabel.toLowerCase();

        if (lower.includes('kvadrat')) {
            matchedGroup = 'Kvadrat';
        } else if (lower.includes('runda') || sizeLabel.includes('*') || sizeLabel.includes('Ø')) {
            matchedGroup = 'Runda';
        } else if (lower.includes('rektangel')) {
            matchedGroup = 'Rektangel';
        } else if (sizeLabel.includes('x')) {
            const parts = sizeLabel.split('x').map((part) => part.trim());
            if (parts.length === 2) {
                matchedGroup = parts[0] === parts[1] ? 'Kvadrat' : 'Rektangel';
            }
        }

        if (matchedGroup) {
            groups[matchedGroup] = groups[matchedGroup] || [];
            groups[matchedGroup].push(sizeLabel);
        } else {
            noGroup.push(sizeLabel);
        }
    });

    return {
        __ungrouped__: noGroup,
        ...groups
    };
}

export function BuilderItem({ item, index, onRemove }: BuilderItemProps) {
    const { state, dispatch } = useQuote();
    const { exchangeRate, globalDiscountPct } = state;

    const lineData = getBuilderLine(item.line);
    const modelData = lineData?.models?.[item.model] || null;
    const addonCategories = getBuilderAddonCategories(modelData);
    const isAddonsOnly = item.size === ADDONS_ONLY_SIZE;
    const supportsAddonsOnly = item.line === 'BaHaMa';

    const updateItem = (updates: Partial<QuoteBuilderItem>) => {
        const newItems = state.builderItems.map((existingItem) => (
            existingItem.id === item.id ? { ...existingItem, ...updates } : existingItem
        ));
        dispatch({ type: 'SET_BUILDER_ITEMS', payload: newItems });
    };

    const handleLineChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const newLine = event.target.value;
        const nextLineData = getBuilderLine(newLine);
        if (!nextLineData) return;

        const newModels = Object.keys(nextLineData.models);
        const newModel = newModels[0];
        const newSize = isAddonsOnly
            ? ADDONS_ONLY_SIZE
            : Object.keys(nextLineData.models[newModel]?.sizes || {})[0] || '';

        updateItem({ line: newLine, model: newModel, size: newSize, addons: [] });
    };

    const handleModelChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const newModel = event.target.value;
        if (!lineData?.models[newModel]) return;

        const newSize = isAddonsOnly
            ? ADDONS_ONLY_SIZE
            : Object.keys(lineData.models[newModel].sizes || {})[0] || '';

        updateItem({ model: newModel, size: newSize, addons: [] });
    };

    const handleSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
        updateItem({ size: event.target.value });
    };

    const handleQtyChange = (event: ChangeEvent<HTMLInputElement>) => {
        const newQty = Number.parseInt(event.target.value, 10) || 1;
        const oldQty = item.qty;

        const newAddons = item.addons.map((addon) => {
            if (!isCustomBuilderAddon(addon) && addon.qty === oldQty) {
                return { ...addon, qty: newQty };
            }
            return addon;
        });

        updateItem({ qty: newQty, addons: newAddons });
    };

    const toggleAddon = (addonId: string, isChecked: boolean) => {
        let newAddons = [...item.addons];
        if (isChecked) {
            const nextAddon: CatalogBuilderAddon = {
                id: addonId,
                qty: item.qty,
                discountPct: globalDiscountPct
            };
            newAddons.push(nextAddon);
        } else {
            newAddons = newAddons.filter((addon) => isCustomBuilderAddon(addon) || addon.id !== addonId);
        }
        updateItem({ addons: newAddons });
    };

    const updateAddonQty = (addonId: string, qtyValue: string) => {
        const newQty = Number.parseInt(qtyValue, 10) || 1;
        const newAddons = item.addons.map((addon) => (
            !isCustomBuilderAddon(addon) && addon.id === addonId ? { ...addon, qty: newQty } : addon
        ));
        updateItem({ addons: newAddons });
    };

    const addCustomAddon = (categoryId: string) => {
        updateItem({
            addons: [...item.addons, createCustomAddon(item.qty, globalDiscountPct, categoryId)]
        });
    };

    const updateCustomAddon = (customAddonId: string, updates: Partial<CustomBuilderAddon>) => {
        updateItem({
            addons: item.addons.map((addon) => (
                isCustomBuilderAddon(addon) && addon.id === customAddonId
                    ? { ...addon, ...updates }
                    : addon
            ))
        });
    };

    const removeCustomAddon = (customAddonId: string) => {
        updateItem({
            addons: item.addons.filter((addon) => !(isCustomBuilderAddon(addon) && addon.id === customAddonId))
        });
    };

    const renderSizeOptions = (sizes: BuilderCatalogModelData['sizes']): ReactNode[] => {
        const groupedSizes = buildSizeOptionGroups(sizes);
        const elements: ReactNode[] = [];

        if (supportsAddonsOnly) {
            elements.push(
                <optgroup key="addons-only-group" label="--- UTAN PARASOLL ---" className="bg-panel-bg text-warning font-bold italic">
                    <option value={ADDONS_ONLY_SIZE} className="bg-panel-bg text-text-primary font-normal not-italic">
                        Endast tillägg
                    </option>
                </optgroup>
            );
        }

        groupedSizes.__ungrouped__.forEach((sizeLabel) => {
            elements.push(
                <option key={sizeLabel} value={sizeLabel} className="bg-panel-bg text-text-primary">
                    {sizeLabel}
                </option>
            );
        });

        Object.entries(groupedSizes)
            .filter(([groupName]) => groupName !== '__ungrouped__')
            .forEach(([groupName, sizeLabels]) => {
                elements.push(
                    <optgroup
                        key={groupName}
                        label={`--- ${groupName.toUpperCase()} ---`}
                        className="bg-panel-bg text-warning font-bold italic"
                    >
                        {sizeLabels.map((sizeLabel) => (
                            <option key={sizeLabel} value={sizeLabel} className="bg-panel-bg text-text-primary font-normal not-italic">
                                {sizeLabel}
                            </option>
                        ))}
                    </optgroup>
                );
            });

        return elements;
    };

    const itemBasePrice = modelData?.sizes?.[item.size]?.price || 0;
    const itemUnitPrice = getPriceSek(itemBasePrice, lineData, exchangeRate);
    const itemBaseTotal = itemUnitPrice * item.qty;

    let addonsTotal = 0;
    item.addons.forEach((addon) => {
        if (isCustomBuilderAddon(addon)) {
            addonsTotal += (Number(addon.price) || 0) * (Number(addon.qty) || 1);
            return;
        }

        let addonPrice = 0;
        addonCategories.forEach((category) => {
            const found = category.items.find((catalogAddon) => catalogAddon.id === addon.id);
            if (found) {
                addonPrice = found.price;
            }
        });
        addonsTotal += getPriceSek(addonPrice, lineData, exchangeRate) * (Number(addon.qty) || 1);
    });

    const itemGrandTotal = itemBaseTotal + addonsTotal;
    const selectedAddonCount = item.addons.length;
    const selectedAddonBadgeText = selectedAddonCount === 1 ? '1 tillägg' : `${selectedAddonCount} tillägg`;

    const getSelectedCategoryCount = (category: NormalizedBuilderAddonCategory): number => {
        const selectedCatalogCount = category.items.filter((addonOption) => (
            item.addons.some((selectedAddon) => !isCustomBuilderAddon(selectedAddon) && selectedAddon.id === addonOption.id)
        )).length;
        const selectedCustomCount = item.addons.filter((selectedAddon) => (
            isCustomBuilderAddon(selectedAddon) && selectedAddon.categoryId === category.id
        )).length;
        return selectedCatalogCount + selectedCustomCount;
    };

    const getSelectedCategoryLabel = (count: number): string => (count === 1 ? '1 vald' : `${count} valda`);

    const availableBuilderLines = Array.from(new Set([
        ...state.selectedLines.filter((lineId) => getBuilderLine(lineId) !== null),
        item.line
    ]));

    if (!lineData || !modelData) {
        return null;
    }

    return (
        <div className={`bg-panel-bg border rounded-lg p-6 mb-6 relative animate-slide-in ${isAddonsOnly ? 'border-primary/40' : 'border-panel-border'}`}>
            <div className="flex justify-between items-center mb-4 pb-4 border-bottom border-panel-border">
                <h3 className="text-lg font-semibold m-0 flex items-center gap-2">
                    <span className="text-text-secondary cursor-grab">=</span>
                    {isAddonsOnly ? `Enbart tillägg (${item.model})` : `Produkt ${index + 1} (${item.line})`}
                    {isAddonsOnly && (
                        <span className="inline-flex items-center rounded-full bg-secondary/20 px-2.5 py-1 text-xs font-semibold text-secondary">
                            Utan parasoll
                        </span>
                    )}
                    {selectedAddonCount > 0 && (
                        <span className="inline-flex items-center rounded-full bg-primary/20 px-2.5 py-1 text-xs font-semibold text-primary">
                            {selectedAddonBadgeText}
                        </span>
                    )}
                </h3>
                <button
                    onClick={() => onRemove(item.id)}
                    className="text-danger bg-transparent border-none text-sm font-medium cursor-pointer hover:underline"
                >
                    Ta bort
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Produktlinje</label>
                    <select
                        value={item.line}
                        onChange={handleLineChange}
                        className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                    >
                        {availableBuilderLines.map((lineId) => (
                            <option key={lineId} value={lineId} className="bg-panel-bg text-text-primary">
                                {getBuilderLine(lineId)?.name || lineId}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Modell</label>
                    <select
                        value={item.model}
                        onChange={handleModelChange}
                        className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                    >
                        {Object.entries(lineData.models).map(([modelId, catalogModel]) => (
                            <option key={modelId} value={modelId} className="bg-panel-bg text-text-primary">
                                {catalogModel.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Storlek</label>
                    <select
                        value={item.size}
                        onChange={handleSizeChange}
                        className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary"
                    >
                        {renderSizeOptions(modelData.sizes)}
                    </select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Antal</label>
                    <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={handleQtyChange}
                        className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md outline-none focus:border-primary w-24"
                    />
                </div>

                {!isAddonsOnly && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-text-secondary uppercase">Summa</label>
                        <div className="font-bold text-lg text-text-primary flex items-center h-10">
                            {itemBaseTotal.toLocaleString('sv-SE')} SEK
                        </div>
                    </div>
                )}
            </div>

            {addonCategories.length > 0 && (
                <details open={isAddonsOnly || undefined} className="mt-6 pt-6 border-t border-panel-border group">
                    <summary className="cursor-pointer list-none select-none flex items-center justify-between rounded-md border border-panel-border bg-black/10 px-4 py-3 hover:bg-black/20 transition-colors">
                        <span className="text-sm font-semibold uppercase tracking-wide text-text-primary">Tillägg</span>
                        <span className="flex items-center gap-3 text-xs text-text-secondary">
                            {selectedAddonCount > 0 ? `${selectedAddonCount} valda` : 'Inga valda'}
                            <span className="transition-transform group-open:rotate-180">v</span>
                        </span>
                    </summary>

                    <div className="mt-4 space-y-4">
                        {addonCategories.map((category) => {
                            const selectedCategoryCount = getSelectedCategoryCount(category);
                            const customAddons = item.addons.filter(
                                (addon): addon is CustomBuilderAddon => isCustomBuilderAddon(addon) && addon.categoryId === category.id
                            );

                            return (
                                <details key={category.id} className="bg-black/10 border border-panel-border rounded-md overflow-hidden group">
                                    <summary className="p-3 text-sm font-semibold text-primary uppercase cursor-pointer list-none flex justify-between items-center group-open:border-b group-open:border-panel-border">
                                        <span>{category.name}</span>
                                        <span className="flex items-center gap-3">
                                            {selectedCategoryCount > 0 && (
                                                <span className="inline-flex items-center rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-semibold normal-case tracking-normal text-primary">
                                                    {getSelectedCategoryLabel(selectedCategoryCount)}
                                                </span>
                                            )}
                                            <span className="text-xs transition-transform group-open:rotate-180">v</span>
                                        </span>
                                    </summary>
                                    <div className="p-4 space-y-3">
                                        {category.items.map((addonOption: BuilderCatalogAddonOption) => {
                                            const existingAddon = item.addons.find((addon) => (
                                                !isCustomBuilderAddon(addon) && addon.id === addonOption.id
                                            ));
                                            const isChecked = Boolean(existingAddon);
                                            const priceSek = getPriceSek(addonOption.price, lineData, exchangeRate);
                                            const isReq = addonOption.priceUponRequest === true;

                                            return (
                                                <div key={addonOption.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(event) => toggleAddon(addonOption.id, event.target.checked)}
                                                            className="w-4 h-4 accent-primary"
                                                        />
                                                        {addonOption.name}
                                                    </label>
                                                    <span className="text-sm text-text-secondary whitespace-nowrap">
                                                        {isReq ? 'Pris på förfrågan' : `${priceSek.toLocaleString('sv-SE')} SEK`}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={isChecked ? existingAddon?.qty || item.qty : item.qty}
                                                        disabled={!isChecked}
                                                        onChange={(event) => updateAddonQty(addonOption.id, event.target.value)}
                                                        className="bg-input-bg border border-panel-border text-text-primary p-1.5 rounded-md outline-none focus:border-primary w-16 text-sm disabled:opacity-50"
                                                    />
                                                    <span className="text-sm font-semibold min-w-[100px] text-right">
                                                        {isChecked
                                                            ? isReq
                                                                ? '= Pris på förfrågan'
                                                                : `= ${(priceSek * (Number(existingAddon?.qty) || 1)).toLocaleString('sv-SE')} SEK`
                                                            : ''}
                                                    </span>
                                                </div>
                                            );
                                        })}

                                        {customAddons.map((addon) => {
                                            const addonQty = Number(addon.qty) || 1;
                                            const addonPrice = Number(addon.price) || 0;
                                            return (
                                                <div key={addon.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4">
                                                    <input
                                                        type="text"
                                                        value={addon.name || ''}
                                                        onChange={(event) => updateCustomAddon(addon.id, { name: event.target.value })}
                                                        placeholder="Egen rad"
                                                        className="bg-input-bg border border-panel-border text-text-primary p-1.5 rounded-md outline-none focus:border-primary text-sm"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={addonPrice}
                                                        onChange={(event) => updateCustomAddon(addon.id, { price: Number.parseFloat(event.target.value) || 0 })}
                                                        className="bg-input-bg border border-panel-border text-text-primary p-1.5 rounded-md outline-none focus:border-primary w-24 text-sm text-right"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={addonQty}
                                                        onChange={(event) => updateCustomAddon(addon.id, { qty: Number.parseInt(event.target.value, 10) || 1 })}
                                                        className="bg-input-bg border border-panel-border text-text-primary p-1.5 rounded-md outline-none focus:border-primary w-16 text-sm"
                                                    />
                                                    <span className="text-sm font-semibold min-w-[100px] text-right">
                                                        = {(addonPrice * addonQty).toLocaleString('sv-SE')} SEK
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCustomAddon(addon.id)}
                                                        className="text-danger bg-transparent border-none text-sm font-medium cursor-pointer hover:underline justify-self-end"
                                                    >
                                                        Ta bort
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        <button
                                            type="button"
                                            onClick={() => addCustomAddon(category.id)}
                                            className="w-full rounded-md border border-dashed border-panel-border bg-white/[0.02] px-3 py-2 text-left text-sm font-medium text-primary hover:bg-white/[0.05] transition-colors"
                                        >
                                            + Lägg till egen rad
                                        </button>
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                </details>
            )}

            <div className="mt-6 pt-4 border-t border-panel-border flex justify-end items-center gap-4">
                <span className="text-sm text-text-secondary italic">Total för denna produkt:</span>
                <span className="text-xl font-bold text-text-primary">{itemGrandTotal.toLocaleString('sv-SE')} SEK</span>
            </div>
        </div>
    );
}
