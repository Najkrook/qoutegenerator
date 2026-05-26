import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import { computeQuoteTotals } from '../services/calculationEngine';
import { CustomerInfoForm } from '../components/features/CustomerInfoForm';
import { FinalSummaryTable } from '../components/features/FinalSummaryTable';
import { TermsAndPaymentPanel } from '../components/features/TermsAndPaymentPanel';
import { downloadBlob, saveBlobWithPicker } from '../utils/fileUtils';
import { createQuotePdfBlob } from '../services/quotePdfService';
import { quoteRepository } from '../services/quoteRepositoryClient';
import { saveQuoteToRepository } from '../services/quoteSaveService';
import { safeLogActivity } from '../services/activityLogService';
import { hasZeroDiscountSummary } from '../services/exportDataBuilders';
import { buildQuoteRevisionLink } from '../navigation/quoteLinks';
import {
    getOrderRequestStatusLabel,
    getRetailerOrderRequestStatusLabel,
    orderRequestService
} from '../services/orderRequestService';
import {
    notifyError,
    notifyInfo,
    notifySuccess,
    notifyWarn
} from '../services/notificationService';
import { getErrorMessage } from '../utils/runtime';
import type {
    ExcelExportModule,
    OrderRequestRecord,
    QuoteState,
    QuoteTotalsResult,
    SavedQuoteStatePatch,
    SummaryExportProps
} from '../types/contracts';

interface ActivityLogResultLike {
    ok?: boolean;
}

interface PdfExportOptions {
    allowMissingQuoteNumber?: boolean;
}

function sanitizeFileNamePart(value: string): string {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50);
}

function buildPdfFileName(customerInfo: QuoteState['customerInfo']): string {
    const rawRef = customerInfo.reference?.trim();
    const rawName = customerInfo.company?.trim() || customerInfo.name?.trim();
    const date = customerInfo.date || new Date().toISOString().slice(0, 10);
    const base = rawRef || rawName || 'Offert';
    const safeBase = sanitizeFileNamePart(base);
    return `${safeBase || 'Offert'}-${date}.pdf`;
}

function getActivityCustomerLabel(customerInfo: QuoteState['customerInfo']): string {
    return customerInfo.company || customerInfo.name || '';
}

