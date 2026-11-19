import React, { useState } from 'react';
import { contractingCatalog } from '../../data/contractingCatalog';
import { isContractingQuantity } from '../../services/contractingWork';
import { confirmAction } from '../../services/notificationService';
import { useQuote } from '../../store/QuoteContext';
import type {
    ContractingWorkProvider,
    ContractingWorkRow,
    ContractingWorkState
} from '../../types/contracts';

let fallbackRowSequence = 0;
const formatSek = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
const categories = [undefined, ...(Object.keys(contractingCatalog) as ContractingWorkProvider[])];

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
    const { provider, rows } = contractingWork;
    const [isSwitchingCategory, setIsSwitchingCategory] = useState(false);
    const hasNamedRow = rows.some((row) => row.workPackage.trim().length > 0);
    const availableServices = provider ? contractingCatalog[provider].services : [];
    const selectedById = new Map(rows.map((row) => [row.id, row]));
    const serviceOptions: ContractingWorkRow[] = [
        ...availableServices.map((service) => selectedById.get(service.id) ?? ({
            id: service.id,
            workPackage: service.name,
            scope: service.scope ?? '',
            unit: 'st',
            unitPriceExVatSek: service.unitPriceExVatSek,
            priceExVatSek: service.unitPriceExVatSek
        })),
        ...rows.filter((row) => row.quantity !== undefined && !availableServices.some((service) => service.id === row.id))
    ];

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

    const selectCategory = async (nextProvider: ContractingWorkProvider | undefined): Promise<void> => {
        if (nextProvider === provider || isSwitchingCategory) return;

        if (rows.some((row) => row.workPackage.trim() || row.scope.trim() || row.unit.trim() || row.priceExVatSek > 0)) {
            setIsSwitchingCategory(true);
            const confirmed = await confirmAction({
                title: 'Byt entreprenadkategori?',
                message: 'Arbetspaketen eller tjänsterna i den valda kategorin tas bort när du byter.',
                confirmText: 'Byt kategori',
                tone: 'danger'
            });
            setIsSwitchingCategory(false);
            if (!confirmed) return;
        }

        updateContractingWork({
            provider: nextProvider,
            rows: nextProvider ? [] : [createContractingWorkRow()]
        });
    };

    return (
        <section aria-labelledby="contracting-work-category">
            <fieldset disabled={isSwitchingCategory} className="mb-6 min-w-0">
                <legend id="contracting-work-category" className="mb-3 text-sm font-bold text-text-primary">
                    Entreprenadkategori
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                    {categories.map((category) => (
                        <label
                            key={category ?? 'free-text'}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold text-text-primary ${
                                provider === category ? 'border-action bg-action-soft' : 'border-panel-border bg-panel-bg'
                            }`}
                        >
                            <input
                                type="radio"
                                name="contracting-category"
                                checked={provider === category}
                                onChange={() => { void selectCategory(category); }}
                                className="h-4 w-4 shrink-0 accent-action"
                            />
                            {category ? contractingCatalog[category].name : 'Fritext'}
                        </label>
                    ))}
                </div>
            </fieldset>
            {!provider && (
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="m-0 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                            Entreprenadarbete
                        </p>
                        <h3 className="mt-2 text-xl font-bold text-text-primary">Arbetspaket och omfattning</h3>
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
            )}

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

            {provider ? (
                <div className="space-y-3">
                    <h3 className="text-xl font-bold text-text-primary">Installationstjänster</h3>
                    {serviceOptions.length === 0 && (
                        <p className="rounded-xl border border-dashed border-panel-border p-5 text-sm text-text-secondary">
                            {contractingCatalog[provider].name} har inga tjänster i katalogen ännu.
                        </p>
                    )}
                    {serviceOptions.map((service) => (
                        <div key={service.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4 rounded-xl border border-panel-border bg-panel-bg p-4">
                            <label className="flex cursor-pointer items-center gap-3 text-text-primary">
                                <input
                                    type="checkbox"
                                    checked={service.quantity !== undefined}
                                    onChange={(event) => {
                                        if (event.target.checked) {
                                            updateContractingWork({ rows: [...rows, { ...service, quantity: 1 }] });
                                        } else {
                                            removeRow(service.id);
                                        }
                                    }}
                                    className="h-5 w-5 shrink-0 accent-action"
                                />
                                <span>
                                    <span className="block font-semibold">{service.workPackage}</span>
                                    <span className="block text-sm text-text-secondary">
                                        {formatSek.format(service.unitPriceExVatSek ?? 0)} SEK/st exkl. moms
                                    </span>
                                    {service.scope && <span className="block text-sm text-text-secondary">{service.scope}</span>}
                                </span>
                            </label>
                            {service.quantity !== undefined && (
                                <label className="flex items-center gap-2 text-sm text-text-primary">
                                    Antal
                                    <input
                                        aria-label={`Antal för ${service.workPackage}`}
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={service.quantity}
                                        onFocus={(event) => event.currentTarget.select()}
                                        onChange={(event) => {
                                            const quantity = event.currentTarget.valueAsNumber;
                                            if (isContractingQuantity(quantity)) updateRow(service.id, { quantity });
                                        }}
                                        className="w-16 rounded-md border border-panel-border bg-input-bg px-3 py-2 text-text-primary sm:w-24"
                                    />
                                </label>
                            )}
                        </div>
                    ))}
                    {serviceOptions.length > 0 && rows.length === 0 && (
                        <p role="status" className="text-sm font-medium text-warning">Välj minst en tjänst för en entreprenadoffert.</p>
                    )}
                </div>
            ) : contractingWork.rows.length === 0 ? (
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

            {!provider && !hasNamedRow && contractingWork.rows.length > 0 ? (
                <p role="status" className="mb-0 mt-3 text-sm font-medium text-warning">
                    Ange ett namn på minst ett arbetspaket för att fortsätta.
                </p>
            ) : null}
        </section>
    );
}
