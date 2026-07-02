import React, { type ChangeEvent } from 'react';
import { useQuote } from '../../store/QuoteContext';
import { catalogData } from '../../data/catalog';
import { computeQuoteTotals } from '../../services/calculationEngine';
import { applyVat } from '../../utils/vatHelper';
import { hasZeroDiscountSummary } from '../../services/exportDataBuilders';

export function FinalSummaryTable() {
    const { state, dispatch } = useQuote();
    const summaryData = computeQuoteTotals({
        state,
        catalogData
    });
    const { totals, grossTotalSek, totalDiscountSek, finalTotalSek, globalDiscountAmt } = summaryData;

    const canHideDiscountReferences = hasZeroDiscountSummary(summaryData);
    const hideZeroDiscount = state.hideZeroDiscountReferencesInPdf === true && canHideDiscountReferences;

    const formatSek = (value: number): string => Math.round(value).toLocaleString('sv-SE');

    const vatAmount = state.includesVat ? finalTotalSek * 0.25 : 0;
    const totalWithVat = finalTotalSek + vatAmount;

    return (
        <div className="space-y-6">
            <div className={`flex ${canHideDiscountReferences ? 'justify-between' : 'justify-end'} items-center gap-3`}>
                {canHideDiscountReferences && (
                    <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                        <input
                            type="checkbox"
                            checked={state.hideZeroDiscountReferencesInPdf === true}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => dispatch({
                                type: 'SET_HIDE_ZERO_DISCOUNT_REFERENCES_IN_PDF',
                                payload: event.target.checked
                            })}
                            className="w-4 h-4 accent-primary"
                        />
                        Dölj rabattreferenser i PDF när rabatten är 0%
                    </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={state.includesVat}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => dispatch({
                            type: 'SET_INCLUDES_VAT',
                            payload: event.target.checked
                        })}
                        className="w-5 h-5 accent-primary cursor-pointer border-panel-border bg-black/20 rounded"
                    />
                    <span className="text-sm font-medium text-text-primary">Visa priser inklusive 25% moms</span>
                </label>
            </div>

            <div className="overflow-x-auto bg-panel-bg border border-panel-border rounded-lg shadow-inner w-full">
                <table className="w-full text-left border-collapse min-w-0">
                    <thead>
                        <tr className="bg-black/20 text-[10px] uppercase font-bold text-text-secondary tracking-wider">
                            <th className="p-4 border-b border-panel-border">Modell</th>
                            <th className="p-4 border-b border-panel-border">Storlek</th>
                            {!hideZeroDiscount && (
                                <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">{state.includesVat ? 'Ert pris (Inkl. moms)' : 'Ert pris'}</th>
                            )}
                            {hideZeroDiscount && (
                                <th className="p-4 border-b border-panel-border text-right whitespace-nowrap text-primary">{state.includesVat ? 'Rek utpris (Inkl. moms)' : 'Rek utpris'}</th>
                            )}
                            <th className="p-4 border-b border-panel-border text-center whitespace-nowrap">Antal</th>
                            {!hideZeroDiscount && (
                                <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">{state.includesVat ? 'Rek utpris (Inkl. moms)' : 'Rek utpris'}</th>
                            )}
                            {!hideZeroDiscount && (
                                <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">Rabatt %</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border/50">
                        {totals.map((row, index) => {
                            const isReq = row.priceUponRequest === true;
                            return (
                                <tr
                                    key={`${row.model}-${index}`}
                                    className={`${row.isAddon ? 'text-text-secondary italic bg-black/5' : 'font-medium'} ${row.isCustom ? 'italic text-secondary/80' : ''}`}
                                >
                                    <td className={`p-3 text-sm ${row.isAddon ? 'pl-8' : ''}`}>{row.model}</td>
                                    <td className="p-3 text-sm text-text-secondary">{row.size}</td>
                                    {!hideZeroDiscount && (
                                        <td className="p-3 text-sm text-right text-primary font-bold whitespace-nowrap">
                                            {isReq ? 'Pris på förfrågan' : `${formatSek(applyVat(row.net, state.includesVat))} SEK`}
                                        </td>
                                    )}
                                    {hideZeroDiscount && (
                                        <td className="p-3 text-sm text-right text-primary font-bold whitespace-nowrap">
                                            {isReq ? 'Pris på förfrågan' : `${formatSek(applyVat(row.gross, state.includesVat))} SEK`}
                                        </td>
                                    )}
                                    <td className="p-3 text-sm text-center whitespace-nowrap">{row.qty}</td>
                                    {!hideZeroDiscount && (
                                        <td className="p-3 text-sm text-right text-text-secondary whitespace-nowrap">
                                            {isReq ? 'Pris på förfrågan' : `${formatSek(applyVat(row.gross, state.includesVat))} SEK`}
                                        </td>
                                    )}
                                    {!hideZeroDiscount && (
                                        <td className="p-3 text-sm text-right text-danger whitespace-nowrap">
                                            {isReq ? '-' : `-${row.discountPct}%`}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}

                        {globalDiscountAmt > 0 && (
                            <tr className="bg-black/10 italic text-text-secondary">
                                <td colSpan={2} className="p-3 text-sm">Övergripande offertrabatt ({state.globalDiscountPct}%)</td>
                                <td className="p-3 text-sm text-right text-danger font-bold whitespace-nowrap">-{formatSek(applyVat(globalDiscountAmt, state.includesVat))} SEK</td>
                                <td colSpan={hideZeroDiscount ? 1 : 3}></td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-black/30 border-t-2 border-panel-border">
                        <tr>
                            <td colSpan={2} className="p-4 text-right text-xs uppercase font-bold text-text-secondary">Totalt exkl. moms</td>
                            <td className="p-4 text-right font-bold text-primary text-3xl whitespace-nowrap">{formatSek(finalTotalSek)} SEK</td>
                            <td colSpan={2} className="p-4 text-right text-xs uppercase font-bold text-text-secondary whitespace-nowrap">{state.includesVat ? 'Brutto (inkl. moms):' : 'Brutto:'} {formatSek(applyVat(grossTotalSek, state.includesVat))} SEK</td>
                            <td className="p-4 text-right text-danger font-bold text-xs">{state.includesVat ? 'Total rabatt (inkl. moms):' : 'Total rabatt:'}<br />-{formatSek(applyVat(totalDiscountSek, state.includesVat))} SEK</td>
                        </tr>
                        {state.includesVat && (
                            <>
                                <tr className="border-t border-panel-border/30">
                                    <td colSpan={2} className="p-2 text-right text-xs uppercase font-bold text-text-secondary">Moms 25%</td>
                                    <td className="p-2 text-right font-bold text-text-secondary whitespace-nowrap">{formatSek(vatAmount)} SEK</td>
                                    <td colSpan={hideZeroDiscount ? 1 : 3}></td>
                                </tr>
                                <tr className="bg-primary/5">
                                    <td colSpan={2} className="p-4 text-right text-lg uppercase font-black text-white">Totalt att betala (inkl. moms)</td>
                                    <td className="p-4 text-right font-black text-2xl text-primary whitespace-nowrap">{formatSek(totalWithVat)} SEK</td>
                                    <td colSpan={hideZeroDiscount ? 1 : 3}></td>
                                </tr>
                            </>
                        )}
                    </tfoot>
                </table>
            </div>
            {totals.some((row) => row.priceUponRequest === true) && (
                <p className="text-xs text-text-secondary italic text-right px-1">
                    * Totalsumman exkluderar artiklar med pris på förfrågan
                </p>
            )}
        </div>
    );
}
