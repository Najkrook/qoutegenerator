import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
import { hasZeroDiscountSummary } from '../services/exportDataBuilders.js';

function sanitizeFileNamePart(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50);
}

function buildPdfFileName(customerInfo = {}) {
    const rawRef = customerInfo.reference?.trim();
    const rawName = customerInfo.company?.trim() || customerInfo.name?.trim();
    const date = customerInfo.date || new Date().toISOString().slice(0, 10);
    const base = rawRef || rawName || 'Offert';
    const safeBase = sanitizeFileNamePart(base);
    return `${safeBase || 'Offert'}-${date}.pdf`;
}

function getActivityCustomerLabel(customerInfo = {}) {
    return customerInfo.company || customerInfo.name || '';
}

async function createPdfBlob(state, summaryData) {
    try {
        const { generatePDF } = await import('../features/pdfExport');
        return generatePDF(state, summaryData, true);
    } catch (error) {
        console.error('Failed to load PDF export module:', error);
        return null;
    }
}

async function exportExcelWorkbook(state, summaryData) {
    const { generateExcel } = await import('../features/excelExport');
    return generateExcel(state, summaryData);
}

function warnIfActivityLogFailed(result, message) {
    if (result?.ok === false) {
        toast(message, { icon: '!' });
    }
}

export function SummaryExport({ onPrev, onBackToSketch }) {
    const { state, dispatch } = useQuote();
    const { user } = useAuth();
    const summaryData = useMemo(() => computeQuoteTotals({ state, catalogData }), [state]);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [isSavingQuote, setIsSavingQuote] = useState(false);
    const previewUrlRef = useRef('');

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

    const handleBack = () => {
        if (onPrev) {
            onPrev();
        } else {
            dispatch({ type: 'SET_STEP', payload: 3 });
        }
    };

    const handleExportPDF = async () => {
        const fileName = buildPdfFileName(state.customerInfo);
        const pdfBlob = await createPdfBlob(state, summaryData);
        if (!pdfBlob) {
            toast.error('Kunde inte skapa PDF.');
            return;
        }

        const pickerResult = await saveBlobWithPicker(pdfBlob, fileName);
        if (pickerResult === 'saved') {
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
                    reference: state.customerInfo?.reference || ''
                }
            }).then((result) => warnIfActivityLogFailed(result, 'PDF-exporten lyckades, men aktivitetsloggen kunde inte uppdateras.'));
            toast.success(`PDF sparad: ${fileName}`);
            return;
        }

        if (pickerResult === 'canceled') {
            toast('PDF-export avbröts.', { icon: '!' });
            return;
        }

        if (pickerResult === 'failed') {
            toast('Kunde inte öppna spara-dialog. Använder nedladdning i stället.', { icon: '!' });
        }

        if (pickerResult === 'failed' || pickerResult === 'unavailable') {
            downloadBlob(pdfBlob, fileName);
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
                    reference: state.customerInfo?.reference || ''
                }
            }).then((result) => warnIfActivityLogFailed(result, 'PDF-exporten lyckades, men aktivitetsloggen kunde inte uppdateras.'));
            toast.success(`PDF nedladdad: ${fileName}`);
        }
    };

    const handleExportExcel = async () => {
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
                    reference: state.customerInfo?.reference || ''
                }
            }).then((result) => warnIfActivityLogFailed(result, 'Excel-exporten lyckades, men aktivitetsloggen kunde inte uppdateras.'));
        } catch (error) {
            console.error('Failed to export Excel:', error);
            toast.error('Kunde inte skapa Excel.');
        }
    };

    const handleSaveQuote = async () => {
        if (isSavingQuote) return;

        setIsSavingQuote(true);
        try {
            const { saved, isNewQuote, statePatch } = await saveQuoteToRepository({
                quoteRepository,
                user,
                state,
                summary: summaryData
            });

            dispatch({
                type: 'UPDATE_STATE',
                payload: statePatch
            });

            void safeLogActivity({
                user,
                eventType: isNewQuote ? 'quote_created' : 'quote_revision_saved',
                system: 'quote',
                targetType: isNewQuote ? 'quote' : 'revision',
                targetId: statePatch.activeQuoteId || saved?.quoteId || 'unknown_quote',
                details: isNewQuote
                    ? 'Offert skapad och sparad i Mina Offerter.'
                    : `Offerten sparades som version ${statePatch.activeQuoteVersion}.`,
                metadata: {
                    version: statePatch.activeQuoteVersion || null,
                    customerName: getActivityCustomerLabel(state.customerInfo),
                    reference: state.customerInfo?.reference || '',
                    totalSek: summaryData.finalTotalSek || 0
                }
            }).then((result) => warnIfActivityLogFailed(result, 'Offerten sparades, men aktivitetsloggen kunde inte uppdateras.'));

            if (isNewQuote) {
                toast.success('Offerten sparades i Mina Offerter.');
            } else {
                toast.success(`Offerten sparades som version ${statePatch.activeQuoteVersion}.`);
            }
        } catch (err) {
            console.error('Failed to save quote:', err);
            toast.error(`Kunde inte spara offerten: ${err.message}`);
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
                                    onClick={onBackToSketch}
                                    className="px-6 py-2.5 bg-panel-bg border border-panel-border text-text-secondary rounded-lg font-medium hover:bg-panel-border hover:text-white transition-all text-sm tracking-wide"
                                >
                                    Tillbaka till ritning
                                </button>
                            )}
                            <button
                                onClick={handleSaveQuote}
                                disabled={isSavingQuote}
                                className="px-6 py-2.5 bg-panel-bg border border-panel-border text-text-primary rounded-lg font-bold hover:bg-white/5 transition-all text-sm uppercase tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
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
                                <span className="text-primary text-xl">📋</span> Summering
                            </h3>
                            <FinalSummaryTable />
                        </section>

                        <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4 p-6 bg-black/40 border border-panel-border rounded-xl">
                            <button
                                onClick={handleBack}
                                className="text-text-secondary hover:text-white transition-colors flex items-center gap-2 group whitespace-nowrap text-sm md:text-base"
                            >
                                <span className="group-hover:-translate-x-1 transition-transform">&larr;</span>
                                Tillbaka för att ändra priser
                            </button>

                            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full md:w-auto md:justify-end">
                                <button
                                    onClick={handleExportPDF}
                                    className="px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all tracking-wide flex items-center justify-center gap-2"
                                >
                                    <span>📄</span> Exportera som PDF
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    className="px-6 py-3 bg-success text-white rounded-lg font-bold hover:bg-success-hover shadow-lg shadow-success/20 transition-all tracking-wide flex items-center justify-center gap-2"
                                >
                                    <span>📊</span> Exportera som Excel
                                </button>
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
