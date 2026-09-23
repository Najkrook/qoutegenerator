import React from 'react';
import type { ClickitupFieldKey, ClickitupStockGridProps } from '../../types/contracts';
import { CLICKITUP_FIELDS, CLICKITUP_SIZES, getClickitupCountKey } from '../../services/clickitupInventory';
import { StockQuantityControl } from './StockQuantityControl';

const fieldColor: Record<ClickitupFieldKey, string> = {
    sektion: 'bg-emerald-400/[0.07]',
    dorr_h: 'bg-orange-400/[0.07]',
    dorr_v: 'bg-orange-400/[0.07]',
    hane_h: 'bg-blue-400/[0.07]',
    hane_v: 'bg-blue-400/[0.07]'
};

function CountedButton({ counted, onClick, label }: { counted: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={counted}
            aria-label={`${label}: ${counted ? 'räknad' : 'ej räknad'}`}
            className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8e1d4] ${counted
                ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                : 'border-white/20 bg-white/5 text-slate-300 hover:bg-white/10'}`}
        >
            {counted ? '✓ Räknad' : 'Markera räknad'}
        </button>
    );
}

export function ClickitupStockGrid({ inventoryData, cloudInventoryData, onSetStock, onToggleCounted }: ClickitupStockGridProps) {
    const stock = inventoryData.clickitup || {};
    const saved = cloudInventoryData.clickitup || {};

    const fieldControl = (size: string, field: typeof CLICKITUP_FIELDS[number]) => {
        const value = stock[size]?.[field.key] || 0;
        const delta = value - (saved[size]?.[field.key] || 0);
        return (
            <div className="flex flex-col items-start gap-1">
                <StockQuantityControl
                    label={`${field.label} ${size}`}
                    value={value}
                    onSet={(next) => onSetStock(size, field.key, next)}
                    showSix
                />
                {delta !== 0 ? <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>Osparat {delta > 0 ? `+${delta}` : delta}</span> : null}
            </div>
        );
    };

    return (
        <div>
            <div className="mb-4">
                <h3 className="m-0 text-lg font-semibold text-slate-50">Sektioner och dörrar</h3>
                <p className="m-0 mt-1 text-sm text-slate-400">Räkna alla fem delarna för en storlek och markera sedan storleken som räknad.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:hidden">
                {CLICKITUP_SIZES.map((size) => {
                    const counted = inventoryData.clickitupCounted?.[getClickitupCountKey('size', size)] === true;
                    return (
                        <section key={size} aria-label={`Storlek ${size}`} className="rounded-xl border border-white/10 bg-[#172027] p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h4 className="m-0 text-lg font-bold text-slate-50">{size} <span className="text-sm font-normal text-slate-400">mm</span></h4>
                                {counted ? <span className="text-xs font-semibold text-emerald-300">Räknad</span> : <span className="text-xs text-slate-400">Återstår</span>}
                            </div>
                            <div className="space-y-3">
                                {CLICKITUP_FIELDS.map((field) => (
                                    <div key={field.key} className={`rounded-lg p-2.5 ${fieldColor[field.key]}`}>
                                        <p className="m-0 mb-2 text-sm font-medium text-slate-200">{field.label}</p>
                                        {fieldControl(size, field)}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 flex justify-end">
                                <CountedButton counted={counted} label={`Storlek ${size}`} onClick={() => onToggleCounted('size', size)} />
                            </div>
                        </section>
                    );
                })}
            </div>

            <div className="hidden overflow-x-auto 2xl:block">
                <table className="w-full min-w-[1120px] border-collapse text-left">
                    <thead>
                        <tr className="border-b border-white/15 text-xs uppercase text-slate-400">
                            <th className="p-3">Storlek</th>
                            {CLICKITUP_FIELDS.map((field) => <th key={field.key} className="p-3">{field.label}</th>)}
                            <th className="p-3">Inventering</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CLICKITUP_SIZES.map((size) => {
                            const counted = inventoryData.clickitupCounted?.[getClickitupCountKey('size', size)] === true;
                            return (
                                <tr key={size} className="border-b border-white/10 align-top">
                                    <th scope="row" className="p-3 text-sm font-bold text-slate-50">{size}</th>
                                    {CLICKITUP_FIELDS.map((field) => <td key={field.key} className={`p-2 ${fieldColor[field.key]}`}>{fieldControl(size, field)}</td>)}
                                    <td className="p-2"><CountedButton counted={counted} label={`Storlek ${size}`} onClick={() => onToggleCounted('size', size)} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
