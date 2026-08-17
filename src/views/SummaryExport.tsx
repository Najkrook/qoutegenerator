import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuote } from '../store/QuoteContext';
import { useAuth } from '../store/AuthContext';
import { catalogData } from '../data/catalog';
import { PDF_THEME_OPTIONS } from '../config/pdfThemes';
import { computeQuoteTotals } from '../services/calculationEngine';
import { CustomerInfoForm } from '../components/features/CustomerInfoForm';
import { FinalSummaryTable } from '../components/features/FinalSummaryTable';
import { ContractingWorkSummaryTable } from '../components/features/ContractingWorkSummaryTable';
import { TermsAndPaymentPanel } from '../components/features/TermsAndPaymentPanel';
import { MarginSummaryPanel } from '../components/features/MarginSummaryPanel';
import { ExportLanguageSelector } from '../components/features/ExportLanguageSelector';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { downloadBlob, saveBlobWithPicker } from '../utils/fileUtils';
import { createQuotePdfBlob } from '../services/quotePdfService';
import { quoteSave } from '../services/quoteSaveService';
import { safeLogActivity } from '../services/activityLogService';
import { prepareQuote } from '../services/quotePreparation';
import type { PreparedQuote } from '../services/quotePreparation';
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
    OrderRequestRecord,
    PdfThemeId,
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

interface PendingQuoteSaveRetry {
    saveIntentId: string;
    draftSignature: string;
}

const QUOTE_SAVE_RETRY_STORAGE_PREFIX = 'quote-generator:pending-save-retry:';

function getQuoteSaveRetryStorageKey(userUid: string | null | undefined): string | null {
    const normalizedUid = String(userUid || '').trim();
    return normalizedUid ? `${QUOTE_SAVE_RETRY_STORAGE_PREFIX}${normalizedUid}` : null;
}

function buildQuoteSaveDraftSignature({
    state,
    ownerUid,
    quoteId,
    crmDealId,
    retailerId
}: {
    state: QuoteState;
    ownerUid: string;
    quoteId: string | null;
    crmDealId: string | null;
    retailerId: string | null;
}): string {
    return JSON.stringify({ ownerUid, quoteId, crmDealId, retailerId, state });
}

function readMatchingQuoteSaveRetry(
    userUid: string | null | undefined,
    draftSignature: string,
    storage: Storage | undefined = globalThis.sessionStorage
): string | null {
    const storageKey = getQuoteSaveRetryStorageKey(userUid);
    if (!storageKey || !storage) return null;

    try {
        const raw = storage.getItem(storageKey);
        if (!raw) return null;
        const pending = JSON.parse(raw) as Partial<PendingQuoteSaveRetry>;
        if (
            typeof pending.saveIntentId === 'string'
            && pending.saveIntentId.trim()
            && pending.draftSignature === draftSignature
        ) {
            return pending.saveIntentId;
        }
        storage.removeItem(storageKey);
    } catch (error) {
        console.error('Failed to restore pending Quote Save retry:', error);
        storage.removeItem(storageKey);
    }
    return null;
}

function persistQuoteSaveRetry(
    userUid: string | null | undefined,
    pending: PendingQuoteSaveRetry,
    storage: Storage | undefined = globalThis.sessionStorage
): void {
    const storageKey = getQuoteSaveRetryStorageKey(userUid);
    if (!storageKey || !storage) return;

    try {
        storage.setItem(storageKey, JSON.stringify(pending));
    } catch (error) {
        console.error('Failed to persist pending Quote Save retry:', error);
    }
}

