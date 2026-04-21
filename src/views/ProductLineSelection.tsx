import React, { useEffect } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { getCatalogLineIds, getCatalogLineName } from '../data/catalogLookup';
import type { ProductLineSelectionProps, RetailerRecord } from '../types/contracts';

export interface ProductLineOption {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    retailerDiscountPct: number | null;
    restrictionMessage: string;
}

function getProductLineDescription(lineId: string): string {
    if (lineId === 'BaHaMa') {
        return 'Premiumparasoller';
    }

    if (lineId === 'ClickitUp') {
        return 'Höj- och sänkbara glaspartier.';
    }

    return 'Premium biogas';
}

export function buildProductLineOptions(
    isRetailer: boolean,
    retailer: RetailerRecord | null
): ProductLineOption[] {
    return getCatalogLineIds().map((lineId) => {
        const retailerConfig = retailer?.productLines?.[lineId];
        const enabled = !isRetailer || retailerConfig?.enabled === true;

        return {
            id: lineId,
            name: getCatalogLineName(lineId) || lineId,
            description: getProductLineDescription(lineId),
            enabled,
            retailerDiscountPct: enabled && isRetailer ? (Number(retailerConfig?.discountPct) || 0) : null,
            restrictionMessage: enabled ? '' : 'Ingår inte i ert retailer-avtal.'
        };
    });
}

export function getFirstEnabledProductLineId(productLines: ProductLineOption[]): string | null {
    return productLines.find((line) => line.enabled)?.id || null;
}

export function ProductLineSelection({ onNext }: ProductLineSelectionProps) {
    const { state, dispatch } = useQuote();
    const { isRetailer, retailer } = useAuth();
    const { selectedLines } = state;
    const productLines = buildProductLineOptions(isRetailer, retailer);
    const selectedLineId = selectedLines[0] || '';
    const selectedLine = productLines.find((line) => line.id === selectedLineId) || null;
    const nextRetailerDiscount = selectedLine?.retailerDiscountPct ?? 0;

    const toggleLine = (lineId: string): void => {
        if (isRetailer) {
            const selectedRetailerLine = productLines.find((line) => line.id === lineId);
            if (!selectedRetailerLine?.enabled) {
                return;
            }

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
            const selectedRetailerId = selectedLines[0];
            const lineConfig = retailer.productLines?.[selectedRetailerId];
            if (lineConfig) {
                const discountPct = Number(lineConfig.discountPct) || 0;
                dispatch({ type: 'SET_GLOBAL_DISCOUNT', payload: discountPct });
            }
        }

        onNext();
    };

    useEffect(() => {
        if (!isRetailer) {
            return;
        }

        const firstEnabledLineId = getFirstEnabledProductLineId(productLines);
        if (!firstEnabledLineId) {
            if (selectedLines.length > 0) {
                dispatch({ type: 'SET_SELECTED_LINES', payload: [] });
            }
            return;
        }

        const hasValidSelection = selectedLines.length === 1 && productLines.some((line) => (
            line.id === selectedLines[0] && line.enabled
        ));

        if (!hasValidSelection) {
            dispatch({ type: 'SET_SELECTED_LINES', payload: [firstEnabledLineId] });
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

            {isRetailer && (
                <div className="mb-8 rounded-xl border border-panel-border bg-panel-bg p-6 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                                Retailer Scope
                            </p>
                            <h3 className="mt-2 text-xl font-semibold text-text-primary">
                                {retailer?.name || 'Er retailerprofil'}
                            </h3>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
                                Du ser hela katalogen här, men kan bara välja de produktlinjer som ingår i ert avtal.
                                När du fortsätter appliceras linjens avtalade standardrabatt automatiskt i prissteget.
                            </p>
                        </div>

                        {selectedLine && (
                            <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-text-primary">
                                <div className="font-semibold">{selectedLine.name}</div>
                                <div className="mt-1 text-text-secondary">
                                    Förhandsvisning: {nextRetailerDiscount}% retailer-rabatt
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {productLines.map((line) => {
                    const isSelected = selectedLines.includes(line.id);
                    const disabled = isRetailer && !line.enabled;

                    return (
                        <label
                            key={line.id}
                            className={`flex items-start gap-4 p-6 border rounded-lg bg-panel-bg transition-all ${
                                disabled
                                    ? 'cursor-not-allowed border-panel-border opacity-55'
                                    : isSelected
                                        ? 'cursor-pointer border-primary ring-1 ring-primary hover:-translate-y-0.5'
                                        : 'cursor-pointer border-panel-border hover:-translate-y-0.5 hover:border-primary'
                            }`}
                        >
                            <input
                                type={isRetailer ? 'radio' : 'checkbox'}
                                name={isRetailer ? 'productLine' : line.id}
                                checked={isSelected}
                                disabled={disabled}
                                onChange={() => toggleLine(line.id)}
                                className={`mt-1 w-5 h-5 accent-primary ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-semibold text-text-primary mb-0 mt-0">{line.name}</h3>
                                    {line.retailerDiscountPct !== null && (
                                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                                            {line.retailerDiscountPct}% rabatt
                                        </span>
                                    )}
                                    {disabled && (
                                        <span className="rounded-full border border-panel-border bg-black/15 px-2.5 py-0.5 text-[11px] font-bold text-text-secondary">
                                            Ej tillgänglig
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-text-secondary leading-relaxed mt-2 mb-0">{line.description}</p>
                                {disabled && (
                                    <p className="mt-2 mb-0 text-xs font-medium text-text-secondary">
                                        {line.restrictionMessage}
                                    </p>
                                )}
                            </div>
                        </label>
                    );
                })}
            </div>

            {isRetailer && selectedLine && (
                <div className="mb-8 rounded-xl border border-panel-border bg-panel-bg p-5 text-sm text-text-secondary">
                    Vald linje: <span className="font-semibold text-text-primary">{selectedLine.name}</span>. När du går
                    vidare används <span className="font-semibold text-text-primary">{nextRetailerDiscount}%</span> som
                    standardrabatt i prissteget.
                </div>
            )}

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
