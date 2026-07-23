import React from 'react';
import { useQuote } from '../../store/QuoteContext';
import type {
    ContractingWorkRow,
    ContractingWorkState
} from '../../types/contracts';

let fallbackRowSequence = 0;

export function createContractingWorkRow(): ContractingWorkRow {
    const id = typeof globalThis.crypto?.randomUUID === 'function'
        ? `contracting-${globalThis.crypto.randomUUID()}`
        : `contracting-${Date.now()}-${++fallbackRowSequence}`;

    return {
        id,
        workPackage: '',
        scope: '',
        unit: '',
        priceExVatSek: 0
    };
}

export function ContractingWorkEditor() {
    const { state, dispatch } = useQuote();
    const contractingWork = state.contractingWork;
    const hasNamedRow = contractingWork.rows.some((row) => row.workPackage.trim().length > 0);

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

    const addRow = (): void => {
        updateContractingWork({ rows: [...contractingWork.rows, createContractingWorkRow()] });
    };

    const removeRow = (rowId: string): void => {
        updateContractingWork({ rows: contractingWork.rows.filter((row) => row.id !== rowId) });
    };

    return (
        <section aria-labelledby="contracting-work-editor-heading">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                        Entreprenadarbete
                    </p>
                    <h3 id="contracting-work-editor-heading" className="mt-2 text-xl font-bold text-text-primary">
                        Arbetspaket och omfattning
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
                        Beskriv arbetet med fri text. Minst ett arbetspaket behöver ett namn för att offerten ska kunna prissättas.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={addRow}
                    className="w-full rounded-md border border-primary bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/20 sm:w-auto"
                >
                    Lägg till arbetspaket
                </button>
            </div>

            <div className="mb-6 rounded-xl border border-panel-border bg-panel-bg p-5 shadow-sm">
                <label htmlFor="contracting-project-name" className="block text-xs font-bold uppercase tracking-wide text-text-secondary">
                    Projektnamn (valfritt)
                </label>
                <input
                    id="contracting-project-name"
                    type="text"
                    value={contractingWork.projectName}
                    onChange={(event) => updateContractingWork({ projectName: event.target.value })}
                    placeholder="Exempel: Designer Village, Löddeköpinge"
                    className="mt-2 w-full rounded-md border border-panel-border bg-input-bg px-3 py-2.5 text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary"
                />
                <p className="mb-0 mt-2 text-xs text-text-secondary">
                    Projektnamnet används i entreprenaddelens rubrik i offerten.
                </p>
            </div>

            {contractingWork.rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-panel-border bg-panel-bg/60 px-6 py-10 text-center">
                    <p className="m-0 font-medium text-text-primary">Inga arbetspaket har lagts till ännu.</p>
                    <p className="mb-0 mt-2 text-sm text-text-secondary">
                        Lägg till ett arbetspaket för att beskriva entreprenadens omfattning.
                    </p>
                    <button
                        type="button"
                        onClick={addRow}
                        className="mt-5 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                    >
                        Lägg till första arbetspaketet
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {contractingWork.rows.map((row, index) => {
                        const workPackageId = `contracting-work-package-${row.id}`;
                        const scopeId = `contracting-scope-${row.id}`;
                        const unitId = `contracting-unit-${row.id}`;

                        return (
                            <article key={row.id} className="rounded-xl border border-panel-border bg-panel-bg p-5 shadow-sm">
                                <div className="mb-4 flex items-center justify-between gap-4">
                                    <h4 className="m-0 text-base font-bold text-text-primary">Arbetspaket {index + 1}</h4>
                                    <button
                                        type="button"
                                        onClick={() => removeRow(row.id)}
                                        aria-label={`Ta bort arbetspaket ${index + 1}`}
                                        className="rounded-md border border-danger/40 px-3 py-1.5 text-xs font-bold text-danger transition-colors hover:bg-danger/10"
                                    >
                                        Ta bort
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(10rem,0.65fr)]">
                                    <div>
                                        <label htmlFor={workPackageId} className="block text-xs font-bold uppercase tracking-wide text-text-secondary">
                                            Arbetspaket
                                        </label>
                                        <input
                                            id={workPackageId}
                                            type="text"
                                            value={row.workPackage}
                                            onChange={(event) => updateRow(row.id, { workPackage: event.target.value })}
                                            placeholder="Exempel: Markarbete och fundament"
                                            className="mt-2 w-full rounded-md border border-panel-border bg-input-bg px-3 py-2.5 text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor={scopeId} className="block text-xs font-bold uppercase tracking-wide text-text-secondary">
                                            Omfattning
                                        </label>
                                        <textarea
                                            id={scopeId}
                                            rows={4}
                                            value={row.scope}
                                            onChange={(event) => updateRow(row.id, { scope: event.target.value })}
                                            placeholder="Beskriv vad som ingår i arbetet, leveransen och installationen."
                                            className="mt-2 w-full resize-y rounded-md border border-panel-border bg-input-bg px-3 py-2.5 text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor={unitId} className="block text-xs font-bold uppercase tracking-wide text-text-secondary">
                                            Enhet
                                        </label>
                                        <input
                                            id={unitId}
                                            type="text"
                                            value={row.unit}
                                            onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                                            placeholder="Exempel: Samlat arbetspaket"
                                            className="mt-2 w-full rounded-md border border-panel-border bg-input-bg px-3 py-2.5 text-text-primary outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary"
                                        />
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {!hasNamedRow && contractingWork.rows.length > 0 ? (
                <p role="status" className="mb-0 mt-3 text-sm font-medium text-warning">
                    Ange ett namn på minst ett arbetspaket för att fortsätta.
                </p>
            ) : null}
        </section>
    );
}
