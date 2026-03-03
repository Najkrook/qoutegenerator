import React from 'react';

export function SketchBom({ counts, totalGlassLength, slimlineCount, stodbenCount, onExport, onExportPdf }) {
    const sortedKeys = Object.keys(counts).sort((a, b) => {
        if (String(a).includes('Dörr')) return -1;
        if (String(b).includes('Dörr')) return 1;
        return parseFloat(b) - parseFloat(a);
    });

    return (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-5">
            <h3 className="text-lg font-semibold text-text-primary m-0 mb-4">📋 Materialförteckning</h3>

            <ul className="list-none p-0 m-0 space-y-0">
                {sortedKeys.map(size => {
                    const isDoor = String(size).includes('Dörr');
                    return (
                        <li key={size} className="py-2.5 border-b border-panel-border flex justify-between items-center text-sm">
                            <span className="text-text-primary">
                                {isDoor ? size : <>ClickitUP Sektion <b>{size}</b> mm</>}
                            </span>
                            <span className="font-bold text-text-primary">{counts[size]} st</span>
                        </li>
                    );
                })}

                {slimlineCount > 0 && (
                    <li className="py-2.5 border-b border-dashed border-panel-border flex justify-between items-center text-sm text-text-secondary">
                        <span>Slimline (stöd för dörr)</span>
                        <span className="font-bold">{slimlineCount} st</span>
                    </li>
                )}

                {stodbenCount > 0 && (
                    <li className="py-2.5 border-b border-dashed border-panel-border flex justify-between items-center text-sm text-text-secondary">
                        <span>Stödben 45° (för fri ände)</span>
                        <span className="font-bold">{stodbenCount} st</span>
                    </li>
                )}
            </ul>

            {sortedKeys.length === 0 && (
                <p className="text-text-secondary text-center text-sm py-4 m-0 italic">Inga sektioner beräknade.</p>
            )}

            <div className="mt-4 text-right text-base">
                Total längd glas: <b>{(totalGlassLength / 1000).toLocaleString('sv-SE', { minimumFractionDigits: 1 })} löpmeter</b>
            </div>

            <div className="mt-5 flex flex-col gap-3">
                <button
                    onClick={onExport}
                    disabled={sortedKeys.length === 0}
                    className="w-full py-3 bg-primary text-white border-none rounded-lg font-semibold cursor-pointer hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    Exportera till Offert
                </button>
                <button
                    onClick={onExportPdf}
                    disabled={sortedKeys.length === 0}
                    className="w-full py-2.5 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    📄 Ladda ner PDF
                </button>
            </div>
        </div>
    );
}
