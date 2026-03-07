import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { catalogData } from '../../data/catalog';

export function GridConfig({ lineId }) {
    const { state, dispatch } = useQuote();
    const { gridSelections, globalDiscountPct } = state;

    const lineData = catalogData[lineId];
    const selections = gridSelections[lineId] || { items: {}, addons: {} };

    const updateGrid = (updates) => {
        const newSelections = { ...gridSelections, [lineId]: { ...selections, ...updates } };
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: newSelections });
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

    const setAddonQty = (addonId, qty) => {
        const newAddons = { ...selections.addons };
        if (qty > 0) {
            const existing = newAddons[addonId];
            newAddons[addonId] = existing
                ? { ...existing, qty }
                : { qty, discountPct: globalDiscountPct };
        } else {
            delete newAddons[addonId];
        }
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
        Object.entries(selections.addons).forEach(([id, val]) => {
            let price = 0;
            lineData.addonCategories.forEach(cat => {
                const found = cat.items.find(a => a.id === id);
                if (found) price = found.price;
            });
            total += price * val.qty;
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

    const getItemsQtyTotal = () => {
        return Object.values(selections.items).reduce((sum, entry) => sum + (Number(entry?.qty) || 0), 0);
    };

    const itemsSubtotal = getItemsSubtotal();
    const itemsQtyTotal = getItemsQtyTotal();

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
                        {lineData.addonCategories.map(cat => (
                            <React.Fragment key={cat.name}>
                                <tr className="bg-black/10">
                                    <td colSpan="5" className="p-2 pl-4 text-xs font-bold uppercase text-text-secondary border-y border-panel-border">
                                        {cat.name}
                                    </td>
                                </tr>
                                {cat.items.map(addon => {
                                    const qty = selections.addons[addon.id]?.qty || 0;
                                    const total = addon.price * qty;
                                    return (
                                        <tr key={addon.id} className="hover:bg-white/5 transition-colors">
                                            <td colSpan="2" className="p-3 pl-6 text-sm italic">{addon.name}</td>
                                            <td className="p-3 text-sm text-right">{addon.price.toLocaleString('sv-SE')} SEK</td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setAddonQty(addon.id, qty - 6)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-1.5 py-1 rounded text-[10px] hover:bg-panel-border cursor-pointer"
                                                    >-6</button>
                                                    <button
                                                        onClick={() => setAddonQty(addon.id, qty - 1)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer"
                                                    >-</button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={qty}
                                                        onChange={(e) => setAddonQty(addon.id, parseInt(e.target.value) || 0)}
                                                        className={`w-12 text-center font-bold bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${qty > 0 ? 'text-primary' : ''}`}
                                                    />
                                                    <button
                                                        onClick={() => setAddonQty(addon.id, qty + 1)}
                                                        className="bg-panel-bg border border-panel-border text-text-primary px-2 py-1 rounded text-xs hover:bg-panel-border cursor-pointer"
                                                    >+</button>
                                                    <button
                                                        onClick={() => setAddonQty(addon.id, qty + 6)}
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
