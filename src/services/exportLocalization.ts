import { catalogData } from '../data/catalog';
import type { QuoteExportLanguage, QuoteTotalsRow } from '../types/contracts';

export const DEFAULT_EXPORT_LANGUAGE: QuoteExportLanguage = 'sv';

const EXPORT_LABELS = {
    sv: {
        sheetName: 'Offert',
        quoteTitle: 'OFFERT',
        quote: 'Offert',
        date: 'Datum',
        quoteNo: 'OffertNr',
        company: 'Foretag',
        projectReference: 'Projektreferens',
        customerReference: 'Er referens',
        validityPeriod: 'Giltighetstid',
        to: 'Till',
        notes: 'Noteringar',
        quoteDetails: 'Offertdetaljer',
        productsHeading: 'Produkter',
        productTotalExVat: 'Produkttotal exkl. moms',
        products: 'Produkter',
        addons: 'Tillval',
        otherPrefix: 'Övrigt',
        addonPrefix: 'Tillval',
        globalDiscount: 'Overgripande Rabatt',
        subtotal: 'Delsumma',
        yourPrice: 'Ert Pris',
        paymentValidity: 'BETALNING & GILTIGHET',
        paymentTerms: 'Betalningsvillkor',
        validUntil: 'Giltig till',
        termsTitle: 'VILLKOR',
        approval: 'Godkännande',
        printedName: 'Namnförtydligande',
        signature: 'Signatur',
        model: 'Modell',
        size: 'Storlek',
        unitPrice: 'Pris/enhet',
        quantity: 'Antal',
        recommendedPrice: 'Rek Utpris',
        discountSek: 'Rabatt\ni SEK',
        discountPct: 'Rabatt\ni %',
        inclVat: 'Inkl. moms',
        exclVat: 'Exkl. moms',
        totalRecommendedPrice: 'Totalt Rek Utpris',
        totalRecommendedPriceExVat: 'Totalt Rek Utpris (Exkl. moms)',
        totalDiscount: 'Total Rabatt',
        totalDiscountExVat: 'Total Rabatt (Exkl. moms)',
        totalExVat: 'Totalt Exkl. moms',
        totalExVatExcel: 'Totalt Exkl. Moms',
        totalInclVat: 'Totalt inkl. moms',
        totalInclVatExcel: 'Totalt Inkl. Moms',
        vat25: 'Moms 25%',
        vat25Excel: 'Varav Moms (25%)',
        gross: 'Brutto',
        totalAmountDue: 'Totalt att betala',
        priceUponRequest: 'Pris på förfrågan',
        totalsExcludePriceUponRequest: '* Totalsumman exkluderar artiklar med pris på förfrågan',
        contractingHeading: 'Entreprenadarbeten - sammanställd översikt',
        contractingFor: 'för',
        contractingWorkPackage: 'Arbetspaket',
        contractingScope: 'Sammanställd omfattning för hela området',
        contractingUnit: 'Enhet',
        contractingPriceExVat: 'Ert pris\nexkl. moms',
        contractingBaseValue: 'Grundkontraktsvärde för hela området (exkl. moms)',
        contractingAtaAllowance: 'ÄTA-reserv',
        contractingLowerIndicative: 'Lägre indikativt belopp exkl. moms',
        contractingUpperIndicative: 'Övre indikativt belopp exkl. moms',
        days: 'dagar'
    },
    en: {
        sheetName: 'Quote',
        quoteTitle: 'QUOTE',
        quote: 'Quote',
        date: 'Date',
        quoteNo: 'Quote No',
        company: 'Company',
        projectReference: 'Project reference',
        customerReference: 'Your reference',
        validityPeriod: 'Validity period',
        to: 'To',
        notes: 'Notes',
        quoteDetails: 'Quote details',
        productsHeading: 'Products',
        productTotalExVat: 'Product total excl. VAT',
        products: 'Products',
        addons: 'Add-ons',
        otherPrefix: 'Other',
        addonPrefix: 'Add-on',
        globalDiscount: 'Overall Discount',
        subtotal: 'Subtotal',
        yourPrice: 'Your Price',
        paymentValidity: 'PAYMENT & VALIDITY',
        paymentTerms: 'Payment terms',
        validUntil: 'Valid until',
        termsTitle: 'TERMS',
        approval: 'Approval',
        printedName: 'Printed name',
        signature: 'Signature',
        model: 'Model',
        size: 'Size',
        unitPrice: 'Unit price',
        quantity: 'Qty',
        recommendedPrice: 'Recommended Price',
        discountSek: 'Discount\nin SEK',
        discountPct: 'Discount\nin %',
        inclVat: 'Incl. VAT',
        exclVat: 'Excl. VAT',
        totalRecommendedPrice: 'Total Recommended Price',
        totalRecommendedPriceExVat: 'Total Recommended Price (Excl. VAT)',
        totalDiscount: 'Total Discount',
        totalDiscountExVat: 'Total Discount (Excl. VAT)',
        totalExVat: 'Total excl. VAT',
        totalExVatExcel: 'Total Excl. VAT',
        totalInclVat: 'Total incl. VAT',
        totalInclVatExcel: 'Total Incl. VAT',
        vat25: 'VAT 25%',
        vat25Excel: 'VAT 25%',
        gross: 'Gross',
        totalAmountDue: 'Total amount due',
        priceUponRequest: 'Price on request',
        totalsExcludePriceUponRequest: '* The total excludes items with price on request',
        contractingHeading: 'Contracting works - consolidated overview',
        contractingFor: 'for',
        contractingWorkPackage: 'Work package',
        contractingScope: 'Consolidated scope for the entire area',
        contractingUnit: 'Unit',
        contractingPriceExVat: 'Your price\nexcl. VAT',
        contractingBaseValue: 'Base contract value for the entire area (excl. VAT)',
        contractingAtaAllowance: 'Variation work allowance',
        contractingLowerIndicative: 'Lower indicative amount excl. VAT',
        contractingUpperIndicative: 'Upper indicative amount excl. VAT',
        days: 'days'
    }
} as const;

