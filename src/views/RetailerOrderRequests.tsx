import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { catalogData } from '../data/catalog';
import { getCatalogLineName } from '../data/catalogLookup';
import { computeQuoteTotals } from '../services/calculationEngine';
import { quoteRepository } from '../services/quoteRepositoryClient';
import {
    getOrderRequestStatusLabel,
    orderRequestService
} from '../services/orderRequestService';
import { createQuotePdfBlob } from '../services/quotePdfService';
import {
    notifyError,
    notifyInfo,
    notifySuccess,
    notifyWarn
} from '../services/notificationService';
import { downloadBlob, saveBlobWithPicker } from '../utils/fileUtils';
import { getErrorMessage } from '../utils/runtime';
import { buildHistoryOpenQuotePayload } from './historyPayload';
import { hydrateQuoteState } from '../store/quoteStateSchema';
import { useAuth } from '../store/AuthContext';
import type {
    OrderRequestRecord,
    OrderRequestStatus,
    QuoteState,
    QuoteTotalsResult,
    RetailerOrderRequestsProps
} from '../types/contracts';

type OrderRequestItemOverviewStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface OrderRequestItemOverviewRow {
    id: string;
    model: string;
    size: string;
    qty: number;
    lineLabel: string;
    net: number;
    isAddon: boolean;
    isCustom: boolean;
}

interface OrderRequestItemOverviewState {
    status: OrderRequestItemOverviewStatus;
    rows: OrderRequestItemOverviewRow[];
}

