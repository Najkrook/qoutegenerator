import React, { type ChangeEvent } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import { getCatalogLineName } from '../data/catalogLookup';
import { PricingTable } from '../components/features/PricingTable';
import { CustomCosts } from '../components/features/CustomCosts';
import { ContractingWorkPricing } from '../components/features/ContractingWorkPricing';
import { MarginSummaryPanel } from '../components/features/MarginSummaryPanel';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import { computeQuoteTotals } from '../services/calculationEngine';
import { hasConfiguredQuoteSelections } from '../navigation/routes';
import {
    applyGlobalDiscountToGridCustomAddons,
    applyGlobalDiscountToGridCustomItems,
    applyGlobalDiscountToLineSelection
} from '../utils/gridAutoScale';
import type {
    GridCatalogAddonOption,
    GridCatalogLineData,
    PricingGridAddonsMap,
    PricingGridItemsMap,
    PricingProps
} from '../types/contracts';

function parseDiscount(value: string): number {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, parsed));
}

export function clampRetailerDiscount(value: number, maxDiscount: number): number {
    return Math.max(0, Math.min(maxDiscount, value));
}

export function getNextGlobalDiscount(value: string, isRetailer: boolean, retailerDiscountPct: number): number {
    const parsedDiscount = parseDiscount(value);
    return isRetailer
        ? clampRetailerDiscount(parsedDiscount, retailerDiscountPct)
        : parsedDiscount;
}

function nearlyEqual(left: number, right: number): boolean {
    return Math.abs(left - right) < 0.0001;
}

function findGridAddonDefinition(
    lineData: GridCatalogLineData | null,
    addonId: string
): GridCatalogAddonOption | null {
    if (!lineData) {
        return null;
    }

    for (const category of lineData.addonCategories || []) {
        const match = (category.items || []).find((item) => item.id === addonId);
        if (match) {
            return match;
        }
    }

    return null;
}

