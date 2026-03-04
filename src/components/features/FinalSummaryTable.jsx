import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { catalogData } from '../../data/catalog';
import { computeQuoteTotals } from '../../../services/calculationEngine';

export function FinalSummaryTable() {
    const { state, dispatch } = useQuote();
    const { totals, grossTotalSek, totalDiscountSek, finalTotalSek, globalDiscountAmt } = computeQuoteTotals({ state, catalogData });

    const fmt = (num) => Math.round(num).toLocaleString('sv-SE');

    const vatAmount = state.includesVat ? finalTotalSek * 0.25 : 0;
    const totalWithVat = finalTotalSek + vatAmount;

    return (
        <div className="space-y-6">
            <div className="flex justify-end items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={state.includesVat}
                        onChange={(e) => dispatch({ type: 'SET_INCLUDES_VAT', payload: e.target.checked })}
                        className="w-5 h-5 accent-primary cursor-pointer border-panel-border bg-black/20 rounded"
                    />
                    <span className="text-sm font-medium text-text-primary">Visa priser inklusive 25% moms</span>
                </label>
            </div>

            <div className="overflow-x-auto md:overflow-visible bg-panel-bg border border-panel-border rounded-lg shadow-inner">
                <table className="w-full text-left border-collapse min-w-0">
                    <thead>
                        <tr className="bg-black/20 text-[10px] uppercase font-bold text-text-secondary tracking-wider">
                            <th className="p-4 border-b border-panel-border">Modell</th>
                            <th className="p-4 border-b border-panel-border">Storlek</th>
                            <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">Ert Pris</th>
                            <th className="p-4 border-b border-panel-border text-center whitespace-nowrap">Antal</th>
                            <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">Rek Utpris</th>
                            <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">Rabatt %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border/50">
                        {totals.map((row, idx) => (
                            <tr
                                key={`${row.model}-${idx}`}
                                className={`${row.isAddon ? 'text-text-secondary italic bg-black/5' : 'font-medium'} ${row.isCustom ? 'italic text-secondary/80' : ''}`}
                            >
                                <td className={`p-3 text-sm ${row.isAddon ? 'pl-8' : ''}`}>{row.model}</td>
                                <td className="p-3 text-sm text-text-secondary">{row.size}</td>
                                <td className="p-3 text-sm text-right text-primary font-bold whitespace-nowrap">{fmt(row.net)} SEK</td>
                                <td className="p-3 text-sm text-center whitespace-nowrap">{row.qty}</td>
                                <td className="p-3 text-sm text-right text-text-secondary whitespace-nowrap">{fmt(row.gross)} SEK</td>
                                <td className="p-3 text-sm text-right text-danger whitespace-nowrap">-{row.discountPct}%</td>
                            </tr>
                        ))}

                        {globalDiscountAmt > 0 && (
                            <tr className="bg-black/10 italic text-text-secondary">
                                <td colSpan="2" className="p-3 text-sm">Övergripande offertrabatt ({state.globalDiscountPct}%)</td>
                                <td className="p-3 text-sm text-right text-danger font-bold whitespace-nowrap">-{fmt(globalDiscountAmt)} SEK</td>
                                <td colSpan="3"></td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-black/30 border-t-2 border-panel-border">
                        <tr>
                            <td colSpan="2" className="p-4 text-right text-xs uppercase font-bold text-text-secondary">Totalt exkl. moms</td>
                            <td className="p-4 text-right font-bold text-primary text-3xl whitespace-nowrap">{fmt(finalTotalSek)} SEK</td>
                            <td colSpan="2" className="p-4 text-right text-xs uppercase font-bold text-text-secondary whitespace-nowrap">Brutto: {fmt(grossTotalSek)} SEK</td>
                            <td className="p-4 text-right text-danger font-bold text-xs whitespace-nowrap">Total rabatt: -{fmt(totalDiscountSek)} SEK</td>
                        </tr>
                        {state.includesVat && (
                            <>
                                <tr className="border-t border-panel-border/30">
                                    <td colSpan="2" className="p-2 text-right text-xs uppercase font-bold text-text-secondary">Moms 25%</td>
                                    <td className="p-2 text-right font-bold text-text-secondary whitespace-nowrap">{fmt(vatAmount)} SEK</td>
                                    <td colSpan="3"></td>
                                </tr>
                                <tr className="bg-primary/5">
                                    <td colSpan="2" className="p-4 text-right text-lg uppercase font-black text-white">Totalt att betala (inkl. moms)</td>
                                    <td className="p-4 text-right font-black text-2xl text-primary whitespace-nowrap">{fmt(totalWithVat)} SEK</td>
                                    <td colSpan="3"></td>
                                </tr>
                            </>
                        )}
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
