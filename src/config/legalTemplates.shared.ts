import type { LegalTemplateOption, QuoteExportLanguage } from '../types/contracts';

const STANDARD_TERMS_BODY = `OFFERT OCH PRISER
- Samtliga priser i offerten anges i SEK exklusive moms om inget annat uttryckligen anges.
- Offerten gäller under den giltighetstid som anges i offerten. Därefter förbehåller sig BRIXX rätten att justera pris och leveransvillkor.

BETALNINGSVILLKOR
- Betalningsvilkor lämnas efter utförd kreditprövning.
- Vid försenad betalning debiteras dröjsmålsränta och eventuella lagstadgade påminnelseavgifter.

LEVERANS
- Bedömd standard produktionstid 4-6 veckor gäller om inget annat anges i offerten.
- Nettofrakt tillkommer om inget annat anges.

MONTERING OCH FÖRUTSÄTTNINGAR
- Montage eller installation ingår ej i offertens omfattning om inget annat anges i offerten.
- Kunden ansvarar för att tillträde, arbetsyta, el, underlag och övriga praktiska förutsättningar finns tillgängliga enligt överenskommelse.
- Ändrings- och tilläggsarbeten som inte omfattas av offerten beställs separat och debiteras utöver offertbeloppet.

SPECIALBESTÄLLNINGAR
- Kundunika eller specialbeställda produkter tas hem eller produceras särskilt för kunden och kan därför inte avbeställas eller returneras utan att faktisk uppkommen kostnad debiteras.
- I sammanband med specialbeställningar erläggs en procentuell handpenning enligt diskusion med kund. Denna handpenning återbetalas ej vid avbeställning.

REKLAMATION
- Eventuella reklamationer ska göras skriftligen inom skälig tid efter att felet upptäckts eller borde ha upptäckts.
- BRIXX ansvarar inte för fel eller skador som orsakas av bristande underhåll, felaktig användning eller omständigheter utanför BRIXX kontroll.

ÖVRIGT
- BRIXX förbehåller sig rätten att korrigera skrivfel, räknefel och uppenbara felaktigheter i offerten.
- BRIXX ansvarar inte för förseningar eller utebliven leverans som beror på force majeure eller annan omständighet utanför BRIXX rimliga kontroll.`;

const STANDARD_TERMS_BODY_EN = `QUOTE AND PRICES
- All prices in the quote are stated in SEK excluding VAT unless expressly stated otherwise.
- The quote is valid for the validity period stated in the quote. After that, BRIXX reserves the right to adjust prices and delivery terms.

PAYMENT TERMS
- Payment terms are provided after completed credit approval.
- Late payment may incur interest and any statutory reminder fees.

DELIVERY
- Estimated standard production time of 4-6 weeks applies unless otherwise stated in the quote.
- Net freight is added unless otherwise stated.

INSTALLATION AND CONDITIONS
- Assembly or installation is not included in the quote scope unless otherwise stated in the quote.
- The customer is responsible for ensuring that access, workspace, electricity, substrate, and other practical conditions are available as agreed.
- Changes and additional work not covered by the quote are ordered separately and charged in addition to the quote amount.

SPECIAL ORDERS
- Customer-specific or specially ordered products are purchased or produced specifically for the customer and therefore cannot be cancelled or returned without charging actual incurred costs.
- For special orders, a percentage deposit is paid as agreed with the customer. This deposit is not refunded in the event of cancellation.

CLAIMS
- Any claims must be made in writing within a reasonable time after the defect was discovered or should have been discovered.
- BRIXX is not responsible for defects or damage caused by insufficient maintenance, incorrect use, or circumstances outside BRIXX's control.

OTHER
- BRIXX reserves the right to correct typing errors, calculation errors, and obvious inaccuracies in the quote.
- BRIXX is not responsible for delays or non-delivery caused by force majeure or other circumstances outside BRIXX's reasonable control.`;

export const LEGAL_TEMPLATES: LegalTemplateOption[] = [
    {
        id: 'standard',
        label: 'Standardvillkor',
        body: STANDARD_TERMS_BODY,
        language: 'sv'
    },
    {
        id: 'standard_en',
        label: 'Standard terms (English)',
        body: STANDARD_TERMS_BODY_EN,
        language: 'en'
    }
];

export const DEFAULT_TEMPLATE_ID = 'standard';
export const DEFAULT_ENGLISH_TEMPLATE_ID = 'standard_en';

export function getDefaultTemplateIdForLanguage(language: QuoteExportLanguage): string {
    return language === 'en' ? DEFAULT_ENGLISH_TEMPLATE_ID : DEFAULT_TEMPLATE_ID;
}

export function isBuiltinTemplateId(id: unknown): boolean {
    return LEGAL_TEMPLATES.some((t) => t.id === id);
}

export function isLegalTemplateId(id: unknown, customTemplates: LegalTemplateOption[] = []): boolean {
    return LEGAL_TEMPLATES.some((t) => t.id === id) ||
        customTemplates.some((t) => t.id === id);
}

export function getTemplateById(id: unknown, customTemplates: LegalTemplateOption[] = []): LegalTemplateOption {
    const all = [...LEGAL_TEMPLATES, ...customTemplates];
    const match = all.find((t) => t.id === id);
    if (match) return match;
    return LEGAL_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID) || LEGAL_TEMPLATES[0];
}