export type ExportLabels = typeof EXPORT_LABELS[QuoteExportLanguage];

export function normalizeExportLanguage(value: unknown): QuoteExportLanguage {
    return value === 'en' ? 'en' : DEFAULT_EXPORT_LANGUAGE;
}

export function getExportLabels(language: unknown = DEFAULT_EXPORT_LANGUAGE): ExportLabels {
    return EXPORT_LABELS[normalizeExportLanguage(language)];
}

export function formatLocalizedDays(days: number, language: unknown = DEFAULT_EXPORT_LANGUAGE): string {
    const normalizedLanguage = normalizeExportLanguage(language);
    const dayLabel = days === 1
        ? (normalizedLanguage === 'en' ? 'day' : 'dag')
        : getExportLabels(normalizedLanguage).days;
    return `${days} ${dayLabel}`;
}

export function formatLocalizedValidityPeriod(
    value: unknown,
    language: unknown = DEFAULT_EXPORT_LANGUAGE
): string {
    const raw = String(value ?? '').trim();
    if (!raw || normalizeExportLanguage(language) !== 'en') {
        return raw;
    }

    const daysMatch = raw.match(/\d+/u);
    if (!daysMatch) {
        return raw;
    }

    return formatLocalizedDays(Number.parseInt(daysMatch[0], 10), language);
}

export function translateSystemLabel(value: unknown, language: unknown = DEFAULT_EXPORT_LANGUAGE): string {
    const raw = String(value ?? '');
    if (normalizeExportLanguage(language) !== 'en') {
        return raw;
    }

    return raw
        .replace(/^Tillval:\s*/u, `${EXPORT_LABELS.en.addonPrefix}: `)
        .replace(/^Övrigt:\s*/u, `${EXPORT_LABELS.en.otherPrefix}: `)
        .replace(/^Overgripande Rabatt/u, EXPORT_LABELS.en.globalDiscount)
        .replace(/^Övergripande Rabatt/u, EXPORT_LABELS.en.globalDiscount);
}

type QuoteTotalsRowModelInput = Pick<QuoteTotalsRow, 'model'> & Partial<Pick<QuoteTotalsRow, 'source'>>;

export function translateQuoteTotalsRowModel(
    row: QuoteTotalsRowModelInput,
    language: unknown = DEFAULT_EXPORT_LANGUAGE
): string {
    const raw = String(row?.model ?? '');
    if (normalizeExportLanguage(language) !== 'en') {
        return raw;
    }

    const source = row?.source;
    if (source?.type !== 'grid' && source?.type !== 'grid-addon') {
        return translateSystemLabel(raw, language);
    }

    const lineData = catalogData[source.lineId];
    if (!lineData || lineData.type !== 'grid') {
        return translateSystemLabel(raw, language);
    }

    if (source.type === 'grid') {
        const separatorIndex = source.key.lastIndexOf('|');
        const modelId = separatorIndex > -1 ? source.key.slice(0, separatorIndex) : source.key;
        const modelDefinition = lineData.gridItems.find((item) => item.model === modelId);
        return modelDefinition?.exportNameEn || translateSystemLabel(raw, language);
    }

    for (const category of lineData.addonCategories) {
        const addonDefinition = category.items.find((item) => item.id === source.addonId);
        if (addonDefinition?.exportNameEn) {
            return `${EXPORT_LABELS.en.addonPrefix}: ${addonDefinition.exportNameEn}`;
        }
    }

    return translateSystemLabel(raw, language);
}

export function translateGroupLabel(value: unknown, language: unknown = DEFAULT_EXPORT_LANGUAGE): string {
    const raw = String(value ?? '');
    if (normalizeExportLanguage(language) !== 'en') {
        return raw;
    }

    // Saved quote data may contain older mojibake for "Övrigt"; keep English export resilient.
    const legacyMojibakeOther = '\u00C3\u2013vrigt';
    if (raw === 'Övrigt' || raw === legacyMojibakeOther) {
        return EXPORT_LABELS.en.otherPrefix;
    }
    return raw === 'ClickitUpFixed' ? 'CiUFixed' : raw;
}
