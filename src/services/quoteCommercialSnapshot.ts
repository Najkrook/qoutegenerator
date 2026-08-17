import type {
    PdfThemeId,
    QuoteCommercialSnapshot,
    QuoteCommercialSnapshotContractingWork,
    QuoteCommercialSnapshotProductRow,
    QuoteCommercialSnapshotProductTotals,
    QuoteExportLanguage,
    UnknownRecord
} from '../types/contracts';

const EXPORT_LANGUAGES = new Set<QuoteExportLanguage>(['sv', 'en']);
const PDF_THEMES = new Set<PdfThemeId>(['brixx', 'custom', 'roslagsmarkisen']);
const CONTRACTING_VISIBILITY = new Set(['visible', 'absent', 'suppressed-retailer']);
const DISCOUNT_VISIBILITY = new Set(['visible', 'hidden-zero']);
const SEK_RECONCILIATION_TOLERANCE = 1;

const SNAPSHOT_KEYS = [
    'schemaVersion', 'presentation', 'effectiveQuoteDate', 'productRows',
    'productTotals', 'contractingWork', 'visibility'
] as const;
const PRESENTATION_KEYS = ['exportLanguage', 'pdfThemeId', 'allowedPdfThemeIds'] as const;
const PRODUCT_ROW_KEYS = [
    'model', 'size', 'unitPrice', 'qty', 'gross', 'discountPct', 'discountSek',
    'net', 'isAddon', 'isCustom', 'priceUponRequest', 'line'
] as const;
const PRODUCT_TOTAL_KEYS = [
    'includesVat', 'grossTotalSek', 'totalDiscountSek', 'finalTotalSek',
    'globalDiscountAmt', 'globalDiscountPct', 'vatBasisSek', 'vatAmountSek',
    'totalWithVatSek'
] as const;
const CONTRACTING_KEYS = [
    'projectName', 'rows', 'baseTotalSek', 'ataEnabled', 'ataPercent',
    'allowanceSek', 'lowerIndicativeSek', 'upperIndicativeSek'
] as const;
const CONTRACTING_ROW_KEYS = ['id', 'workPackage', 'scope', 'unit', 'priceExVatSek'] as const;
const VISIBILITY_KEYS = ['contractingWork', 'discountReferences'] as const;

function isRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasExactKeys(value: UnknownRecord, allowed: readonly string[]): boolean {
    const allowedSet = new Set(allowed);
    const keys = Object.keys(value);
    return keys.length === allowed.length && keys.every((key) => allowedSet.has(key));
}

function reconciles(actual: number, expected: number): boolean {
    return Math.abs(actual - expected) <= SEK_RECONCILIATION_TOLERANCE;
}

function normalizeProductRow(value: unknown): QuoteCommercialSnapshotProductRow | null {
    if (!isRecord(value) || !hasExactKeys(value, PRODUCT_ROW_KEYS)) return null;
    if (
        typeof value.model !== 'string'
        || typeof value.size !== 'string'
        || typeof value.line !== 'string'
        || typeof value.isAddon !== 'boolean'
        || typeof value.isCustom !== 'boolean'
        || typeof value.priceUponRequest !== 'boolean'
    ) return null;
    const unitPrice = finite(value.unitPrice);
    const qty = finite(value.qty);
    const gross = finite(value.gross);
    const discountPct = finite(value.discountPct);
    const discountSek = finite(value.discountSek);
    const net = finite(value.net);
    if (
        unitPrice == null || qty == null || qty <= 0 || gross == null
        || discountPct == null || discountPct < 0 || discountPct > 100
        || discountSek == null || net == null
    ) return null;

    return {
        model: String(value.model || ''),
        size: String(value.size || ''),
        unitPrice,
        qty,
        gross,
        discountPct,
        discountSek,
        net,
        isAddon: value.isAddon === true,
        isCustom: value.isCustom === true,
        priceUponRequest: value.priceUponRequest === true,
        line: String(value.line || '')
    };
}

