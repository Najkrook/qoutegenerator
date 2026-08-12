import { DEFAULT_PDF_THEME_ID, normalizePdfThemeId } from '../config/pdfThemes';
import type {
    BuilderAddon,
    BuilderItem,
    CatalogData,
    ContractingWorkState,
    CustomerInfo,
    GridLineSelection,
    PdfThemeId,
    QuoteCommercialSnapshot,
    QuoteExportLanguage,
    QuoteState,
    QuoteStatus,
    QuoteTotalsResult,
    QuoteTotalsRow
} from '../types/contracts';
import { catalogData as defaultCatalogData } from '../data/catalog';
import { calculateContractingWorkSummary } from './contractingWork';
import { normalizeExportLanguage, translateQuoteTotalsRowModel } from './exportLocalization';
import { stripPrivateQuoteStateData } from '../utils/quoteStateSanitization';
import { normalizeQuoteCommercialSnapshot } from './quoteCommercialSnapshot';

const SEK_RECONCILIATION_TOLERANCE = 1;

export interface QuotePreparationAudience {
    isRetailer: boolean;
    allowedPdfThemes?: readonly unknown[];
}

export interface PreparedQuoteProductRow {
    model: string;
    size: string;
    unitPrice: number;
    qty: number;
    gross: number;
    discountPct: number;
    discountSek: number;
    net: number;
    isAddon: boolean;
    isCustom: boolean;
    priceUponRequest: boolean;
    source: QuoteTotalsRow['source'];
    line: string;
    sortModel: string;
    sortSizeRaw: string;
    sortKind: QuoteTotalsRow['sortKind'];
    sortDimensions: number[];
    originalIndex: number;
}

export interface PreparedQuoteContractingWork {
    projectName: string;
    rows: Array<{
        id: string;
        workPackage: string;
        scope: string;
        unit: string;
        priceExVatSek: number;
    }>;
    baseTotalSek: number;
    ataEnabled: boolean;
    ataPercent: number;
    allowanceSek: number;
    lowerIndicativeSek: number;
    upperIndicativeSek: number;
}

export interface PreparedQuote {
    presentation: {
        exportLanguage: QuoteExportLanguage;
        pdfThemeId: PdfThemeId;
        equivalenceKey: string;
    };
    commercial: {
        productRows: PreparedQuoteProductRow[];
        productTotals: {
            includesVat: boolean;
            grossTotalSek: number;
            totalDiscountSek: number;
            finalTotalSek: number;
            globalDiscountAmt: number;
            globalDiscountPct: number;
            vatBasisSek: number;
            vatAmountSek: number;
            totalWithVatSek: number;
        };
        contractingWork: PreparedQuoteContractingWork | null;
    };
    agreement: {
        customerInfo: CustomerInfo;
        effectiveQuoteDate: string;
        quoteIdentity: {
            quoteId: string | null;
            quoteNumber: string | null;
            version: number;
            status: QuoteStatus;
        };
        legalTerms: {
            included: boolean;
            text: string;
            templateId: string;
            customized: boolean;
        };
        paymentTermsDays: number;
        validityDays: number;
        includePaymentBox: boolean;
        includeSignatureBlock: boolean;
    };
    visibility: {
        contractingWork: 'visible' | 'absent' | 'suppressed-retailer';
        discountReferences: 'visible' | 'hidden-zero';
        legalTerms: 'visible' | 'hidden';
        paymentBox: 'visible' | 'hidden';
        signatureBlock: 'visible' | 'hidden';
    };
    persistenceSnapshot: QuoteState;
}

export class QuotePreparationError extends Error {
    readonly code = 'INVALID_COMMERCIAL_DATA' as const;
    readonly field: string;

    constructor(field: string, message: string) {
        super(message);
        this.name = 'QuotePreparationError';
        this.field = field;
    }
}

function invalidCommercial(field: string, reason: string): never {
    throw new QuotePreparationError(field, `Invalid commercial data at ${field}: ${reason}`);
}

