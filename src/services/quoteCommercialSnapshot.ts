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

function isRecord(value: unknown): value is UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeProductRow(value: unknown): QuoteCommercialSnapshotProductRow | null {
    if (!isRecord(value)) return null;
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
    if (!isRecord(value)) return null;
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
    if (!isRecord(value) || !Array.isArray(value.rows)) return undefined;
    const rows = value.rows.map((row) => {
        if (!isRecord(row)) return null;
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
        baseTotalSek == null || ataPercent == null || allowanceSek == null
        || lowerIndicativeSek == null || upperIndicativeSek == null
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
    if (!isRecord(value) || value.schemaVersion !== 1) return null;
    const presentation = isRecord(value.presentation) ? value.presentation : null;
    const visibility = isRecord(value.visibility) ? value.visibility : null;
    if (!presentation || !visibility || !Array.isArray(value.productRows)) return null;
    const exportLanguage = String(presentation.exportLanguage || '') as QuoteExportLanguage;
    const pdfThemeId = String(presentation.pdfThemeId || '') as PdfThemeId;
    const contractingVisibility = String(visibility.contractingWork || '');
    const discountReferences = String(visibility.discountReferences || '');
    const effectiveQuoteDate = String(value.effectiveQuoteDate || '');
    if (
        !EXPORT_LANGUAGES.has(exportLanguage)
        || !PDF_THEMES.has(pdfThemeId)
        || !CONTRACTING_VISIBILITY.has(contractingVisibility)
        || !DISCOUNT_VISIBILITY.has(discountReferences)
        || !/^\d{4}-\d{2}-\d{2}$/u.test(effectiveQuoteDate)
    ) return null;

    const productRows = value.productRows.map(normalizeProductRow);
    const productTotals = normalizeProductTotals(value.productTotals);
    const contractingWork = normalizeContractingWork(value.contractingWork);
    if (productRows.some((row) => row == null) || !productTotals || contractingWork === undefined) return null;

    return {
        schemaVersion: 1,
        presentation: { exportLanguage, pdfThemeId },
        effectiveQuoteDate,
        productRows: productRows as QuoteCommercialSnapshotProductRow[],
        productTotals,
        contractingWork,
        visibility: {
            contractingWork: contractingVisibility as QuoteCommercialSnapshot['visibility']['contractingWork'],
            discountReferences: discountReferences as QuoteCommercialSnapshot['visibility']['discountReferences']
        }
    };
}
