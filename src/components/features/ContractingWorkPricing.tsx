import React from 'react';
import { calculateContractingWorkSummary } from '../../services/contractingWork';
import { useQuote } from '../../store/QuoteContext';
import type {
    ContractingWorkRow,
    ContractingWorkState
} from '../../types/contracts';

const sekFormatter = new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

function formatSek(value: number): string {
    return `${sekFormatter.format(value)} SEK`;
}

export function normalizeContractingPriceInput(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function normalizeAtaPercentInput(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

export function normalizeMarginPercentInput(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
}

export function ContractingWorkPricing() {
    const { state, dispatch } = useQuote();
    const contractingWork = state.contractingWork;
    const summary = calculateContractingWorkSummary(contractingWork);
    const customerPriceByRowId = new Map(
        summary.customerRows.map((row) => [row.id, row.priceExVatSek])
    );

    const updateContractingWork = (patch: Partial<ContractingWorkState>): void => {
        dispatch({
            type: 'SET_CONTRACTING_WORK',
            payload: {
                ...contractingWork,
                ...patch
            }
        });
    };

    const updateRow = (rowId: string, patch: Partial<ContractingWorkRow>): void => {
        updateContractingWork({
            rows: contractingWork.rows.map((row) => (
                row.id === rowId ? { ...row, ...patch } : row
            ))
        });
    };

    return (
        <section
            aria-labelledby="contracting-work-pricing-heading"
            className="mt-8 min-w-0 max-w-full rounded-xl border border-panel-border bg-panel-bg p-5 shadow-sm sm:p-6"
        >
            <div className="mb-5">
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                    Separat offertdel
                </p>
                <h3 id="contracting-work-pricing-heading" className="mt-2 text-xl font-bold text-text-primary">
                    Entreprenadarbete
                </h3>
                <p className="mb-0 mt-1 text-sm leading-relaxed text-text-secondary">
                    Ange underentreprenörens grundpris per arbetspaket i SEK exkl. moms. Priserna hålls separata från produktdelens rabatter och interna marginalanalys.
                </p>
            </div>

            <div
                className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-panel-border"
                style={{ contain: 'layout paint' }}
            >
                <table className={`w-full border-collapse text-left text-sm ${summary.marginEnabled ? 'min-w-[900px]' : 'min-w-[720px]'}`}>
                    <thead className="bg-input-bg text-xs uppercase tracking-wide text-text-secondary">
                        <tr>
                            <th scope="col" className="px-4 py-3 font-bold">Arbetspaket</th>
                            <th scope="col" className="px-4 py-3 font-bold">Omfattning</th>
                            <th scope="col" className="px-4 py-3 font-bold">Enhet</th>
                            <th scope="col" className="px-4 py-3 text-right font-bold">Grundpris exkl. moms</th>
                            {summary.marginEnabled ? (
                                <th scope="col" className="px-4 py-3 text-right font-bold">Kundpris exkl. moms</th>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-panel-border">
                        {contractingWork.rows.map((row, index) => {
                            const priceId = `contracting-price-${row.id}`;

                            return (
                                <tr key={row.id} className="align-top">
                                    <td className="px-4 py-4 font-semibold text-text-primary">
                                        {row.workPackage || `Arbetspaket ${index + 1}`}
                                    </td>
                                    <td className="max-w-xl whitespace-pre-wrap px-4 py-4 leading-relaxed text-text-secondary">
                                        {row.scope || 'Ingen omfattning angiven'}
                                    </td>
                                    <td className="px-4 py-4 text-text-secondary">
                                        {row.unit || '–'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <label htmlFor={priceId} className="sr-only">
                                            Grundpris exkl. moms för {row.workPackage || `arbetspaket ${index + 1}`}
                                        </label>
                                        <div className="ml-auto flex w-[190px] items-center rounded-md border border-panel-border bg-input-bg focus-within:border-primary">
                                            <input
                                                id={priceId}
                                                type="number"
                                                min="0"
                                                step="1"
                                                inputMode="decimal"
                                                value={row.priceExVatSek}
                                                onChange={(event) => updateRow(row.id, {
                                                    priceExVatSek: normalizeContractingPriceInput(event.target.value)
                                                })}
                                                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-right font-bold text-text-primary outline-none"
                                            />
                                            <span className="pr-3 text-xs font-bold text-text-secondary">SEK</span>
                                        </div>
                                    </td>
                                    {summary.marginEnabled ? (
                                        <td className="whitespace-nowrap px-4 py-4 text-right font-black text-primary">
                                            {formatSek(customerPriceByRowId.get(row.id) ?? 0)}
                                        </td>
                                    ) : null}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
                <div className="rounded-lg border border-panel-border bg-input-bg/60 p-4">
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="min-w-0">
                            <div className="flex items-start gap-3">
                                <input
                                    id="contracting-ata-enabled"
                                    type="checkbox"
                                    checked={contractingWork.ata.enabled}
                                    onChange={(event) => updateContractingWork({
                                        ata: {
                                            ...contractingWork.ata,
                                            enabled: event.target.checked
                                        }
                                    })}
                                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-primary"
                                />
                                <div className="min-w-0 flex-1">
                                    <label htmlFor="contracting-ata-enabled" className="font-bold text-text-primary">
                                        Visa indikativt ÄTA-intervall
                                    </label>
                                    <p className="mb-0 mt-1 text-xs leading-relaxed text-text-secondary">
                                        Beräknar en valfri reserv samt ett lägre och övre indikativt belopp kring entreprenadens grundsumma.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 max-w-[220px]">
                                <label htmlFor="contracting-ata-percent" className="block text-xs font-bold uppercase tracking-wide text-text-secondary">
                                    ÄTA-reserv (%)
                                </label>
                                <div className="mt-2 flex items-center rounded-md border border-panel-border bg-panel-bg focus-within:border-primary">
                                    <input
                                        id="contracting-ata-percent"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={contractingWork.ata.percent}
                                        disabled={!contractingWork.ata.enabled}
                                        onChange={(event) => updateContractingWork({
                                            ata: {
                                                ...contractingWork.ata,
                                                percent: normalizeAtaPercentInput(event.target.value)
                                            }
                                        })}
                                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-right font-bold text-text-primary outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <span className="pr-3 text-sm font-bold text-text-secondary">%</span>
                                </div>
                            </div>
                        </div>

                        <div className="min-w-0 border-t border-panel-border pt-5 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                            <div className="flex items-start gap-3">
                                <input
                                    id="contracting-margin-enabled"
                                    type="checkbox"
                                    checked={contractingWork.margin.enabled}
                                    onChange={(event) => updateContractingWork({
                                        margin: {
                                            ...contractingWork.margin,
                                            enabled: event.target.checked
                                        }
                                    })}
                                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-primary"
                                />
                                <div className="min-w-0 flex-1">
                                    <label htmlFor="contracting-margin-enabled" className="font-bold text-text-primary">
                                        Lägg på marginal/påslag
                                    </label>
                                    <p className="mb-0 mt-1 text-xs leading-relaxed text-text-secondary">
                                        Läggs ovanpå samtliga entreprenadpriser och visas inte separat i kundofferten.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 max-w-[220px]">
                                <label htmlFor="contracting-margin-percent" className="block text-xs font-bold uppercase tracking-wide text-text-secondary">
                                    Marginal/påslag (%)
                                </label>
                                <div className="mt-2 flex items-center rounded-md border border-panel-border bg-panel-bg focus-within:border-primary">
                                    <input
                                        id="contracting-margin-percent"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={contractingWork.margin.percent}
                                        disabled={!contractingWork.margin.enabled}
                                        onChange={(event) => updateContractingWork({
                                            margin: {
                                                ...contractingWork.margin,
                                                percent: normalizeMarginPercentInput(event.target.value)
                                            }
                                        })}
                                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-right font-bold text-text-primary outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    <span className="pr-3 text-sm font-bold text-text-secondary">%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <dl aria-label="Intern entreprenadsummering" aria-live="polite" className="m-0 overflow-hidden rounded-lg border border-panel-border">
                    <div className="flex items-center justify-between gap-4 bg-input-bg px-4 py-3">
                        <dt className="font-bold text-text-primary">Underentreprenörens summa</dt>
                        <dd className="m-0 whitespace-nowrap font-black text-text-primary">{formatSek(summary.costTotalSek)}</dd>
                    </div>
                    {summary.marginEnabled ? (
                        <div className="flex items-center justify-between gap-4 border-t border-panel-border px-4 py-3 text-sm">
                            <dt className="text-text-secondary">Marginal/påslag ({summary.marginPercent}%)</dt>
                            <dd className="m-0 whitespace-nowrap font-semibold text-text-primary">{formatSek(summary.marginAmountSek)}</dd>
                        </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-4 border-t border-panel-border bg-primary/5 px-4 py-3">
                        <dt className="font-bold text-text-primary">Grundsumma kundpris</dt>
                        <dd className="m-0 whitespace-nowrap font-black text-text-primary">{formatSek(summary.baseTotalSek)}</dd>
                    </div>
                    {summary.ataEnabled ? (
                        <>
                            <div className="flex items-center justify-between gap-4 border-t border-panel-border px-4 py-3 text-sm">
                                <dt className="text-text-secondary">ÄTA-reserv ({summary.ataPercent}%)</dt>
                                <dd className="m-0 whitespace-nowrap font-semibold text-text-primary">{formatSek(summary.allowanceSek)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 border-t border-panel-border px-4 py-3 text-sm">
                                <dt className="text-text-secondary">Lägre indikativt belopp</dt>
                                <dd className="m-0 whitespace-nowrap font-semibold text-text-primary">{formatSek(summary.lowerIndicativeSek)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 border-t border-panel-border bg-primary/10 px-4 py-3">
                                <dt className="font-bold text-text-primary">Övre indikativt belopp</dt>
                                <dd className="m-0 whitespace-nowrap font-black text-primary">{formatSek(summary.upperIndicativeSek)}</dd>
                            </div>
                        </>
                    ) : null}
                </dl>
            </div>
        </section>
    );
}
