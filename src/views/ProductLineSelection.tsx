import React, { useEffect } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import type { ProductLineSelectionProps } from '../types/contracts';

interface ProductLineOption {
    id: string;
    name: string;
    description: string;
}

export function ProductLineSelection({ onNext }: ProductLineSelectionProps) {
    const { state, dispatch } = useQuote();
    const { isRetailer, retailer } = useAuth();
    const { selectedLines } = state;

    const toggleLine = (lineId: string): void => {
        if (isRetailer) {
            dispatch({ type: 'SET_SELECTED_LINES', payload: [lineId] });
            return;
        }

        let nextSelection: string[];
        if (selectedLines.includes(lineId)) {
            nextSelection = selectedLines.filter((id) => id !== lineId);
        } else {
            nextSelection = [...selectedLines, lineId];
        }

        dispatch({ type: 'SET_SELECTED_LINES', payload: nextSelection });
    };

    const handleNext = (): void => {
        if (isRetailer && selectedLines.length === 1 && retailer) {
            const selectedLineId = selectedLines[0];
            const lineConfig = retailer.productLines?.[selectedLineId];
            if (lineConfig) {
                const discountPct = Number(lineConfig.discountPct) || 0;
                dispatch({ type: 'SET_GLOBAL_DISCOUNT', payload: discountPct });
            }
        }

        onNext();
    };

    const productLines: ProductLineOption[] = Object.keys(catalogData)
        .filter((key) => {
            if (!isRetailer) return true;
            return retailer?.productLines?.[key]?.enabled === true;
        })
        .map((key) => ({
            id: key,
            name: catalogData[key].name,
            description: key === 'BaHaMa'
                ? 'Premiumparasoller'
                : key === 'ClickitUp'
                    ? 'Höj- och sänkbara glaspartier.'
                    : 'Premium biogas'
        }));

    useEffect(() => {
        if (isRetailer && productLines.length > 0) {
            const hasValidSelection = selectedLines.length === 1 && productLines.some((line) => line.id === selectedLines[0]);
            if (!hasValidSelection) {
                dispatch({ type: 'SET_SELECTED_LINES', payload: [productLines[0].id] });
            }
        }
    }, [dispatch, isRetailer, productLines, selectedLines]);

    return (
        <div className="max-w-[1200px] mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold m-0 text-text-primary">Välj Produktlinje</h2>
                <button
                    type="button"
                    className="bg-panel-bg text-text-primary text-xs px-3 py-1.5 rounded border border-panel-border hover:bg-panel-border transition-colors"
                >
                    + Uppdatera Prislista
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {productLines.map((line) => (
                    <label
                        key={line.id}
                        className={`flex items-start gap-4 p-6 border rounded-lg bg-panel-bg cursor-pointer transition-all hover:-translate-y-0.5 ${selectedLines.includes(line.id) ? 'border-primary ring-1 ring-primary' : 'border-panel-border hover:border-primary'}`}
                    >
                        <input
                            type={isRetailer ? 'radio' : 'checkbox'}
                            name={isRetailer ? 'productLine' : line.id}
                            checked={selectedLines.includes(line.id)}
                            onChange={() => toggleLine(line.id)}
                            className="mt-1 w-5 h-5 accent-primary cursor-pointer"
                        />
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary mb-1 mt-0">{line.name}</h3>
                            <p className="text-sm text-text-secondary leading-relaxed m-0">{line.description}</p>
                        </div>
                    </label>
                ))}
            </div>

            <div className="flex justify-end mt-8 border-t border-panel-border pt-6">
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={selectedLines.length === 0}
                    className={`px-8 py-3 rounded-md font-medium text-base transition-colors shadow shadow-primary/20 ${selectedLines.length === 0
                        ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                        : 'bg-primary hover:bg-primary-hover text-white cursor-pointer'
                    }`}
                >
                    Fortsätt till Offertskapande &raquo;
                </button>
            </div>
        </div>
    );
}
