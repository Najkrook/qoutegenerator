import React from 'react';
import { useQuote } from '../../store/QuoteContext';

export function CustomCosts() {
    const { state, dispatch } = useQuote();
    const { customCosts } = state;

    const addCost = () => {
        const newCost = { description: '', price: 0, qty: 1 };
        dispatch({ type: 'SET_CUSTOM_COSTS', payload: [...customCosts, newCost] });
    };

    const updateCost = (index, updates) => {
        const newCosts = customCosts.map((c, i) => i === index ? { ...c, ...updates } : c);
        dispatch({ type: 'SET_CUSTOM_COSTS', payload: newCosts });
    };

    const removeCost = (index) => {
        dispatch({ type: 'SET_CUSTOM_COSTS', payload: customCosts.filter((_, i) => i !== index) });
    };

    return (
        <div className="bg-panel-bg border border-panel-border rounded-lg p-6 mt-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold m-0 flex items-center gap-2">
                    <span className="bg-secondary/20 text-secondary p-1 rounded text-xs">Extra</span>
                    Övriga Kostnader
                </h3>
                <button
                    onClick={addCost}
                    className="bg-secondary/20 text-secondary border border-secondary/30 text-xs px-4 py-2 rounded-md font-bold hover:bg-secondary/30 transition-colors"
                >
                    + Lägg till Post
                </button>
            </div>

            <div className="space-y-4">
                {customCosts.length === 0 ? (
                    <p className="text-center text-text-secondary text-sm italic py-4 opacity-50">Inga övriga kostnader tillagda.</p>
                ) : (
                    customCosts.map((cost, idx) => (
                        <div key={idx} className="grid grid-cols-[auto_1fr_150px_100px_auto] items-end gap-4 animate-slide-in">
                            <div className="text-text-secondary pb-3 cursor-grab">≡</div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">Beskrivning</label>
                                <input
                                    type="text"
                                    value={cost.description}
                                    onChange={(e) => updateCost(idx, { description: e.target.value })}
                                    placeholder="T.ex. Frakt, Montering..."
                                    className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md text-sm outline-none focus:border-secondary"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">Pris (SEK)</label>
                                <input
                                    type="number"
                                    value={cost.price}
                                    onChange={(e) => updateCost(idx, { price: parseFloat(e.target.value) || 0 })}
                                    className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md text-sm outline-none focus:border-secondary text-right"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-text-secondary uppercase">Antal</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={cost.qty}
                                    onChange={(e) => updateCost(idx, { qty: parseInt(e.target.value) || 1 })}
                                    className="bg-input-bg border border-panel-border text-text-primary p-2 rounded-md text-sm outline-none focus:border-secondary text-center"
                                />
                            </div>
                            <button
                                onClick={() => removeCost(idx)}
                                className="bg-danger/10 text-danger border border-danger/20 p-2 rounded-md hover:bg-danger/20 transition-colors h-[38px] w-[38px] flex items-center justify-center font-bold"
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
