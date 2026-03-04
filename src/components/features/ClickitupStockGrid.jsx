import React from 'react';

const SIZES = ["700", "1000", "1100", "1200", "1300", "1400", "1500", "1600", "1700", "1800", "1900", "2000", "980 special"];
const FIELDS = [
    { key: "sektion", label: "Sektion", color: "rgba(100, 200, 100, 0.1)" },
    { key: "dorr_h", label: "Dörr H", color: "rgba(255, 150, 100, 0.15)" },
    { key: "dorr_v", label: "Dörr V", color: "rgba(255, 150, 100, 0.15)" },
    { key: "hane_h", label: "Hane H", color: "rgba(100, 150, 255, 0.15)" },
    { key: "hane_v", label: "Hane V", color: "rgba(100, 150, 255, 0.15)" }
];

export function ClickitupStockGrid({ inventoryData, onUpdateStock }) {
    const clickitup = inventoryData.clickitup || {};

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
                <thead>
                    <tr>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase border-b border-panel-border">Storlek</th>
                        {FIELDS.map(f => (
                            <th key={f.key} className="p-3 text-center text-xs font-semibold text-text-secondary uppercase border-b border-panel-border">
                                {f.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {SIZES.map(size => {
                        const dataObj = clickitup[size] || { sektion: 0, dorr_h: 0, dorr_v: 0, hane_h: 0, hane_v: 0 };
                        return (
                            <tr key={size} className="border-b border-panel-border">
                                <td className="p-3 font-bold text-text-primary">{size}</td>
                                {FIELDS.map(f => {
                                    const val = dataObj[f.key] || 0;
                                    return (
                                        <td key={f.key} className="p-2 text-center" style={{ background: f.color }}>
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => onUpdateStock(size, f.key, -6)}
                                                    className="px-1.5 py-0.5 rounded border border-panel-border bg-panel-bg text-text-primary cursor-pointer text-xs hover:bg-white/10"
                                                    aria-label={`Minska ${f.label} ${size} med 6`}
                                                >-6</button>
                                                <button
                                                    onClick={() => onUpdateStock(size, f.key, -1)}
                                                    className="px-2 py-0.5 rounded border border-panel-border bg-panel-bg text-text-primary cursor-pointer hover:bg-white/10"
                                                    aria-label={`Minska ${f.label} ${size} med 1`}
                                                >-</button>
                                                <span className={`min-w-[24px] font-bold text-center ${val > 0 ? 'text-green-400' : 'text-text-primary'}`}>
                                                    {val}
                                                </span>
                                                <button
                                                    onClick={() => onUpdateStock(size, f.key, 1)}
                                                    className="px-2 py-0.5 rounded border border-panel-border bg-panel-bg text-text-primary cursor-pointer hover:bg-white/10"
                                                    aria-label={`Öka ${f.label} ${size} med 1`}
                                                >+</button>
                                                <button
                                                    onClick={() => onUpdateStock(size, f.key, 6)}
                                                    className="px-1.5 py-0.5 rounded border border-panel-border bg-panel-bg text-text-primary cursor-pointer text-xs hover:bg-white/10"
                                                    aria-label={`Öka ${f.label} ${size} med 6`}
                                                >+6</button>
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
