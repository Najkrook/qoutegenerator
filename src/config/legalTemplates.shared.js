const STANDARD_TERMS_BODY = `OFFERT OCH PRISER
- Samtliga priser i offerten anges i SEK exklusive moms om inget annat uttryckligen anges.
- Offerten gäller under den giltighetstid som anges i offerten. Därefter förbehåller sig BRIXX rätten att justera pris och leveransvillkor.

BETALNINGSVILLKOR
- Betalning sker mot faktura med 30 dagars netto om inget annat anges i offerten.
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

REKLAMATION
- Eventuella reklamationer ska göras skriftligen inom skälig tid efter att felet upptäckts eller borde ha upptäckts.
- BRIXX ansvarar inte för fel eller skador som orsakas av bristande underhåll, felaktig användning eller omständigheter utanför BRIXX kontroll.

ÖVRIGT
- BRIXX förbehåller sig rätten att korrigera skrivfel, räknefel och uppenbara felaktigheter i offerten.
- BRIXX ansvarar inte för förseningar eller utebliven leverans som beror på force majeure eller annan omständighet utanför BRIXX rimliga kontroll.`;

export const LEGAL_TEMPLATES = [
    {
        id: 'standard',
        label: 'Standardvillkor',
        body: STANDARD_TERMS_BODY
    },
    {
        id: 'service_work',
        label: 'Standardvillkor (tidigare service)',
        body: STANDARD_TERMS_BODY
    },
    {
        id: 'project_delivery',
        label: 'Standardvillkor (tidigare projekt)',
        body: STANDARD_TERMS_BODY
    }
];

export const DEFAULT_TEMPLATE_ID = 'standard';

export function isBuiltinTemplateId(id) {
    return LEGAL_TEMPLATES.some((t) => t.id === id);
}

export function isLegalTemplateId(id, customTemplates = []) {
    return LEGAL_TEMPLATES.some((t) => t.id === id) ||
        customTemplates.some((t) => t.id === id);
}

export function getTemplateById(id, customTemplates = []) {
    const all = [...LEGAL_TEMPLATES, ...customTemplates];
    const match = all.find((t) => t.id === id);
    if (match) return match;
    return LEGAL_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID) || LEGAL_TEMPLATES[0];
}
