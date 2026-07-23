import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import { calculateContractingWorkSummary } from '../../services/contractingWork';
import { getExportLabels, normalizeExportLanguage } from '../../services/exportLocalization';

interface ContractingWorkSummaryTableProps {
    className?: string;
}

function formatSek(value: number): string {
    return Math.round(value).toLocaleString('sv-SE');
}

export function ContractingWorkSummaryTable({ className = '' }: ContractingWorkSummaryTableProps) {
    const { state } = useQuote();
    const summary = calculateContractingWorkSummary(state.contractingWork);

    if (summary.customerRows.length === 0) {
        return null;
    }

    const labels = getExportLabels(normalizeExportLanguage(state.exportLanguage));
    const projectName = state.contractingWork.projectName;
    const title = projectName.trim()
        ? `${labels.contractingHeading} ${labels.contractingFor} ${projectName}`
        : labels.contractingHeading;

    return (
        <section className={`min-w-0 max-w-full overflow-hidden rounded-lg border border-panel-border bg-panel-bg shadow-inner ${className}`.trim()}>
            <h4 className="m-0 border-b border-panel-border bg-black/20 px-4 py-4 text-base font-bold text-text-primary">
                {title}
            </h4>
            <div className="min-w-0 max-w-full overflow-x-auto" style={{ contain: 'layout paint' }}>
                <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead>
                        <tr className="bg-black/30 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                            <th className="border-b border-panel-border p-4">{labels.contractingWorkPackage}</th>
                            <th className="border-b border-panel-border p-4">{labels.contractingScope}</th>
                            <th className="border-b border-panel-border p-4 text-center">{labels.contractingUnit}</th>
                            <th className="border-b border-panel-border bg-success/80 p-4 text-right text-white">
                                {labels.contractingPriceExVat.split('\n').map((line, index) => (
                                    <React.Fragment key={line}>
                                        {index > 0 ? <br /> : null}
                                        {line}
                                    </React.Fragment>
                                ))}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border/50">
                        {summary.customerRows.map((row) => (
                            <tr key={row.id} className="align-top">
                                <td className="p-4 text-sm font-bold text-text-primary">{row.workPackage}</td>
                                <td className="whitespace-pre-wrap p-4 text-sm leading-6 text-text-secondary">{row.scope}</td>
                                <td className="whitespace-pre-wrap p-4 text-center text-sm text-text-secondary">{row.unit}</td>
                                <td className="whitespace-nowrap bg-success/10 p-4 text-right text-sm font-bold text-text-primary">
                                    {formatSek(row.priceExVatSek)} SEK
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-panel-border bg-black/50">
                            <td colSpan={3} className="p-4 text-sm font-bold text-white">{labels.contractingBaseValue}</td>
                            <td className="p-4 text-right text-base font-black text-white">{formatSek(summary.baseTotalSek)} SEK</td>
                        </tr>
                        {summary.ataEnabled ? (
                            <>
                                <tr className="bg-black/10 text-text-secondary">
                                    <td colSpan={3} className="px-4 py-3 text-right text-sm">
                                        {labels.contractingAtaAllowance} (±{summary.ataPercent}%)
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold">{formatSek(summary.allowanceSek)} SEK</td>
                                </tr>
                                <tr className="bg-black/10 text-text-secondary">
                                    <td colSpan={3} className="px-4 py-3 text-right text-sm">
                                        {labels.contractingLowerIndicative} (-{summary.ataPercent}%)
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-semibold">{formatSek(summary.lowerIndicativeSek)} SEK</td>
                                </tr>
                                <tr className="bg-white/10 text-text-primary">
                                    <td colSpan={3} className="p-4 text-right text-sm font-bold">
                                        {labels.contractingUpperIndicative} (+{summary.ataPercent}%)
                                    </td>
                                    <td className="p-4 text-right text-base font-black">{formatSek(summary.upperIndicativeSek)} SEK</td>
                                </tr>
                            </>
                        ) : null}
                    </tfoot>
                </table>
            </div>
        </section>
    );
}
