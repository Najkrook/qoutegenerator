import React, { useEffect, useMemo, useState } from 'react';
import { getCatalogLineName } from '../data/catalogLookup';
import {
    getRetailerOrderRequestStatusLabel,
    orderRequestService
} from '../services/orderRequestService';
import { useAuth } from '../store/AuthContext';
import type { OrderRequestRecord, RetailerOrderHistoryProps } from '../types/contracts';

const RETAILER_ORDER_PAGE_SIZE = 25;

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

function getRetailerOrderRequestStatusClasses(status: string): string {
    switch (status) {
        case 'completed':
            return 'border-success/35 bg-success/10 text-success';
        case 'reviewing':
            return 'border-warning/35 bg-warning/10 text-warning';
        case 'new':
        default:
            return 'border-primary/35 bg-primary/10 text-primary';
    }
}

export function RetailerOrderHistory({ onBack }: RetailerOrderHistoryProps) {
    const { user, retailer } = useAuth();
    const [pageSize, setPageSize] = useState(RETAILER_ORDER_PAGE_SIZE);
    const [requests, setRequests] = useState<OrderRequestRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedId, setSelectedId] = useState('');
    const [selectedRequestLive, setSelectedRequestLive] = useState<OrderRequestRecord | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(false);

        const unsubscribe = orderRequestService.subscribeOwnOrderRequests(
            {
                user,
                limit: pageSize + 1
            },
            (records) => {
                setRequests(records);
                setLoading(false);
                setError(false);
                setSelectedId((current) => {
                    const visibleRecords = records.slice(0, pageSize);
                    if (current && visibleRecords.some((record) => record.id === current)) {
                        return current;
                    }

                    return visibleRecords[0]?.id || '';
                });
            },
            (loadError) => {
                console.error('Failed to subscribe to retailer order requests:', loadError);
                setRequests([]);
                setLoading(false);
                setError(true);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [pageSize, user]);

    useEffect(() => {
        if (!selectedId) {
            setSelectedRequestLive(null);
            return;
        }

        const unsubscribe = orderRequestService.subscribeOrderRequestById(
            { id: selectedId },
            (record) => {
                setSelectedRequestLive(record);
            },
            (loadError) => {
                console.error('Failed to subscribe to selected retailer order request:', loadError);
                setSelectedRequestLive(null);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [selectedId]);

    const visibleRequests = useMemo(
        () => requests.slice(0, pageSize),
        [pageSize, requests]
    );
    const hasMore = requests.length > pageSize;
    const selectedFromList = visibleRequests.find((request) => request.id === selectedId) || visibleRequests[0] || null;
    const selectedRequest = selectedRequestLive?.id === selectedId
        ? selectedRequestLive
        : selectedFromList;

    return (
        <div className="mx-auto flex max-w-[1480px] flex-col gap-6 pb-16 animate-slide-in">
            <section className="rounded-2xl border border-panel-border bg-panel-bg p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="m-0 text-3xl font-semibold tracking-tight text-text-primary">Mina orderförfrågningar</h2>
                        <p className="mt-2 text-sm text-text-secondary">
                            Följ era skickade orderförfrågningar i realtid och se när BRIXX börjar hantera dem.
                        </p>
                        <p className="mt-2 text-xs text-text-secondary">
                            Uppdateras automatiskt när status ändras av BRIXX.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="rounded-full border border-panel-border bg-black/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-text-secondary">
                            {retailer?.name || user?.email || 'Retailer'}
                        </span>
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
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                <section className="rounded-2xl border border-panel-border bg-panel-bg p-5 shadow-sm" data-testid="retailer-order-history-list">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h3 className="m-0 text-lg font-semibold text-text-primary">Skickade ordrar</h3>
                            <p className="mt-1 text-xs text-text-secondary">
                                Visar de senaste {Math.min(pageSize, visibleRequests.length)} orderförfrågningarna.
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <p className="text-sm italic text-text-secondary">Laddar orderförfrågningar...</p>
                    ) : error ? (
                        <p className="text-sm italic text-text-secondary">Kunde inte ladda era orderförfrågningar just nu.</p>
                    ) : visibleRequests.length === 0 ? (
                        <p className="text-sm italic text-text-secondary">Ni har inte skickat några orderförfrågningar ännu.</p>
                    ) : (
                        <>
                            <div className="flex max-h-[760px] flex-col gap-3 overflow-y-auto pr-1">
                                {visibleRequests.map((request) => {
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
                                                        {request.company || request.customerName || 'Okänd kund'}
                                                    </div>
                                                </div>
                                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${getRetailerOrderRequestStatusClasses(request.status)}`}>
                                                    {getRetailerOrderRequestStatusLabel(request.status)}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary">
                                                <span>{formatCurrencySek(request.totalSek)}</span>
                                                <span>{formatDateTime(request.createdAtMs)}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {hasMore && (
                                <button
                                    type="button"
                                    onClick={() => setPageSize((current) => current + RETAILER_ORDER_PAGE_SIZE)}
                                    className="mt-4 w-full rounded-md border border-panel-border bg-black/10 px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
                                >
                                    Ladda fler
                                </button>
                            )}
                        </>
                    )}
                </section>

                <section className="rounded-2xl border border-panel-border bg-panel-bg p-6 shadow-sm" data-testid="retailer-order-history-detail">
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
                                        Skickad {formatDateTime(selectedRequest.createdAtMs)}.
                                    </p>
                                </div>
                                <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${getRetailerOrderRequestStatusClasses(selectedRequest.status)}`}>
                                    {getRetailerOrderRequestStatusLabel(selectedRequest.status)}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                    <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Kund</h4>
                                    <div className="mt-3 space-y-2 text-sm text-text-primary">
                                        <div><strong>Företag:</strong> {selectedRequest.company || '-'}</div>
                                        <div><strong>Kontakt:</strong> {selectedRequest.customerName || '-'}</div>
                                        <div><strong>Referens:</strong> {selectedRequest.reference || '-'}</div>
                                        <div><strong>Kundreferens:</strong> {selectedRequest.customerReference || '-'}</div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                    <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Status</h4>
                                    <div className="mt-3 space-y-3">
                                        <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getRetailerOrderRequestStatusClasses(selectedRequest.status)}`}>
                                            {getRetailerOrderRequestStatusLabel(selectedRequest.status)}
                                        </div>
                                        <p className="m-0 text-sm text-text-secondary">
                                            Senast uppdaterad {formatDateTime(selectedRequest.updatedAtMs)}.
                                        </p>
                                        <p className="m-0 text-xs text-text-secondary">
                                            Offertversion v{selectedRequest.quoteVersion} följs separat från offertens vanliga status.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                                <div className="rounded-xl border border-panel-border bg-black/10 p-4">
                                    <h4 className="m-0 text-sm font-bold uppercase tracking-wide text-text-secondary">Valda produktlinjer</h4>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedRequest.selectedLines.length === 0 ? (
                                            <span className="text-sm text-text-secondary">Inga produktlinjer sparades i orderförfrågan.</span>
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
                                        Snapshot från den skickade orderförfrågan.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