function requireFinite(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return invalidCommercial(field, 'expected a finite number');
    }
    return value;
}

function requireReconciled(actual: number, expected: number, field: string): void {
    if (Math.abs(actual - expected) > SEK_RECONCILIATION_TOLERANCE) {
        invalidCommercial(field, `expected ${expected} SEK from the supplied rows, received ${actual} SEK`);
    }
}

function cloneSafeJsonValue<T>(value: T): T {
    if (value === undefined || value === null) {
        return value;
    }
    return JSON.parse(JSON.stringify(stripPrivateQuoteStateData(value))) as T;
}

function cloneRowSource(source: QuoteTotalsRow['source']): QuoteTotalsRow['source'] {
    switch (source?.type) {
        case 'builder':
            return { type: source.type, itemId: String(source.itemId) };
        case 'builder-addon':
            return { type: source.type, itemId: String(source.itemId), addonId: String(source.addonId) };
        case 'builder-custom-addon':
            return {
                type: source.type,
                itemId: String(source.itemId),
                rowId: String(source.rowId),
                categoryId: String(source.categoryId)
            };
        case 'grid':
            return { type: source.type, lineId: String(source.lineId), key: String(source.key) };
        case 'grid-addon':
            return { type: source.type, lineId: String(source.lineId), addonId: String(source.addonId) };
        case 'grid-custom-addon':
            return {
                type: source.type,
                lineId: String(source.lineId),
                categoryId: String(source.categoryId),
                rowId: String(source.rowId)
            };
        case 'grid-custom-item':
            return { type: source.type, lineId: String(source.lineId), rowId: String(source.rowId) };
        case 'custom':
            return { type: source.type, index: Number(source.index) };
        default:
            return { type: 'custom', index: -1 };
    }
}

function normalizeEffectiveQuoteDate(value: unknown, fallbackDate: unknown): string {
    const requested = String(value || '').trim();
    const fallback = String(fallbackDate || '').trim();
    const candidate = requested || fallback;
    const parsed = /^\d{4}-\d{2}-\d{2}$/u.test(candidate)
        ? new Date(`${candidate}T00:00:00`)
        : null;

    if (parsed && !Number.isNaN(parsed.getTime())) {
        return candidate;
    }
    return new Date().toISOString().slice(0, 10);
}

function cloneCustomerInfo(customerInfo: QuoteState['customerInfo']): CustomerInfo {
    return {
        name: String(customerInfo?.name || ''),
        company: String(customerInfo?.company || ''),
        email: String(customerInfo?.email || ''),
        reference: String(customerInfo?.reference || ''),
        customerReference: String(customerInfo?.customerReference || ''),
        date: String(customerInfo?.date || ''),
        validity: String(customerInfo?.validity || ''),
        extraNotes: String(customerInfo?.extraNotes || '')
    };
}

function cloneBuilderAddon(addon: BuilderAddon): BuilderAddon {
    const base = {
        id: String(addon.id),
        qty: addon.qty,
        discountPct: addon.discountPct,
        ...(addon.displayName !== undefined ? { displayName: String(addon.displayName) } : {})
    };

    return 'isCustom' in addon && addon.isCustom === true
        ? {
            ...base,
            isCustom: true,
            name: String(addon.name),
            price: addon.price,
            categoryId: String(addon.categoryId)
        }
        : base;
}

function cloneBuilderItem(item: BuilderItem): BuilderItem {
    return {
        id: String(item.id),
        line: String(item.line),
        model: String(item.model),
        size: String(item.size),
        qty: item.qty,
        discountPct: item.discountPct,
        addons: Array.isArray(item.addons) ? item.addons.map(cloneBuilderAddon) : [],
        ...(item.displayName !== undefined ? { displayName: String(item.displayName) } : {}),
        ...(item.source !== undefined ? { source: String(item.source) } : {}),
        ...(item.sourceType !== undefined ? { sourceType: String(item.sourceType) } : {})
    };
}

