# Välj Visualiseringsplanens kontrakt

Type: grilling
Status: resolved
Parent: ../map.md

## Question

Vilket minsta versionerade och kommersiellt neutrala kontrakt ska översätta Simple Sketch till 3D Visualization utan att Three.js-modulen behöver känna till `QuoteState`, React-context eller sektionslösarens interna representation?

Beslutet ska täcka enheter och koordinataxlar, ClickitUp-löp med ordnade sektioner och dörrar, hörn och fria ändar, placerade parasoller och Fiesta, stabil produktidentitet, problem/fallbacks samt vilka värden som uttryckligen härleds i stället för att persisteras. Jämför ett scenorienterat kontrakt med ett domänorienterat Visualiseringsplan-kontrakt och välj den seam som ger minst koppling och bäst testbarhet.

## Comments

### Val av kontraktsseam

Användaren valde ett domänorienterat, renderingsneutralt Visualiseringsplan-kontrakt. En ren adapter ska härleda planen från Simple Sketch och sektionslösarens resultat. Three.js-lagret ska konsumera Visualiseringsplanen utan kännedom om `QuoteState`, React-context, sektionslösarens interna representation eller specifika mesh-, material- och assetdetaljer.

### Godkända kontraktsgränser

Användaren godkände samtliga rekommenderade följdbeslut:

- Kontraktet använder heltalsmillimeter och ett explicit högerhänt Y-up-koordinatsystem med X/Z som markplan. Origo ligger i främre vänstra hörnet, +X löper åt höger och +Z in mot baksidan eller fasaden. Renderern ansvarar ensam för konvertering från millimeter till meter.
- Planen bär en explicit footprint och ordnade ClickitUp-löp. Varje löp har semantisk identitet, start- och slutpunkt, ordnade `section | door`-element samt explicita hörn eller fria ändar. Elementordningen gäller från löpets start till slut.
- En Placed Product Instance identifieras separat från sin domäntyp. Planen använder `instanceId`, stabil typ, självförsörjande footprint, centrumposition och rotation. Giltiga unika käll-ID:n bevaras; saknade eller duplicerade ID:n ersätts deterministiskt och ger ett problem. Kommersiella exportnycklar och asset-ID:n ingår inte.
- Planbyggaren normaliserar källproblem till lokaliseringsneutrala problem med stabil kod, allvarlighet, entitetsreferens och effekt som `degraded` eller `omitted`, samtidigt som användbar best-effort-geometri bevaras. Runtime-assetfel tillhör renderern; exakt fallback- och exportpolicy lämnas till den senare ticketen **Lås fel- och fallbacktolkningen**.
- Visualiseringsplanen är en transient och deterministisk `schemaVersion: 1`-snapshot som alltid härleds från den aktuella normaliserade Simple Sketch och aldrig persisteras i Quote eller Quote Revision. Kamera, markering, UI-läge, material, asset-URL:er, priser, rabatter, offertmängder och exportetiketter ingår inte.

### Godkända kompatibilitets- och geometriregler

- En okänd `schemaVersion` avvisas tydligt vid kontraktsgränsen och får aldrig gissas fram. Version 1 får endast utökas med bakåtkompatibla valfria fält; borttagna fält eller ändrad semantik kräver en ny version.
- Om aktiverad bakkant och olika sidodjup ger en diagonal footprint men ett horisontellt ClickitUp-löp, bevarar planen båda utan att korrigera Simple Sketch. En anslutning som geometriskt inte möts klassificeras som `unresolved`, inte som ett avsiktligt `free`-slut, och ger problemet `RUN_ENDPOINT_DISCONNECTED`. Visuell markering och exportpolicy beslutas i **Lås fel- och fallbacktolkningen**.

## Answer

Inför ett domänorienterat `VisualizationPlanV1` som enda kontrakt mellan Simple Sketch-adaptern och 3D-modulen. Adaptern får känna till den normaliserade `SketchConfigState`-formen och anropa den rena sektionslösaren, men översätter resultatet till ett självförsörjande kontrakt innan Three.js-gränsen. Planen är inte en scen-graf och innehåller inga mesh-, material-, asset- eller React-begrepp.

