import React from 'react';

export function StockComparisonModal({ allSections, doorSize, slimlineCount, stodbenCount, clickitupStock, onConfirm, onCancel }) {
    // Build requirements map
    const requirements = {};
    allSections.forEach(item => {
        if (String(item).includes('Dörr')) {
            const key = `Dörr|${doorSize}`;
            requirements[key] = (requirements[key] || 0) + 1;
        } else {
            const key = `Sektion|${item}`;
            requirements[key] = (requirements[key] || 0) + 1;
        }
    });

    const stock = clickitupStock || {};
    let hasShortfall = false;

    const rows = Object.entries(requirements).sort((a, b) => a[0].localeCompare(b[0])).map(([key, needed]) => {
        const [type, size] = key.split('|');
        const sizeData = stock[size] || {};

        let inStock = 0;
        if (type === 'Sektion') {
            inStock = sizeData.sektion || 0;
        } else {
            inStock = (sizeData.dorr_h || 0) + (sizeData.dorr_v || 0);
        }

        const diff = inStock - needed;
        const isShort = diff < 0;
        if (isShort) hasShortfall = true;

        return { type, size, needed, inStock, isShort, diff };
    });

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
            <div className="bg-panel-bg border border-panel-border rounded-xl p-8 w-full max-w-2xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-semibold text-text-primary mb-6 m-0">Lagerjämförelse</h3>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b-2 border-panel-border">
                                <th className="p-2.5 text-left text-xs font-semibold text-text-secondary uppercase">Typ</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">Storlek</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">Behov</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">I Lager</th>
                                <th className="p-2.5 text-center text-xs font-semibold text-text-secondary uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={`${r.type}-${r.size}`}
                                    className="border-b border-panel-border"
                                    style={{ background: r.isShort ? 'rgba(255, 80, 80, 0.1)' : 'rgba(80, 255, 80, 0.05)' }}
                                >
                                    <td className="p-2.5 font-semibold text-text-primary">{r.type}</td>
                                    <td className="p-2.5 text-center text-text-primary">{r.size} mm</td>
                                    <td className="p-2.5 text-center font-bold text-text-primary">{r.needed}</td>
                                    <td className="p-2.5 text-center font-bold" style={{ color: r.inStock > 0 ? '#4ade80' : '#888' }}>{r.inStock}</td>
                                    <td className="p-2.5 text-center font-semibold" style={{ color: r.isShort ? '#ff6b6b' : '#4ade80' }}>
                                        {r.isShort ? `❌ Brist: ${Math.abs(r.diff)}` : '✅ OK'}
                                    </td>
                                </tr>
                            ))}
                            {stodbenCount > 0 && (
                                <tr className="border-b border-panel-border" style={{ background: 'rgba(255, 165, 0, 0.05)' }}>
                                    <td className="p-2.5 font-semibold text-text-primary">Stödben 45°</td>
                                    <td className="p-2.5 text-center text-text-primary">-</td>
                                    <td className="p-2.5 text-center font-bold text-text-primary">{stodbenCount}</td>
                                    <td className="p-2.5 text-center" style={{ color: '#888' }}>-</td>
                                    <td className="p-2.5 text-center" style={{ color: '#f39c12' }}>Tillval</td>
                                </tr>
                            )}
                            {slimlineCount > 0 && (
                                <tr className="border-b border-panel-border" style={{ background: 'rgba(255, 165, 0, 0.05)' }}>
                                    <td className="p-2.5 font-semibold text-text-primary">Slimline</td>
                                    <td className="p-2.5 text-center text-text-primary">-</td>
                                    <td className="p-2.5 text-center font-bold text-text-primary">{slimlineCount}</td>
                                    <td className="p-2.5 text-center" style={{ color: '#888' }}>-</td>
                                    <td className="p-2.5 text-center" style={{ color: '#f39c12' }}>Tillval</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {hasShortfall && (
                    <p className="mt-4 p-3 bg-danger/15 rounded-lg text-sm text-danger m-0">
                        ⚠️ Det finns lagerbrist för en eller flera storlekar. Du kan fortfarande exportera till offerten.
                    </p>
                )}

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-panel-border">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 border border-panel-border bg-transparent text-text-primary rounded-lg cursor-pointer hover:bg-white/5"
                    >
                        Avbryt
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2.5 bg-primary text-white border-none rounded-lg cursor-pointer font-semibold hover:brightness-110"
                    >
                        Exportera till Offert
                    </button>
                </div>
            </div>
        </div>
    );
}
