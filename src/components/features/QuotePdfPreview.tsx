import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { quoteRepository } from '../../services/quoteRepositoryClient';
import type { QuotePreparationAudience } from '../../services/quotePreparation';
import type { QuoteMetadata } from '../../types/contracts';

interface QuotePdfPreviewProps {
    quote: QuoteMetadata;
    ownerUid: string;
    version?: number;
    audience?: QuotePreparationAudience;
    onClose: () => void;
}

export function QuotePdfPreview({ quote, ownerUid, version, audience, onClose }: QuotePdfPreviewProps) {
    const [attempt, setAttempt] = useState(0);
    const [preview, setPreview] = useState<{
        url: string;
        version: number;
        quoteNumber: string | null;
        usesCurrentCatalog: boolean;
    } | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        let objectUrl = '';
        setPreview(null);
        setError('');

        void (async () => {
            try {
                const [payload, preparation, pdfService] = await Promise.all([
                    version === undefined
                        ? quoteRepository.getQuoteLatestRevision({ userId: ownerUid, quoteId: quote.quoteId })
                        : quoteRepository.getQuoteRevisionByVersion({ userId: ownerUid, quoteId: quote.quoteId, version })
                            .then((revision) => ({ metadata: quote, revision })),
                    import('../../services/savedQuotePdfPreparation'),
                    import('../../services/quotePdfService')
                ]);
                if (cancelled) return;
                if (!payload?.revision) {
                    setError('Offertversionen kunde inte hittas.');
                    return;
                }
                if (!payload.revision.state) {
                    setError('Revisionen saknar sparat tillstånd.');
                    return;
                }
                const prepared = preparation.prepareSavedQuoteForPdf({
                    revision: payload.revision,
                    metadata: payload.metadata,
                    audience
                });
                const blob = await pdfService.createQuotePdfBlob(prepared.preparedQuote);
                if (cancelled) return;
                if (!blob) {
                    setError('Kunde inte skapa PDF-förhandsvisning. Försök igen.');
                    return;
                }
                objectUrl = URL.createObjectURL(blob);
                setPreview({
                    url: objectUrl,
                    version: payload.revision.version,
                    quoteNumber: payload.metadata.quoteNumber,
                    usesCurrentCatalog: prepared.usesCurrentCatalog
                });
            } catch (loadError) {
                if (cancelled) return;
                console.error('Failed to preview saved quote:', loadError);
                setError('Kunde inte läsa eller förhandsgranska offerten. Försök igen.');
            }
        })();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [quote, ownerUid, version, audience, attempt]);

    return (
        <Modal
            title="Förhandsgranska PDF"
            description={`${quote.company || quote.customerName || 'Okänd kund'} · ${preview?.quoteNumber || quote.quoteNumber || 'Offert'} · ${preview ? `v${preview.version}` : version === undefined ? 'Senaste sparade versionen' : `v${version}`}`}
            maxWidthClassName="max-w-6xl"
            onClose={onClose}
        >
            <div className="flex h-[75dvh] min-h-0 flex-col" aria-busy={!preview && !error}>
                {preview?.usesCurrentCatalog && (
                    <p className="m-0 border-b border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning-text">
                        Äldre offertversion: PDF:en återskapas med dagens produktkatalog och kan avvika från den ursprungliga offerten.
                    </p>
                )}
                {preview ? (
                    <iframe title={`PDF-förhandsvisning v${preview.version}`} tabIndex={0} src={preview.url} className="min-h-0 w-full flex-1 border-0 bg-white" />
                ) : error ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                        <p role="alert">{error}</p>
                        <Button onClick={() => setAttempt((current) => current + 1)}>Försök igen</Button>
                    </div>
                ) : (
                    <p role="status" className="m-auto p-6">Genererar PDF-förhandsvisning…</p>
                )}
            </div>
        </Modal>
    );
}