export function Pricing({ onNext, onPrev }: PricingProps) {
    const { state, dispatch } = useQuote();
    const { canViewEverything, isRetailer, retailer } = useAuth();
    const { globalDiscountPct, exchangeRate, prevGlobalDiscountPct, selectedLines } = state;
    const selectedLineId = selectedLines[0] || '';
    const hasProductContent = hasConfiguredQuoteSelections(state);
    const showContractingWork = !isRetailer && state.contractingWork?.enabled === true;
    const selectedLineName = selectedLineId ? (getCatalogLineName(selectedLineId) || selectedLineId) : 'Ingen vald produktlinje';
    const retailerDiscountPct = isRetailer
        ? (Number(retailer?.productLines?.[selectedLineId]?.discountPct) || 0)
        : 0;
    const globalDiscountMax = isRetailer ? retailerDiscountPct : 100;
    const summaryData = React.useMemo(
        () => computeQuoteTotals({ state, catalogData }),
        [state]
    );

    const handleGlobalDiscountChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const nextGlobalDiscount = getNextGlobalDiscount(event.target.value, isRetailer, retailerDiscountPct);
        const previousGlobalDiscount = Number.isFinite(prevGlobalDiscountPct)
            ? prevGlobalDiscountPct
            : 0;

        const shouldFollowGlobal = (value: number): boolean => {
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
            const gridLineData: GridCatalogLineData | null = lineData?.type === 'grid' ? lineData : null;
            const nextItems = Object.entries(lineSelection.items || {}).reduce<PricingGridItemsMap>((itemsAcc, [key, item]) => {
                const currentDiscount = Number.isFinite(item.discountPct) ? item.discountPct : 0;
                itemsAcc[key] = shouldFollowGlobal(currentDiscount)
                    ? { ...item, discountPct: nextGlobalDiscount }
                    : item;
                return itemsAcc;
            }, {});

            const nextAddons = Object.entries(lineSelection.addons || {}).reduce<PricingGridAddonsMap>((addonsAcc, [addonId, addon]) => {
                const addonDef = findGridAddonDefinition(gridLineData, addonId);
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

            const nextLineSelection = applyGlobalDiscountToGridCustomItems(
                applyGlobalDiscountToGridCustomAddons(
                    {
                        ...lineSelection,
                        items: nextItems,
                        addons: nextAddons
                    },
                    previousGlobalDiscount,
                    nextGlobalDiscount
                ),
                previousGlobalDiscount,
                nextGlobalDiscount
            );

            acc[lineId] = applyGlobalDiscountToLineSelection(
                gridLineData || undefined,
                {
                    ...nextLineSelection,
                    items: nextItems,
                    addons: nextAddons
                },
                nextGlobalDiscount
            ) as typeof lineSelection;
            return acc;
        }, {} as typeof state.gridSelections);

        dispatch({ type: 'SET_BUILDER_ITEMS', payload: updatedBuilderItems });
        dispatch({ type: 'SET_GRID_SELECTIONS', payload: updatedGridSelections });
        dispatch({ type: 'SET_GLOBAL_DISCOUNT', payload: nextGlobalDiscount });
    };

    const handleExchangeRateChange = (event: ChangeEvent<HTMLInputElement>): void => {
        dispatch({ type: 'SET_EXCHANGE_RATE', payload: Number.parseFloat(event.target.value) || 0 });
    };

    return (
        <div className="mx-auto max-w-[1200px] animate-fade-in pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-24">
            <PageHeader
                eyebrow="Steg 3 av 4"
                title="Priser och rabatter"
                description={(
                    <>
                    {hasProductContent
                        ? 'Granska produktpriser och applicera rabatter.'
                        : 'Prissätt offertens entreprenadarbeten.'}{' '}
                    Alla priser visas i <strong className="text-text">SEK</strong>.
                    </>
                )}
            />

            {hasProductContent ? (
                <div className="mt-6">
                    {isRetailer && (
                        <Panel className="mb-6">
                            <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-text-muted">
                                        Återförsäljarprissättning
                                    </p>
                                    <h2 className="mb-0 mt-2 text-xl font-semibold text-text">
                                        Vald produktlinje: {selectedLineName}
                                    </h2>
                                    <p className="mb-0 mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
                                        Den övergripande offertrabatten kan justeras mellan 0 och {retailerDiscountPct}%.
                                        Radrabatter kan också justeras inom samma spann, medan Övriga kostnader kan läggas till vid behov.
                                    </p>
                                </div>

                                <div className="rounded-panel border border-success-border bg-success-bg px-4 py-3 text-sm">
                                    <div className="text-success-text">Avtalad återförsäljarrabatt</div>
                                    <div className="mt-2"><StatusChip tone="success">{retailerDiscountPct}% max</StatusChip></div>
                                </div>
                            </div>
                        </Panel>
                    )}

                    <PricingTable />

                    <MarginSummaryPanel summaryData={summaryData} className="mt-6" />

                    <CustomCosts />

                    <div className={`grid grid-cols-1 ${canViewEverything ? 'md:grid-cols-2' : ''} gap-6 mt-8`}>
                        <Panel className={isRetailer ? 'opacity-90' : ''}>
                            <div className="p-6">
                            <label htmlFor="global-discount-range" className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-text-muted">
                                <span>Övergripande offertrabatt (%)</span>
                                {isRetailer && (
                                    <span className="rounded bg-action-soft px-2 py-0.5 text-[10px] tracking-wider text-action-soft-text">
                                        MAX {retailerDiscountPct}%
                                    </span>
                                )}
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    id="global-discount-range"
                                    name="globalDiscountRange"
                                    type="range"
                                    min="0"
                                    max={globalDiscountMax}
                                    step="1"
                                    value={globalDiscountPct}
                                    onChange={handleGlobalDiscountChange}
                                    className="flex-1 accent-action"
                                />
                                <label className="sr-only" htmlFor="global-discount-value">
                                    Övergripande offertrabatt i procent
                                </label>
                                <input
                                    id="global-discount-value"
                                    name="globalDiscountPct"
                                    type="number"
                                    step="1"
                                    min="0"
                                    max={globalDiscountMax}
                                    value={globalDiscountPct}
                                    onChange={handleGlobalDiscountChange}
                                    className="w-20 rounded-control border border-control-border bg-input p-2 text-center font-bold text-text"
                                />
                            </div>
                            <p className="mb-0 mt-2 text-[10px] text-text-muted">
                                {isRetailer
                                    ? `* Rabatt kan sättas mellan 0 och ${retailerDiscountPct}% för ${selectedLineName}, både övergripande och per rad.`
                                    : '* Ändrar snabbt alla rader som följer standardrabatten. Manuellt justerade rader behåller sitt värde.'}
                            </p>
                            </div>
                        </Panel>

                        {canViewEverything && (
                            <Panel>
                                <div className="p-6">
                                <label htmlFor="exchange-rate" className="mb-2 block text-xs font-bold uppercase text-text-muted">
                                    Växelkurs (EUR till SEK)
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-1 items-center gap-2 text-2xl font-black text-text-muted">
                                        1.00 <span className="text-xs font-normal">EUR</span>
                                        <span className="text-action">=</span>
                                    </div>
                                    <input
                                        id="exchange-rate"
                                        name="exchangeRate"
                                        type="number"
                                        step="0.01"
                                        value={exchangeRate}
                                        onChange={handleExchangeRateChange}
                                        className="w-32 rounded-control border border-control-border bg-input p-3 text-center text-xl font-black text-text"
                                    />
                                    <div className="text-xs font-normal uppercase text-text-muted">SEK</div>
                                </div>
                                </div>
                            </Panel>
                        )}
                    </div>
                </div>
            ) : null}

            {showContractingWork ? <ContractingWorkPricing /> : null}

            <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface-raised/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-md">
                <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-2 sm:grid-cols-2 sm:items-center">
                    <Button
                        onClick={onPrev}
                        className="w-full sm:w-auto sm:justify-self-start"
                    >
                        Tillbaka till konfiguration
                    </Button>
                    <Button
                        onClick={() => {
                            window.scrollTo(0, 0);
                            onNext();
                        }}
                        className="w-full sm:w-auto sm:justify-self-end"
                        variant="primary"
                    >
                        Granska offert
                    </Button>
                </div>
            </div>
        </div>
    );
}
