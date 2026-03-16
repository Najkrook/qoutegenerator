import React from 'react';

const EDGE_LABELS = {
    front: 'Fram',
    left: 'Vänster',
    right: 'Höger',
    back: 'Bak'
};

export function SketchBom({
    counts,
    totalGlassLength,
    slimlineCount,
    stodbenCount,
    hasInvalidEdges,
    invalidEdges,
    autoAdjustedEdges,
    parasols = [],
    fiestaItems = [],
    parasolWarnings = [],
    canExportToQuote = true,
    onExport,
    onExportImage
}) {
    const keys = Object.keys(counts);
    const doorKeys = keys.filter((key) => String(key).includes('Dörr')).sort((a, b) => Number.parseInt(b, 10) - Number.parseInt(a, 10));
    const sectionKeys = keys
        .filter((key) => !String(key).includes('Dörr'))
        .sort((a, b) => Number.parseFloat(b) - Number.parseFloat(a));

    const sortedKeys = [...doorKeys, ...sectionKeys];

    const parasolCounts = parasols.reduce((acc, p) => {
        acc[p.label] = (acc[p.label] || 0) + 1;
        return acc;
    }, {});
    const parasolKeys = Object.keys(parasolCounts).sort();
    const fiestaCount = fiestaItems.length;

    const hasExportableLayout = sortedKeys.length > 0 || parasols.length > 0 || fiestaCount > 0;
    const exportDisabled = !hasExportableLayout || !canExportToQuote;
    const exportButtonTitle = !canExportToQuote
        ? 'Du har inte behörighet att exportera till offert.'
        : undefined;

    return (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold text-text-primary m-0">📋 Materialförteckning</h3>
                <span
                    className={`text-xs px-2 py-1 rounded-full border ${hasInvalidEdges
                        ? 'border-danger/50 text-danger bg-danger/10'
                        : 'border-success/40 text-success bg-success/10'
                        }`}
                >
                    {hasInvalidEdges ? 'Kräver kontroll' : 'Redo'}
                </span>
            </div>

            {hasInvalidEdges && (
                <div className="mb-4 p-3 rounded-lg border border-danger/40 bg-danger/10 text-danger text-xs">
                    Ogiltig kant: {invalidEdges.map(([edge]) => EDGE_LABELS[edge] || edge).join(', ')}. Export kräver bekräftelse.
                </div>
            )}

            {autoAdjustedEdges.length > 0 && (
                <div className="mb-4 p-3 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-200 text-xs">
                    Autojustering:{' '}
                    {autoAdjustedEdges
                        .map(([edge, diag]) => `${EDGE_LABELS[edge] || edge} ${diag.requestedDoorSize} -> ${diag.resolvedDoorSize} mm`)
                        .join(', ')}
                </div>
            )}

            {parasolWarnings.length > 0 && (
                <div className="mb-4 p-3 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-200 text-xs">
                    <b>Varning (Parasoll):</b> {parasolWarnings.map((warning) => warning.text).join(', ')}
                </div>
            )}

            <ul className="list-none p-0 m-0 space-y-0">
                {sortedKeys.map((size) => {
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

                {parasolKeys.map((label) => (
                    <li key={`parasol-${label}`} className="py-2.5 border-b border-panel-border flex justify-between items-center text-sm">
                        <span className="text-text-primary">
                            Parasoll <b>{label}</b>
                        </span>
                        <span className="font-bold text-text-primary">{parasolCounts[label]} st</span>
                    </li>
                ))}

                {fiestaCount > 0 && (
                    <li className="py-2.5 border-b border-panel-border flex justify-between items-center text-sm">
                        <span className="text-text-primary">
                            Fiesta <b>70 cm</b>
                        </span>
                        <span className="font-bold text-text-primary">{fiestaCount} st</span>
                    </li>
                )}
            </ul>

            {sortedKeys.length === 0 && parasols.length === 0 && fiestaCount === 0 && (
                <p className="text-text-secondary text-center text-sm py-4 m-0 italic">Inga sektioner beräknade.</p>
            )}

            <div className="mt-4 text-right text-base">
                Total längd glas: <b>{(totalGlassLength / 1000).toLocaleString('sv-SE', { minimumFractionDigits: 1 })} löpmeter</b>
            </div>

            <div className="mt-5 flex flex-col gap-3">
                <button
                    onClick={onExport}
                    disabled={exportDisabled}
                    title={exportButtonTitle}
                    className="w-full py-3 bg-primary text-white border-none rounded-lg font-semibold cursor-pointer hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    {!canExportToQuote
                        ? 'Export till Offert ej tillgänglig'
                        : (hasInvalidEdges ? 'Exportera till Offert (bekräfta varningar)' : 'Exportera till Offert')}
                </button>
                <button
                    onClick={onExportImage}
                    disabled={sortedKeys.length === 0 && parasols.length === 0 && fiestaCount === 0}
                    className="w-full py-2.5 border border-panel-border bg-panel-bg text-text-primary rounded-lg cursor-pointer text-sm hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    🖼️ Ladda ner Bild
                </button>
            </div>
        </div>
    );
}