function normalizeProductTotals(value: unknown): QuoteCommercialSnapshotProductTotals | null {
    if (!isRecord(value) || !hasExactKeys(value, PRODUCT_TOTAL_KEYS)) return null;
    if (typeof value.includesVat !== 'boolean') return null;
    const numericFields = [
        'grossTotalSek',
        'totalDiscountSek',
        'finalTotalSek',
        'globalDiscountAmt',
        'globalDiscountPct',
        'vatBasisSek',
        'vatAmountSek',
        'totalWithVatSek'
    ] as const;
    const numbers = Object.fromEntries(numericFields.map((field) => [field, finite(value[field])])) as Record<(typeof numericFields)[number], number | null>;
    if (numericFields.some((field) => numbers[field] == null)) return null;

    return {
        includesVat: value.includesVat === true,
        grossTotalSek: numbers.grossTotalSek!,
        totalDiscountSek: numbers.totalDiscountSek!,
        finalTotalSek: numbers.finalTotalSek!,
        globalDiscountAmt: numbers.globalDiscountAmt!,
        globalDiscountPct: numbers.globalDiscountPct!,
        vatBasisSek: numbers.vatBasisSek!,
        vatAmountSek: numbers.vatAmountSek!,
        totalWithVatSek: numbers.totalWithVatSek!
    };
}

function normalizeContractingWork(value: unknown): QuoteCommercialSnapshotContractingWork | null | undefined {
    if (value == null) return null;
    if (!isRecord(value) || !hasExactKeys(value, CONTRACTING_KEYS) || !Array.isArray(value.rows)) return undefined;
    const rows = value.rows.map((row) => {
        if (!isRecord(row) || !hasExactKeys(row, CONTRACTING_ROW_KEYS)) return null;
        if (
            typeof row.id !== 'string'
            || typeof row.workPackage !== 'string'
            || typeof row.scope !== 'string'
            || typeof row.unit !== 'string'
        ) return null;
        const priceExVatSek = finite(row.priceExVatSek);
        if (priceExVatSek == null) return null;
        return {
            id: String(row.id || ''),
            workPackage: String(row.workPackage || ''),
            scope: String(row.scope || ''),
            unit: String(row.unit || ''),
            priceExVatSek
        };
    });
    if (rows.some((row) => row == null)) return undefined;

    const baseTotalSek = finite(value.baseTotalSek);
    const ataPercent = finite(value.ataPercent);
    const allowanceSek = finite(value.allowanceSek);
    const lowerIndicativeSek = finite(value.lowerIndicativeSek);
    const upperIndicativeSek = finite(value.upperIndicativeSek);
    if (
        typeof value.projectName !== 'string'
        || typeof value.ataEnabled !== 'boolean'
        || baseTotalSek == null || ataPercent == null || allowanceSek == null
        || lowerIndicativeSek == null || upperIndicativeSek == null
        || ataPercent < 0 || ataPercent > 100
    ) return undefined;

    const rowTotal = rows.reduce((sum, row) => sum + (row?.priceExVatSek || 0), 0);
    const expectedAllowance = value.ataEnabled === true ? baseTotalSek * ataPercent / 100 : 0;
    if (
        !reconciles(baseTotalSek, rowTotal)
        || !reconciles(allowanceSek, expectedAllowance)
        || !reconciles(lowerIndicativeSek, baseTotalSek - allowanceSek)
        || !reconciles(upperIndicativeSek, baseTotalSek + allowanceSek)
    ) return undefined;

    return {
        projectName: String(value.projectName || ''),
        rows: rows as QuoteCommercialSnapshotContractingWork['rows'],
        baseTotalSek,
        ataEnabled: value.ataEnabled === true,
        ataPercent,
        allowanceSek,
        lowerIndicativeSek,
        upperIndicativeSek
    };
}