function cloneGridLineSelection(selection: GridLineSelection): GridLineSelection {
    return {
        items: Object.fromEntries(Object.entries(selection?.items || {}).map(([key, item]) => [key, {
            qty: item.qty,
            discountPct: item.discountPct
        }])),
        addons: Object.fromEntries(Object.entries(selection?.addons || {}).map(([key, addon]) => [key, {
            qty: addon.qty,
            discountPct: addon.discountPct,
            ...(addon.syncMode !== undefined ? { syncMode: addon.syncMode } : {}),
            ...(addon.discountSyncMode !== undefined ? { discountSyncMode: addon.discountSyncMode } : {})
        }])),
        customAddonsByCategory: Object.fromEntries(
            Object.entries(selection?.customAddonsByCategory || {}).map(([categoryId, rows]) => [
                categoryId,
                Array.isArray(rows) ? rows.map((row) => ({
                    id: String(row.id),
                    name: String(row.name),
                    price: row.price,
                    qty: row.qty,
                    discountPct: row.discountPct
                })) : []
            ])
        ),
        ...(Array.isArray(selection?.customItems) ? {
            customItems: selection.customItems.map((row) => ({
                id: String(row.id),
                name: String(row.name),
                size: String(row.size),
                price: row.price,
                qty: row.qty,
                discountPct: row.discountPct
            }))
        } : {})
    };
}

function cloneContractingWork(contractingWork: ContractingWorkState): ContractingWorkState {
    return {
        enabled: contractingWork?.enabled === true,
        projectName: String(contractingWork?.projectName || ''),
        rows: Array.isArray(contractingWork?.rows) ? contractingWork.rows.map((row) => ({
            id: String(row.id),
            workPackage: String(row.workPackage),
            scope: String(row.scope),
            unit: String(row.unit),
            priceExVatSek: row.priceExVatSek
        })) : [],
        margin: {
            enabled: contractingWork?.margin?.enabled === true,
            percent: contractingWork?.margin?.percent
        },
        ata: {
            enabled: contractingWork?.ata?.enabled === true,
            percent: contractingWork?.ata?.percent
        }
    };
}

function createSuppressedContractingWork(): ContractingWorkState {
    return {
        enabled: false,
        projectName: '',
        rows: [],
        margin: { enabled: false, percent: 15 },
        ata: { enabled: false, percent: 15 }
    };
}

function createPersistenceSnapshot(
    state: QuoteState,
    presentation: { exportLanguage: QuoteExportLanguage; pdfThemeId: PdfThemeId },
    isRetailer: boolean,
    effectiveQuoteDate: string
): QuoteState {
    return {
        stateVersion: state.stateVersion,
        step: state.step,
        draftUpdatedAtMs: state.draftUpdatedAtMs,
        selectedLines: Array.isArray(state.selectedLines) ? state.selectedLines.map(String) : [],
        builderItems: Array.isArray(state.builderItems) ? state.builderItems.map(cloneBuilderItem) : [],
        gridSelections: Object.fromEntries(
            Object.entries(state.gridSelections || {}).map(([lineId, selection]) => [
                lineId,
                cloneGridLineSelection(selection)
            ])
        ),
        customCosts: Array.isArray(state.customCosts) ? state.customCosts.map((row) => ({
            description: String(row.description),
            price: row.price,
            qty: row.qty,
            discountPct: row.discountPct
        })) : [],
        contractingWork: isRetailer
            ? createSuppressedContractingWork()
            : cloneContractingWork(state.contractingWork),
        includesVat: state.includesVat === true,
        globalDiscountPct: state.globalDiscountPct,
        prevGlobalDiscountPct: state.prevGlobalDiscountPct,
        exchangeRate: state.exchangeRate,
        customerInfo: {
            ...cloneCustomerInfo(state.customerInfo),
            date: effectiveQuoteDate
        },
        inventoryData: cloneSafeJsonValue(state.inventoryData),
        cloudInventoryData: cloneSafeJsonValue(state.cloudInventoryData),
        sketchDraft: cloneSafeJsonValue(state.sketchDraft),
        advancedSketchDraft: cloneSafeJsonValue(state.advancedSketchDraft),
        sketchMeta: {
            addedBahamaLine: state.sketchMeta?.addedBahamaLine === true,
            addedFiestaLine: state.sketchMeta?.addedFiestaLine === true
        },
        inventoryBasket: cloneSafeJsonValue(state.inventoryBasket),
        activeQuoteId: state.activeQuoteId ? String(state.activeQuoteId) : null,
        quoteNumber: state.quoteNumber ? String(state.quoteNumber) : null,
        activeQuoteVersion: state.activeQuoteVersion,
        quoteStatus: state.quoteStatus,
        includeTerms: state.includeTerms === true,
        termsText: String(state.termsText || ''),
        termsTemplateId: String(state.termsTemplateId || ''),
        termsCustomized: state.termsCustomized === true,
        includeSignatureBlock: state.includeSignatureBlock === true,
        includePaymentBox: state.includePaymentBox === true,
        hideZeroDiscountReferencesInPdf: state.hideZeroDiscountReferencesInPdf === true,
        pdfThemeId: presentation.pdfThemeId,
        exportLanguage: presentation.exportLanguage,
        paymentTermsDays: state.paymentTermsDays,
        quoteValidityDays: state.quoteValidityDays
    };
}

