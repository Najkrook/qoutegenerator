import React from 'react';
import type { InventoryData } from '../../types/contracts';
import { CLICKITUP_ACCESSORIES, getClickitupCountKey } from '../../services/clickitupInventory';
import { StockQuantityControl } from './StockQuantityControl';

interface ClickitupAccessoryStockProps {
    inventoryData: InventoryData;
    cloudInventoryData: InventoryData;
    onSetStock: (id: string, value: number) => void;
    onToggleCounted: (id: string) => void;
}

const GROUPS = [
    { title: 'Stickfötter', subgroups: ['Standard', '+30', '+60'] },
    { title: 'Gångjärn', subgroups: ['Gångjärn'] },
    { title: 'Stolpe och smådelar', subgroups: ['Stolpe och smådelar'] }
] as const;

export function ClickitupAccessoryStock({ inventoryData, cloudInventoryData, onSetStock, onToggleCounted }: ClickitupAccessoryStockProps) {
    return (
        <div className="space-y-5">
            <div>
                <h3 className="m-0 text-lg font-semibold text-slate-50">ClickitUp tillbehör</h3>
                <p className="m-0 mt-1 text-sm text-slate-400">Skriv det uppmätta antalet direkt eller justera ett steg i taget.</p>
            </div>
            {GROUPS.map((group) => (
                <section key={group.title} aria-label={group.title} className="rounded-xl border border-white/10 bg-[#131b21] p-3 sm:p-4">
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <h4 className="m-0 text-base font-bold text-slate-50">{group.title}</h4>
                        <span className="text-xs text-slate-400">{group.subgroups.reduce((sum, subgroup) => sum + CLICKITUP_ACCESSORIES.filter((item) => item.group === subgroup).length, 0)} varianter</span>
                    </div>
                    <div className="space-y-5">
                        {group.subgroups.map((subgroup) => (
                            <div key={subgroup}>
                                {group.title === 'Stickfötter' ? <h5 className="m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-[#e8e1d4]">{subgroup}</h5> : null}
                                <div className="space-y-2">
                                    {CLICKITUP_ACCESSORIES.filter((item) => item.group === subgroup).map((item) => {
                                        const value = inventoryData.clickitupAccessories?.[item.id] || 0;
                                        const delta = value - (cloudInventoryData.clickitupAccessories?.[item.id] || 0);
                                        const counted = inventoryData.clickitupCounted?.[getClickitupCountKey('accessory', item.id)] === true;
                                        const label = group.title === 'Stickfötter' ? `${subgroup} ${item.label}` : item.label;
                                        return (
                                            <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-white/[0.07] bg-[#19242b] p-3 md:flex-row md:items-center md:justify-between">
                                                <div className="min-w-0">
                                                    <p className="m-0 text-sm font-semibold text-slate-100">{item.label}</p>
                                                    <p className={`m-0 mt-0.5 text-xs ${counted ? 'text-emerald-300' : 'text-slate-400'}`}>{counted ? 'Räknad' : 'Återstår'}</p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                    <div>
                                                        <StockQuantityControl label={label} value={value} onSet={(next) => onSetStock(item.id, next)} />
                                                        {delta !== 0 ? <p className={`m-0 mt-1 text-xs font-semibold ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>Osparat {delta > 0 ? `+${delta}` : delta}</p> : null}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-pressed={counted}
                                                        aria-label={`${label}: ${counted ? 'räknad' : 'ej räknad'}`}
                                                        onClick={() => onToggleCounted(item.id)}
                                                        className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8e1d4] ${counted
                                                            ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                                                            : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                                                    >
                                                        {counted ? '✓ Räknad' : 'Markera räknad'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