Kontraktets minsta form är:

```ts
interface VisualizationPlanV1 {
    schemaVersion: 1;
    units: 'mm';
    coordinateSystem: {
        handedness: 'right';
        upAxis: 'y';
        groundPlane: 'xz';
        origin: 'front-left';
        xDirection: 'right';
        zDirection: 'back';
    };
    footprint: { points: PlanPoint[] };
    clickitUpRuns: ClickitUpRunV1[];
    placedProducts: PlacedProductV1[];
    problems: VisualizationProblemV1[];
}

interface PlanPoint {
    xMm: number;
    zMm: number;
}

interface ClickitUpRunV1 {
    id: 'front' | 'left' | 'right' | 'back';
    start: PlanPoint;
    end: PlanPoint;
    members: Array<{
        index: number;
        kind: 'section' | 'door';
        lengthMm: number;
    }>;
    terminals: {
        start: RunTerminalV1;
        end: RunTerminalV1;
    };
}

type RunTerminalV1 =
    | { kind: 'corner'; connectsTo: { runId: ClickitUpRunV1['id']; terminal: 'start' | 'end' } }
    | { kind: 'free' }
    | { kind: 'unresolved' };

interface PlacedProductV1 {
    instanceId: string;
    productType: string;
    variantKey?: string;
    center: PlanPoint;
    rotationDeg: number;
    footprint:
        | { kind: 'rectangle'; widthMm: number; depthMm: number }
        | { kind: 'circle'; diameterMm: number };
}

interface VisualizationProblemV1 {
    code: string;
    severity: 'warning' | 'error';
    entityRef: {
        kind: 'plan' | 'run' | 'run-member' | 'placed-product';
        id: string;
        memberIndex?: number;
    };
    effect: 'degraded' | 'omitted';
}
```

`footprint.points` går runt ytan i ordningen främre vänster, främre höger, bakre höger, bakre vänster. Löpets `members` är ordnade från `start` till `end`; renderern ska aldrig känna till eller tolka `SketchSectionEntry`, dörrsträngar, manuella pins eller `ComputedLayoutResult`. Exakta produktnycklar och det slutliga sektions-, stolp- och hörnbyggsättet fylls i av de efterföljande prototypticketarna utan att ändra kontraktets ansvarsfördelning.

Alla planvärden härleds deterministiskt från den aktuella normaliserade Simple Sketch. Giltiga och unika placerings-ID:n bevaras. Saknade eller duplicerade produkt-ID:n ersätts med ett deterministiskt planlokalt ID och ger ett problem. Kända sektionsfel blir stabila, lokaliseringsneutrala problemkoder; UI-text transporteras inte i planen. Användbar footprint, löpgeometri och produktgeometri behålls vid fel så långt källdatan tillåter.

Om olika sidodjup kombineras med bakkant bevaras både den diagonala footprinten och det horisontella bakre ClickitUp-löpet. En endpoint som då inte möter sin avsedda granne får terminaltypen `unresolved` och problemet `RUN_ENDPOINT_DISCONNECTED`. Adaptern får inte flytta punkter eller ändra Simple Sketch för att läka relationen.

Planen skapas på nytt när den aktuella skissen ändras och sparas aldrig i Quote, Quote Revision eller någon separat 3D-state. Den innehåller inte workspace-kamera, markering, editorläge, `Fiesta.zLayer`, offert- eller projektnamn, pris, rabatt, mängdsummeringar, exportnycklar, material, 3D-höjder, asset-ID:n, asset-URL:er, scenbounds eller kamerainramning. De visuella värden som behövs vid rendering härleds av produkt-/assetlagret och renderern.

En mottagare måste avvisa okänd `schemaVersion` med ett tydligt kontraktsfel. Version 1 får bara få bakåtkompatibla valfria tillägg; borttagna obligatoriska fält eller ändrad betydelse kräver en ny version. Exakt visuell fallback, användartext och exportblockering beslutas i **Lås fel- och fallbacktolkningen**.

Beslutet behöver ingen separat ADR inom denna Wayfinder-karta: den fullständiga motiveringen, alternativen och kontraktsgränsen är samlade här och pekas ut från kartan.