function normalizePresentation(state: QuoteState, audience: QuotePreparationAudience): {
    exportLanguage: QuoteExportLanguage;
    pdfThemeId: PdfThemeId;
} {
    const exportLanguage = normalizeExportLanguage(state.exportLanguage);
    const requestedTheme = normalizePdfThemeId(state.pdfThemeId);
    if (!audience.isRetailer) {
        return { exportLanguage, pdfThemeId: requestedTheme };
    }

    const allowedThemes = new Set<PdfThemeId>([DEFAULT_PDF_THEME_ID]);
    for (const candidate of audience.allowedPdfThemes || []) {
        const normalized = normalizePdfThemeId(candidate);
        if (candidate === normalized) {
            allowedThemes.add(normalized);
        }
    }

    return {
        exportLanguage,
        pdfThemeId: allowedThemes.has(requestedTheme) ? requestedTheme : DEFAULT_PDF_THEME_ID
    };
}

function prepareProductRows(
    totals: QuoteTotalsResult,
    exportLanguage: QuoteExportLanguage,
    quoteCatalogData: CatalogData
): PreparedQuoteProductRow[] {
    if (!Array.isArray(totals?.totals)) {
        invalidCommercial('totals', 'expected an array');
    }

    return totals.totals.map((row, index) => {
        const qty = requireFinite(row?.qty, `totals[${index}].qty`);
        if (qty <= 0) {
            invalidCommercial(`totals[${index}].qty`, 'expected a positive quantity');
        }
        const discountPct = requireFinite(row?.discountPct, `totals[${index}].discountPct`);
        if (discountPct < 0 || discountPct > 100) {
            invalidCommercial(`totals[${index}].discountPct`, 'expected a percentage between 0 and 100');
        }
        const unitPrice = requireFinite(row?.unitPrice, `totals[${index}].unitPrice`);
        const gross = requireFinite(row?.gross, `totals[${index}].gross`);
        const discountSek = requireFinite(row?.discountSek, `totals[${index}].discountSek`);
        const net = requireFinite(row?.net, `totals[${index}].net`);
        requireReconciled(gross, unitPrice * qty, `totals[${index}].gross`);
        requireReconciled(discountSek, gross * discountPct / 100, `totals[${index}].discountSek`);
        requireReconciled(net, gross - discountSek, `totals[${index}].net`);

        return {
            model: translateQuoteTotalsRowModel(row, exportLanguage, quoteCatalogData),
            size: String(row?.size || ''),
            unitPrice,
            qty,
            gross,
            discountPct,
            discountSek,
            net,
            isAddon: row?.isAddon === true,
            isCustom: row?.isCustom === true,
            priceUponRequest: row?.priceUponRequest === true,
            source: cloneRowSource(row.source),
            line: String(row?.line || ''),
            sortModel: String(row?.sortModel || ''),
            sortSizeRaw: String(row?.sortSizeRaw || ''),
            sortKind: row?.sortKind,
            sortDimensions: Array.isArray(row?.sortDimensions) ? row.sortDimensions.map(Number) : [],
            originalIndex: row?.originalIndex
        };
    });
}