function formatCurrencySek(value: number): string {
    return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatDateTime(value: number): string {
    const date = new Date(value || Date.now());
    return `${date.toLocaleDateString('sv-SE')} ${date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
}

function sanitizeFileNamePart(value: string): string {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 60);
}

function buildOrderRequestPdfFileName(request: OrderRequestRecord): string {
    const base = sanitizeFileNamePart(request.quoteNumber || request.company || request.customerName || 'order-request');
    return `${base || 'order-request'}-v${request.quoteVersion}.pdf`;
}

function buildOrderRequestItemsCacheKey(request: OrderRequestRecord): string {
    return `${request.quoteId}__v${request.quoteVersion}`;
}

async function loadSubmittedQuoteData(
    request: OrderRequestRecord
): Promise<{ state: QuoteState; summaryData: QuoteTotalsResult } | null> {
    const revision = await quoteRepository.getQuoteRevisionByVersion({
        userId: request.quoteOwnerUid,
        quoteId: request.quoteId,
        version: request.quoteVersion
    });

    if (!revision) {
        return null;
    }

    const payload = buildHistoryOpenQuotePayload(
        revision.state,
        request.quoteId,
        request.quoteNumber,
        request.quoteVersion,
        'draft'
    );
    const state = hydrateQuoteState(payload);
    const summaryData = computeQuoteTotals({ state, catalogData });

    return { state, summaryData };
}

function buildOrderRequestItemOverviewRows(summaryData: QuoteTotalsResult): OrderRequestItemOverviewRow[] {
    return summaryData.totals.map((row, index) => ({
        id: `${row.source.type}-${index}`,
        model: row.model || '-',
        size: row.size || '-',
        qty: row.qty,
        lineLabel: getCatalogLineName(row.line) || row.line || '-',
        net: row.net,
        isAddon: Boolean(row.isAddon),
        isCustom: Boolean(row.isCustom)
    }));
}

function getStatusButtonClasses(currentStatus: string, buttonStatus: OrderRequestStatus): string {
    const isActive = currentStatus === buttonStatus;

    if (isActive) {
        return 'border-primary bg-primary text-white';
    }

    return 'border-panel-border bg-panel-bg text-text-primary hover:bg-panel-border';
}

export function RetailerOrderRequests({ onBack }: RetailerOrderRequestsProps) {
    const { user } = useAuth();
    const [requests, setRequests] = useState<OrderRequestRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [selectedId, setSelectedId] = useState('');
    const [statusSaving, setStatusSaving] = useState<OrderRequestStatus | ''>('');
    const [exportingId, setExportingId] = useState('');
    const [itemOverviewByKey, setItemOverviewByKey] = useState<Record<string, OrderRequestItemOverviewState>>({});
    const itemOverviewCacheRef = useRef<Record<string, OrderRequestItemOverviewState>>({});

    const loadRequests = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError(false);
        try {
            const nextRequests = await orderRequestService.listOrderRequests({ limit: 100 });
            setRequests(nextRequests);
            setSelectedId((current) => {
                if (current && nextRequests.some((request) => request.id === current)) {
                    return current;
                }
                return nextRequests[0]?.id || '';
            });
        } catch (loadError) {
            console.error('Failed to load retailer order requests:', loadError);
            setRequests([]);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    const selectedRequest = useMemo(
        () => requests.find((request) => request.id === selectedId) || requests[0] || null,
        [requests, selectedId]
    );
    const selectedRequestItemsKey = selectedRequest ? buildOrderRequestItemsCacheKey(selectedRequest) : '';
    const selectedRequestItems = selectedRequestItemsKey
        ? itemOverviewByKey[selectedRequestItemsKey] || { status: 'idle', rows: [] }
        : { status: 'idle', rows: [] };

    const loadOrderRequestItems = useCallback(async (request: OrderRequestRecord): Promise<void> => {
        const cacheKey = buildOrderRequestItemsCacheKey(request);
        const cachedState = itemOverviewCacheRef.current[cacheKey];

        if (cachedState && cachedState.status !== 'idle') {
            return;
        }

        const loadingState: OrderRequestItemOverviewState = {
            status: 'loading',
            rows: []
        };

        itemOverviewCacheRef.current = {
            ...itemOverviewCacheRef.current,
            [cacheKey]: loadingState
        };
        setItemOverviewByKey((current) => ({
            ...current,
            [cacheKey]: loadingState
        }));

        try {
            const submittedQuoteData = await loadSubmittedQuoteData(request);

            if (!submittedQuoteData) {
                const missingState: OrderRequestItemOverviewState = {
                    status: 'missing',
                    rows: []
                };

                itemOverviewCacheRef.current = {
                    ...itemOverviewCacheRef.current,
                    [cacheKey]: missingState
                };
                setItemOverviewByKey((current) => ({
                    ...current,
                    [cacheKey]: missingState
                }));
                return;
            }

            const readyState: OrderRequestItemOverviewState = {
                status: 'ready',
                rows: buildOrderRequestItemOverviewRows(submittedQuoteData.summaryData)
            };

            itemOverviewCacheRef.current = {
                ...itemOverviewCacheRef.current,
                [cacheKey]: readyState
            };
            setItemOverviewByKey((current) => ({
                ...current,
                [cacheKey]: readyState
            }));
        } catch (loadError) {
            console.error('Failed to derive order request item overview:', loadError);
            const errorState: OrderRequestItemOverviewState = {
                status: 'error',
                rows: []
            };

            itemOverviewCacheRef.current = {
                ...itemOverviewCacheRef.current,
                [cacheKey]: errorState
            };
            setItemOverviewByKey((current) => ({
                ...current,
                [cacheKey]: errorState
            }));
        }
    }, []);

    useEffect(() => {
        if (!selectedRequest) {
            return;
        }

        void loadOrderRequestItems(selectedRequest);
    }, [loadOrderRequestItems, selectedRequest]);

    const handleStatusChange = async (status: OrderRequestStatus): Promise<void> => {
        if (!selectedRequest || statusSaving || selectedRequest.status === status) {
            return;
        }

        setStatusSaving(status);
        try {
            const updated = await orderRequestService.updateOrderRequestStatus({
                id: selectedRequest.id,
                status,
                user
            });
            setRequests((current) => current.map((request) => (
                request.id === updated.id ? updated : request
            )));
            notifySuccess(`Orderförfrågan uppdaterad till ${getOrderRequestStatusLabel(updated.status).toLowerCase()}.`);
        } catch (updateError) {
            console.error('Failed to update order request status:', updateError);
            notifyError(`Kunde inte uppdatera orderförfrågan: ${getErrorMessage(updateError, 'okänt fel')}`);
        } finally {
            setStatusSaving('');
        }
    };

    const handleExportPdf = async (): Promise<void> => {
        if (!selectedRequest || exportingId) {
            return;
        }

        setExportingId(selectedRequest.id);
        try {
            const submittedQuoteData = await loadSubmittedQuoteData(selectedRequest);

            if (!submittedQuoteData) {
                notifyError('Kunde inte hitta den sparade offertversionen för orderförfrågan.');
                return;
            }

            const pdfBlob = await createQuotePdfBlob(submittedQuoteData.state, submittedQuoteData.summaryData);

            if (!pdfBlob) {
                notifyError('Kunde inte skapa PDF för den valda offertversionen.');
                return;
            }

            const fileName = buildOrderRequestPdfFileName(selectedRequest);
            const pickerResult = await saveBlobWithPicker(pdfBlob, fileName);

            if (pickerResult === 'saved') {
                notifySuccess(`PDF sparad: ${fileName}`);
                return;
            }

            if (pickerResult === 'canceled') {
                notifyInfo('PDF-export avbröts.');
                return;
            }

            if (pickerResult === 'failed') {
                notifyWarn('Kunde inte öppna spara-dialog. Använder nedladdning i stället.');
            }

            downloadBlob(pdfBlob, fileName);
            notifySuccess(`PDF nedladdad: ${fileName}`);
        } catch (exportError) {
            console.error('Failed to export submitted quote PDF:', exportError);
            notifyError(`Kunde inte exportera PDF: ${getErrorMessage(exportError, 'okänt fel')}`);
        } finally {
            setExportingId('');
        }
    };

    return (
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 pb-16">
            <section className="rounded-2xl border border-panel-border bg-panel-bg p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="m-0 text-3xl font-semibold tracking-tight text-text-primary">Retailer Orderförfrågningar</h2>
                        <p className="mt-2 text-sm text-text-secondary">
                            Granska inkomna retailerförfrågningar, uppdatera status och exportera den exakta offertversionen vid behov.
                        </p>
                    </div>
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="rounded-md border border-panel-border bg-black/10 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
                        >
                            Tillbaka till dashboard
                        </button>
                    )}
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                <section className="rounded-2xl border border-panel-border bg-panel-bg p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="m-0 text-lg font-semibold text-text-primary">Inbox</h3>
                        <button
                            type="button"
                            onClick={() => {
                                void loadRequests();
                            }}
                            className="rounded-md border border-panel-border bg-black/10 px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-white/5"
                        >
                            Uppdatera
                        </button>
                    </div>

                    {loading ? (
                        <p className="text-sm italic text-text-secondary">Laddar orderförfrågningar...</p>
                    ) : error ? (
                        <p className="text-sm italic text-text-secondary">Kunde inte ladda orderförfrågningarna just nu.</p>
                    ) : requests.length === 0 ? (
                        <p className="text-sm italic text-text-secondary">Inga orderförfrågningar har registrerats ännu.</p>
                    ) : (
                        <div className="flex max-h-[760px] flex-col gap-3 overflow-y-auto pr-1">
                            {requests.map((request) => {
                                const isSelected = selectedRequest?.id === request.id;

                                return (
                                    <button
                                        key={request.id}
                                        type="button"
                                        onClick={() => setSelectedId(request.id)}
                                        className={`rounded-xl border p-4 text-left transition-colors ${
                                            isSelected
                                                ? 'border-primary bg-primary/10'
                                                : 'border-panel-border bg-black/10 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-text-primary">{request.quoteNumber}</div>
                                                <div className="mt-1 truncate text-sm text-text-secondary">
                                                    {request.retailerName} · {request.company || request.customerName || 'Okänd kund'}
                                                </div>
                                            </div>
                                            <span className="rounded-full border border-panel-border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-text-primary">
                                                {getOrderRequestStatusLabel(request.status)}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
                                            <span>v{request.quoteVersion}</span>
                                            <span>{formatDateTime(request.createdAtMs)}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-panel-border bg-panel-bg p-6 shadow-sm">
                    {!selectedRequest ? (
                        <div className="flex min-h-[320px] items-center justify-center text-center text-sm text-text-secondary">
                            Välj en orderförfrågan för att se detaljer.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-4 border-b border-panel-border pb-5 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">Orderförfrågan</div>
                                    <h3 className="mt-2 text-2xl font-semibold text-text-primary">{selectedRequest.quoteNumber}</h3>
                                    <p className="mt-2 text-sm text-text-secondary">
                                        Registrerad {formatDateTime(selectedRequest.createdAtMs)} av {selectedRequest.retailerName}.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                                        {getOrderRequestStatusLabel(selectedRequest.status)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void handleExportPdf();
                                        }}
                                        disabled={exportingId === selectedRequest.id}
                                        className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {exportingId === selectedRequest.id ? 'Exporterar PDF...' : 'Exportera PDF'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                    <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Retailer</h4>
                                    <div className="mt-3 space-y-2 text-sm text-text-primary">
                                        <div><strong>Namn:</strong> {selectedRequest.retailerName}</div>
                                        <div><strong>E-post:</strong> {selectedRequest.retailerEmail}</div>
                                        <div><strong>Skapad av:</strong> {selectedRequest.createdByEmail || '-'}</div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                    <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Kund</h4>
                                    <div className="mt-3 space-y-2 text-sm text-text-primary">
                                        <div><strong>Företag:</strong> {selectedRequest.company || '-'}</div>
                                        <div><strong>Kontakt:</strong> {selectedRequest.customerName || '-'}</div>
                                        <div><strong>Referens:</strong> {selectedRequest.reference || '-'}</div>
                                        <div><strong>Kundreferens:</strong> {selectedRequest.customerReference || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                                <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                    <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Valda produktlinjer</h4>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedRequest.selectedLines.length === 0 ? (
                                            <span className="text-sm text-text-secondary">Inga produktlinjer sparades i snapshoten.</span>
                                        ) : (
                                            selectedRequest.selectedLines.map((lineId) => (
                                                <span
                                                    key={lineId}
                                                    className="rounded-full border border-panel-border bg-panel-bg px-3 py-1 text-sm text-text-primary"
                                                >
                                                    {getCatalogLineName(lineId) || lineId}
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                    <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Ordervärde</h4>
                                    <div className="mt-3 text-2xl font-semibold text-text-primary">
                                        {formatCurrencySek(selectedRequest.totalSek)}
                                    </div>
                                    <p className="mt-2 text-xs text-text-secondary">
                                        Snapshot från den inskickade offertversionen v{selectedRequest.quoteVersion}.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-panel-border bg-black/10 p-4" data-testid="order-request-items">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Produkter i orderförfrågan</h4>
                                    <span className="text-xs text-text-secondary">
                                        Snabböversikt från offertversion v{selectedRequest.quoteVersion}.
                                    </span>
                                </div>

                                {selectedRequestItems.status === 'loading' || selectedRequestItems.status === 'idle' ? (
                                    <p className="mt-4 text-sm italic text-text-secondary">Laddar produkter från sparad offertversion...</p>
                                ) : selectedRequestItems.status === 'missing' ? (
                                    <div className="mt-4 rounded-lg border border-panel-border bg-panel-bg p-4 text-sm text-text-secondary">
                                        Den sparade offertversionen kunde inte hittas för denna orderförfrågan. PDF-export finns fortfarande kvar som fallback vid behov.
                                    </div>
                                ) : selectedRequestItems.status === 'error' ? (
                                    <div className="mt-4 rounded-lg border border-panel-border bg-panel-bg p-4 text-sm text-text-secondary">
                                        Kunde inte bygga produktöversikten från den sparade offertversionen. PDF-export finns fortfarande tillgänglig.
                                    </div>
                                ) : selectedRequestItems.rows.length === 0 ? (
                                    <p className="mt-4 text-sm italic text-text-secondary">Inga produkter kunde utläsas från den sparade offertversionen.</p>
                                ) : (
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="w-full min-w-[620px] border-collapse text-left">
                                            <thead>
                                                <tr className="border-b border-panel-border text-[11px] uppercase tracking-wider text-text-secondary">
                                                    <th className="px-3 py-2 font-bold">Modell</th>
                                                    <th className="px-3 py-2 font-bold">Storlek</th>
                                                    <th className="px-3 py-2 text-center font-bold">Antal</th>
                                                    <th className="px-3 py-2 font-bold">Produktlinje</th>
                                                    <th className="px-3 py-2 text-right font-bold">Nettopris</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-panel-border/50">
                                                {selectedRequestItems.rows.map((row) => (
                                                    <tr
                                                        key={row.id}
                                                        className={`${row.isAddon ? 'bg-black/5 text-text-secondary italic' : 'text-text-primary'} ${row.isCustom ? 'italic text-secondary/80' : ''}`}
                                                    >
                                                        <td className={`px-3 py-3 text-sm ${row.isAddon ? 'pl-8' : ''}`}>{row.model}</td>
                                                        <td className="px-3 py-3 text-sm text-text-secondary">{row.size}</td>
                                                        <td className="px-3 py-3 text-center text-sm">{row.qty}</td>
                                                        <td className="px-3 py-3 text-sm text-text-secondary">{row.lineLabel}</td>
                                                        <td className="px-3 py-3 text-right text-sm font-semibold text-primary whitespace-nowrap">
                                                            {formatCurrencySek(row.net)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Statushantering</h4>
                                <p className="mt-2 text-sm text-text-secondary">
                                    Uppdaterad senast {formatDateTime(selectedRequest.updatedAtMs)} av {selectedRequest.statusUpdatedByEmail || '-'}.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    {(['new', 'reviewing', 'completed'] as OrderRequestStatus[]).map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => {
                                                void handleStatusChange(status);
                                            }}
                                            disabled={Boolean(statusSaving)}
                                            className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${getStatusButtonClasses(selectedRequest.status, status)}`}
                                        >
                                            {statusSaving === status ? 'Sparar...' : getOrderRequestStatusLabel(status)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
