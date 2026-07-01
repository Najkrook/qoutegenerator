import type { QuoteExportLanguage } from '../types/contracts';

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
        priceUponRequest: 'Pris på förfrågan',
        totalsExcludePriceUponRequest: '* Totalsumman exkluderar artiklar med pris på förfrågan',
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
        priceUponRequest: 'Price on request',
        totalsExcludePriceUponRequest: '* The total excludes items with price on request',
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
    return `${days} ${getExportLabels(language).days}`;
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

export function translateGroupLabel(value: unknown, language: unknown = DEFAULT_EXPORT_LANGUAGE): string {
    const raw = String(value ?? '');
    if (normalizeExportLanguage(language) !== 'en') {
        return raw;
    }

    // Saved quote data may contain older mojibake for "Övrigt"; keep English export resilient.
    const legacyMojibakeOther = '\u00C3\u2013vrigt';
    return raw === 'Övrigt' || raw === legacyMojibakeOther ? EXPORT_LABELS.en.otherPrefix : raw;
}