function validateAndPrepareProductTotals(
    state: QuoteState,
    totals: QuoteTotalsResult,
    rows: PreparedQuoteProductRow[]
): PreparedQuote['commercial']['productTotals'] {
    const grossTotalSek = requireFinite(totals.grossTotalSek, 'grossTotalSek');
    const totalDiscountSek = requireFinite(totals.totalDiscountSek, 'totalDiscountSek');
    const finalTotalSek = requireFinite(totals.finalTotalSek, 'finalTotalSek');
    const globalDiscountAmt = requireFinite(totals.globalDiscountAmt, 'globalDiscountAmt');
    const globalDiscountPct = requireFinite(state.globalDiscountPct, 'globalDiscountPct');
    if (globalDiscountPct < 0 || globalDiscountPct > 100) {
        invalidCommercial('globalDiscountPct', 'expected a percentage between 0 and 100');
    }
    const rowGrossTotal = rows.reduce((sum, row) => sum + row.gross, 0);
    const rowDiscountTotal = rows.reduce((sum, row) => sum + row.discountSek, 0);
    const rowNetTotal = rows.reduce((sum, row) => sum + row.net, 0);

    requireReconciled(grossTotalSek, rowGrossTotal, 'grossTotalSek');
    requireReconciled(totalDiscountSek, rowDiscountTotal, 'totalDiscountSek');
    requireReconciled(finalTotalSek, rowNetTotal - globalDiscountAmt, 'finalTotalSek');

    const vatBasisSek = finalTotalSek;
    const vatAmountSek = state.includesVat ? vatBasisSek * 0.25 : 0;
    requireFinite(vatAmountSek, 'vatAmountSek');

    return {
        includesVat: state.includesVat === true,
        grossTotalSek,
        totalDiscountSek,
        finalTotalSek,
        globalDiscountAmt,
        globalDiscountPct,
        vatBasisSek,
        vatAmountSek,
        totalWithVatSek: vatBasisSek + vatAmountSek
    };
}

function prepareContractingWork(
    state: QuoteState,
    audience: QuotePreparationAudience
): PreparedQuoteContractingWork | null {
    if (audience.isRetailer) {
        return null;
    }

    const activeRows = state.contractingWork?.enabled === true && Array.isArray(state.contractingWork.rows)
        ? state.contractingWork.rows.filter((row) => String(row?.workPackage || '').trim().length > 0)
        : [];
    if (activeRows.length === 0) {
        return null;
    }

    activeRows.forEach((row, index) => {
        requireFinite(row.priceExVatSek, `contractingWork.rows[${index}].priceExVatSek`);
    });
    const summary = calculateContractingWorkSummary(state.contractingWork);
    const numericTotals = [
        ['baseTotalSek', summary.baseTotalSek],
        ['allowanceSek', summary.allowanceSek],
        ['lowerIndicativeSek', summary.lowerIndicativeSek],
        ['upperIndicativeSek', summary.upperIndicativeSek]
    ] as const;
    numericTotals.forEach(([field, value]) => requireFinite(value, `contractingWork.${field}`));

    return {
        projectName: String(state.contractingWork.projectName || ''),
        rows: summary.customerRows.map((row) => ({
            id: String(row.id),
            workPackage: String(row.workPackage),
            scope: String(row.scope),
            unit: String(row.unit),
            priceExVatSek: row.priceExVatSek
        })),
        baseTotalSek: summary.baseTotalSek,
        ataEnabled: summary.ataEnabled,
        ataPercent: summary.ataPercent,
        allowanceSek: summary.allowanceSek,
        lowerIndicativeSek: summary.lowerIndicativeSek,
        upperIndicativeSek: summary.upperIndicativeSek
    };
}

