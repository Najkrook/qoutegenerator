import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getCatalogLineIds, getCatalogLineName } from '../data/catalogLookup';
import {
    getRetailerDocumentKindLabel,
    retailerDocumentService
} from '../services/retailerDocumentService';
import { notifyError } from '../services/notificationService';
import { useAuth } from '../store/AuthContext';
import { getErrorMessage } from '../utils/runtime';
import type {
    RetailerDocumentsProps,
    RetailerLineDocument,
    RetailerLineDocumentsRecord
} from '../types/contracts';

function getActiveRetailerLineIds(productLines: Record<string, { enabled?: boolean }> | null | undefined): string[] {
    return getCatalogLineIds().filter((lineId) => Boolean(productLines?.[lineId]?.enabled));
}

export function RetailerDocuments({ onBack }: RetailerDocumentsProps) {
    const { retailer } = useAuth();
    const [documentsByLine, setDocumentsByLine] = useState<Record<string, RetailerLineDocumentsRecord>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const activeLineIds = useMemo(
        () => getActiveRetailerLineIds(retailer?.productLines),
        [retailer?.productLines]
    );

    const loadDocuments = useCallback(async (): Promise<void> => {
        if (activeLineIds.length === 0) {
            setDocumentsByLine({});
            setError('');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        try {
            const records = await retailerDocumentService.getRetailerDocumentsForLines({ lineIds: activeLineIds });
            const nextDocumentsByLine = records.reduce<Record<string, RetailerLineDocumentsRecord>>((acc, record) => {
                acc[record.lineId] = record;
                return acc;
            }, {});
            setDocumentsByLine(nextDocumentsByLine);
        } catch (loadError) {
            console.error('Failed to load retailer documents:', loadError);
            setDocumentsByLine({});
            setError('Kunde inte ladda produktdokument just nu.');
        } finally {
            setLoading(false);
        }
    }, [activeLineIds]);

    useEffect(() => {
        void loadDocuments();
    }, [loadDocuments]);

    const visibleLineRecords = activeLineIds
        .map((lineId) => documentsByLine[lineId] || { lineId, documents: [], updatedAt: 0, updatedBy: '', updatedByUid: '' })
        .filter((record) => record.documents.length > 0);

    const handleOpenDocument = (document: RetailerLineDocument): void => {
        try {
            window.open(document.url, '_blank', 'noopener,noreferrer');
        } catch (openError) {
            console.error('Failed to open retailer document:', openError);
            notifyError(getErrorMessage(openError, 'Kunde inte öppna PDF-länken.'));
        }
    };

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-16 animate-slide-in">
            <section className="rounded-2xl border border-panel-border bg-panel-bg p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="m-0 text-3xl font-semibold tracking-tight text-text-primary">Produktdokument</h2>
                        <p className="mt-2 text-sm text-text-secondary">
                            Se färgkartor och installationsinstruktioner för de produktlinjer som är aktiva för ert retailer-konto.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                void loadDocuments();
                            }}
                            className="rounded-md border border-panel-border bg-black/10 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
                        >
                            Uppdatera
                        </button>
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

            {loading ? (
                <section className="rounded-2xl border border-panel-border bg-panel-bg p-8 text-sm text-text-secondary">
                    Laddar dokument...
                </section>
            ) : error ? (
                <section className="rounded-2xl border border-danger/30 bg-danger/10 p-8 text-sm text-text-primary">
                    {error}
                </section>
            ) : activeLineIds.length === 0 ? (
                <section className="rounded-2xl border border-panel-border bg-panel-bg p-8 text-sm text-text-secondary">
                    Inga produktlinjer är aktiva för ert retailer-konto ännu, så det finns inga dokument att visa.
                </section>
            ) : visibleLineRecords.length === 0 ? (
                <section className="rounded-2xl border border-panel-border bg-panel-bg p-8 text-sm text-text-secondary">
                    Det finns inga publicerade PDF-dokument för era aktiva produktlinjer ännu.
                </section>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {visibleLineRecords.map((record) => (
                        <section
                            key={record.lineId}
                            className="rounded-2xl border border-panel-border bg-panel-bg p-6 shadow-sm"
                            data-testid={`retailer-documents-${record.lineId}`}
                        >
                            <div className="border-b border-panel-border pb-4">
                                <h3 className="m-0 text-xl font-semibold text-text-primary">
                                    {getCatalogLineName(record.lineId) || record.lineId}
                                </h3>
                                <p className="mt-2 text-sm text-text-secondary">
                                    {record.documents.length} dokument tillgängliga för den här produktlinjen.
                                </p>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-4">
                                {record.documents.map((document) => (
                                    <div
                                        key={document.id}
                                        className="rounded-xl border border-panel-border bg-black/10 p-5"
                                    >
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="m-0 text-lg font-semibold text-text-primary">{document.title}</h4>
                                                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                                                        {getRetailerDocumentKindLabel(document.kind)}
                                                    </span>
                                                </div>
                                                {document.description && (
                                                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{document.description}</p>
                                                )}
                                                <div className="mt-3 text-xs text-text-secondary">
                                                    Filnamn: {document.fileName}
                                                </div>
                                            </div>

                                            <div className="flex shrink-0 flex-wrap gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDocument(document)}
                                                    className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                                                >
                                                    Visa PDF
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
