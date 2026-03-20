import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { catalogData } from '../../data/catalog';
import { buildEffectiveGridSelections } from '../../utils/gridAutoScale.js';

function createCustomAddonRow(globalDiscountPct) {
    return {
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: '',
        price: 0,
        qty: 1,
        discountPct: globalDiscountPct
    };
}

function getCategoryId(category, index) {
    return String(category?.id || category?.categoryId || `category_${index}`);
}

export function GridConfig({ lineId }) {
    const { state, dispatch } = useQuote();
    const { gridSelections, globalDiscountPct } = state;

    const lineData = catalogData[lineId];
    const selections = gridSelections[lineId] || { items: {}, addons: {}, customAddonsByCategory: {} };
    const effectiveSelections = buildEffectiveGridSelections(lineData, selections, {
        globalDiscountPct
    });

    const updateGrid = (updates) => {
        const newSelections = { ...gridSelections, [lineId]: { ...selections, ...updates } };
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: newSelections });
    };

    const addCustomAddon = (categoryId) => {
        const existingRows = selections.customAddonsByCategory?.[categoryId] || [];
        updateGrid({
            customAddonsByCategory: {
                ...(selections.customAddonsByCategory || {}),
                [categoryId]: [...existingRows, createCustomAddonRow(globalDiscountPct)]
            }
        });
    };

    const updateCustomAddon = (categoryId, rowId, updates) => {
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

    const removeCustomAddon = (categoryId, rowId) => {
        const nextCustomAddonsByCategory = { ...(selections.customAddonsByCategory || {}) };
        const nextRows = (nextCustomAddonsByCategory[categoryId] || []).filter((row) => row.id !== rowId);
        if (nextRows.length > 0) {
            nextCustomAddonsByCategory[categoryId] = nextRows;
        } else {
            delete nextCustomAddonsByCategory[categoryId];
        }
        updateGrid({ customAddonsByCategory: nextCustomAddonsByCategory });
    };

    const setCustomAddonQty = (categoryId, rowId, qty) => {
        updateCustomAddon(categoryId, rowId, { qty: Math.max(0, qty) });
    };

    const setItemQty = (model, size, qty) => {
        const key = `${model}|${size}`;
        const newItems = { ...selections.items };
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

    const setAddonQtyManual = (addonId, qty, addon) => {
        const newAddons = { ...selections.addons };
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

    const setAddonSyncMode = (addonId, syncMode) => {
        const newAddons = { ...selections.addons };
        const existing = newAddons[addonId];
        const effectiveQty = effectiveSelections.addons[addonId]?.qty || 0;
        newAddons[addonId] = {
            ...(existing || {}),
            qty: existing?.qty ?? effectiveQty,
            discountPct: existing?.discountPct ?? globalDiscountPct,
            syncMode,
            discountSyncMode: existing?.discountSyncMode ?? (existing ? 'manual' : 'global')
        };
        updateGrid({ addons: newAddons });
    };

    const getSubtotal = () => {
        let total = 0;
        Object.entries(selections.items).forEach(([key, val]) => {
            const [model, size] = key.split('|');
            const group = lineData.gridItems.find(g => g.model === model);
            const price = group?.sizes.find(s => s.size === size)?.price || 0;
            total += price * val.qty;
        });
        Object.entries(effectiveSelections.addons).forEach(([id, val]) => {
            let price = 0;
            lineData.addonCategories.forEach(cat => {
                const found = cat.items.find(a => a.id === id);
                if (found) price = found.price;
            });
            total += price * val.qty;
        });
        Object.values(selections.customAddonsByCategory || {}).forEach((rows) => {
            (rows || []).forEach((row) => {
                total += (Number(row?.price) || 0) * (Number(row?.qty) || 0);
            });
        });
        return total;
    };

    const getItemsSubtotal = () => {
        let total = 0;
        Object.entries(selections.items).forEach(([key, val]) => {
            const [model, size] = key.split('|');
            const group = lineData.gridItems.find(g => g.model === model);
            const price = group?.sizes.find(s => s.size === size)?.price || 0;
            total += price * val.qty;
        });
        return total;
    };

    const itemsSubtotal = getItemsSubtotal();
    const itemsQtyTotal = effectiveSelections.itemsQtyTotal;

    return (
        <div className="bg-panel-bg border border-panel-border rounded-lg p-6 mb-8 bg-black/5 animate-fade-in">
            <h3 className="text-lg font-semibold mb-2">Grid View: {lineData.name}</h3>
            <p className="text-sm text-text-secondary mb-6 italic">Fyll i antal f\u00F6r de artiklar som ska ing\u00E5 i offerten.</p>

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
                        {lineData.gridItems.map(group => (
                            <React.Fragment key={group.model}>
                                {group.sizes.map(sz => {
                                    const key = `${group.model}|${sz.size}`;
                                    const qty = selections.items[key]?.qty || 0;
                                    const total = sz.price * qty;
                                    return (
                                        <tr key={key} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 text-sm">{group.model}</td>
                                            <td className="p-3 text-sm">{sz.size}</td>
                                            <td className="p-3 text-sm text-right">{sz.price.toLocaleString('sv-SE')} SEK</td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setItemQty(group.model, sz.size, qty - 6)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer"
                                                    >-6</button>
                                                    <button
                                                        onClick={() => setItemQty(group.model, sz.size, qty - 1)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer"
                                                    >-</button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={qty}
                                                        onChange={(e) => setItemQty(group.model, sz.size, parseInt(e.target.value) || 0)}
                                                        className={`w-12 text-center font-bold bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${qty > 0 ? 'text-primary' : ''}`}
                                                    />
                                                    <button
                                                        onClick={() => setItemQty(group.model, sz.size, qty + 1)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer"
                                                    >+</button>
                                                    <button
                                                        onClick={() => setItemQty(group.model, sz.size, qty + 6)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer"
                                                    >+6</button>
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm text-right font-semibold">
                                                {total > 0 ? `${total.toLocaleString('sv-SE')} SEK` : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}

                        <tr className="bg-white/[0.035] border-y border-panel-border">
                            <td colSpan="3" className="px-4 py-4 pl-5 text-sm font-semibold uppercase tracking-[0.08em] text-text-secondary">
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
                            <td colSpan="5" className="h-4 p-0 border-0 bg-transparent" />
                        </tr>

                        {/* Addons for Grid */}
                        {lineData.addonCategories.map((cat, categoryIndex) => {
                            const categoryId = getCategoryId(cat, categoryIndex);
                            const customRows = selections.customAddonsByCategory?.[categoryId] || [];
                            return (
                            <React.Fragment key={categoryId}>
                                <tr className="bg-black/10">
                                    <td colSpan="5" className="p-2 pl-4 text-xs font-bold uppercase text-text-secondary border-y border-panel-border">
                                        {cat.name}
                                    </td>
                                </tr>
                                {cat.items.map(addon => {
                                    const effectiveAddon = effectiveSelections.addons[addon.id] || {};
                                    const qty = effectiveAddon.qty || 0;
                                    const syncMode = effectiveAddon.syncMode || 'manual';
                                    const total = addon.price * qty;
                                    return (
                                        <tr key={addon.id} className="hover:bg-white/5 transition-colors">
                                            <td colSpan="2" className="p-3 pl-6 text-sm italic">{addon.name}</td>
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
                                                    <button
                                                        onClick={() => setAddonQtyManual(addon.id, qty - 6, addon)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer"
                                                    >-6</button>
                                                    <button
                                                        onClick={() => setAddonQtyManual(addon.id, qty - 1, addon)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer"
                                                    >-</button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={qty}
                                                        onChange={(e) => setAddonQtyManual(addon.id, parseInt(e.target.value, 10) || 0, addon)}
                                                        className={`w-12 text-center font-bold bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${qty > 0 ? 'text-primary' : ''}`}
                                                    />
                                                    <button
                                                        onClick={() => setAddonQtyManual(addon.id, qty + 1, addon)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer"
                                                    >+</button>
                                                    <button
                                                        onClick={() => setAddonQtyManual(addon.id, qty + 6, addon)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer"
                                                    >+6</button>
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
                                            <td colSpan="2" className="p-3 pl-6">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={row.name}
                                                        onChange={(e) => updateCustomAddon(categoryId, row.id, { name: e.target.value })}
                                                        placeholder="Egen rad"
                                                        className="w-full bg-black/20 border border-panel-border text-text-primary rounded p-2 text-sm outline-none focus:border-primary"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCustomAddon(categoryId, row.id)}
                                                        className="h-9 w-9 shrink-0 rounded border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                                                        aria-label="Ta bort egen rad"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={price}
                                                    onChange={(e) => updateCustomAddon(categoryId, row.id, { price: parseFloat(e.target.value) || 0 })}
                                                    className="w-full bg-black/20 border border-panel-border text-text-primary rounded p-2 text-sm text-right outline-none focus:border-primary"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setCustomAddonQty(categoryId, row.id, qty - 6)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer"
                                                    >-6</button>
                                                    <button
                                                        onClick={() => setCustomAddonQty(categoryId, row.id, qty - 1)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer"
                                                    >-</button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={qty}
                                                        onChange={(e) => setCustomAddonQty(categoryId, row.id, parseInt(e.target.value, 10) || 0)}
                                                        className={`w-12 text-center font-bold bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${qty > 0 ? 'text-primary' : ''}`}
                                                    />
                                                    <button
                                                        onClick={() => setCustomAddonQty(categoryId, row.id, qty + 1)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer"
                                                    >+</button>
                                                    <button
                                                        onClick={() => setCustomAddonQty(categoryId, row.id, qty + 6)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer"
                                                    >+6</button>
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm text-right font-semibold">
                                                {total > 0 ? `${total.toLocaleString('sv-SE')} SEK` : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-white/[0.02]">
                                    <td colSpan="5" className="p-0">
                                        <button
                                            type="button"
                                            onClick={() => addCustomAddon(categoryId)}
                                            className="w-full px-6 py-3 text-left text-sm font-medium text-primary hover:bg-white/[0.04] transition-colors"
                                        >
                                            + Lägg till egen rad
                                        </button>
                                    </td>
                                </tr>
                            </React.Fragment>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-black/30 border-t-2 border-primary">
                            <td colSpan="4" className="p-4 text-right font-bold text-lg uppercase tracking-wider">Totalt {lineData.name}</td>
                            <td className="p-4 text-right font-bold text-lg text-primary">{getSubtotal().toLocaleString('sv-SE')} SEK</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