function hasOnlyZeroDiscounts(rows: PreparedQuoteProductRow[], totalDiscountSek: number): boolean {
    return rows.length > 0 && totalDiscountSek === 0 && rows.every((row) => (
        row.discountPct === 0 && row.discountSek === 0
    ));
}

function canonicalStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalStringify).join(',')}]`;
    }
    if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) => (
            `${JSON.stringify(key)}:${canonicalStringify(record[key])}`
        )).join(',')}}`;
    }
    return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const nested of Object.values(value as Record<string, unknown>)) {
            deepFreeze(nested);
        }
    }
    return value;
}

export function prepareQuote({
    state,
    totals,
    audience,
    fallbackDate = new Date().toISOString().slice(0, 10),
    catalogData = defaultCatalogData
}: {
    state: QuoteState;
    totals: QuoteTotalsResult;
    audience: QuotePreparationAudience;
    fallbackDate?: string;
    catalogData?: CatalogData;
}): PreparedQuote {
    const normalizedPresentation = normalizePresentation(state, audience);
    const productRows = prepareProductRows(
        totals,
        normalizedPresentation.exportLanguage,
        catalogData
    );
    const productTotals = validateAndPrepareProductTotals(state, totals, productRows);
    const contractingWork = prepareContractingWork(state, audience);
    const discountReferences: PreparedQuote['visibility']['discountReferences'] = state.hideZeroDiscountReferencesInPdf === true
        && hasOnlyZeroDiscounts(productRows, productTotals.totalDiscountSek)
        ? 'hidden-zero'
        : 'visible';
    const customerInfo = cloneCustomerInfo(state.customerInfo);
    const effectiveQuoteDate = normalizeEffectiveQuoteDate(customerInfo.date, fallbackDate);
    const persistenceSnapshot = createPersistenceSnapshot(
        state,
        normalizedPresentation,
        audience.isRetailer,
        effectiveQuoteDate
    );
    const preparedMeaning = {
        presentation: normalizedPresentation,
        commercial: {
            productRows,
            productTotals,
            contractingWork
        },
        agreement: {
            customerInfo,
            effectiveQuoteDate,
            quoteIdentity: {
                quoteId: state.activeQuoteId ? String(state.activeQuoteId) : null,
                quoteNumber: state.quoteNumber ? String(state.quoteNumber) : null,
                version: state.activeQuoteVersion,
                status: state.quoteStatus
            },
            legalTerms: {
                included: state.includeTerms === true,
                text: String(state.termsText || ''),
                templateId: String(state.termsTemplateId || ''),
                customized: state.termsCustomized === true
            },
            paymentTermsDays: state.paymentTermsDays,
            validityDays: state.quoteValidityDays,
            includePaymentBox: state.includePaymentBox === true,
            includeSignatureBlock: state.includeSignatureBlock === true
        },
        visibility: {
            contractingWork: audience.isRetailer
                ? 'suppressed-retailer' as const
                : contractingWork
                    ? 'visible' as const
                    : 'absent' as const,
            discountReferences,
            legalTerms: state.includeTerms === true ? 'visible' as const : 'hidden' as const,
            paymentBox: state.includePaymentBox === true ? 'visible' as const : 'hidden' as const,
            signatureBlock: state.includeSignatureBlock === true ? 'visible' as const : 'hidden' as const
        }
    };
    const result: PreparedQuote = {
        presentation: {
            ...normalizedPresentation,
            equivalenceKey: canonicalStringify(preparedMeaning)
        },
        commercial: preparedMeaning.commercial,
        agreement: preparedMeaning.agreement,
        visibility: preparedMeaning.visibility,
        persistenceSnapshot
    };

    return deepFreeze(result);
}

