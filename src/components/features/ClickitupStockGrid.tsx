import React from 'react';
import type {
    ClickitupFieldKey,
    ClickitupStockEntry,
    ClickitupStockGridProps
} from '../../types/contracts';

const SIZES = ['700', '1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900', '2000', '980 special'];

const FIELDS: Array<{ key: ClickitupFieldKey; label: string; color: string }> = [
    { key: 'sektion', label: 'Sektion', color: 'rgba(100, 200, 100, 0.1)' },
    { key: 'dorr_h', label: 'Dörr H', color: 'rgba(255, 150, 100, 0.15)' },
    { key: 'dorr_v', label: 'Dörr V', color: 'rgba(255, 150, 100, 0.15)' },
    { key: 'hane_h', label: 'Hane H', color: 'rgba(100, 150, 255, 0.15)' },
    { key: 'hane_v', label: 'Hane V', color: 'rgba(100, 150, 255, 0.15)' }
];

const EMPTY_ENTRY: ClickitupStockEntry = {
    sektion: 0,
    dorr_h: 0,
    dorr_v: 0,
    hane_h: 0,
    hane_v: 0
};

export function ClickitupStockGrid({ inventoryData, cloudInventoryData, onUpdateStock }: ClickitupStockGridProps) {
    const clickitup = inventoryData.clickitup || {};
    const cloudClickitup = cloudInventoryData.clickitup || {};

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
                <thead>
                    <tr>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase border-b border-panel-border">Storlek</th>
                        {FIELDS.map((field) => (
                            <th key={field.key} className="p-3 text-center text-xs font-semibold text-text-secondary uppercase border-b border-panel-border">
                                {field.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {SIZES.map((size) => {
                        const dataObj = clickitup[size] || EMPTY_ENTRY;
                        const cloudDataObj = cloudClickitup[size] || EMPTY_ENTRY;
                        return (
                            <tr key={size} className="border-b border-panel-border">
                                <td className="p-3 font-bold text-text-primary">{size}</td>
                                {FIELDS.map((field) => {
                                    const value = dataObj[field.key] || 0;
                                    const cloudValue = cloudDataObj[field.key] || 0;
                                    const delta = value - cloudValue;
                                    return (
                                        <td key={field.key} className="p-2 text-center relative" style={{ background: field.color }}>
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => onUpdateStock(size, field.key, -6)}
                                                    className="px-1.5 py-0.5 rounded border border-panel-border bg-panel-bg text-text-primary cursor-pointer text-xs hover:bg-white/10 transition-colors"
                                                    aria-label={`Minska ${field.label} ${size} med 6`}
                                                >
                                                    -6
                                                </button>
                                                <button
                                                    onClick={() => onUpdateStock(size, field.key, -1)}
                                                    className="px-2 py-0.5 rounded border border-panel-border bg-panel-bg text-text-primary cursor-pointer hover:bg-white/10 transition-colors"
                                                    aria-label={`Minska ${field.label} ${size} med 1`}
                                                >
                                                    -
                                                </button>
                                                <div className="relative group">
                                                    <span className={`min-w-[28px] font-bold text-center block ${value > 0 ? 'text-green-400' : 'text-text-primary'}`}>
                                                        {value}
                                                    </span>
                                                    
                                                    {delta !== 0 && (
                                                        <div 
                                                            className={`absolute -top-5 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded-full text-[8px] font-black border shadow-sm animate-in fade-in zoom-in duration-200 whitespace-nowrap ${
                                                                delta > 0 
                                                                    ? 'bg-green-500/20 text-green-400 border-green-500/40' 
                                                                    : 'bg-red-500/20 text-red-400 border-red-500/40'
                                                            }`}
                                                        >
                                                            {delta > 0 ? `+${delta}` : delta}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => onUpdateStock(size, field.key, 1)}
                                                    className="px-2 py-0.5 rounded border border-panel-border bg-panel-bg text-text-primary cursor-pointer hover:bg-white/10 transition-colors"
                                                    aria-label={`Öka ${field.label} ${size} med 1`}
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => onUpdateStock(size, field.key, 6)}
                                                    className="px-1.5 py-0.5 rounded border border-panel-border bg-panel-bg text-text-primary cursor-pointer text-xs hover:bg-white/10 transition-colors"
                                                    aria-label={`Öka ${field.label} ${size} med 6`}
                                                >
                                                    +6
                                                </button>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
