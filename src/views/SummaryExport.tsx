import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import { computeQuoteTotals } from '../services/calculationEngine';
import { CustomerInfoForm } from '../components/features/CustomerInfoForm';
import { FinalSummaryTable } from '../components/features/FinalSummaryTable';
import { TermsAndPaymentPanel } from '../components/features/TermsAndPaymentPanel';
import { downloadBlob, saveBlobWithPicker } from '../utils/fileUtils';
import { quoteRepository } from '../services/quoteRepositoryClient';
import { saveQuoteToRepository } from '../services/quoteSaveService';
import { safeLogActivity } from '../services/activityLogService';
import { hasZeroDiscountSummary } from '../services/exportDataBuilders';
import {
    notifyError,
    notifyInfo,
    notifySuccess,
    notifyWarn
} from '../services/notificationService';
import { getErrorMessage } from '../utils/runtime';
import type {
    ExcelExportModule,
    PdfExportModule,
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

export function getPdfExportBlockReason(quoteNumber: QuoteState['quoteNumber'] | null | undefined): string | null {
    if (quoteNumber) {
        return null;
    }

    return 'Offerten saknar offertnummer. Spara offerten f\u00F6r att tilldela ett nummer, eller exportera \u00E4nd\u00E5 utan nummer.';
    return quoteNumber
        ? null
        : 'Spara offerten först för att tilldela ett offertnummer innan PDF-export.';
}

async function createPdfBlob(state: QuoteState, summaryData: QuoteTotalsResult): Promise<Blob | null> {
    try {
        const pdfModule: PdfExportModule = await import('../features/pdfExport');
        const { generatePDF } = pdfModule;

        if (typeof generatePDF !== 'function') {
            return null;
        }

        const result = await generatePDF(state, summaryData, true);
        return result ?? null;
    } catch (error) {
        console.error('Failed to load PDF export module:', error);
        return null;
    }
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

export function SummaryExport({ onPrev, onBackToSketch }: SummaryExportProps) {
    const { state, dispatch } = useQuote();
    const { user, retailer } = useAuth();
    const summaryData = useMemo(
        () => computeQuoteTotals({ state, catalogData }),
        [state]
    );
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [isSavingQuote, setIsSavingQuote] = useState(false);
    const previewUrlRef = useRef<string>('');
    const exportBlockReason = getPdfExportBlockReason(state.quoteNumber);

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
            const pdfBlob = await createPdfBlob(state, summaryData);
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
        const pdfBlob = await createPdfBlob(state, summaryData);
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
                        </section>

                        <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4 p-6 bg-black/40 border border-panel-border rounded-xl">
                            <button
                                type="button"
                                onClick={handleBack}
                                className="text-text-secondary hover:text-white transition-colors flex items-center gap-2 group whitespace-nowrap text-sm md:text-base"
                            >
                                <span className="group-hover:-translate-x-1 transition-transform">&larr;</span>
                                Tillbaka för att ändra priser
                            </button>

                            <div className="flex flex-col gap-3 w-full md:w-auto md:items-end">
                                {exportBlockReason && (
                                    <div className="max-w-[420px] rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                        <p className="m-0 font-semibold">{'Offerten saknar offertnummer'}</p>
                                        <p className="m-0 mt-1 text-amber-100/90">{exportBlockReason}</p>
                                        <p className="m-0 mt-2 text-amber-100/80">{'Spara offert \u00E4r rekommenderat, men du kan fortfarande exportera PDF:n utan nummer.'}</p>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full md:w-auto md:justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        void handleExportPDF();
                                    }}
                                    disabled={Boolean(exportBlockReason)}
                                    className="px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all tracking-wide flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary"
                                >
                                    <span aria-hidden="true">📄</span> Exportera som PDF
                                </button>
                                {exportBlockReason && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void handleExportPDF({ allowMissingQuoteNumber: true });
                                        }}
                                        className="px-6 py-3 bg-amber-500/15 text-amber-100 border border-amber-400/35 rounded-lg font-bold hover:bg-amber-500/25 transition-all tracking-wide flex items-center justify-center gap-2"
                                    >
                                        <span aria-hidden="true">!</span> {'Exportera \u00E4nd\u00E5'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        void handleExportExcel();
                                    }}
                                    className="px-6 py-3 bg-success text-white rounded-lg font-bold hover:bg-success-hover shadow-lg shadow-success/20 transition-all tracking-wide flex items-center justify-center gap-2"
                                >
                                    <span aria-hidden="true">📊</span> Exportera som Excel
                                </button>
                            </div>
                            </div>
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
