import type { ChangeEvent } from 'react';
import { useQuote } from '../../store/QuoteContext';
import { getGridCatalogLine } from '../../data/catalogLookup';
import { buildEffectiveGridSelections } from '../../utils/gridAutoScale';
import type {
    EffectiveGridLineSelection,
    GridAddonDiscountSyncMode,
    GridAddonState,
    GridAddonSyncMode,
    GridCatalogAddonCategory,
    GridCatalogAddonOption,
    GridCatalogItemGroup,
    GridCatalogLineData,
    GridConfigProps,
    GridCustomAddonRow,
    GridCustomItemRow,
    GridItemSelectionState,
    GridLineSelection
} from '../../types/contracts';

function createGridRowId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createCustomAddonRow(globalDiscountPct: number): GridCustomAddonRow {
    return {
        id: createGridRowId('custom'),
        name: '',
        price: 0,
        qty: 1,
        discountPct: globalDiscountPct
    };
}

function createCustomItemRow(globalDiscountPct: number): GridCustomItemRow {
    return {
        id: createGridRowId('custom_item'),
        name: '',
        size: '',
        price: 0,
        qty: 1,
        discountPct: globalDiscountPct
    };
}

function getCategoryId(category: GridCatalogAddonCategory, index: number): string {
    return String(category.id || category.categoryId || `category_${index}`);
}

function getGridLine(lineId: string): GridCatalogLineData | null {
    return getGridCatalogLine(lineId);
}

function createEmptyGridSelection(): GridLineSelection {
    return {
        items: {},
        addons: {},
        customAddonsByCategory: {},
        customItems: []
    };
}

function getGridPrice(group: GridCatalogItemGroup, size: string): number {
    return group.sizes.find((sizeOption) => sizeOption.size === size)?.price || 0;
}

interface FragmentRowsProps {
    group: GridCatalogItemGroup;
    selections: GridLineSelection;
    setItemQty: (model: string, size: string, qty: number) => void;
}

function FragmentRows({ group, selections, setItemQty }: FragmentRowsProps) {
    return (
        <>
            {group.sizes.map((sizeOption) => {
                const key = `${group.model}|${sizeOption.size}`;
                const qty = selections.items[key]?.qty || 0;
                const total = sizeOption.price * qty;

                return (
                    <tr key={key} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-sm">{group.model}</td>
                        <td className="p-3 text-sm">{sizeOption.size}</td>
                        <td className="p-3 text-sm text-right">{sizeOption.price.toLocaleString('sv-SE')} SEK</td>
                        <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => setItemQty(group.model, sizeOption.size, qty - 6)} className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer">-6</button>
                                <button onClick={() => setItemQty(group.model, sizeOption.size, qty - 1)} className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer">-</button>
                                <input
                                    type="number"
                                    min="0"
                                    value={qty}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => setItemQty(group.model, sizeOption.size, Number.parseInt(event.target.value, 10) || 0)}
                                    className={`w-12 text-center font-bold bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${qty > 0 ? 'text-primary' : ''}`}
                                />
                                <button onClick={() => setItemQty(group.model, sizeOption.size, qty + 1)} className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer">+</button>
                                <button onClick={() => setItemQty(group.model, sizeOption.size, qty + 6)} className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer">+6</button>
                            </div>
                        </td>
                        <td className="p-3 text-sm text-right font-semibold">
                            {total > 0 ? `${total.toLocaleString('sv-SE')} SEK` : ''}
                        </td>
                    </tr>
                );
            })}
        </>
    );
}

interface GridAddonCategoryRowsProps {
    category: GridCatalogAddonCategory;
    categoryId: string;
    customRows: GridCustomAddonRow[];
    effectiveSelections: EffectiveGridLineSelection;
    setAddonQtyManual: (addonId: string, qty: number, addon?: GridCatalogAddonOption) => void;
    setAddonSyncMode: (addonId: string, syncMode: GridAddonSyncMode) => void;
    updateCustomAddon: (categoryId: string, rowId: string, updates: Partial<GridCustomAddonRow>) => void;
    removeCustomAddon: (categoryId: string, rowId: string) => void;
    setCustomAddonQty: (categoryId: string, rowId: string, qty: number) => void;
    addCustomAddon: (categoryId: string) => void;
}

