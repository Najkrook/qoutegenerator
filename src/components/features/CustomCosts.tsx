import React, { type ChangeEvent } from 'react';
import { useQuote } from '../../store/QuoteContext';
import type { CustomCostRow } from '../../types/contracts';

export function CustomCosts() {
    const { state, dispatch } = useQuote();
    const { customCosts } = state;

    const addCost = (): void => {
        const nextCost: CustomCostRow = {
            description: '',
            price: 0,
            qty: 1,
            discountPct: 0
        };
        dispatch({ type: 'SET_CUSTOM_COSTS', payload: [...customCosts, nextCost] });
    };

    const updateCost = (index: number, updates: Partial<CustomCostRow>): void => {
        const nextCosts = customCosts.map((cost, rowIndex) => (
            rowIndex === index ? { ...cost, ...updates } : cost
        ));
        dispatch({ type: 'SET_CUSTOM_COSTS', payload: nextCosts });
    };

    const removeCost = (index: number): void => {
        dispatch({
            type: 'SET_CUSTOM_COSTS',
            payload: customCosts.filter((_, rowIndex) => rowIndex !== index)
        });
    };

    return (
        <div className="bg-panel-bg border border-panel-border rounded-lg p-6 mt-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold m-0 flex items-center gap-2">
                    <span className="bg-secondary/20 text-secondary p-1 rounded text-xs">Extra</span>
                    Övriga kostnader
                </h3>
                <button
                    type="button"
                    onClick={addCost}
                    className="bg-secondary/20 text-secondary border border-secondary/30 text-xs px-4 py-2 rounded-md font-bold hover:bg-secondary/30 transition-colors"
                >
                    + Lägg till post
                </button>
            </div>

            <div className="space-y-4">
                {customCosts.length === 0 ? (
                    <p className="text-center text-text-secondary text-sm italic py-4 opacity-50">Inga övriga kostnader tillagda.</p>
                ) : (
                    customCosts.map((cost, index) => (
                        <div key={index} className="grid grid-cols-[auto_1fr_150px_100px_auto] items-end gap-4 animate-slide-in">
                            <div className="text-text-secondary pb-3 cursor-grab" aria-hidden="true">≡</div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">Beskrivning</label>
                                <input
                                    type="text"
                                    value={cost.description}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateCost(index, { description: event.target.value })}
                                    placeholder="T.ex. frakt, montering..."
                                    className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md text-sm outline-none focus:border-secondary"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">Pris (SEK)</label>
                                <input
                                    type="number"
                                    value={cost.price}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateCost(index, { price: Number.parseFloat(event.target.value) || 0 })}
                                    className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md text-sm outline-none focus:border-secondary text-right"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">Antal</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={cost.qty}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateCost(index, { qty: Number.parseInt(event.target.value, 10) || 1 })}
                                    className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md text-sm outline-none focus:border-secondary text-center"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeCost(index)}
                                className="bg-danger/10 text-danger border border-danger/20 p-2 rounded-md hover:bg-danger/20 transition-colors h-[38px] w-[38px] flex items-center justify-center font-bold"
                                aria-label={`Ta bort kostnad ${index + 1}`}
                            >
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
