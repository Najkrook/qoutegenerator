export const LEGAL_TEMPLATES = [
    {
        id: 'standard',
        label: 'Standardvillkor',
        body: `BETALNINGSVILLKOR
- Betalning sker mot faktura med 30 dagars netto.
- Vid försenad betalning debiteras dröjsmålsränta enligt räntelagen.

LEVERANS
- Leveranstid cirka 4-6 veckor efter orderbekräftelse.
- Fraktkostnad tillkommer enligt offert.
- Leverans sker fritt vårt lager om ej annat anges.

GARANTI & REKLAMATION
- Garanti enligt gällande konsumentköplag.
- Reklamation ska ske skriftligt senast 14 dagar efter leverans.

MONTERING
- Montering ingår ej om ej annat avtalats.
- Vid montering av BRIXX ansvarar kunden för att underlaget är plant och stabilt.

ÖVRIGT
- Alla priser är exklusive moms om ej annat anges.
- Offerten är giltig enligt angiven giltighetstid.
- BRIXX Europe AB förbehåller sig rätten till prisändringar och tryckfel.`
    },
    {
        id: 'service_work',
        label: 'Service & installation',
        body: `SERVICEARBETE
- Arbetet utförs enligt överenskommen omfattning och tidplan.
- Eventuella tilläggsarbeten beställs skriftligt och debiteras separat.

BETALNING
- 40% faktureras vid beställning, resterande 60% efter färdigställande.
- Betalningsvillkor 15 dagar netto om inget annat avtalats.

TILLTRÄDE OCH ANSVAR
- Kunden ansvarar för fri tillgång till arbetsplatsen under avtalad tid.
- Förseningar orsakade av bristande tillträde kan medföra omplaneringskostnad.

GARANTI
- Garantitid för utfört arbete är 12 månader från godkänd leverans.
- Garantin omfattar inte normalt slitage eller skador från yttre påverkan.`
    },
    {
        id: 'project_delivery',
        label: 'Projektleverans',
        body: `PROJEKTLEVERANS
- Leveransplan och etapper fastställs vid orderbekräftelse.
- Del- och slutfakturering sker enligt betalningsplan i offerten.

BETALNINGSPLAN
- 30% vid order, 50% vid leverans, 20% efter godkänd slutkontroll.
- Betalningsvillkor 30 dagar netto om inget annat avtalats.

LEVERANS OCH RISK
- Riskövergång sker när varan avlämnats till avtalad leveransadress.
- Kunden ansvarar för mottagningskontroll och eventuell avvikelseanmälan inom 5 arbetsdagar.

ÄNDRINGAR OCH AVBESTÄLLNING
- Ändringar efter godkänd beställning kan påverka pris och leveranstid.
- Avbeställning av specialbeställda produkter debiteras enligt faktisk kostnad.`
    }
];

export const DEFAULT_TEMPLATE_ID = 'standard';

export function isLegalTemplateId(id) {
    return LEGAL_TEMPLATES.some((template) => template.id === id);
}

export function getTemplateById(id) {
    const match = LEGAL_TEMPLATES.find((template) => template.id === id);
    if (match) return match;
    return LEGAL_TEMPLATES.find((template) => template.id === DEFAULT_TEMPLATE_ID) || LEGAL_TEMPLATES[0];
}
