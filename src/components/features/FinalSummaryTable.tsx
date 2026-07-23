import React, { type ChangeEvent } from 'react';
import { useQuote } from '../../store/QuoteContext';
import { catalogData } from '../../data/catalog';
import { computeQuoteTotals } from '../../services/calculationEngine';
import { applyVat } from '../../utils/vatHelper';
import { hasZeroDiscountSummary } from '../../services/exportDataBuilders';
import {
    getExportLabels,
    normalizeExportLanguage,
    translateQuoteTotalsRowModel
} from '../../services/exportLocalization';

interface FinalSummaryTableProps {
    isMixedOffer?: boolean;
}

export function FinalSummaryTable({ isMixedOffer = false }: FinalSummaryTableProps) {
    const { state, dispatch } = useQuote();
    const summaryData = computeQuoteTotals({
        state,
        catalogData
    });
    const { totals, grossTotalSek, totalDiscountSek, finalTotalSek, globalDiscountAmt } = summaryData;
    const exportLanguage = normalizeExportLanguage(state.exportLanguage);
    const labels = getExportLabels(exportLanguage);
    const summaryLabels = exportLanguage === 'en'
        ? labels
        : {
            ...labels,
            yourPrice: 'Ert pris',
            recommendedPrice: 'Rek utpris',
            discountPct: 'Rabatt %',
            globalDiscount: 'Övergripande offertrabatt',
            totalDiscount: 'Total rabatt',
            totalExVat: 'Totalt exkl. moms'
        };
    const totalsVatLabel = exportLanguage === 'en' ? summaryLabels.inclVat : 'inkl. moms';

    if (totals.length === 0) {
        return null;
    }

    const canHideDiscountReferences = hasZeroDiscountSummary(summaryData);
    const hideZeroDiscount = state.hideZeroDiscountReferencesInPdf === true && canHideDiscountReferences;

    const formatSek = (value: number): string => Math.round(value).toLocaleString('sv-SE');

    const vatAmount = state.includesVat ? finalTotalSek * 0.25 : 0;
    const totalWithVat = finalTotalSek + vatAmount;

    return (
        <div className="space-y-6">
            {isMixedOffer ? (
                <h4 className="m-0 text-base font-bold text-text-primary">{summaryLabels.productsHeading}</h4>
            ) : null}
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
                            <th className="p-4 border-b border-panel-border">{summaryLabels.model}</th>
                            <th className="p-4 border-b border-panel-border">{summaryLabels.size}</th>
                            {!hideZeroDiscount && (
                                <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">{state.includesVat ? `${summaryLabels.yourPrice} (${summaryLabels.inclVat})` : summaryLabels.yourPrice}</th>
                            )}
                            {hideZeroDiscount && (
                                <th className="p-4 border-b border-panel-border text-right whitespace-nowrap text-primary">{state.includesVat ? `${summaryLabels.recommendedPrice} (${summaryLabels.inclVat})` : summaryLabels.recommendedPrice}</th>
                            )}
                            <th className="p-4 border-b border-panel-border text-center whitespace-nowrap">{summaryLabels.quantity}</th>
                            {!hideZeroDiscount && (
                                <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">{state.includesVat ? `${summaryLabels.recommendedPrice} (${summaryLabels.inclVat})` : summaryLabels.recommendedPrice}</th>
                            )}
                            {!hideZeroDiscount && (
                                <th className="p-4 border-b border-panel-border text-right whitespace-nowrap">{summaryLabels.discountPct}</th>
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
                                    <td className={`p-3 text-sm ${row.isAddon ? 'pl-8' : ''}`}>{translateQuoteTotalsRowModel(row, exportLanguage)}</td>
                                    <td className="p-3 text-sm text-text-secondary">{row.size}</td>
                                    {!hideZeroDiscount && (
                                        <td className="p-3 text-sm text-right text-primary font-bold whitespace-nowrap">
                                            {isReq ? summaryLabels.priceUponRequest : `${formatSek(applyVat(row.net, state.includesVat))} SEK`}
                                        </td>
                                    )}
                                    {hideZeroDiscount && (
                                        <td className="p-3 text-sm text-right text-primary font-bold whitespace-nowrap">
                                            {isReq ? summaryLabels.priceUponRequest : `${formatSek(applyVat(row.gross, state.includesVat))} SEK`}
                                        </td>
                                    )}
                                    <td className="p-3 text-sm text-center whitespace-nowrap">{row.qty}</td>
                                    {!hideZeroDiscount && (
                                        <td className="p-3 text-sm text-right text-text-secondary whitespace-nowrap">
                                            {isReq ? summaryLabels.priceUponRequest : `${formatSek(applyVat(row.gross, state.includesVat))} SEK`}
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
                                <td colSpan={2} className="p-3 text-sm">{summaryLabels.globalDiscount} ({state.globalDiscountPct}%)</td>
                                <td className="p-3 text-sm text-right text-danger font-bold whitespace-nowrap">-{formatSek(applyVat(globalDiscountAmt, state.includesVat))} SEK</td>
                                <td colSpan={hideZeroDiscount ? 1 : 3}></td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-black/30 border-t-2 border-panel-border">
                        <tr>
                            <td colSpan={2} className="p-4 text-right text-xs uppercase font-bold text-text-secondary">
                                {isMixedOffer ? summaryLabels.productTotalExVat : summaryLabels.totalExVat}
                            </td>
                            <td className="p-4 text-right font-bold text-primary text-3xl whitespace-nowrap">{formatSek(finalTotalSek)} SEK</td>
                            <td colSpan={2} className="p-4 text-right text-xs uppercase font-bold text-text-secondary whitespace-nowrap">{summaryLabels.gross}{state.includesVat ? ` (${totalsVatLabel})` : ''}: {formatSek(applyVat(grossTotalSek, state.includesVat))} SEK</td>
                            <td className="p-4 text-right text-danger font-bold text-xs">{summaryLabels.totalDiscount}{state.includesVat ? ` (${totalsVatLabel})` : ''}:<br />-{formatSek(applyVat(totalDiscountSek, state.includesVat))} SEK</td>
                        </tr>
                        {state.includesVat && (
                            <>
                                <tr className="border-t border-panel-border/30">
                                    <td colSpan={2} className="p-2 text-right text-xs uppercase font-bold text-text-secondary">{summaryLabels.vat25}</td>
                                    <td className="p-2 text-right font-bold text-text-secondary whitespace-nowrap">{formatSek(vatAmount)} SEK</td>
                                    <td colSpan={hideZeroDiscount ? 1 : 3}></td>
                                </tr>
                                <tr className="bg-primary/5">
                                    <td colSpan={2} className="p-4 text-right text-lg uppercase font-black text-white">{summaryLabels.totalAmountDue} ({totalsVatLabel})</td>
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
                    {summaryLabels.totalsExcludePriceUponRequest}
                </p>
            )}
        </div>
    );
}
