import React from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import { PricingTable } from '../components/features/PricingTable';
import { CustomCosts } from '../components/features/CustomCosts';
import { applyGlobalDiscountToLineSelection } from '../utils/gridAutoScale.js';

function parseDiscount(value) {
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, num));
}

function nearlyEqual(a, b) {
    return Math.abs(a - b) < 0.0001;
}

export function Pricing({ onNext, onPrev }) {
    const { state, dispatch } = useQuote();
    const { canViewEverything } = useAuth();
    const { globalDiscountPct, exchangeRate, prevGlobalDiscountPct } = state;

    const handleGlobalDiscountChange = (e) => {
        const nextGlobalDiscount = parseDiscount(e.target.value);
        const previousGlobalDiscount = Number.isFinite(prevGlobalDiscountPct)
            ? prevGlobalDiscountPct
            : 0;

        const shouldFollowGlobal = (value) => {
            const normalized = Number.isFinite(value) ? value : 0;
            return nearlyEqual(normalized, previousGlobalDiscount);
        };

        const updatedBuilderItems = (state.builderItems || []).map((item) => {
            const nextItemDiscount = shouldFollowGlobal(item.discountPct)
                ? nextGlobalDiscount
                : (Number.isFinite(item.discountPct) ? item.discountPct : 0);

            const nextAddons = (item.addons || []).map((addon) => {
                const currentAddonDiscount = Number.isFinite(addon.discountPct) ? addon.discountPct : 0;
                return shouldFollowGlobal(currentAddonDiscount)
                    ? { ...addon, discountPct: nextGlobalDiscount }
                    : addon;
            });

            return {
                ...item,
                discountPct: nextItemDiscount,
                addons: nextAddons
            };
        });

        const updatedGridSelections = Object.entries(state.gridSelections || {}).reduce((acc, [lineId, lineSelection]) => {
            const lineData = catalogData[lineId];
            const nextItems = Object.entries(lineSelection.items || {}).reduce((itemsAcc, [key, item]) => {
                const currentDiscount = Number.isFinite(item.discountPct) ? item.discountPct : 0;
                itemsAcc[key] = shouldFollowGlobal(currentDiscount)
                    ? { ...item, discountPct: nextGlobalDiscount }
                    : item;
                return itemsAcc;
            }, {});

            const nextAddons = Object.entries(lineSelection.addons || {}).reduce((addonsAcc, [addonId, addon]) => {
                const addonDef = (lineData?.addonCategories || [])
                    .flatMap((category) => category.items || [])
                    .find((item) => item.id === addonId);
                if (addonDef?.autoScale) {
                    addonsAcc[addonId] = addon;
                    return addonsAcc;
                }
                const currentDiscount = Number.isFinite(addon.discountPct) ? addon.discountPct : 0;
                addonsAcc[addonId] = shouldFollowGlobal(currentDiscount)
                    ? { ...addon, discountPct: nextGlobalDiscount }
                    : addon;
                return addonsAcc;
            }, {});

            acc[lineId] = applyGlobalDiscountToLineSelection(lineData, {
                ...lineSelection,
                items: nextItems,
                addons: nextAddons
            }, nextGlobalDiscount);
            return acc;
        }, {});

        dispatch({ type: 'SET_BUILDER_ITEMS', payload: updatedBuilderItems });
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: updatedGridSelections });
        dispatch({ type: 'SET_GLOBAL_DISCOUNT', payload: nextGlobalDiscount });
    };

    const handleExchangeRateChange = (e) => {
        dispatch({ type: 'SET_EXCHANGE_RATE', payload: parseFloat(e.target.value) || 0 });
    };

    return (
        <div className="max-w-[1200px] mx-auto animate-fade-in pb-24">
            <div className="mb-8">
                <h2 className="text-2xl font-bold m-0 text-text-primary">Priser & Rabatter</h2>
                <p className="text-text-secondary text-sm mt-1">
                    Granska priser och applicera rabatter. Alla priser visas i <span className="text-text-primary font-bold">SEK</span>.
                </p>
            </div>

            <PricingTable />

            <CustomCosts />

            <div className={`grid grid-cols-1 ${canViewEverything ? 'md:grid-cols-2' : ''} gap-6 mt-8`}>
                <div className="bg-panel-bg border border-panel-border rounded-lg p-6 shadow-sm">
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Övergripande Offertrabatt (%)</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={globalDiscountPct}
                            onChange={handleGlobalDiscountChange}
                            className="flex-1 accent-primary"
                        />
                        <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            value={globalDiscountPct}
                            onChange={handleGlobalDiscountChange}
                            className="w-20 bg-input-bg border border-panel-border text-text-primary p-2 rounded-md font-bold text-center outline-none focus:border-primary"
                        />
                    </div>
                    <p className="text-[10px] text-text-secondary mt-2 italic">
                        * Ändrar snabbt alla rader som följer standardrabatten. Manuellt justerade rader behåller sitt värde.
                    </p>
                </div>

                {canViewEverything && (
                    <div className="bg-panel-bg border border-panel-border rounded-lg p-6 shadow-sm">
                        <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Växelkurs (EUR → SEK)</label>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 text-2xl font-black text-text-secondary flex items-center gap-2">
                                1.00 <span className="text-xs font-normal">EUR</span>
                                <span className="text-primary">=</span>
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                value={exchangeRate}
                                onChange={handleExchangeRateChange}
                                className="w-32 bg-input-bg border border-panel-border text-text-primary p-3 rounded-lg font-black text-xl text-center outline-none focus:border-primary shadow-inner"
                            />
                            <div className="text-xs font-normal text-text-secondary uppercase">SEK</div>
                        </div>
                    </div>
                )}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-panel-bg/80 backdrop-blur-md border-t border-panel-border p-4 z-50">
                <div className="max-w-[1200px] mx-auto flex justify-between items-center">
                    <button
                        onClick={onPrev}
                        className="px-6 py-2.5 rounded-md font-medium text-text-primary bg-panel-bg border border-panel-border hover:bg-panel-border transition-colors flex items-center gap-2"
                    >
                        &laquo; Tillbaka till Konfiguration
                    </button>
                    <button
                        onClick={onNext}
                        className="px-8 py-2.5 rounded-md font-bold text-base bg-primary hover:bg-primary-hover text-white scale-105 shadow-lg shadow-primary-hover/30 transition-all flex items-center gap-2"
                    >
                        Granska Offert &raquo;
                    </button>
                </div>
            </div>
        </div>
    );
}
