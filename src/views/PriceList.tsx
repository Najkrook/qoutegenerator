import React, { useDeferredValue, useMemo, useState } from 'react';
import { IconChevronDown, IconSearch } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import { catalogData } from '../data/catalog';
import { useAuth } from '../store/AuthContext';
import { useQuote } from '../store/QuoteContext';
import {
    applyPriceListDiscount,
    buildPriceListEntries,
    convertPriceListEntryToSek,
    filterPriceListEntries,
    getRetailerLineDiscount,
    getVisiblePriceListLineIds,
    type PriceListEntry,
    type PriceListEntryKind
} from '../services/priceList';

const ALL_PRICE_LIST_ENTRIES = buildPriceListEntries(catalogData);
const PRICE_LIST_KINDS = new Set<PriceListEntryKind>(['product', 'addon']);

interface PriceListSection {
    id: string;
    lineId: string;
    lineName: string;
    name: string;
    rows: PriceListEntry[];
}

interface PriceListRowGroup {
    name: string | null;
    rows: PriceListEntry[];
}

function formatAmount(value: number): string {
    return new Intl.NumberFormat('sv-SE', {
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatSourcePrice(entry: PriceListEntry): string {
    return `${formatAmount(entry.unitPrice)} ${entry.currency}`;
}

function formatSek(value: number): string {
    return `${formatAmount(value)} SEK`;
}

function groupPriceListEntries(entries: PriceListEntry[]): PriceListSection[] {
    const sections = new Map<string, PriceListSection>();

    entries.forEach((entry) => {
        const existing = sections.get(entry.sectionId);
        if (existing) {
            existing.rows.push(entry);
            return;
        }

        sections.set(entry.sectionId, {
            id: entry.sectionId,
            lineId: entry.lineId,
            lineName: entry.lineName,
            name: entry.sectionName,
            rows: [entry]
        });
    });

    return Array.from(sections.values());
}

function groupPriceListRows(rows: PriceListEntry[]): PriceListRowGroup[] {
    const groups: PriceListRowGroup[] = [];

    rows.forEach((row) => {
        const previousGroup = groups.at(-1);
        if (previousGroup?.name === row.variantCategory) {
            previousGroup.rows.push(row);
            return;
        }

        groups.push({
            name: row.variantCategory,
            rows: [row]
        });
    });

    return groups;
}

export function PriceList() {
    const { state } = useQuote();
    const { isRetailer, retailer } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [eurToSek, setEurToSek] = useState(() => (
        Number.isFinite(state.exchangeRate) && state.exchangeRate > 0
            ? state.exchangeRate
            : 12.2
    ));

    const visibleLineIds = useMemo(
        () => getVisiblePriceListLineIds(catalogData, isRetailer, retailer),
        [isRetailer, retailer]
    );
    const visibleLineIdSet = useMemo(() => new Set(visibleLineIds), [visibleLineIds]);
    const requestedLineId = searchParams.get('line') || 'all';
    const selectedLineId = requestedLineId === 'all' || visibleLineIdSet.has(requestedLineId)
        ? requestedLineId
        : 'all';
    const requestedKind = searchParams.get('kind');
    const selectedKind: PriceListEntryKind | 'all' = requestedKind && PRICE_LIST_KINDS.has(requestedKind as PriceListEntryKind)
        ? requestedKind as PriceListEntryKind
        : 'all';
    const search = searchParams.get('q') || '';
    const deferredSearch = useDeferredValue(search);

    const visibleEntries = useMemo(() => ALL_PRICE_LIST_ENTRIES.filter((entry) => (
        visibleLineIdSet.has(entry.lineId)
    )), [visibleLineIdSet]);
    const filteredEntries = useMemo(() => filterPriceListEntries(visibleEntries, {
        kind: selectedKind,
        lineId: selectedLineId,
        search: deferredSearch
    }), [deferredSearch, selectedKind, selectedLineId, visibleEntries]);
    const sections = useMemo(() => groupPriceListEntries(filteredEntries), [filteredEntries]);
    const hasEurPrices = visibleEntries.some((entry) => entry.currency === 'EUR');
    const hasActiveFilters = selectedLineId !== 'all' || selectedKind !== 'all' || search.length > 0;

    const updateSearchParam = (key: string, value: string, defaultValue = '') => {
        const nextParams = new URLSearchParams(searchParams);
        if (!value || value === defaultValue) {
            nextParams.delete(key);
        } else {
            nextParams.set(key, value);
        }
        setSearchParams(nextParams, { replace: true });
    };

    const clearFilters = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('q');
        nextParams.delete('line');
        nextParams.delete('kind');
        setSearchParams(nextParams, { replace: true });
    };

    return (
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 animate-fade-in">
            <PageHeader
                eyebrow="Försäljning"
                title="Prislista"
                description="Sök bland produkter, storlekar och tillbehör utan att skapa eller ändra en offert. Alla priser visas exklusive moms."
            />

            <Panel>
                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div>
                        <label htmlFor="price-list-search" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                            Sök i prislistan
                        </label>
                        <div className="relative">
                            <IconSearch
                                aria-hidden="true"
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                                size={19}
                                stroke={1.8}
                            />
                            <input
                                id="price-list-search"
                                type="search"
                                value={search}
                                onChange={(event) => updateSearchParam('q', event.target.value)}
                                placeholder="Sök produkt, modell, storlek eller tillbehör"
                                className="min-h-12 w-full rounded-control border border-control-border bg-input py-3 pl-10 pr-4 text-sm text-text outline-none placeholder:text-text-muted focus:border-action focus:ring-2 focus:ring-focus-ring/30"
                            />
                        </div>
                    </div>

                    {hasEurPrices ? (
                        <div className="min-w-56">
                            <label htmlFor="price-list-exchange-rate" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">
                                Visningskurs EUR till SEK
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-text-muted">1 EUR =</span>
                                <input
                                    id="price-list-exchange-rate"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={eurToSek}
                                    onChange={(event) => setEurToSek(Math.max(0, Number(event.target.value) || 0))}
                                    className="min-h-12 w-24 rounded-control border border-control-border bg-input px-3 py-2 text-right font-semibold tabular-nums text-text outline-none focus:border-action focus:ring-2 focus:ring-focus-ring/30"
                                />
                                <span className="text-sm text-text-muted">SEK</span>
                            </div>
                            <p className="mb-0 mt-1 text-xs text-text-muted">Ändrar bara omräkningen på denna sida.</p>
                        </div>
                    ) : null}
                </div>

                <div className="border-t border-border px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap gap-2" aria-label="Filtrera på produktlinje">
                        <Button
                            size="sm"
                            variant={selectedLineId === 'all' ? 'primary' : 'secondary'}
                            aria-pressed={selectedLineId === 'all'}
                            onClick={() => updateSearchParam('line', 'all', 'all')}
                        >
                            Alla produktlinjer
                        </Button>
                        {visibleLineIds.map((lineId) => (
                            <Button
                                key={lineId}
                                size="sm"
                                variant={selectedLineId === lineId ? 'primary' : 'secondary'}
                                aria-pressed={selectedLineId === lineId}
                                onClick={() => updateSearchParam('line', lineId, 'all')}
                            >
                                {catalogData[lineId].name}
                            </Button>
                        ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filtrera på pristyp">
                        {([
                            ['all', 'Alla typer'],
                            ['product', 'Produkter'],
                            ['addon', 'Tillbehör']
                        ] as const).map(([kind, label]) => (
                            <Button
                                key={kind}
                                size="sm"
                                variant={selectedKind === kind ? 'primary' : 'ghost'}
                                aria-pressed={selectedKind === kind}
                                onClick={() => updateSearchParam('kind', kind, 'all')}
                            >
                                {label}
                            </Button>
                        ))}
                        {hasActiveFilters ? (
                            <Button size="sm" variant="ghost" onClick={clearFilters}>
                                Rensa filter
                            </Button>
                        ) : null}
                    </div>
                </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-3 px-1" aria-live="polite">
                <p className="m-0 text-sm text-text-muted">
                    Visar <strong className="text-text">{filteredEntries.length}</strong> av {visibleEntries.length} priser
                </p>
                {isRetailer ? (
                    <StatusChip tone="success">Avtalade priser visas</StatusChip>
                ) : null}
            </div>

            {visibleLineIds.length === 0 ? (
                <Panel>
                    <p className="m-0 p-6 text-sm text-warning-text">
                        Inga produktlinjer är aktiva för kontot ännu. Kontakta Brixx om ni behöver tillgång till prislistan.
                    </p>
                </Panel>
            ) : sections.length === 0 ? (
                <Panel>
                    <div className="p-8 text-center">
                        <h2 className="m-0 text-lg font-semibold text-text">Inga priser matchar sökningen</h2>
                        <p className="mb-5 mt-2 text-sm text-text-muted">Prova ett annat sökord eller rensa filtren.</p>
                        <Button onClick={clearFilters}>Rensa filter</Button>
                    </div>
                </Panel>
            ) : (
                <div className="space-y-8">
                    {visibleLineIds.map((lineId) => {
                        const lineSections = sections.filter((section) => section.lineId === lineId);
                        if (lineSections.length === 0) {
                            return null;
                        }

                        return (
                            <section key={lineId} aria-labelledby={`price-list-line-${lineId}`}>
                                <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
                                    <h2 id={`price-list-line-${lineId}`} className="m-0 text-2xl font-semibold text-text">
                                        {catalogData[lineId].name}
                                    </h2>
                                    <StatusChip>{catalogData[lineId].currency}</StatusChip>
                                    {isRetailer ? (
                                        <StatusChip tone="success">
                                            {getRetailerLineDiscount(lineId, true, retailer)}% rabatt
                                        </StatusChip>
                                    ) : null}
                                </div>

                                <div className="space-y-4">
                                    {lineSections.map((section) => (
                                        <PriceListSectionTable
                                            key={section.id}
                                            section={section}
                                            eurToSek={eurToSek}
                                            retailerDiscount={getRetailerLineDiscount(lineId, isRetailer, retailer)}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function PriceListSectionTable({
    eurToSek,
    retailerDiscount,
    section
}: {
    eurToSek: number;
    retailerDiscount: number | null;
    section: PriceListSection;
}) {
    const showSekConversion = section.rows.some((row) => row.currency === 'EUR');
    const rowGroups = groupPriceListRows(section.rows);
    const columnCount = 3 + Number(showSekConversion) + Number(retailerDiscount !== null);

    const priceCountLabel = `${section.rows.length} ${section.rows.length === 1 ? 'pris' : 'priser'}`;

    return (
        <details className="group rounded-panel border border-border bg-surface-raised shadow-panel [content-visibility:auto] [contain-intrinsic-size:64px]">
            <summary
                aria-label={`Visa eller dölj ${section.name}, ${priceCountLabel}`}
                className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-panel px-5 py-4 transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring [&::-webkit-details-marker]:hidden"
            >
                <h3 className="m-0 text-base font-semibold text-text">{section.name}</h3>
                <span className="flex shrink-0 items-center gap-3 text-xs text-text-muted">
                    {priceCountLabel}
                    <IconChevronDown
                        aria-hidden="true"
                        className="transition-transform duration-200 group-open:rotate-180"
                        size={19}
                        stroke={1.9}
                    />
                </span>
            </summary>

            <div className="hidden overflow-x-auto border-t border-border md:block">
                <table className="w-full border-collapse text-left">
                    <caption className="sr-only">Prislista för {section.lineName}, {section.name}</caption>
                    <thead className="bg-surface">
                        <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-text-muted">
                            <th scope="col" className="px-5 py-3">Artikel</th>
                            <th scope="col" className="px-5 py-3">Storlek</th>
                            <th scope="col" className="px-5 py-3 text-right">Listpris</th>
                            {showSekConversion ? <th scope="col" className="px-5 py-3 text-right">Omräknat SEK</th> : null}
                            {retailerDiscount !== null ? <th scope="col" className="px-5 py-3 text-right">Ert pris SEK</th> : null}
                        </tr>
                    </thead>
                    <tbody>
                        {rowGroups.map((group, groupIndex) => (
                            <React.Fragment key={`${group.name || 'uncategorized'}-${groupIndex}`}>
                                {group.name ? (
                                    <tr className="border-y border-action/20 bg-action-soft/50">
                                        <th
                                            scope="rowgroup"
                                            colSpan={columnCount}
                                            className="px-5 py-2 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-action-soft-text"
                                        >
                                            {group.name}
                                        </th>
                                    </tr>
                                ) : null}
                                {group.rows.map((row) => {
                                    const sekPrice = convertPriceListEntryToSek(row, eurToSek);
                                    const retailerPrice = applyPriceListDiscount(sekPrice, retailerDiscount);

                                    return (
                                        <tr key={row.id} className="border-b border-border/70 last:border-b-0">
                                            <td className="px-5 py-3 text-sm font-medium text-text">{row.name}</td>
                                            <td className="px-5 py-3 text-sm text-text-muted">{row.size || '—'}</td>
                                            <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-semibold tabular-nums text-text">
                                                {row.priceUponRequest ? <StatusChip tone="warning">Pris på förfrågan</StatusChip> : formatSourcePrice(row)}
                                            </td>
                                            {showSekConversion ? (
                                                <td className="whitespace-nowrap px-5 py-3 text-right text-sm tabular-nums text-text-muted">
                                                    {row.priceUponRequest ? '—' : formatSek(sekPrice)}
                                                </td>
                                            ) : null}
                                            {retailerDiscount !== null ? (
                                                <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-semibold tabular-nums text-success-text">
                                                    {row.priceUponRequest || retailerPrice === null ? '—' : formatSek(retailerPrice)}
                                                </td>
                                            ) : null}
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="border-t border-border md:hidden">
                {rowGroups.map((group, groupIndex) => (
                    <section key={`${group.name || 'uncategorized'}-${groupIndex}`}>
                        {group.name ? (
                            <h4 className="m-0 border-y border-action/20 bg-action-soft/50 px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-action-soft-text">
                                {group.name}
                            </h4>
                        ) : null}
                        <div className="divide-y divide-border">
                            {group.rows.map((row) => {
                                const sekPrice = convertPriceListEntryToSek(row, eurToSek);
                                const retailerPrice = applyPriceListDiscount(sekPrice, retailerDiscount);

                                return (
                                    <article key={row.id} className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <h5 className="m-0 text-sm font-semibold text-text">{row.name}</h5>
                                                {row.size ? <p className="mb-0 mt-1 text-xs text-text-muted">Storlek: {row.size}</p> : null}
                                            </div>
                                            {row.priceUponRequest ? <StatusChip tone="warning">Pris på förfrågan</StatusChip> : null}
                                        </div>
                                        {!row.priceUponRequest ? (
                                            <dl className="mb-0 mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                <dt className="text-text-muted">Listpris</dt>
                                                <dd className="m-0 text-right font-semibold tabular-nums text-text">{formatSourcePrice(row)}</dd>
                                                {row.currency === 'EUR' ? (
                                                    <>
                                                        <dt className="text-text-muted">Omräknat SEK</dt>
                                                        <dd className="m-0 text-right tabular-nums text-text">{formatSek(sekPrice)}</dd>
                                                    </>
                                                ) : null}
                                                {retailerDiscount !== null && retailerPrice !== null ? (
                                                    <>
                                                        <dt className="text-text-muted">Ert pris SEK</dt>
                                                        <dd className="m-0 text-right font-semibold tabular-nums text-success-text">{formatSek(retailerPrice)}</dd>
                                                    </>
                                                ) : null}
                                            </dl>
                                        ) : null}
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </details>
    );
}
