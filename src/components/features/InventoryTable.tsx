import React from 'react';
import type { BahamaInventoryStatus, InventoryTableProps } from '../../types/contracts';

const STATUS_LABELS: Record<BahamaInventoryStatus, string> = {
    available: 'Tillgänglig',
    reserved: 'Reserverad',
    'needs-review': 'Kontroll',
    used: 'Begagnad',
    sold: 'Såld'
};

const STATUS_CLASSES: Record<BahamaInventoryStatus, string> = {
    available: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    reserved: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    'needs-review': 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    used: 'border-zinc-400/30 bg-zinc-400/10 text-zinc-200',
    sold: 'border-rose-400/30 bg-rose-400/10 text-rose-200'
};

function display(value: string): string {
    return value.trim() || '-';
}

export function InventoryTable({ items, selectedItemId, onSelect }: InventoryTableProps) {
    return (
        <div className="min-h-0 overflow-auto rounded-lg border border-white/10 bg-[#0f1418]">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-[#12191f]">
                    <tr className="border-b border-white/10">
                        <th className="w-10 px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500"> </th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">ID</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Typ</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Storlek</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Status</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Lagerplats</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Stativ</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Textil</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Fot</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Belysning</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Värme</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase text-slate-500">Kommentar</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length > 0 ? (
                        items.map((item) => {
                            const isSelected = item.id === selectedItemId;
                            return (
                                <tr
                                    key={item.id}
                                    onClick={() => onSelect(item)}
                                    className={`cursor-pointer border-b border-white/[0.06] transition-colors ${
                                        isSelected ? 'bg-[#26313a]' : 'hover:bg-white/[0.04]'
                                    }`}
                                >
                                    <td className="px-3 py-3">
                                        <span
                                            className={`block h-2.5 w-2.5 rounded-full ${
                                                isSelected ? 'bg-[#e8e1d4]' : 'bg-slate-700'
                                            }`}
                                            aria-hidden="true"
                                        />
                                    </td>
                                    <td className="px-3 py-3 font-semibold text-slate-100">{item.id}</td>
                                    <td className="px-3 py-3 text-slate-200">{display(item.type)}</td>
                                    <td className="px-3 py-3 text-slate-200">{display(item.size)}</td>
                                    <td className="px-3 py-3">
                                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASSES[item.status]}`}>
                                            {STATUS_LABELS[item.status]}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-slate-300">{display(item.location)}</td>
                                    <td className="px-3 py-3 text-slate-300">{display(item.properties.stativ)}</td>
                                    <td className="px-3 py-3 text-slate-300">{display(item.properties.textil)}</td>
                                    <td className="px-3 py-3 text-slate-300">{display(item.properties.fot)}</td>
                                    <td className="px-3 py-3 text-slate-300">{display(item.properties.belysning)}</td>
                                    <td className="px-3 py-3 text-slate-300">{display(item.properties.varme)}</td>
                                    <td className="max-w-[220px] truncate px-3 py-3 text-slate-400">{display(item.comment)}</td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan={12} className="px-4 py-16 text-center text-sm text-slate-500">
                                Inga BaHaMa-artiklar matchar filtret.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
