import React, { useEffect, useMemo, useRef, useState } from 'react';

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

function normalizeSizeValue(size) {
    return (size || '').toString().trim();
}

function isUnknownSizeValue(size) {
    const normalized = normalizeSizeValue(size)
        .toLowerCase()
        .replaceAll('ã¤', 'ä')
        .replaceAll('ã¶', 'ö')
        .replaceAll('ã¥', 'å')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return !normalized || normalized === '-' || normalized === 'okand' || normalized === 'unknown';
}

function areSetsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const value of a) {
        if (!b.has(value)) return false;
    }
    return true;
}

export function InventoryTable({ items, searchTerm, onAddToBasket, onEdit, onDelete }) {
    const lowerTerm = (searchTerm || '').toLowerCase();
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [selectedSizes, setSelectedSizes] = useState(new Set());
    const [isSizeFilterOpen, setIsSizeFilterOpen] = useState(false);
    const sizeFilterRef = useRef(null);

    const sizeOptions = useMemo(() => {
        const uniqueSizes = Array.from(
            new Set((items || []).map((item) => normalizeSizeValue(item.STORLEK)).filter((size) => size && !isUnknownSizeValue(size)))
        );

        uniqueSizes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        return uniqueSizes;
    }, [items]);

    const searchedItems = useMemo(() => {
        const next = (items || []).filter((item) => {
            if (!lowerTerm) return true;
            const fields = [item.TYP, item.STORLEK, item.BESKRIVNING, item.ID, item.TEXTIL, item.Kommentar];
            return fields.some((f) => (f || '').toString().toLowerCase().includes(lowerTerm));
        });

        next.sort((a, b) => {
            const idA = (a.ID || '').toString();
            const idB = (b.ID || '').toString();
            return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
        });

        return next;
    }, [items, lowerTerm]);

    const filtered = useMemo(() => {
        if (selectedSizes.size === 0) return searchedItems;

        return searchedItems.filter((item) => {
            const size = normalizeSizeValue(item.STORLEK);
            if (isUnknownSizeValue(size)) return false;
            return selectedSizes.has(size);
        });
    }, [searchedItems, selectedSizes]);

    const groupedRows = useMemo(() => {
        const groups = [];
        const byPrefix = new Map();

        filtered.forEach((item) => {
            const prefix = getGrenstallPrefix(item.ID || '-');
            let group = byPrefix.get(prefix);
            if (!group) {
                group = { prefix, items: [] };
                byPrefix.set(prefix, group);
                groups.push(group);
            }
            group.items.push(item);
        });

        return groups;
    }, [filtered]);

    const indexByItemRef = useMemo(() => {
        const indexMap = new Map();
        (items || []).forEach((item, idx) => indexMap.set(item, idx));
        return indexMap;
    }, [items]);

    useEffect(() => {
        setSelectedSizes((prev) => {
            const allowed = new Set(sizeOptions);
            const next = new Set([...prev].filter((s) => allowed.has(s)));
            return areSetsEqual(prev, next) ? prev : next;
        });
    }, [sizeOptions]);

    useEffect(() => {
        setCollapsedGroups((prev) => {
            const next = {};
            groupedRows.forEach(({ prefix }) => {
                next[prefix] = prev[prefix] ?? false;
            });
            return next;
        });
    }, [groupedRows]);

    useEffect(() => {
        if (!lowerTerm) return;
        setCollapsedGroups((prev) => {
            const next = { ...prev };
            groupedRows.forEach(({ prefix }) => {
                next[prefix] = false;
            });
            return next;
        });
    }, [lowerTerm, groupedRows]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (sizeFilterRef.current && !sizeFilterRef.current.contains(event.target)) {
                setIsSizeFilterOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setIsSizeFilterOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const toggleGroup = (prefix) => {
        setCollapsedGroups((prev) => ({ ...prev, [prefix]: !prev[prefix] }));
    };

    const toggleSizeSelection = (size) => {
        setSelectedSizes((prev) => {
            const next = new Set(prev);
            if (next.has(size)) {
                next.delete(size);
            } else {
                next.add(size);
            }
            return next;
        });
    };

    const selectAllSizes = () => {
        setSelectedSizes(new Set(sizeOptions));
    };

    const clearSizeFilter = () => {
        setSelectedSizes(new Set());
    };

    return (
        <div className="overflow-x-auto border border-panel-border rounded-lg">
            <table className="w-full border-collapse min-w-[800px]">
                <thead>
                    <tr className="bg-white/[0.02]">
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">ID</th>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">Typ</th>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase relative" ref={sizeFilterRef}>
                            <button
                                type="button"
                                onClick={() => setIsSizeFilterOpen((prev) => !prev)}
                                className={`inline-flex items-center gap-2 cursor-pointer transition-colors ${selectedSizes.size > 0 ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                                aria-expanded={isSizeFilterOpen}
                                aria-haspopup="menu"
                            >
                                <span>Storlek</span>
                                <span className={`text-[10px] transition-transform ${isSizeFilterOpen ? 'rotate-180' : ''}`}>v</span>
                                {selectedSizes.size > 0 && (
                                    <span className="text-[10px] font-bold leading-none bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                                        {selectedSizes.size}
                                    </span>
                                )}
                            </button>

                            {isSizeFilterOpen && (
                                <div className="absolute left-0 top-full mt-2 z-20 w-64 bg-panel-bg border border-panel-border rounded-lg shadow-xl p-3 normal-case">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-text-secondary uppercase">Filtrera storlek</span>
                                        <span className="text-xs text-text-secondary">{selectedSizes.size} valda</span>
                                    </div>

                                    <div className="flex gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={selectAllSizes}
                                            className="px-2 py-1 text-xs border border-panel-border bg-panel-bg text-text-primary rounded hover:bg-white/5"
                                        >
                                            Välj alla
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearSizeFilter}
                                            className="px-2 py-1 text-xs border border-panel-border bg-panel-bg text-text-primary rounded hover:bg-white/5"
                                        >
                                            Rensa
                                        </button>
                                    </div>

                                    <div className="max-h-52 overflow-auto pr-1 space-y-1">
                                        {sizeOptions.length > 0 ? (
                                            sizeOptions.map((size) => (
                                                <label key={size} className="flex items-center gap-2 text-xs text-text-primary cursor-pointer hover:bg-white/5 px-2 py-1 rounded">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSizes.has(size)}
                                                        onChange={() => toggleSizeSelection(size)}
                                                        className="accent-blue-500"
                                                    />
                                                    <span>{size}</span>
                                                </label>
                                            ))
                                        ) : (
                                            <div className="text-xs text-text-secondary italic px-2 py-1">Inga storlekar tillgängliga</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </th>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">Beskrivning</th>
                        <th className="p-3 text-left text-xs font-semibold text-text-secondary uppercase">Kommentar</th>
                        <th className="p-3 text-center text-xs font-semibold text-text-secondary uppercase">Åtgärder</th>
                    </tr>
                </thead>
                <tbody>
                    {groupedRows.length > 0 ? (
                        groupedRows.map((group) => {
                            const isCollapsed = !!collapsedGroups[group.prefix];

                            return (
                                <React.Fragment key={`group-${group.prefix}`}>
                                    <tr>
                                        <td colSpan="6" className="p-0 bg-bg border-b-2 border-primary">
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(group.prefix)}
                                                className="w-full px-3 py-3 flex items-center justify-between text-primary font-bold text-sm uppercase cursor-pointer hover:bg-white/5 transition-colors"
                                            >
                                                <span>Grenställ: {group.prefix}</span>
                                                <span className="flex items-center gap-3 text-xs normal-case text-text-secondary">
                                                    {group.items.length} artiklar
                                                    <span className={`text-primary transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>▲</span>
                                                </span>
                                            </button>
                                        </td>
                                    </tr>

                                    {!isCollapsed &&
                                        group.items.map((item) => {
                                            const id = item.ID || '-';
                                            const { isReserved, isUsed, isMissingParts } = getRowStatus(item.Kommentar);
                                            let rowClasses = 'border-b border-panel-border hover:bg-white/5 transition-colors';
                                            if (isReserved || isMissingParts) rowClasses += ' opacity-60';
                                            if (isUsed) rowClasses += ' opacity-50 italic';

                                            const actualIndex = indexByItemRef.get(item);

                                            return (
                                                <tr key={`${id}-${actualIndex}-${group.prefix}`} className={rowClasses}>
                                                    <td className="p-3 font-medium text-text-primary whitespace-nowrap">{id}</td>
                                                    <td className="p-3 text-text-primary whitespace-nowrap">{item.TYP || 'BA'}</td>
                                                    <td className="p-3 text-text-primary whitespace-nowrap">{item.STORLEK || 'Okänd'}</td>
                                                    <td className="p-3 text-text-primary max-w-[400px]" style={{ whiteSpace: 'normal' }}>
                                                        {item.BESKRIVNING || ''}
                                                    </td>
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
                                        })}
                                </React.Fragment>
                            );
                        })
                    ) : (
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
