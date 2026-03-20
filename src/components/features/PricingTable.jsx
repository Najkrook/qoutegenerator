import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { catalogData } from '../../data/catalog';
import { computeQuoteTotals } from '../../services/calculationEngine';
import { buildEffectiveGridSelections } from '../../utils/gridAutoScale.js';

export function PricingTable() {
    const { state, dispatch } = useQuote();
    const { totals, grossTotalSek, totalDiscountSek, finalTotalSek } = computeQuoteTotals({ state, catalogData });

    const handleDiscountChange = (source, value) => {
        const discountPct = parseFloat(value) || 0;

        if (source.type === 'builder') {
            const newItems = state.builderItems.map(item =>
                item.id === source.itemId ? { ...item, discountPct } : item
            );
            dispatch({ type: 'SET_BUILDER_ITEMS', payload: newItems });
        } else if (source.type === 'builder-addon') {
            const newItems = state.builderItems.map(item => {
                if (item.id === source.itemId) {
                    const newAddons = item.addons.map(addon =>
                        addon.id === source.addonId ? { ...addon, discountPct } : addon
                    );
                    return { ...item, addons: newAddons };
                }
                return item;
            });
            dispatch({ type: 'SET_BUILDER_ITEMS', payload: newItems });
        } else if (source.type === 'grid') {
            const lineSelections = state.gridSelections[source.lineId];
            const newSelections = {
                ...state.gridSelections,
                [source.lineId]: {
                    ...lineSelections,
                    items: {
                        ...lineSelections.items,
                        [source.key]: { ...lineSelections.items[source.key], discountPct }
                    }
                }
            };
            dispatch({ type: 'SET_GRID_SELECTIONS', payload: newSelections });
        } else if (source.type === 'grid-addon') {
            const lineSelections = state.gridSelections[source.lineId] || { items: {}, addons: {}, customAddonsByCategory: {} };
            const effectiveSelections = buildEffectiveGridSelections(catalogData[source.lineId], lineSelections, {
                globalDiscountPct: state.globalDiscountPct
            });
            const existingAddon = lineSelections.addons?.[source.addonId];
            const effectiveAddon = effectiveSelections.addons?.[source.addonId] || {};
            const newSelections = {
                ...state.gridSelections,
                [source.lineId]: {
                    ...lineSelections,
                    addons: {
                        ...lineSelections.addons,
                        [source.addonId]: {
                            ...(existingAddon || {}),
                            qty: existingAddon?.qty ?? effectiveAddon.qty ?? 0,
                            syncMode: existingAddon?.syncMode ?? effectiveAddon.syncMode ?? 'manual',
                            discountPct,
                            discountSyncMode: 'manual'
                        }
                    }
                }
            };
            dispatch({ type: 'SET_GRID_SELECTIONS', payload: newSelections });
        } else if (source.type === 'grid-custom-addon') {
            const lineSelections = state.gridSelections[source.lineId] || { items: {}, addons: {}, customAddonsByCategory: {} };
            const nextCustomAddonsByCategory = {
                ...(lineSelections.customAddonsByCategory || {}),
                [source.categoryId]: (lineSelections.customAddonsByCategory?.[source.categoryId] || []).map((row) => (
                    row.id === source.rowId ? { ...row, discountPct } : row
                ))
            };
            const newSelections = {
                ...state.gridSelections,
                [source.lineId]: {
                    ...lineSelections,
                    customAddonsByCategory: nextCustomAddonsByCategory
                }
            };
            dispatch({ type: 'SET_GRID_SELECTIONS', payload: newSelections });
        } else if (source.type === 'custom') {
            const newCosts = [...state.customCosts];
            newCosts[source.index] = { ...newCosts[source.index], discountPct };
            dispatch({ type: 'SET_CUSTOM_COSTS', payload: newCosts });
        }
    };

    const fmt = (num) => Math.round(num).toLocaleString('sv-SE');

    return (
        <div className="overflow-x-auto bg-panel-bg border border-panel-border rounded-lg shadow-inner">
            <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                    <tr className="bg-black/20 text-[10px] uppercase font-bold text-text-secondary tracking-wider">
                        <th className="p-4 border-b border-panel-border">Modell/Beskrivning</th>
                        <th className="p-4 border-b border-panel-border">Storlek</th>
                        <th className="p-4 border-b border-panel-border text-right">Pris/enhet</th>
                        <th className="p-4 border-b border-panel-border text-center">Antal</th>
                        <th className="p-4 border-b border-panel-border text-right">Rek Utpris</th>
                        <th className="p-4 border-b border-panel-border text-center">Rabatt %</th>
                        <th className="p-4 border-b border-panel-border text-right">Ert Pris (SEK)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-panel-border/50">
                    {totals.map((row, idx) => (
                        <tr
                            key={`${row.model}-${idx}`}
                            className={`hover:bg-white/[0.02] transition-colors ${row.isAddon ? 'bg-black/5' : ''} ${row.isCustom ? 'bg-secondary/5' : ''}`}
                        >
                            <td className={`p-4 text-sm ${row.isAddon ? 'pl-8 text-text-secondary italic' : 'font-medium'}`}>
                                {row.model}
                            </td>
                            <td className="p-4 text-sm text-text-secondary">{row.size}</td>
                            <td className="p-4 text-sm text-right text-text-secondary">{fmt(row.unitPrice)}</td>
                            <td className="p-4 text-sm text-center font-medium">{row.qty}</td>
                            <td className="p-4 text-sm text-right text-text-secondary">{fmt(row.gross)}</td>
                            <td className="p-4 text-center">
                                <input
                                    type="number"
                                    step="1"
                                    value={row.discountPct}
                                    onChange={(e) => handleDiscountChange(row.source, e.target.value)}
                                    className={`w-16 text-center bg-black/20 border border-panel-border rounded p-1 text-sm outline-none focus:border-primary ${row.discountPct > 0 ? 'text-primary' : ''}`}
                                />
                            </td>
                            <td className="p-4 text-sm text-right font-bold text-primary">
                                {fmt(row.net)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-black/40">
                    <tr className="border-t-2 border-panel-border">
                        <td colSpan="4" className="p-4 text-right font-semibold text-text-secondary uppercase text-xs">Summa Brutto</td>
                        <td className="p-4 text-right font-medium text-text-secondary">{fmt(grossTotalSek)} SEK</td>
                        <td colSpan="2"></td>
                    </tr>
                    <tr>
                        <td colSpan="4" className="p-4 text-right font-semibold text-text-secondary uppercase text-xs">Total Rabatt</td>
                        <td colSpan="2" className="p-4 text-right font-medium text-danger">-{fmt(totalDiscountSek)} SEK</td>
                        <td></td>
                    </tr>
                    <tr className="bg-primary/10">
                        <td colSpan="4" className="p-4 text-right font-bold text-lg uppercase">Totalt att betala (Exkl. moms)</td>
                        <td colSpan="3" className="p-4 text-right font-black text-2xl text-primary">{fmt(finalTotalSek)} SEK</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
