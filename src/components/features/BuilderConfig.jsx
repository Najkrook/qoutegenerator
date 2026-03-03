import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { catalogData } from '../../data/catalog';
import { BuilderItem } from './BuilderItem';

export function BuilderConfig() {
    const { state, dispatch } = useQuote();
    const { builderItems, selectedLines, globalDiscountPct } = state;

    const builderLines = selectedLines.filter((l) => catalogData[l].type === 'builder');

    const addNewItem = () => {
        const defaultLine = builderLines[0];
        const models = Object.keys(catalogData[defaultLine].models);
        const defaultModel = models[0];
        const sizes = Object.keys(catalogData[defaultLine].models[defaultModel].sizes);
        const defaultSize = sizes[0];

        const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            line: defaultLine,
            model: defaultModel,
            size: defaultSize,
            qty: 1,
            addons: [],
            discountPct: globalDiscountPct
        };

        dispatch({ type: 'SET_BUILDER_ITEMS', payload: [...builderItems, newItem] });
    };

    const removeItem = (id) => {
        dispatch({ type: 'SET_BUILDER_ITEMS', payload: builderItems.filter((i) => i.id !== id) });
    };

    if (builderLines.length === 0) return null;

    return (
        <div className="space-y-6">
            {builderItems.length === 0 ? (
                <div className="bg-panel-bg border-2 border-dashed border-panel-border rounded-xl p-12 text-center flex flex-col items-center justify-center animate-fade-in">
                    <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-4">
                        <span className="text-2xl">📦</span>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Inga produkter valda ännu</h4>
                    <p className="text-text-secondary mb-6 max-w-sm">
                        Klicka på knappen nedan för att välja modell, storlek och tillägg för dina valda produktlinjer.
                    </p>
                    <button
                        onClick={addNewItem}
                        className="bg-primary text-white px-8 py-3 rounded-lg font-black shadow-lg shadow-primary/20 hover:bg-primary-hover hover:-translate-y-1 transition-all flex items-center gap-3 uppercase tracking-wide"
                    >
                        <span className="text-xl leading-none">+</span> Lägg till produkt
                    </button>
                </div>
            ) : (
                <>
                    <div className="space-y-4">
                        {builderItems.map((item, index) => (
                            <BuilderItem
                                key={item.id}
                                item={item}
                                index={index}
                                onRemove={removeItem}
                            />
                        ))}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={addNewItem}
                            className="bg-panel-bg border border-panel-border text-text-primary text-sm px-4 py-2 rounded-md font-bold cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                            <span className="text-lg leading-none">+</span> Lägg till produkt
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

