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

const fieldAccent: Record<ClickitupFieldKey, string> = {
    sektion: 'bg-emerald-400',
    dorr_h: 'bg-amber-400',
    dorr_v: 'bg-amber-400',
    hane_h: 'bg-sky-400',
    hane_v: 'bg-sky-400'
};

function CountedButton({ counted, onClick, label, compact = false }: { counted: boolean; onClick: () => void; label: string; compact?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={counted}
            aria-label={`${label}: ${counted ? 'räknad' : 'ej räknad'}`}
            className={`${compact
                ? 'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-xs'
                : 'min-h-11 rounded-lg px-3 py-2 text-sm'} border font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8e1d4] ${counted
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : 'border-white/15 bg-white/[0.04] text-slate-300 hover:border-white/30 hover:bg-white/10'}`}
        >
            {compact ? (
                <>
                    <span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded border text-[11px] ${counted ? 'border-emerald-300 bg-emerald-400 text-[#0d1715]' : 'border-slate-500'}`}>{counted ? '✓' : ''}</span>
                    {counted ? 'Räknad' : 'Markera'}
                </>
            ) : counted ? '✓ Räknad' : 'Markera räknad'}
        </button>
    );
}

export function ClickitupStockGrid({ inventoryData, cloudInventoryData, onSetStock, onToggleCounted }: ClickitupStockGridProps) {
    const stock = inventoryData.clickitup || {};
    const saved = cloudInventoryData.clickitup || {};

    const fieldControl = (size: string, field: typeof CLICKITUP_FIELDS[number], compact = false) => {
        const value = stock[size]?.[field.key] || 0;
        const delta = value - (saved[size]?.[field.key] || 0);
        return (
            <div className="flex min-w-0 flex-col items-start gap-1">
                <StockQuantityControl
                    label={`${field.label} ${size}`}
                    value={value}
                    onSet={(next) => onSetStock(size, field.key, next)}
                    showSix={compact}
                    compact={compact}
                    pendingDelta={compact ? delta : 0}
                />
                {delta !== 0 && !compact ? <span className={`text-xs font-semibold ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>Osparat {delta > 0 ? `+${delta}` : delta}</span> : null}
            </div>
        );
    };

    return (
        <div>
            <div className="mb-4">
                <h3 className="m-0 text-lg font-semibold text-slate-50">Sektioner och dörrar</h3>
                <p className="m-0 mt-1 text-sm text-slate-400">Räkna alla fem delarna för en storlek och markera sedan storleken som räknad.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:hidden">
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

            <div className="hidden min-[1700px]:block">
                <table className="w-full table-fixed border-collapse text-left">
                    <colgroup>
                        <col className="w-[104px]" />
                        {CLICKITUP_FIELDS.map((field) => <col key={field.key} />)}
                        <col className="w-[116px]" />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-white/15 bg-white/[0.025] text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            <th className="px-3 py-3">Storlek</th>
                            {CLICKITUP_FIELDS.map((field) => <th key={field.key} className="px-2 py-3"><span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${fieldAccent[field.key]}`} />{field.label}</span></th>)}
                            <th className="px-2 py-3">Räknad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CLICKITUP_SIZES.map((size) => {
                            const counted = inventoryData.clickitupCounted?.[getClickitupCountKey('size', size)] === true;
                            return (
                                <tr key={size} className="border-b border-white/[0.08] transition-colors hover:bg-white/[0.035]">
                                    <th scope="row" className={`border-l-2 px-3 py-2 text-sm font-semibold tabular-nums text-slate-100 ${counted ? 'border-emerald-400' : 'border-transparent'}`}>{size}</th>
                                    {CLICKITUP_FIELDS.map((field) => <td key={field.key} className="px-2 py-2">{fieldControl(size, field, true)}</td>)}
                                    <td className="px-2 py-2"><CountedButton compact counted={counted} label={`Storlek ${size}`} onClick={() => onToggleCounted('size', size)} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
