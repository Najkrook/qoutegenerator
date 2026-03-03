import React from 'react';

function getGrenstallPrefix(id) {
    if (!id || id === '-') return 'Övrigt';
    const upperId = id.toUpperCase();

    if (id.includes('.')) {
        const prefix = upperId.split('.')[0];
        if (prefix === 'MAIN' || upperId.startsWith('M')) return 'Main';
        if (prefix === 'LOD' || upperId.startsWith('L')) return 'Lod';
        if (prefix === 'BLACK' || upperId.startsWith('B')) return 'Black';
        if (['3', '4', '5', '6'].includes(prefix)) return prefix;
    } else {
        if (upperId === 'MAIN' || upperId.startsWith('M')) return 'Main';
        if (upperId === 'LOD' || upperId.startsWith('L')) return 'Lod';
        if (upperId === 'BLACK' || upperId.startsWith('B')) return 'Black';
        if (['3', '4', '5', '6'].includes(id)) return id;
    }
    return 'Övrigt';
}

function getRowStatus(kommentar) {
    const upper = (kommentar || '').toUpperCase();
    const isReserved = upper.includes('SALES LAPP') || upper.includes('AHLGRENS') || upper.includes('ENOCLUB') || upper.includes('RESERVERAD');
    const isUsed = upper.includes('INBYTES') || upper.includes('BEGAGNAD');
    const isMissingParts = upper.includes('SAKNAR') || upper.includes('KOLLA');
    return { isReserved, isUsed, isMissingParts };
}

export function InventoryTable({ items, searchTerm, onAddToBasket, onEdit, onDelete }) {
    const lowerTerm = (searchTerm || '').toLowerCase();

    const filtered = (items || []).filter(item => {
        if (!lowerTerm) return true;
        const fields = [item.TYP, item.STORLEK, item.BESKRIVNING, item.ID, item.TEXTIL, item.Kommentar];
        return fields.some(f => (f || '').toString().toLowerCase().includes(lowerTerm));
    });

    filtered.sort((a, b) => {
        const idA = (a.ID || '').toString();
        const idB = (b.ID || '').toString();
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });

    let currentGrenstall = null;
    const rows = [];

    filtered.forEach((item) => {
        const id = item.ID || '-';
        const prefix = getGrenstallPrefix(id);

        if (prefix !== currentGrenstall) {
            currentGrenstall = prefix;
            rows.push(
                <tr key={`header-${prefix}`}>
                    <td colSpan="6" className="p-3 bg-bg border-b-2 border-primary text-primary font-bold text-sm uppercase">
                        Grenställ: {prefix}
                    </td>
                </tr>
            );
        }

        const { isReserved, isUsed, isMissingParts } = getRowStatus(item.Kommentar);
        let rowClasses = 'border-b border-panel-border hover:bg-white/5 transition-colors';
        if (isReserved || isMissingParts) rowClasses += ' opacity-60';
        if (isUsed) rowClasses += ' opacity-50 italic';

        const actualIndex = items.findIndex(i => i === item);

        rows.push(
            <tr key={`${id}-${actualIndex}`} className={rowClasses}>
                <td className="p-3 font-medium text-text-primary whitespace-nowrap">{id}</td>
                <td className="p-3 text-text-primary whitespace-nowrap">{item.TYP || 'BA'}</td>
                <td className="p-3 text-text-primary whitespace-nowrap">{item.STORLEK || 'Okänd'}</td>
                <td className="p-3 text-text-primary max-w-[400px]" style={{ whiteSpace: 'normal' }}>{item.BESKRIVNING || ''}</td>
                <td className="p-3 text-text-secondary italic">{item.Kommentar || ''}</td>
                <td className="p-3 whitespace-nowrap">
                    <div className="flex gap-2 justify-center">
                        <button
                            onClick={() => onAddToBasket(item)}
                            className="px-2.5 py-1 text-xs border border-panel-border bg-panel-bg text-text-primary rounded cursor-pointer hover:bg-white/10 hover:border-primary transition-colors"
                        >
                            + Korg
                        </button>
                        <button
                            onClick={() => onEdit(actualIndex, item)}
                            className="px-2 py-1 text-xs border border-primary bg-transparent text-primary rounded cursor-pointer hover:bg-primary/10"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => onDelete(actualIndex, item)}
                            className="px-2 py-1 text-xs border border-danger bg-transparent text-danger rounded cursor-pointer hover:bg-danger/10"
                        >
                            Del
                        </button>
                    </div>
                </td>
            </tr>
        );
    });

    return (
        <div className="overflow-x-auto border border-panel-border rounded-lg">
            <table className="w-full border-collapse min-w-[800px]">
                <thead>
                    <tr className="bg-white/[0.02]">
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">ID</th>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">Typ</th>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">Storlek</th>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">Beskrivning</th>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">Kommentar</th>
                        <th className="p-3 text-center text-xs font-semibold text-text-secondary uppercase">Åtgärder</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length > 0 ? rows : (
                        <tr>
                            <td colSpan="6" className="p-8 text-center text-text-secondary italic">
                                {lowerTerm ? 'Inga artiklar matchar sökningen.' : 'Inga artiklar i lagret.'}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            {filtered.length > 0 && (
                <div className="p-3 text-xs text-text-secondary text-right border-t border-panel-border">
                    Visar {filtered.length} av {items.length} artiklar
                </div>
            )}
        </div>
    );
}
