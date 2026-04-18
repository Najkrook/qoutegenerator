import { useCallback, useEffect } from 'react';
import { useQuote } from '../../store/QuoteContext';
import { getBuilderCatalogLine } from '../../data/catalogLookup';
import type { BuilderCatalogLineData, BuilderConfigProps, BuilderItem as QuoteBuilderItem } from '../../types/contracts';
import { BuilderItem } from './BuilderItem';

function createBuilderItemId(): string {
    return Math.random().toString(36).slice(2, 11);
}

function getBuilderLine(lineId: string): BuilderCatalogLineData | null {
    return getBuilderCatalogLine(lineId);
}

function createDefaultBuilderItem(
    lineData: BuilderCatalogLineData,
    lineId: string,
    globalDiscountPct: number
): QuoteBuilderItem {
    const modelIds = Object.keys(lineData.models);
    const defaultModel = modelIds[0];
    const sizeIds = Object.keys(lineData.models[defaultModel]?.sizes || {});
    const defaultSize = sizeIds[0] || '';

    return {
        id: createBuilderItemId(),
        line: lineId,
        model: defaultModel,
        size: defaultSize,
        qty: 1,
        addons: [],
        discountPct: globalDiscountPct
    };
}

export function BuilderConfig(_props: BuilderConfigProps) {
    const { state, dispatch } = useQuote();
    const { builderItems, selectedLines, globalDiscountPct } = state;

    const builderLines = selectedLines.filter((lineId) => getBuilderLine(lineId) !== null);

    const addNewItem = useCallback(() => {
        if (builderLines.length === 0) return;
        const defaultLine = builderLines[0];
        const lineData = getBuilderLine(defaultLine);
        if (!lineData) return;

        const newItem = createDefaultBuilderItem(lineData, defaultLine, globalDiscountPct);
        dispatch({ type: 'SET_BUILDER_ITEMS', payload: [...builderItems, newItem] });
    }, [builderLines, builderItems, globalDiscountPct, dispatch]);

    useEffect(() => {
        if (builderItems.length > 0 || builderLines.length === 0) {
            return;
        }

        const defaultLine = builderLines[0];
        const lineData = getBuilderLine(defaultLine);
        if (!lineData) {
            return;
        }

        const newItem = createDefaultBuilderItem(lineData, defaultLine, globalDiscountPct);
        dispatch({ type: 'SET_BUILDER_ITEMS', payload: [newItem] });
    }, [builderItems.length, builderLines, globalDiscountPct, dispatch]);

    const removeItem = (id: string) => {
        dispatch({
            type: 'SET_BUILDER_ITEMS',
            payload: builderItems.filter((item) => item.id !== id)
        });
    };

    if (builderLines.length === 0) return null;

    return (
        <div className="space-y-6">
            {builderItems.length === 0 ? (
                <div className="bg-panel-bg border-2 border-dashed border-panel-border rounded-xl p-12 text-center flex flex-col items-center justify-center animate-fade-in">
                    <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-4">
                        <span className="text-2xl">P</span>
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
