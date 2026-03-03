import React from 'react';
import { useQuote } from '../store/QuoteContext';
import { PricingTable } from '../components/features/PricingTable';
import { CustomCosts } from '../components/features/CustomCosts';

export function Pricing({ onNext, onPrev }) {
    const { state, dispatch } = useQuote();
    const { globalDiscountPct, exchangeRate } = state;

    const handleGlobalDiscountChange = (e) => {
        dispatch({ type: 'SET_GLOBAL_DISCOUNT', payload: parseFloat(e.target.value) || 0 });
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
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
                            value={globalDiscountPct}
                            onChange={handleGlobalDiscountChange}
                            className="w-20 bg-input-bg border border-panel-border text-text-primary p-2 rounded-md font-bold text-center outline-none focus:border-primary"
                        />
                    </div>
                    <p className="text-[10px] text-text-secondary mt-2 italic">* Denna rabatt föreslås för alla nya rader men kan ändras individuellt.</p>
                </div>

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