function clearQuoteSaveRetry(
    userUid: string | null | undefined,
    storage: Storage | undefined = globalThis.sessionStorage
): void {
    const storageKey = getQuoteSaveRetryStorageKey(userUid);
    if (storageKey) storage?.removeItem(storageKey);
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

function buildPdfFileName(customerInfo: QuoteState['customerInfo'], exportLanguage: QuoteState['exportLanguage'] = 'sv'): string {
    const rawRef = customerInfo.reference?.trim();
    const rawName = customerInfo.company?.trim() || customerInfo.name?.trim();
    const date = customerInfo.date || '';
    const base = rawRef || rawName || (exportLanguage === 'en' ? 'Quote' : 'Offert');
    const safeBase = sanitizeFileNamePart(base);
    return `${safeBase || (exportLanguage === 'en' ? 'Quote' : 'Offert')}-${date}.pdf`;
}

function getActivityCustomerLabel(customerInfo: QuoteState['customerInfo']): string {
    return customerInfo.company || customerInfo.name || '';
}

function getRetailerOrderRequestStatusClasses(status: string): string {
    switch (status) {
        case 'completed':
            return 'border-success-border bg-success-bg text-success-text';
        case 'reviewing':
            return 'border-warning-border bg-warning-bg text-warning-text';
        case 'new':
        default:
            return 'border-info-border bg-info-bg text-info-text';
    }
}

export function getPdfExportBlockReason(quoteNumber: QuoteState['quoteNumber'] | null | undefined): string | null {
    if (quoteNumber) {
        return null;
    }

    return 'Offerten saknar offertnummer. Spara offerten f\u00F6r att tilldela ett nummer, eller exportera \u00E4nd\u00E5 utan nummer.';
}

async function exportExcelWorkbook(prepared: PreparedQuote): Promise<void> {
    const excelModule = await import('../features/excelExport');
    const { generateExcel } = excelModule;

    if (typeof generateExcel !== 'function') {
        throw new Error('Excel export is unavailable.');
    }

    await generateExcel(prepared);
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

export function SummaryExport({
    onPrev,
    onBackToSketch,
    onOpenRetailerOrderHistory,
    crmDealId = null,
    quoteOwnerUid = null
}: SummaryExportProps) {
    const { state, dispatch } = useQuote();
    const { user, retailer, isRetailer, canViewEverything } = useAuth();
    const summaryData = useMemo(
        () => computeQuoteTotals({ state, catalogData }),
        [state]
    );
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewError, setPreviewError] = useState('');
    const [isPreviewUpdating, setIsPreviewUpdating] = useState(true);
    const [isSavingQuote, setIsSavingQuote] = useState(false);
    const [orderRequest, setOrderRequest] = useState<OrderRequestRecord | null>(null);
    const [isLoadingOrderRequest, setIsLoadingOrderRequest] = useState(false);
    const [isSubmittingOrderRequest, setIsSubmittingOrderRequest] = useState(false);
    const [hasJustSubmittedOrderRequest, setHasJustSubmittedOrderRequest] = useState(false);
    const previewUrlRef = useRef<string>('');
    const preparationFallbackDateRef = useRef(new Date().toISOString().slice(0, 10));
    const reopenedQuoteIdRef = useRef(state.activeQuoteId);
    const attemptedReopenRepairRef = useRef<string | null>(null);
    const previewPdfRef = useRef<{
        blob: Blob;
        equivalenceKey: string;
    } | null>(null);
    const exportBlockReason = getPdfExportBlockReason(state.quoteNumber);
    const hasQuoteNumber = Boolean(String(state.quoteNumber || '').trim());
    const hasSavedRevision = Boolean(
        state.activeQuoteId
        && hasQuoteNumber
        && Number(state.activeQuoteVersion) > 0
    );
    const saveLabel = state.activeQuoteId ? 'Spara ny version' : 'Spara offert';

    const preparedQuote = useMemo(() => prepareQuote({
        state,
        totals: summaryData,
        fallbackDate: preparationFallbackDateRef.current,
        catalogData,
        audience: {
            isRetailer,
            allowedPdfThemes: retailer?.pdfThemes || []
        }
    }), [state, summaryData, isRetailer, retailer?.pdfThemes]);
    const preparedEquivalenceKey = preparedQuote.presentation.equivalenceKey;
    const selectedPdfThemeId = preparedQuote.presentation.pdfThemeId;
    const selectedExportLanguage = preparedQuote.presentation.exportLanguage;
    const effectiveState = preparedQuote.persistenceSnapshot;
    const allowedThemeOptions = useMemo(() => {
        const allowedIds = new Set(preparedQuote.presentation.allowedPdfThemeIds);
        return PDF_THEME_OPTIONS.filter((theme) => allowedIds.has(theme.id));
    }, [preparedQuote.presentation.allowedPdfThemeIds]);
    const hasProducts = preparedQuote.commercial.productRows.length > 0;
    const hasContractingWork = preparedQuote.visibility.contractingWork === 'visible';

    useEffect(() => {
        if (state.pdfThemeId !== selectedPdfThemeId) {
            dispatch({ type: 'SET_PDF_THEME_ID', payload: selectedPdfThemeId });
        }
    }, [selectedPdfThemeId, state.pdfThemeId, dispatch]);

    const canSubmitOrderRequest = Boolean(
        isRetailer
        && hasSavedRevision
    );

    useEffect(() => {
        if (preparedQuote.visibility.discountReferenceEligibility === 'eligible-zero'
            || state.hideZeroDiscountReferencesInPdf !== true) {
            return;
        }

        dispatch({
            type: 'SET_HIDE_ZERO_DISCOUNT_REFERENCES_IN_PDF',
            payload: false
        });
    }, [dispatch, preparedQuote.visibility.discountReferenceEligibility, state.hideZeroDiscountReferencesInPdf]);

    useEffect(() => {
        let cancelled = false;
        setIsPreviewUpdating(true);
        setPreviewError('');

        const timerId = globalThis.setTimeout(() => {
            void (async () => {
                try {
                    const pdfBlob = await createQuotePdfBlob(preparedQuote);
                    if (cancelled) return;

                    if (!pdfBlob) {
                        setPreviewError('Kunde inte skapa PDF-förhandsvisning. Kontrollera offertinnehållet och försök igen.');
                        setIsPreviewUpdating(false);
                        return;
                    }

                    previewPdfRef.current = {
                        blob: pdfBlob,
                        equivalenceKey: preparedEquivalenceKey
                    };
                    const nextUrl = URL.createObjectURL(pdfBlob);
                    if (previewUrlRef.current) {
                        URL.revokeObjectURL(previewUrlRef.current);
                    }

                    previewUrlRef.current = nextUrl;
                    setPreviewUrl(nextUrl);
                    setPreviewError('');
                    setIsPreviewUpdating(false);
                } catch (error) {
                    if (cancelled) return;
                    console.error('Failed to create quote preview:', error);
                    setPreviewError('Kunde inte skapa PDF-förhandsvisning. Kontrollera offertinnehållet och försök igen.');
                    setIsPreviewUpdating(false);
                }
            })();
        }, 400);

        return () => {
            cancelled = true;
            globalThis.clearTimeout(timerId);
        };
    }, [preparedEquivalenceKey]);

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
        const reopenedQuoteId = reopenedQuoteIdRef.current;
        if (
            !canViewEverything
            || !user?.uid
            || !state.activeQuoteId
            || state.activeQuoteId !== reopenedQuoteId
            || attemptedReopenRepairRef.current === reopenedQuoteId
        ) return;

        attemptedReopenRepairRef.current = reopenedQuoteId;

        let cancelled = false;
        void import('../services/quoteSaveService').then((module) => {
            if (cancelled || typeof module.quoteSave?.repairCrm !== 'function') return;
            return module.quoteSave.repairCrm({
                actor: user,
                quote: {
                    ownerUid: quoteOwnerUid || user.uid || '',
                    quoteId: state.activeQuoteId || ''
                },
                canManageAllQuotes: true
            });
        }).catch((error) => {
            if (!cancelled) {
                console.error('Failed to retry CRM repair when reopening Quote:', error);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [canViewEverything, quoteOwnerUid, state.activeQuoteId, user]);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = '';
            }
            previewPdfRef.current = null;
        };
    }, []);

    const handleBack = (): void => {
        if (onPrev) {
            onPrev();
        }
    };

    const handlePdfThemeChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
        dispatch({
            type: 'SET_PDF_THEME_ID',
            payload: event.target.value as PdfThemeId
        });
    };

    const handleExportPDF = async ({ allowMissingQuoteNumber = false }: PdfExportOptions = {}): Promise<void> => {
        if (isSavingQuote) {
            return;
        }

        if (exportBlockReason && !allowMissingQuoteNumber) {
            notifyError(exportBlockReason);
            return;
        }

        const fileName = buildPdfFileName({
            ...preparedQuote.agreement.customerInfo,
            date: preparedQuote.agreement.effectiveQuoteDate
        }, preparedQuote.presentation.exportLanguage);
        const cachedPreview = previewPdfRef.current;
        const pdfBlob = cachedPreview?.equivalenceKey === preparedEquivalenceKey
            ? cachedPreview.blob
            : await createQuotePdfBlob(preparedQuote);
        if (!pdfBlob) {
            notifyError('Kunde inte skapa PDF.');
            return;
        }

        if (cachedPreview?.equivalenceKey !== preparedEquivalenceKey) {
            previewPdfRef.current = {
                blob: pdfBlob,
                equivalenceKey: preparedEquivalenceKey
            };
        }

        const pickerResult = await saveBlobWithPicker(pdfBlob, fileName);
        if (pickerResult === 'saved') {
            logPdfExportActivity({
                user,
                state: preparedQuote.persistenceSnapshot,
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
                state: preparedQuote.persistenceSnapshot,
                fileName,
                missingQuoteNumber: !state.quoteNumber
            });
            notifySuccess(`PDF nedladdad: ${fileName}`);
        }
    };

    const handleExportExcel = async (): Promise<void> => {
        if (isSavingQuote) {
            return;
        }

        const excelFileName = preparedQuote.presentation.exportLanguage === 'en' ? 'Quote.xlsx' : 'Offert.xlsx';

        try {
            await exportExcelWorkbook(preparedQuote);
            void safeLogActivity({
                user,
                eventType: 'quote_export_excel',
                system: 'quote',
                targetType: 'quote',
                targetId: state.activeQuoteId || 'unsaved_quote',
                details: `Excel exporterad: ${excelFileName}`,
                metadata: {
                    format: 'excel',
                    fileName: excelFileName,
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
        if (!state.activeQuoteId || isSavingQuote) return;

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
            const ownerUid = quoteOwnerUid || user?.uid || '';
            const saveTarget = state.activeQuoteId
                ? {
                    kind: 'existing' as const,
                    quote: {
                        ownerUid,
                        quoteId: state.activeQuoteId
                    },
                    crmDealId
                }
                : { kind: 'new' as const, crmDealId };
            const draftSignature = buildQuoteSaveDraftSignature({
                state: preparedQuote.persistenceSnapshot,
                ownerUid,
                quoteId: state.activeQuoteId || null,
                crmDealId,
                retailerId: retailer?.id || null
            });
            const retrySaveIntentId = readMatchingQuoteSaveRetry(user?.uid, draftSignature);
            const outcome = await quoteSave.save({
                actor: user,
                retailer,
                state: preparedQuote.persistenceSnapshot,
                target: saveTarget,
                canManageAllQuotes: canViewEverything,
                retrySaveIntentId
            });

            if ('status' in outcome && outcome.status === 'not-saved') {
                if (outcome.retry?.saveIntentId) {
                    persistQuoteSaveRetry(user?.uid, {
                        saveIntentId: outcome.retry.saveIntentId,
                        draftSignature
                    });
                } else {
                    clearQuoteSaveRetry(user?.uid);
                }
                notifyError(`Kunde inte spara offerten: ${outcome.failure.message}`);
                return;
            }

            clearQuoteSaveRetry(user?.uid);
            const { isNewQuote, statePatch } = outcome;
            const saveStatePatch: SavedQuoteStatePatch = statePatch;

            dispatch({
                type: 'UPDATE_STATE',
                payload: saveStatePatch
            });

            if (isNewQuote) {
                notifySuccess('Offerten sparades i Mina Offerter.');
            } else {
                notifySuccess(`Offerten sparades som version ${saveStatePatch.activeQuoteVersion}.`);
            }
            if ('status' in outcome && outcome.status === 'saved-needs-crm-repair') {
                notifyWarn(outcome.crm.status === 'relink-required'
                    ? 'Offerten sparades. CRM-länken kräver ett uttryckligt beslut om omkoppling.'
                    : 'Offerten sparades. CRM-synkroniseringen repareras automatiskt.');
            }
        } catch (error) {
            console.error('Failed to save quote:', error);
            notifyError(`Kunde inte spara offerten: ${getErrorMessage(error, 'okänt fel')}`);
        } finally {
            setIsSavingQuote(false);
        }
    };

    const handleSubmitOrderRequest = async (): Promise<void> => {
        if (!canSubmitOrderRequest || isSavingQuote || isSubmittingOrderRequest || !retailer) {
            return;
        }

        setIsSubmittingOrderRequest(true);
        try {
            const createdRequest = await orderRequestService.createOrderRequest({
                user,
                retailer,
                quoteId: String(state.activeQuoteId),
                quoteVersion: state.activeQuoteVersion
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
                    <div className="mb-8">
                        <PageHeader
                            eyebrow="Steg 4 av 4"
                            title="Offertsammanställning"
                            description="Granska kunduppgifter och slutgiltiga belopp före export."
                            actions={onBackToSketch ? (
                                <Button onClick={onBackToSketch}>
                                    Tillbaka till ritning
                                </Button>
                            ) : undefined}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <section>
                            <CustomerInfoForm />
                        </section>

                        <section>
                            <TermsAndPaymentPanel />
                        </section>


                        <section className="rounded-panel border border-border bg-surface-raised p-6 shadow-panel">
                            <h2 className="mb-6 text-lg font-bold text-text">Summering</h2>
                            {hasProducts ? (
                                <FinalSummaryTable
                                    isMixedOffer={hasContractingWork}
                                    preparedQuote={preparedQuote}
                                />
                            ) : null}
                            {hasContractingWork ? (
                                <ContractingWorkSummaryTable
                                    className={hasProducts ? 'mt-8' : ''}
                                    contractingWork={preparedQuote.commercial.contractingWork!}
                                    exportLanguage={preparedQuote.presentation.exportLanguage}
                                />
                            ) : null}
                            {hasProducts ? <MarginSummaryPanel summaryData={summaryData} className="mt-6" /> : null}
                            <section className="mt-8 flex flex-col gap-6">
                                {exportBlockReason && (
                                    <div className="rounded-panel border border-warning-border bg-warning-bg px-6 py-5 shadow-sm">
                                        <div className="max-w-3xl">
                                            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-warning-text">
                                                Åtgärd krävs
                                            </p>
                                            <h3 className="m-0 text-base font-bold text-warning-text">Offerten saknar offertnummer</h3>
                                            <p className="m-0 mt-1 text-sm text-text">{exportBlockReason}</p>
                                            <p className="m-0 mt-2 text-sm text-text-muted">
                                                Spara offert är rekommenderat, men du kan fortfarande exportera PDF:n utan nummer.
                                            </p>
                                            <Button
                                                onClick={() => {
                                                    void handleExportPDF({ allowMissingQuoteNumber: true });
                                                }}
                                                disabled={isSavingQuote}
                                                className="mt-4"
                                            >
                                                Exportera PDF utan offertnummer
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col items-stretch justify-between gap-4 rounded-panel border border-border bg-surface p-4 xl:flex-row xl:items-center">
                                    <Button
                                        onClick={handleBack}
                                        className="w-full whitespace-nowrap xl:w-auto"
                                        size="lg"
                                    >
                                        Tillbaka för att ändra priser
                                    </Button>

                                    <div className="flex w-full flex-col items-stretch gap-3 xl:w-auto xl:items-end">
                                        {!hasQuoteNumber && (
                                            <Button
                                                onClick={() => {
                                                    void handleSaveQuote();
                                                }}
                                                disabled={isSavingQuote}
                                                className="w-full sm:w-auto"
                                                size="lg"
                                                variant="primary"
                                            >
                                                {isSavingQuote ? 'Sparar...' : saveLabel}
                                            </Button>
                                        )}

                                        {hasQuoteNumber && (
                                            <>
                                                <Button
                                                    onClick={() => {
                                                        void handleExportPDF();
                                                    }}
                                                    disabled={isSavingQuote}
                                                    className="w-full sm:w-auto"
                                                    size="lg"
                                                    variant="primary"
                                                >
                                                    Skapa PDF
                                                </Button>

                                                <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:justify-end">
                                                    <Button
                                                        onClick={() => {
                                                            void handleSaveQuote();
                                                        }}
                                                        disabled={isSavingQuote}
                                                    >
                                                        {isSavingQuote ? 'Sparar...' : saveLabel}
                                                    </Button>

                                                    <Button
                                                        onClick={() => {
                                                            void handleExportExcel();
                                                        }}
                                                        disabled={isSavingQuote}
                                                    >
                                                        Exportera Excel
                                                    </Button>

                                                    {state.activeQuoteId && (
                                                        <Button
                                                            onClick={() => {
                                                                void handleCopyQuoteLink();
                                                            }}
                                                            disabled={isSavingQuote}
                                                        >
                                                            Kopiera länk
                                                        </Button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {isRetailer && (
                                <section className="mt-8 rounded-panel border border-border bg-surface-raised p-6 shadow-panel">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="max-w-3xl">
                                            <h2 className="m-0 text-lg font-bold text-text">Skicka orderförfrågan till BRIXX</h2>
                                            <p className="mt-2 text-sm text-text-secondary">
                                                När offerten är sparad kan den skickas in som en orderförfrågan för intern hantering hos BRIXX.
                                            </p>
                                            {!canSubmitOrderRequest && (
                                                <p className="mt-3 text-sm text-warning-text">
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
                                                <div className="mt-4 rounded-panel border border-success-border bg-success-bg p-4">
                                                    <h3 className="m-0 text-base font-semibold text-text">
                                                        {hasJustSubmittedOrderRequest ? 'Tack för din order!' : 'Orderförfrågan registrerad'}
                                                    </h3>
                                                    <p className="mt-2 text-sm text-text-secondary">
                                                        {hasJustSubmittedOrderRequest
                                                            ? 'Du kan följa statusen live under Skickade ordrar. Där ser du när BRIXX börjar hantera ärendet.'
                                                            : 'Följ statusen för era skickade ordrar under Skickade ordrar.'}
                                                    </p>
                                                    {onOpenRetailerOrderHistory && (
                                                        <Button
                                                            onClick={onOpenRetailerOrderHistory}
                                                            className="mt-4"
                                                        >
                                                            Se skickade ordrar
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[280px]">
                                            <Button
                                                onClick={() => {
                                                    void handleSubmitOrderRequest();
                                                }}
                                                disabled={!canSubmitOrderRequest || isSavingQuote || Boolean(orderRequest) || isSubmittingOrderRequest || isLoadingOrderRequest}
                                                size="lg"
                                                variant="primary"
                                            >
                                                {isSubmittingOrderRequest
                                                    ? 'Skickar orderförfrågan...'
                                                    : orderRequest
                                                        ? `Orderförfrågan registrerad för v${orderRequest.quoteVersion}`
                                                        : 'Skicka orderförfrågan'}
                                            </Button>
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

                <aside className="bg-panel-bg border border-panel-border rounded-lg p-4 xl:sticky xl:top-4 shadow-sm flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-base font-bold text-text">PDF-förhandsvisning</h2>
                            <p className="text-xs text-text-secondary mt-1">
                                {isPreviewUpdating
                                    ? 'Uppdaterar förhandsvisning…'
                                    : 'Uppdateras automatiskt när offertdata ändras.'}
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[180px]">
                            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                                Offert tema
                                <select
                                    name="pdfThemeId"
                                    value={selectedPdfThemeId}
                                    onChange={handlePdfThemeChange}
                                    className="h-10 w-full rounded-control border border-control-border bg-input px-3 text-sm font-semibold normal-case tracking-normal text-text transition-colors hover:bg-surface-hover"
                                >
                                    {allowedThemeOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <ExportLanguageSelector />
                        </div>
                    </div>
                    <div
                        className="relative h-[860px] overflow-hidden rounded-control border border-border bg-paper"
                        aria-busy={isPreviewUpdating}
                    >
                        {previewUrl ? (
                            <iframe
                                title="PDF förhandsvisning"
                                src={previewUrl}
                                className="w-full h-full"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-paper p-6 text-center text-sm text-on-paper">
                                {previewError || 'Genererar PDF-förhandsvisning…'}
                            </div>
                        )}
                        {previewUrl && isPreviewUpdating && (
                            <div
                                role="status"
                                className="absolute right-3 top-3 rounded-full border border-info-border bg-info-bg px-3 py-1.5 text-xs font-semibold text-info-text shadow-panel"
                            >
                                Uppdaterar förhandsvisning…
                            </div>
                        )}
                    </div>
                    {previewUrl && previewError && (
                        <p role="alert" className="m-0 text-sm text-danger-text">
                            {previewError} Den senaste giltiga förhandsvisningen visas fortfarande.
                        </p>
                    )}
                </aside>
            </div>
        </div>
    );
}