function getOrderRequestStatusClasses(status: string): string {
    switch (status) {
        case 'completed':
            return 'border-success/35 bg-success/10 text-success';
        case 'reviewing':
            return 'border-primary/35 bg-primary/10 text-primary';
        case 'new':
        default:
            return 'border-warning/35 bg-warning/10 text-warning';
    }
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

export function getPdfExportBlockReason(quoteNumber: QuoteState['quoteNumber'] | null | undefined): string | null {
    if (quoteNumber) {
        return null;
    }

    return 'Offerten saknar offertnummer. Spara offerten f\u00F6r att tilldela ett nummer, eller exportera \u00E4nd\u00E5 utan nummer.';
    return quoteNumber
        ? null
        : 'Spara offerten först för att tilldela ett offertnummer innan PDF-export.';
}

async function exportExcelWorkbook(state: QuoteState, summaryData: QuoteTotalsResult): Promise<void> {
    const excelModule: ExcelExportModule = await import('../features/excelExport');
    const { generateExcel } = excelModule;

    if (typeof generateExcel !== 'function') {
        throw new Error('Excel export is unavailable.');
    }

    await generateExcel(state, summaryData);
}

function warnIfActivityLogFailed(result: ActivityLogResultLike | null | undefined, message: string): void {
    if (result?.ok === false) {
        notifyWarn(message);
    }
}

function logPdfExportActivity({
    user,
    state,
    fileName,
    missingQuoteNumber
}: {
    user: ReturnType<typeof useAuth>['user'];
    state: QuoteState;
    fileName: string;
    missingQuoteNumber: boolean;
}): void {
    void safeLogActivity({
        user,
        eventType: 'quote_export_pdf',
        system: 'quote',
        targetType: 'quote',
        targetId: state.activeQuoteId || 'unsaved_quote',
        details: `PDF exporterad: ${fileName}`,
        metadata: {
            format: 'pdf',
            fileName,
            version: state.activeQuoteVersion || null,
            customerName: getActivityCustomerLabel(state.customerInfo),
            reference: state.customerInfo.reference || '',
            missingQuoteNumber
        }
    }).then((result) => warnIfActivityLogFailed(result, 'PDF-exporten lyckades, men aktivitetsloggen kunde inte uppdateras.'));
}

export function SummaryExport({ onPrev, onBackToSketch, onOpenRetailerOrderHistory }: SummaryExportProps) {
    const { state, dispatch } = useQuote();
    const { user, retailer, isRetailer } = useAuth();
    const summaryData = useMemo(
        () => computeQuoteTotals({ state, catalogData }),
        [state]
    );
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [isSavingQuote, setIsSavingQuote] = useState(false);
    const [orderRequest, setOrderRequest] = useState<OrderRequestRecord | null>(null);
    const [isLoadingOrderRequest, setIsLoadingOrderRequest] = useState(false);
    const [isSubmittingOrderRequest, setIsSubmittingOrderRequest] = useState(false);
    const [hasJustSubmittedOrderRequest, setHasJustSubmittedOrderRequest] = useState(false);
    const previewUrlRef = useRef<string>('');
    const exportBlockReason = getPdfExportBlockReason(state.quoteNumber);
    const canSubmitOrderRequest = Boolean(
        isRetailer
        && state.activeQuoteId
        && state.quoteNumber
        && Number(state.activeQuoteVersion) > 0
    );

    useEffect(() => {
        if (hasZeroDiscountSummary(summaryData) || state.hideZeroDiscountReferencesInPdf !== true) {
            return;
        }

        dispatch({
            type: 'SET_HIDE_ZERO_DISCOUNT_REFERENCES_IN_PDF',
            payload: false
        });
    }, [dispatch, state.hideZeroDiscountReferencesInPdf, summaryData]);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const pdfBlob = await createQuotePdfBlob(state, summaryData);
            if (cancelled) return;

            if (!pdfBlob) {
                if (previewUrlRef.current) {
                    URL.revokeObjectURL(previewUrlRef.current);
                    previewUrlRef.current = '';
                }
                setPreviewUrl('');
                setPreviewError('Kunde inte skapa PDF-förhandsvisning. Kontrollera offertinnehållet och försök igen.');
                return;
            }

            const nextUrl = URL.createObjectURL(pdfBlob);
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }

            previewUrlRef.current = nextUrl;
            setPreviewUrl(nextUrl);
            setPreviewError('');
        })();

        return () => {
            cancelled = true;
        };
    }, [state, summaryData]);

    useEffect(() => {
        if (!canSubmitOrderRequest || !state.activeQuoteId) {
            setOrderRequest(null);
            setIsLoadingOrderRequest(false);
            setHasJustSubmittedOrderRequest(false);
            return;
        }

        let cancelled = false;
        setIsLoadingOrderRequest(true);

        void orderRequestService.getOrderRequestByQuoteVersion({
            quoteId: state.activeQuoteId,
            quoteVersion: state.activeQuoteVersion
        }).then((record) => {
            if (cancelled) return;
            setOrderRequest(record);
            if (!record) {
                setHasJustSubmittedOrderRequest(false);
            }
        }).catch((error) => {
            if (cancelled) return;
            console.error('Failed to load current order request:', error);
            setOrderRequest(null);
            setHasJustSubmittedOrderRequest(false);
        }).finally(() => {
            if (cancelled) return;
            setIsLoadingOrderRequest(false);
        });

        return () => {
            cancelled = true;
        };
    }, [canSubmitOrderRequest, state.activeQuoteId, state.activeQuoteVersion]);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = '';
            }
        };
    }, []);

    const handleBack = (): void => {
        if (onPrev) {
            onPrev();
        }
    };

    const handleExportPDF = async ({ allowMissingQuoteNumber = false }: PdfExportOptions = {}): Promise<void> => {
        if (exportBlockReason && !allowMissingQuoteNumber) {
            notifyError(exportBlockReason);
            return;
        }

        const fileName = buildPdfFileName(state.customerInfo);
        const pdfBlob = await createQuotePdfBlob(state, summaryData);
        if (!pdfBlob) {
            notifyError('Kunde inte skapa PDF.');
            return;
        }

        const pickerResult = await saveBlobWithPicker(pdfBlob, fileName);
        if (pickerResult === 'saved') {
            logPdfExportActivity({
                user,
                state,
                fileName,
                missingQuoteNumber: !state.quoteNumber
            });
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

        if (pickerResult === 'failed' || pickerResult === 'unavailable') {
            downloadBlob(pdfBlob, fileName);
            logPdfExportActivity({
                user,
                state,
                fileName,
                missingQuoteNumber: !state.quoteNumber
            });
            notifySuccess(`PDF nedladdad: ${fileName}`);
        }
    };

    const handleExportExcel = async (): Promise<void> => {
        try {
            await exportExcelWorkbook(state, summaryData);
            void safeLogActivity({
                user,
                eventType: 'quote_export_excel',
                system: 'quote',
                targetType: 'quote',
                targetId: state.activeQuoteId || 'unsaved_quote',
                details: 'Excel exporterad: Offert.xlsx',
                metadata: {
                    format: 'excel',
                    fileName: 'Offert.xlsx',
                    version: state.activeQuoteVersion || null,
                    customerName: getActivityCustomerLabel(state.customerInfo),
                    reference: state.customerInfo.reference || ''
                }
            }).then((result) => warnIfActivityLogFailed(result, 'Excel-exporten lyckades, men aktivitetsloggen kunde inte uppdateras.'));
        } catch (error) {
            console.error('Failed to export Excel:', error);
            notifyError('Kunde inte skapa Excel.');
        }
    };

    const handleCopyQuoteLink = async (): Promise<void> => {
        if (!state.activeQuoteId) return;

        try {
            if (!navigator.clipboard?.writeText) {
                throw new Error('Clipboard API unavailable.');
            }

            const path = buildQuoteRevisionLink({
                quoteId: state.activeQuoteId,
                version: state.activeQuoteVersion
            });
            await navigator.clipboard.writeText(`${window.location.origin}${path}`);
            notifySuccess('L\u00e4nk kopierad.');
        } catch (error) {
            console.error('Failed to copy quote link:', error);
            notifyError('Kunde inte kopiera l\u00e4nken.');
        }
    };

    const handleSaveQuote = async (): Promise<void> => {
        if (isSavingQuote) return;

        setIsSavingQuote(true);
        try {
            const { saved, isNewQuote, statePatch } = await saveQuoteToRepository({
                quoteRepository,
                user,
                retailer,
                state,
                summary: summaryData
            });
            const saveStatePatch: SavedQuoteStatePatch = statePatch;

            dispatch({
                type: 'UPDATE_STATE',
                payload: saveStatePatch
            });

            void safeLogActivity({
                user,
                eventType: isNewQuote ? 'quote_created' : 'quote_revision_saved',
                system: 'quote',
                targetType: isNewQuote ? 'quote' : 'revision',
                targetId: saveStatePatch.activeQuoteId || saved?.quoteId || 'unknown_quote',
                details: isNewQuote
                    ? 'Offert skapad och sparad i Mina Offerter.'
                    : `Offerten sparades som version ${saveStatePatch.activeQuoteVersion}.`,
                metadata: {
                    version: saveStatePatch.activeQuoteVersion || null,
                    customerName: getActivityCustomerLabel(state.customerInfo),
                    reference: state.customerInfo.reference || '',
                    totalSek: summaryData.finalTotalSek || 0
                }
            }).then((result) => warnIfActivityLogFailed(result, 'Offerten sparades, men aktivitetsloggen kunde inte uppdateras.'));

            if (isNewQuote) {
                notifySuccess('Offerten sparades i Mina Offerter.');
            } else {
                notifySuccess(`Offerten sparades som version ${saveStatePatch.activeQuoteVersion}.`);
            }
        } catch (error) {
            console.error('Failed to save quote:', error);
            notifyError(`Kunde inte spara offerten: ${getErrorMessage(error, 'okänt fel')}`);
        } finally {
            setIsSavingQuote(false);
        }
    };

    const handleSubmitOrderRequest = async (): Promise<void> => {
        if (!canSubmitOrderRequest || isSubmittingOrderRequest || !retailer) {
            return;
        }

        setIsSubmittingOrderRequest(true);
        try {
            const createdRequest = await orderRequestService.createOrderRequest({
                user,
                retailer,
                state,
                summary: summaryData
            });
            setOrderRequest(createdRequest);
            setHasJustSubmittedOrderRequest(true);
            notifySuccess('Tack för din order! Den är nu skickad till BRIXX för vidare hantering.');
        } catch (error) {
            console.error('Failed to submit order request:', error);
            notifyError(`Kunde inte skicka orderförfrågan: ${getErrorMessage(error, 'okänt fel')}`);
        } finally {
            setIsSubmittingOrderRequest(false);
        }
    };

    return (
        <div className="max-w-[1760px] mx-auto pb-20">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_620px] gap-8 items-start">
                <div>
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight uppercase">Offertsammanställning</h2>
                            <p className="text-text-secondary mt-1">Granska kunduppgifter och slutgiltiga belopp före export.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {onBackToSketch && (
                                <button
                                    type="button"
                                    onClick={onBackToSketch}
                                    className="px-6 py-2.5 bg-panel-bg border border-panel-border text-text-secondary rounded-lg font-medium hover:bg-panel-border hover:text-white transition-all text-sm tracking-wide"
                                >
                                    Tillbaka till ritning
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    void handleSaveQuote();
                                }}
                                disabled={isSavingQuote}
                                className="px-6 py-2.5 bg-success/10 border border-success/40 text-success rounded-lg font-bold hover:bg-success/20 hover:border-success/60 active:bg-success/30 transition-all text-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                            >
                                {isSavingQuote ? 'Sparar...' : 'Spara offert'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <section>
                            <CustomerInfoForm />
                        </section>

                        <section>
                            <TermsAndPaymentPanel summaryData={summaryData} />
                        </section>


                        <section className="bg-panel-bg border border-panel-border rounded-lg p-6 shadow-sm">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <span className="text-primary text-xl" aria-hidden="true">📋</span> Summering
                            </h3>
                            <FinalSummaryTable />
                            <section className="mt-8 flex flex-col gap-6">
                                {exportBlockReason && (
                                    <div className="flex items-start gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-5 shadow-sm">
                                        <div className="flex-shrink-0 text-2xl" aria-hidden="true">⚠️</div>
                                        <div>
                                            <h4 className="m-0 text-base font-bold text-amber-200">Offerten saknar offertnummer</h4>
                                            <p className="m-0 mt-1 text-sm text-amber-100/90">{exportBlockReason}</p>
                                            <p className="m-0 mt-2 text-sm text-amber-100/80">
                                                Spara offert är rekommenderat, men du kan fortfarande exportera PDF:n utan nummer.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col xl:flex-row justify-between items-center gap-4 rounded-xl border border-panel-border bg-black/40 p-3 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className="w-full xl:w-auto px-6 py-3 bg-panel-bg border border-panel-border text-text-secondary rounded-lg font-medium hover:bg-panel-border hover:text-white transition-all text-sm tracking-wide flex items-center justify-center gap-2 group whitespace-nowrap"
                                    >
                                        <span className="group-hover:-translate-x-1 transition-transform">&larr;</span>
                                        Tillbaka för att ändra priser
                                    </button>

                                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleSaveQuote();
                                            }}
                                            disabled={isSavingQuote}
                                            className="w-full sm:w-auto px-6 py-3 bg-success/10 border border-success/40 text-success rounded-lg font-bold hover:bg-success/20 hover:border-success/60 active:bg-success/30 transition-all text-sm tracking-wide flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                        >
                                            <span aria-hidden="true" className="opacity-70">💾</span> {isSavingQuote ? 'Sparar...' : 'Spara offert'}
                                        </button>
                                        
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleCopyQuoteLink();
                                            }}
                                            disabled={!state.activeQuoteId}
                                            className="w-full sm:w-auto px-6 py-3 bg-panel-bg border border-panel-border text-white rounded-lg font-bold hover:bg-white/5 transition-all text-sm tracking-wide flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Kopiera länk
                                        </button>

                                        {exportBlockReason && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleExportPDF({ allowMissingQuoteNumber: true });
                                                }}
                                                className="w-full sm:w-auto px-6 py-3 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg font-bold hover:bg-amber-500/20 transition-all text-sm tracking-wide flex items-center justify-center gap-2"
                                            >
                                                <span aria-hidden="true">!</span> Exportera ändå
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleExportPDF();
                                            }}
                                            disabled={Boolean(exportBlockReason)}
                                            className="w-full sm:w-auto px-8 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all text-sm tracking-wide flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                                        >
                                            <span aria-hidden="true">📄</span> Exportera som PDF
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                void handleExportExcel();
                                            }}
                                            disabled={Boolean(exportBlockReason)}
                                            className="w-full sm:w-auto px-6 py-3 bg-panel-bg border border-panel-border text-white rounded-lg font-bold hover:bg-white/5 transition-all text-sm tracking-wide flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <span aria-hidden="true" className={exportBlockReason ? "opacity-50" : "opacity-70"}>📊</span> Exportera som Excel
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {isRetailer && (
                                <section className="rounded-xl border border-panel-border bg-panel-bg p-6 shadow-sm mt-8">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="max-w-3xl">
                                            <h3 className="m-0 text-lg font-bold text-text-primary">Skicka orderförfrågan till BRIXX</h3>
                                            <p className="mt-2 text-sm text-text-secondary">
                                                När offerten är sparad kan den skickas in som en orderförfrågan för intern hantering hos BRIXX.
                                            </p>
                                            {!canSubmitOrderRequest && (
                                                <p className="mt-3 text-sm text-amber-200">
                                                    Spara offerten först för att kunna skicka en orderförfrågan.
                                                </p>
                                            )}
                                            {orderRequest && (
                                                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                                                    <span className={`rounded-full border px-3 py-1 font-semibold ${getRetailerOrderRequestStatusClasses(orderRequest.status)}`}>
                                                        {getRetailerOrderRequestStatusLabel(orderRequest.status)}
                                                    </span>
                                                    <span className="text-text-secondary">
                                                        Registrerad för version v{orderRequest.quoteVersion}.
                                                    </span>
                                                </div>
                                            )}
                                            {isLoadingOrderRequest && (
                                                <p className="mt-3 text-sm text-text-secondary">Kontrollerar aktuell orderförfrågan...</p>
                                            )}
                                            {orderRequest && (
                                                <div className="mt-4 rounded-xl border border-success/25 bg-success/10 p-4">
                                                    <h4 className="m-0 text-base font-semibold text-text-primary">
                                                        {hasJustSubmittedOrderRequest ? 'Tack för din order!' : 'Orderförfrågan registrerad'}
                                                    </h4>
                                                    <p className="mt-2 text-sm text-text-secondary">
                                                        {hasJustSubmittedOrderRequest
                                                            ? 'Du kan följa statusen live under Skickade ordrar. Där ser du när BRIXX börjar hantera ärendet.'
                                                            : 'Följ statusen för era skickade ordrar under Skickade ordrar.'}
                                                    </p>
                                                    {onOpenRetailerOrderHistory && (
                                                        <button
                                                            type="button"
                                                            onClick={onOpenRetailerOrderHistory}
                                                            className="mt-4 rounded-md border border-panel-border bg-black/10 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-white/5"
                                                        >
                                                            Se skickade ordrar
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[280px]">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void handleSubmitOrderRequest();
                                                }}
                                                disabled={!canSubmitOrderRequest || Boolean(orderRequest) || isSubmittingOrderRequest || isLoadingOrderRequest}
                                                className="rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isSubmittingOrderRequest
                                                    ? 'Skickar orderförfrågan...'
                                                    : orderRequest
                                                        ? `Orderförfrågan registrerad för v${orderRequest.quoteVersion}`
                                                        : 'Skicka orderförfrågan'}
                                            </button>
                                            <p className="m-0 text-xs text-text-secondary">
                                                Det här påverkar inte offertens vanliga status utan skapar ett separat adminärende.
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </section>
                    </div>
                </div>

                <aside className="bg-panel-bg border border-panel-border rounded-lg p-4 xl:sticky xl:top-4 shadow-sm">
                    <h3 className="text-base font-bold text-text-primary">PDF förhandsvisning</h3>
                    <p className="text-xs text-text-secondary mt-1">Uppdateras automatiskt när offertdata ändras.</p>
                    <div className="mt-3 h-[860px] bg-white border border-panel-border rounded-md overflow-hidden">
                        {previewUrl ? (
                            <iframe
                                title="PDF förhandsvisning"
                                src={previewUrl}
                                className="w-full h-full"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center p-6 text-center text-sm text-text-secondary bg-black/5">
                                {previewError || 'Genererar PDF-förhandsvisning...'}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