export function normalizeQuoteCommercialSnapshot(value: unknown): QuoteCommercialSnapshot | null {
    if (!isRecord(value) || !hasExactKeys(value, SNAPSHOT_KEYS) || value.schemaVersion !== 1) return null;
    const presentation = isRecord(value.presentation) ? value.presentation : null;
    const visibility = isRecord(value.visibility) ? value.visibility : null;
    if (
        !presentation || !hasExactKeys(presentation, PRESENTATION_KEYS)
        || !visibility || !hasExactKeys(visibility, VISIBILITY_KEYS)
        || !Array.isArray(value.productRows)
        || !Array.isArray(presentation.allowedPdfThemeIds)
        || typeof presentation.exportLanguage !== 'string'
        || typeof presentation.pdfThemeId !== 'string'
        || typeof visibility.contractingWork !== 'string'
        || typeof visibility.discountReferences !== 'string'
        || typeof value.effectiveQuoteDate !== 'string'
    ) return null;
    const exportLanguage = String(presentation.exportLanguage || '') as QuoteExportLanguage;
    const pdfThemeId = String(presentation.pdfThemeId || '') as PdfThemeId;
    const allowedPdfThemeIds = presentation.allowedPdfThemeIds as unknown[];
    if (allowedPdfThemeIds.some((theme) => typeof theme !== 'string')) return null;
    const normalizedAllowedPdfThemeIds = allowedPdfThemeIds as PdfThemeId[];
    const contractingVisibility = String(visibility.contractingWork || '');
    const discountReferences = String(visibility.discountReferences || '');
    const effectiveQuoteDate = String(value.effectiveQuoteDate || '');
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/u.test(effectiveQuoteDate)
        ? new Date(`${effectiveQuoteDate}T00:00:00Z`)
        : null;
    if (
        !EXPORT_LANGUAGES.has(exportLanguage)
        || !PDF_THEMES.has(pdfThemeId)
        || normalizedAllowedPdfThemeIds.length === 0
        || normalizedAllowedPdfThemeIds.some((theme) => !PDF_THEMES.has(theme))
        || new Set(normalizedAllowedPdfThemeIds).size !== normalizedAllowedPdfThemeIds.length
        || !normalizedAllowedPdfThemeIds.includes('brixx')
        || !normalizedAllowedPdfThemeIds.includes(pdfThemeId)
        || !CONTRACTING_VISIBILITY.has(contractingVisibility)
        || !DISCOUNT_VISIBILITY.has(discountReferences)
        || !parsedDate
        || Number.isNaN(parsedDate.getTime())
        || parsedDate.toISOString().slice(0, 10) !== effectiveQuoteDate
    ) return null;

    const productRows = value.productRows.map(normalizeProductRow);
    const productTotals = normalizeProductTotals(value.productTotals);
    const contractingWork = normalizeContractingWork(value.contractingWork);
    if (productRows.some((row) => row == null) || !productTotals || contractingWork === undefined) return null;
    if (
        (contractingVisibility === 'visible' && !contractingWork)
        || (contractingVisibility !== 'visible' && contractingWork !== null)
    ) return null;
    const normalizedRows = productRows as QuoteCommercialSnapshotProductRow[];
    if (normalizedRows.some((row) => (
        !reconciles(row.gross, row.unitPrice * row.qty)
        || !reconciles(row.discountSek, row.gross * row.discountPct / 100)
        || !reconciles(row.net, row.gross - row.discountSek)
    ))) return null;

    const rowGrossTotal = normalizedRows.reduce((sum, row) => sum + row.gross, 0);
    const rowDiscountTotal = normalizedRows.reduce((sum, row) => sum + row.discountSek, 0);
    const rowNetTotal = normalizedRows.reduce((sum, row) => sum + row.net, 0);
    const expectedVat = productTotals.includesVat ? productTotals.finalTotalSek * 0.25 : 0;
    if (
        !reconciles(productTotals.grossTotalSek, rowGrossTotal)
        || !reconciles(productTotals.totalDiscountSek, rowDiscountTotal)
        || !reconciles(productTotals.finalTotalSek, rowNetTotal - productTotals.globalDiscountAmt)
        || !reconciles(productTotals.vatBasisSek, productTotals.finalTotalSek)
        || !reconciles(productTotals.vatAmountSek, expectedVat)
        || !reconciles(productTotals.totalWithVatSek, productTotals.vatBasisSek + productTotals.vatAmountSek)
        || (discountReferences === 'hidden-zero' && (
            productTotals.totalDiscountSek !== 0
            || normalizedRows.some((row) => row.discountPct !== 0 || row.discountSek !== 0)
        ))
    ) return null;

    return {
        schemaVersion: 1,
        presentation: { exportLanguage, pdfThemeId, allowedPdfThemeIds: normalizedAllowedPdfThemeIds },
        effectiveQuoteDate,
        productRows: normalizedRows,
        productTotals,
        contractingWork,
        visibility: {
            contractingWork: contractingVisibility as QuoteCommercialSnapshot['visibility']['contractingWork'],
            discountReferences: discountReferences as QuoteCommercialSnapshot['visibility']['discountReferences']
        }
    };
}