export function createQuoteCommercialSnapshot(prepared: PreparedQuote): QuoteCommercialSnapshot {
    return {
        schemaVersion: 1,
        presentation: {
            exportLanguage: prepared.presentation.exportLanguage,
            pdfThemeId: prepared.presentation.pdfThemeId
        },
        effectiveQuoteDate: prepared.agreement.effectiveQuoteDate,
        productRows: prepared.commercial.productRows.map((row) => ({
            model: row.model,
            size: row.size,
            unitPrice: row.unitPrice,
            qty: row.qty,
            gross: row.gross,
            discountPct: row.discountPct,
            discountSek: row.discountSek,
            net: row.net,
            isAddon: row.isAddon,
            isCustom: row.isCustom,
            priceUponRequest: row.priceUponRequest,
            line: row.line
        })),
        productTotals: { ...prepared.commercial.productTotals },
        contractingWork: prepared.commercial.contractingWork
            ? {
                ...prepared.commercial.contractingWork,
                rows: prepared.commercial.contractingWork.rows.map((row) => ({ ...row }))
            }
            : null,
        visibility: {
            contractingWork: prepared.visibility.contractingWork,
            discountReferences: prepared.visibility.discountReferences
        }
    };
}

export function restorePreparedQuote({
    state,
    commercialSnapshot,
    quoteIdentity
}: {
    state: QuoteState;
    commercialSnapshot: unknown;
    quoteIdentity?: PreparedQuote['agreement']['quoteIdentity'];
}): PreparedQuote {
    const snapshot = normalizeQuoteCommercialSnapshot(commercialSnapshot);
    if (!snapshot) {
        throw new QuotePreparationError('commercialSnapshot', 'Saved Quote Revision has no valid commercial snapshot.');
    }

    const isRetailer = snapshot.visibility.contractingWork === 'suppressed-retailer';
    const presentation = { ...snapshot.presentation };
    const customerInfo = cloneCustomerInfo(state.customerInfo);
    const productRows: PreparedQuoteProductRow[] = snapshot.productRows.map((row, index) => ({
        ...row,
        source: { type: 'custom', index },
        sortModel: row.model,
        sortSizeRaw: row.size,
        sortKind: 'text',
        sortDimensions: [],
        originalIndex: index
    }));
    const persistenceSnapshot = createPersistenceSnapshot(
        state,
        presentation,
        isRetailer,
        snapshot.effectiveQuoteDate
    );
    const agreement: PreparedQuote['agreement'] = {
        customerInfo,
        effectiveQuoteDate: snapshot.effectiveQuoteDate,
        quoteIdentity: quoteIdentity || {
            quoteId: state.activeQuoteId ? String(state.activeQuoteId) : null,
            quoteNumber: state.quoteNumber ? String(state.quoteNumber) : null,
            version: state.activeQuoteVersion,
            status: state.quoteStatus
        },
        legalTerms: {
            included: state.includeTerms === true,
            text: String(state.termsText || ''),
            templateId: String(state.termsTemplateId || ''),
            customized: state.termsCustomized === true
        },
        paymentTermsDays: state.paymentTermsDays,
        validityDays: state.quoteValidityDays,
        includePaymentBox: state.includePaymentBox === true,
        includeSignatureBlock: state.includeSignatureBlock === true
    };
    const commercial: PreparedQuote['commercial'] = {
        productRows,
        productTotals: { ...snapshot.productTotals },
        contractingWork: snapshot.contractingWork
            ? { ...snapshot.contractingWork, rows: snapshot.contractingWork.rows.map((row) => ({ ...row })) }
            : null
    };
    const visibility: PreparedQuote['visibility'] = {
        contractingWork: snapshot.visibility.contractingWork,
        discountReferences: snapshot.visibility.discountReferences,
        legalTerms: state.includeTerms === true ? 'visible' : 'hidden',
        paymentBox: state.includePaymentBox === true ? 'visible' : 'hidden',
        signatureBlock: state.includeSignatureBlock === true ? 'visible' : 'hidden'
    };
    const preparedMeaning = { presentation, commercial, agreement, visibility };

    return deepFreeze({
        presentation: {
            ...presentation,
            equivalenceKey: canonicalStringify(preparedMeaning)
        },
        commercial,
        agreement,
        visibility,
        persistenceSnapshot
    });
}