function GridAddonCategoryRows({
    category,
    categoryId,
    customRows,
    effectiveSelections,
    setAddonQtyManual,
    setAddonSyncMode,
    updateCustomAddon,
    removeCustomAddon,
    setCustomAddonQty,
    addCustomAddon
}: GridAddonCategoryRowsProps) {
    return (
        <>
            <tr className="bg-black/10">
                <td colSpan={5} className="p-2 pl-4 text-xs font-bold uppercase text-text-secondary border-y border-panel-border">
                    {category.name}
                </td>
            </tr>
            {category.items.map((addon) => {
                const effectiveAddon = effectiveSelections.addons[addon.id];
                const qty = effectiveAddon?.qty || 0;
                const syncMode = effectiveAddon?.syncMode || 'manual';
                const total = addon.price * qty;

                return (
                    <tr key={addon.id} className="hover:bg-white/5 transition-colors">
                        <td colSpan={2} className="p-3 pl-6 text-sm italic">{addon.name}</td>
                        <td className="p-3 text-sm text-right">{addon.price.toLocaleString('sv-SE')} SEK</td>
                        <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                                {addon.autoScale && (
                                    <button
                                        type="button"
                                        aria-pressed={syncMode === 'auto'}
                                        onClick={() => setAddonSyncMode(addon.id, 'auto')}
                                        className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${syncMode === 'auto'
                                            ? 'bg-primary/20 text-primary border-primary/60'
                                            : 'bg-panel-bg border-panel-border text-text-secondary hover:text-text-primary'
                                            }`}
                                    >
                                        Auto
                                    </button>
                                )}
                                <button onClick={() => setAddonQtyManual(addon.id, qty - 6, addon)} className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer">-6</button>
                                <button onClick={() => setAddonQtyManual(addon.id, qty - 1, addon)} className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer">-</button>
                                <input
                                    type="number"
                                    min="0"
                                    value={qty}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => setAddonQtyManual(addon.id, Number.parseInt(event.target.value, 10) || 0, addon)}
                                    className={`w-12 text-center font-bold bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${qty > 0 ? 'text-primary' : ''}`}
                                />
                                <button onClick={() => setAddonQtyManual(addon.id, qty + 1, addon)} className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer">+</button>
                                <button onClick={() => setAddonQtyManual(addon.id, qty + 6, addon)} className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer">+6</button>
                            </div>
                        </td>
                        <td className="p-3 text-sm text-right font-semibold">
                            {total > 0 ? `${total.toLocaleString('sv-SE')} SEK` : ''}
                        </td>
                    </tr>
                );
            })}

            {customRows.map((row) => {
                const qty = Number(row.qty) || 0;
                const price = Number(row.price) || 0;
                const total = price * qty;

                return (
                    <tr key={row.id} className="bg-white/[0.025] hover:bg-white/[0.04] transition-colors">
                        <td colSpan={2} className="p-3 pl-6">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={row.name}
                                    onChange={(event) => updateCustomAddon(categoryId, row.id, { name: event.target.value })}
                                    placeholder="Egen rad"
                                    className="w-full bg-black/20 border border-panel-border text-text-primary rounded p-2 text-sm outline-none focus:border-primary"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeCustomAddon(categoryId, row.id)}
                                    className="h-9 w-9 shrink-0 rounded border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                                    aria-label="Ta bort egen rad"
                                >
                                    x
                                </button>
                            </div>
                        </td>
                        <td className="p-3">
                            <input
                                type="number"
                                min="0"
                                value={price}
                                onChange={(event) => updateCustomAddon(categoryId, row.id, { price: Number.parseFloat(event.target.value) || 0 })}
                                className="w-full bg-black/20 border border-panel-border text-text-primary rounded p-2 text-sm text-right outline-none focus:border-primary"
                            />
                        </td>
                        <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                                <button onClick={() => setCustomAddonQty(categoryId, row.id, qty - 6)} className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer">-6</button>
                                <button onClick={() => setCustomAddonQty(categoryId, row.id, qty - 1)} className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer">-</button>
                                <input
                                    type="number"
                                    min="0"
                                    value={qty}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomAddonQty(categoryId, row.id, Number.parseInt(event.target.value, 10) || 0)}
                                    className={`w-12 text-center font-bold bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${qty > 0 ? 'text-primary' : ''}`}
                                />
                                <button onClick={() => setCustomAddonQty(categoryId, row.id, qty + 1)} className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer">+</button>
                                <button onClick={() => setCustomAddonQty(categoryId, row.id, qty + 6)} className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer">+6</button>
                            </div>
                        </td>
                        <td className="p-3 text-sm text-right font-semibold">
                            {total > 0 ? `${total.toLocaleString('sv-SE')} SEK` : ''}
                        </td>
                    </tr>
                );
            })}

            <tr className="bg-white/[0.02]">
                <td colSpan={5} className="p-0">
                    <button
                        type="button"
                        onClick={() => addCustomAddon(categoryId)}
                        className="w-full px-6 py-3 text-left text-sm font-medium text-primary hover:bg-white/[0.04] transition-colors"
                    >
                        + Lägg till egen rad
                    </button>
                </td>
            </tr>
        </>
    );
}

export function GridConfig({ lineId }: GridConfigProps) {
    const { state, dispatch } = useQuote();
    const { gridSelections, globalDiscountPct } = state;

    const lineData = getGridLine(lineId);
    const selections = gridSelections[lineId] || createEmptyGridSelection();
    const effectiveSelections: EffectiveGridLineSelection = buildEffectiveGridSelections(lineData || {}, selections, {
        globalDiscountPct
    });

    const updateGrid = (updates: Partial<GridLineSelection>) => {
        const newSelections = {
            ...gridSelections,
            [lineId]: { ...selections, ...updates }
        };
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: newSelections });
    };

    const resetGrid = () => {
        const newSelections = {
            ...gridSelections,
            [lineId]: createEmptyGridSelection()
        };
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: newSelections });
    };

    const addCustomItem = () => {
        const existingRows = selections.customItems || [];
        updateGrid({
            customItems: [...existingRows, createCustomItemRow(globalDiscountPct)]
        });
    };

    const updateCustomItem = (rowId: string, updates: Partial<GridCustomItemRow>) => {
        const existingRows = selections.customItems || [];
        updateGrid({
            customItems: existingRows.map((row) => (
                row.id === rowId ? { ...row, ...updates } : row
            ))
        });
    };

    const removeCustomItem = (rowId: string) => {
        const existingRows = selections.customItems || [];
        updateGrid({
            customItems: existingRows.filter((row) => row.id !== rowId)
        });
    };

    const setCustomItemQty = (rowId: string, qty: number) => {
        updateCustomItem(rowId, { qty: Math.max(0, qty) });
    };

    const addCustomAddon = (categoryId: string) => {
        const existingRows = selections.customAddonsByCategory?.[categoryId] || [];
        updateGrid({
            customAddonsByCategory: {
                ...(selections.customAddonsByCategory || {}),
                [categoryId]: [...existingRows, createCustomAddonRow(globalDiscountPct)]
            }
        });
    };

    const updateCustomAddon = (categoryId: string, rowId: string, updates: Partial<GridCustomAddonRow>) => {
        const categoryRows = selections.customAddonsByCategory?.[categoryId] || [];
        updateGrid({
            customAddonsByCategory: {
                ...(selections.customAddonsByCategory || {}),
                [categoryId]: categoryRows.map((row) => (
                    row.id === rowId ? { ...row, ...updates } : row
                ))
            }
        });
    };

    const removeCustomAddon = (categoryId: string, rowId: string) => {
        const nextCustomAddonsByCategory = { ...(selections.customAddonsByCategory || {}) };
        const nextRows = (nextCustomAddonsByCategory[categoryId] || []).filter((row) => row.id !== rowId);

        if (nextRows.length > 0) {
            nextCustomAddonsByCategory[categoryId] = nextRows;
        } else {
            delete nextCustomAddonsByCategory[categoryId];
        }

        updateGrid({ customAddonsByCategory: nextCustomAddonsByCategory });
    };

    const setCustomAddonQty = (categoryId: string, rowId: string, qty: number) => {
        updateCustomAddon(categoryId, rowId, { qty: Math.max(0, qty) });
    };

    const setItemQty = (model: string, size: string, qty: number) => {
        const key = `${model}|${size}`;
        const newItems: Record<string, GridItemSelectionState> = { ...selections.items };
        if (qty > 0) {
            const existing = newItems[key];
            newItems[key] = existing
                ? { ...existing, qty }
                : { qty, discountPct: globalDiscountPct };
        } else {
            delete newItems[key];
        }
        updateGrid({ items: newItems });
    };

    const setAddonQtyManual = (addonId: string, qty: number, addon?: GridCatalogAddonOption) => {
        const newAddons: Record<string, GridAddonState> = { ...selections.addons };
        const normalizedQty = Math.max(0, qty);
        if (normalizedQty > 0 || addon?.autoScale) {
            const existing = newAddons[addonId];
            newAddons[addonId] = existing
                ? {
                    ...existing,
                    qty: normalizedQty,
                    syncMode: 'manual',
                    discountSyncMode: existing.discountSyncMode || 'manual'
                }
                : {
                    qty: normalizedQty,
                    discountPct: globalDiscountPct,
                    syncMode: 'manual',
                    discountSyncMode: 'global'
                };
        } else {
            delete newAddons[addonId];
        }
        updateGrid({ addons: newAddons });
    };

    const setAddonSyncMode = (addonId: string, syncMode: GridAddonSyncMode) => {
        const newAddons: Record<string, GridAddonState> = { ...selections.addons };
        const existing = newAddons[addonId];
        const effectiveQty = effectiveSelections.addons[addonId]?.qty || 0;
        const effectiveDiscountSyncMode = existing?.discountSyncMode ?? (existing ? 'manual' : 'global');

        newAddons[addonId] = {
            ...(existing || { qty: 0, discountPct: globalDiscountPct }),
            qty: existing?.qty ?? effectiveQty,
            discountPct: existing?.discountPct ?? globalDiscountPct,
            syncMode,
            discountSyncMode: effectiveDiscountSyncMode as GridAddonDiscountSyncMode
        };
        updateGrid({ addons: newAddons });
    };

    const getItemsSubtotal = (): number => {
        if (!lineData) return 0;

        let total = 0;
        Object.entries(selections.items).forEach(([key, value]) => {
            const [model, size] = key.split('|');
            const group = lineData.gridItems.find((gridGroup) => gridGroup.model === model);
            const price = group ? getGridPrice(group, size) : 0;
            total += price * value.qty;
        });

        (selections.customItems || []).forEach((row) => {
            total += (Number(row.price) || 0) * (Number(row.qty) || 0);
        });

        return total;
    };

    const getSubtotal = (): number => {
        if (!lineData) return 0;

        let total = getItemsSubtotal();

        Object.entries(effectiveSelections.addons).forEach(([addonId, value]) => {
            let price = 0;
            lineData.addonCategories.forEach((category) => {
                const found = category.items.find((addon) => addon.id === addonId);
                if (found) {
                    price = found.price;
                }
            });
            total += price * value.qty;
        });

        Object.values(selections.customAddonsByCategory || {}).forEach((rows) => {
            (rows || []).forEach((row) => {
                total += (Number(row.price) || 0) * (Number(row.qty) || 0);
            });
        });

        return total;
    };

    const itemsSubtotal = getItemsSubtotal();
    const itemsQtyTotal = effectiveSelections.itemsQtyTotal;

    if (!lineData) {
        return null;
    }

    return (
        <div className="bg-panel-bg border border-panel-border rounded-lg p-6 mb-8 bg-black/5 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Grid View: {lineData.name}</h3>
                <button
                    type="button"
                    onClick={resetGrid}
                    className="text-danger bg-transparent border-none text-sm font-medium cursor-pointer hover:underline"
                >
                    Ta bort
                </button>
            </div>
            <p className="text-sm text-text-secondary mb-6 italic">Fyll i antal för de artiklar som ska ingå i offerten.</p>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-black/20 text-xs uppercase text-text-secondary">
                            <th className="p-3 border-b border-panel-border font-semibold">Modell</th>
                            <th className="p-3 border-b border-panel-border font-semibold">Storlek</th>
                            <th className="p-3 border-b border-panel-border font-semibold text-right">Pris/enhet (Exkl. moms)</th>
                            <th className="p-3 border-b border-panel-border font-semibold text-center w-[200px]">Antal</th>
                            <th className="p-3 border-b border-panel-border font-semibold text-right w-[150px]">Summa</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border">
                        {lineData.gridItems.map((group) => (
                            <FragmentRows
                                key={group.model}
                                group={group}
                                selections={selections}
                                setItemQty={setItemQty}
                            />
                        ))}

                        {(selections.customItems || []).map((row) => {
                            const qty = Number(row.qty) || 0;
                            const price = Number(row.price) || 0;
                            const total = price * qty;

                            return (
                                <tr key={row.id} className="bg-white/[0.025] hover:bg-white/[0.04] transition-colors">
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={row.name}
                                                onChange={(event) => updateCustomItem(row.id, { name: event.target.value })}
                                                placeholder="Egen modell"
                                                className="w-full bg-black/20 border border-panel-border text-text-primary rounded p-2 text-sm outline-none focus:border-primary"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeCustomItem(row.id)}
                                                className="h-9 w-9 shrink-0 rounded border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                                                aria-label="Ta bort egen rad"
                                            >
                                                x
                                            </button>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="text"
                                            value={row.size}
                                            onChange={(event) => updateCustomItem(row.id, { size: event.target.value })}
                                            placeholder="Storlek"
                                            className="w-full bg-black/20 border border-panel-border text-text-primary rounded p-2 text-sm outline-none focus:border-primary"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <input
                                            type="number"
                                            min="0"
                                            value={price}
                                            onChange={(event) => updateCustomItem(row.id, { price: Number.parseFloat(event.target.value) || 0 })}
                                            className="w-full bg-black/20 border border-panel-border text-text-primary rounded p-2 text-sm text-right outline-none focus:border-primary"
                                        />
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => setCustomItemQty(row.id, qty - 6)} className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer">-6</button>
                                            <button onClick={() => setCustomItemQty(row.id, qty - 1)} className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer">-</button>
                                            <input
                                                type="number"
                                                min="0"
                                                value={qty}
                                                onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomItemQty(row.id, Number.parseInt(event.target.value, 10) || 0)}
                                                className={`w-12 text-center font-bold bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${qty > 0 ? 'text-primary' : ''}`}
                                            />
                                            <button onClick={() => setCustomItemQty(row.id, qty + 1)} className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer">+</button>
                                            <button onClick={() => setCustomItemQty(row.id, qty + 6)} className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer">+6</button>
                                        </div>
                                    </td>
                                    <td className="p-3 text-sm text-right font-semibold">
                                        {total > 0 ? `${total.toLocaleString('sv-SE')} SEK` : ''}
                                    </td>
                                </tr>
                            );
                        })}
                        <tr className="bg-white/[0.02]">
                            <td colSpan={5} className="p-0 border-b border-panel-border">
                                <button
                                    type="button"
                                    onClick={addCustomItem}
                                    className="w-full px-6 py-3 text-left text-sm font-medium text-primary hover:bg-white/[0.04] transition-colors"
                                >
                                    + Lägg till egen sektion
                                </button>
                            </td>
                        </tr>

                        <tr className="bg-white/[0.035] border-y border-panel-border">
                            <td colSpan={3} className="px-4 py-4 pl-5 text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
                                Delsumma sektioner
                            </td>
                            <td className="px-4 py-4 text-sm text-center font-semibold text-text-primary">
                                {itemsQtyTotal > 0 ? `${itemsQtyTotal} st` : ''}
                            </td>
                            <td className="px-4 py-4 text-sm text-right font-bold text-text-primary">
                                {itemsSubtotal > 0 ? `${itemsSubtotal.toLocaleString('sv-SE')} SEK` : ''}
                            </td>
                        </tr>
                        <tr aria-hidden="true">
                            <td colSpan={5} className="h-4 p-0 border-0 bg-transparent" />
                        </tr>

                        {lineData.addonCategories.map((category, categoryIndex) => {
                            const categoryId = getCategoryId(category, categoryIndex);
                            const customRows = selections.customAddonsByCategory?.[categoryId] || [];

                            return (
                                <GridAddonCategoryRows
                                    key={categoryId}
                                    category={category}
                                    categoryId={categoryId}
                                    customRows={customRows}
                                    effectiveSelections={effectiveSelections}
                                    setAddonQtyManual={setAddonQtyManual}
                                    setAddonSyncMode={setAddonSyncMode}
                                    updateCustomAddon={updateCustomAddon}
                                    removeCustomAddon={removeCustomAddon}
                                    setCustomAddonQty={setCustomAddonQty}
                                    addCustomAddon={addCustomAddon}
                                />
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-black/30 border-t-2 border-primary">
                            <td colSpan={4} className="p-4 text-right font-bold text-lg uppercase tracking-wider">
                                Totalt {lineData.name}
                            </td>
                            <td className="p-4 text-right font-bold text-lg text-primary">
                                {getSubtotal().toLocaleString('sv-SE')} SEK
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
