import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { catalogData } from '../../data/catalog';

export function BuilderItem({ item, index, onRemove }) {
    const { state, dispatch } = useQuote();
    const { exchangeRate, globalDiscountPct } = state;

    const lineData = catalogData[item.line];
    const modelData = lineData?.models?.[item.model];

    const updateItem = (updates) => {
        const newItems = state.builderItems.map((i) => (i.id === item.id ? { ...i, ...updates } : i));
        dispatch({ type: 'SET_BUILDER_ITEMS', payload: newItems });
    };

    const handleLineChange = (e) => {
        const newLine = e.target.value;
        const newModels = Object.keys(catalogData[newLine].models);
        const newModel = newModels[0];
        const newSizes = Object.keys(catalogData[newLine].models[newModel].sizes);
        const newSize = newSizes[0];
        updateItem({ line: newLine, model: newModel, size: newSize, addons: [] });
    };

    const handleModelChange = (e) => {
        const newModel = e.target.value;
        const newSizes = Object.keys(lineData.models[newModel].sizes);
        const newSize = newSizes[0];
        updateItem({ model: newModel, size: newSize, addons: [] });
    };

    const handleSizeChange = (e) => {
        updateItem({ size: e.target.value });
    };

    const handleQtyChange = (e) => {
        updateItem({ qty: parseInt(e.target.value, 10) || 1 });
    };

    const toggleAddon = (addonId, isChecked) => {
        let newAddons = [...item.addons];
        if (isChecked) {
            newAddons.push({ id: addonId, qty: 1, discountPct: globalDiscountPct });
        } else {
            newAddons = newAddons.filter((a) => a.id !== addonId);
        }
        updateItem({ addons: newAddons });
    };

    const updateAddonQty = (addonId, qty) => {
        const newAddons = item.addons.map((a) => (a.id === addonId ? { ...a, qty: parseInt(qty, 10) || 1 } : a));
        updateItem({ addons: newAddons });
    };

    const getPriceSEK = (price, line) => {
        const currency = catalogData[line]?.currency;
        return currency === 'EUR' ? Math.round(price * exchangeRate) : price;
    };

    const renderSizeOptions = (sizesObj) => {
        const groups = {};
        const noGroup = [];

        Object.keys(sizesObj).forEach((s) => {
            let matchedGroup = null;
            if (s.toLowerCase().includes('kvadrat') || (s.includes('x') && s.split(' ')[1] === 'Kvadrat')) matchedGroup = 'Kvadrat';
            else if (s.toLowerCase().includes('runda') || s.includes('*')) matchedGroup = 'Runda';
            else if (s.toLowerCase().includes('rektangel')) matchedGroup = 'Rektangel';

            if (s.includes('Kvadrat')) matchedGroup = 'Kvadrat';
            if (s.includes('Runda')) matchedGroup = 'Runda';
            if (s.includes('Rektangel')) matchedGroup = 'Rektangel';

            if (matchedGroup) {
                if (!groups[matchedGroup]) groups[matchedGroup] = [];
                groups[matchedGroup].push(s);
            } else {
                noGroup.push(s);
            }
        });

        const elements = [];
        noGroup.forEach((s) => {
            elements.push(
                <option key={s} value={s} className="bg-panel-bg text-text-primary">
                    {s}
                </option>
            );
        });

        Object.keys(groups).forEach((gName) => {
            elements.push(
                <optgroup key={gName} label={`--- ${gName.toUpperCase()} ---`} className="bg-panel-bg text-primary font-bold italic">
                    {groups[gName].map((s) => (
                        <option key={s} value={s} className="bg-panel-bg text-text-primary font-normal not-italic">
                            {s}
                        </option>
                    ))}
                </optgroup>
            );
        });

        return elements;
    };

    const itemBasePrice = modelData?.sizes?.[item.size]?.price || 0;
    const itemUnitPrice = getPriceSEK(itemBasePrice, item.line);
    const itemBaseTotal = itemUnitPrice * item.qty;

    let addonsTotal = 0;
    item.addons.forEach((addon) => {
        let addonPrice = 0;
        if (modelData.addonCategories) {
            modelData.addonCategories.forEach((cat) => {
                const found = cat.items.find((i) => i.id === addon.id);
                if (found) addonPrice = found.price;
            });
        }
        if (modelData.addons) {
            const found = modelData.addons.find((i) => i.id === addon.id);
            if (found) addonPrice = found.price;
        }
        addonsTotal += getPriceSEK(addonPrice, item.line) * (parseInt(addon.qty, 10) || 1);
    });

    const itemGrandTotal = itemBaseTotal + addonsTotal;
    const selectedAddonCount = item.addons.length;

    return (
        <div className="bg-panel-bg border border-panel-border rounded-lg p-6 mb-6 relative animate-slide-in">
            <div className="flex justify-between items-center mb-4 pb-4 border-bottom border-panel-border">
                <h3 className="text-lg font-semibold m-0 flex items-center gap-2">
                    <span className="text-text-secondary cursor-grab">=</span>
                    Produkt {index + 1} ({item.line})
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
                        {Array.from(new Set([...state.selectedLines.filter((l) => catalogData[l].type === 'builder'), item.line])).map((l) => (
                            <option key={l} value={l} className="bg-panel-bg text-text-primary">
                                {catalogData[l] ? catalogData[l].name : l}
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
                        {Object.keys(lineData.models).map((m) => (
                            <option key={m} value={m} className="bg-panel-bg text-text-primary">
                                {lineData.models[m].name}
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

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Summa</label>
                    <div className="font-bold text-lg text-text-primary flex items-center h-10">{itemBaseTotal.toLocaleString('sv-SE')} SEK</div>
                </div>
            </div>

            {(modelData.addonCategories?.length > 0 || modelData.addons?.length > 0) && (
                <details className="mt-6 pt-6 border-t border-panel-border group">
                    <summary className="cursor-pointer list-none select-none flex items-center justify-between rounded-md border border-panel-border bg-black/10 px-4 py-3 hover:bg-black/20 transition-colors">
                        <span className="text-sm font-semibold uppercase tracking-wide text-text-primary">Tillägg</span>
                        <span className="flex items-center gap-3 text-xs text-text-secondary">
                            {selectedAddonCount > 0 ? `${selectedAddonCount} valda` : 'Inga valda'}
                            <span className="transition-transform group-open:rotate-180">▼</span>
                        </span>
                    </summary>

                    <div className="mt-4 space-y-4">
                        {modelData.addonCategories?.map((cat) => (
                            <details key={cat.name} className="bg-black/10 border border-panel-border rounded-md overflow-hidden group">
                                <summary className="p-3 text-sm font-semibold text-primary uppercase cursor-pointer list-none flex justify-between items-center group-open:border-b group-open:border-panel-border">
                                    {cat.name}
                                    <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                                </summary>
                                <div className="p-4 space-y-3">
                                    {cat.items.map((addon) => {
                                        const existing = item.addons.find((a) => a.id === addon.id);
                                        const isChecked = !!existing;
                                        const priceSEK = getPriceSEK(addon.price, item.line);
                                        return (
                                            <div key={addon.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => toggleAddon(addon.id, e.target.checked)}
                                                        className="w-4 h-4 accent-primary"
                                                    />
                                                    {addon.name}
                                                </label>
                                                <span className="text-sm text-text-secondary whitespace-nowrap">{priceSEK.toLocaleString('sv-SE')} SEK</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={isChecked ? existing.qty : 1}
                                                    disabled={!isChecked}
                                                    onChange={(e) => updateAddonQty(addon.id, e.target.value)}
                                                    className="bg-input-bg border border-panel-border text-text-primary p-1.5 rounded-md outline-none focus:border-primary w-16 text-sm disabled:opacity-50"
                                                />
                                                <span className="text-sm font-semibold min-w-[100px] text-right">
                                                    {isChecked ? `= ${(priceSEK * (parseInt(existing.qty, 10) || 1)).toLocaleString('sv-SE')} SEK` : ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </details>
                        ))}

                        {modelData.addons?.length > 0 && (
                            <div className="bg-black/10 border border-panel-border rounded-md p-4 space-y-3">
                                {modelData.addons.map((addon) => {
                                    const existing = item.addons.find((a) => a.id === addon.id);
                                    const isChecked = !!existing;
                                    const priceSEK = getPriceSEK(addon.price, item.line);
                                    return (
                                        <div key={addon.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => toggleAddon(addon.id, e.target.checked)}
                                                    className="w-4 h-4 accent-primary"
                                                />
                                                {addon.name}
                                            </label>
                                            <span className="text-sm text-text-secondary whitespace-nowrap">{priceSEK.toLocaleString('sv-SE')} SEK</span>
                                            <input
                                                type="number"
                                                min="1"
                                                value={isChecked ? existing.qty : 1}
                                                disabled={!isChecked}
                                                onChange={(e) => updateAddonQty(addon.id, e.target.value)}
                                                className="bg-input-bg border border-panel-border text-text-primary p-1.5 rounded-md outline-none focus:border-primary w-16 text-sm disabled:opacity-50"
                                            />
                                            <span className="text-sm font-semibold min-w-[100px] text-right">
                                                {isChecked ? `= ${(priceSEK * (parseInt(existing.qty, 10) || 1)).toLocaleString('sv-SE')} SEK` : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
