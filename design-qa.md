# Design QA — kompakt adminstartsida

- Source visual truth path: `docs/audit-2026-07-24/screenshots/05-approved-dashboard-direction.png`
- Implementation screenshot path: inte tillgänglig; användaren har valt att göra den visuella webbläsarkontrollen manuellt.
- Viewport: målbildens bildyta är 1672 × 941 px; ingen implementationsviewport har fångats.
- Source pixels: 1672 × 941 px.
- Implementation pixels: inte fångade.
- CSS size och device pixel ratio: inte verifierade.
- State: administratör med `full` åtkomst, mörkt tema och desktopmenyn `Mer` öppen.
- Browser-renderad implementation: inte fångad.
- Primära interaktioner: launchers, offertutkast, retry och navigationscallbacks är komponent- och routingtestade; ingen webbläsarinteraktion har utförts.
- Console errors: inte kontrollerade i webbläsare.

## Full-view comparison evidence

Den versionsbara kopian av målbilden har öppnats och granskats. Före-bilderna för header och dashboard finns i `docs/audit-2026-07-24/screenshots/`. Någon implementationsskärmbild i motsvarande viewport och state finns inte, så en normaliserad sida-vid-sida-jämförelse kan inte genomföras ännu.

## Focused region comparison evidence

Inte genomförd. Dashboardkort, de två senaste-listorna och den öppna `Mer`-panelen kräver först en browser-renderad implementationsbild i samma viewport, tema och state.

## Findings

- Visuell fidelity är blockerad av saknad implementationsbild. Typografi, spacing, färgtokens, ikonrendering och copy kan därför inte godkännas visuellt trots att motsvarande kod- och beteendetester passerar.
- Responsivitet vid 1440, 1024, 768 och 390 px, båda teman samt 200 % zoom återstår för användarens manuella kontroll.

## Required fidelity surfaces

- Fonts and typography: inte visuellt verifierat.
- Spacing and layout rhythm: inte visuellt verifierat.
- Colors and visual tokens: inte visuellt verifierat.
- Image quality and asset fidelity: Tabler-ikoner används; faktisk rendering är inte visuellt verifierad.
- Copy and content: verifierat genom komponent- och encodingtester, men inte genom en browser-renderad jämförelse.

## Comparison history

- Pass 0: blockerad före visuell jämförelse eftersom användaren valt manuell webbläsar-QA och ingen implementationsbild ännu har tillhandahållits.

## Implementation checklist

| Kontroll | Mörkt | Ljust | Godkänd |
| --- | --- | --- | --- |
| 1440 px, `Mer` stängd | Inte utförd | Inte utförd | Nej |
| 1440 px, `Mer` öppen | Inte utförd | Inte utförd | Nej |
| 1024 px | Inte utförd | Inte utförd | Nej |
| 768 px | Inte utförd | Inte utförd | Nej |
| 390 px och mobildrawer | Inte utförd | Inte utförd | Nej |
| 200 % zoom | Inte utförd | Inte utförd | Nej |

### Interaktionsmatris

| Kontroll | Status |
| --- | --- |
| Synlig tangentbordsfokus genom header, launchers och `Mer` | Inte utförd |
| Escape, utanför-klick och fokusåterställning för `Mer` | Automatiskt testad; inte manuellt utförd |
| Långa kund-, order- och aktivitetstexter | Automatiskt testad; inte manuellt utförd |
| Loading, tomdata, fel och retry | Automatiskt testad; inte manuellt utförd |
| Tre kolumner → två → en utan horisontell scroll | Kod- och komponenttestad; inte manuellt utförd |
| Fånga implementationsbild i samma state som målbilden | Inte utförd |

previous result: blocked

---

# Design QA — fokuserad sketcharbetsyta

- Source visual truth, desktop: `C:/Users/rooki/.codex/generated_images/019f935e-d017-7c53-8c13-3b38b5d51b61/call_FcojfXmQbs22ssWV83VXtPwA.png`
- Source visual truth, mobile: `C:/Users/rooki/.codex/generated_images/019f935e-d017-7c53-8c13-3b38b5d51b61/call_qCmcJcBayMe0O9gFavp0WMTp.png`
- Final implementation, desktop: `C:/Users/rooki/.codex/visualizations/2026/07/24/019f935e-d017-7c53-8c13-3b38b5d51b61/sketch-implementation-1440-dark-final.jpg`
- Final implementation, mobile: `C:/Users/rooki/.codex/visualizations/2026/07/24/019f935e-d017-7c53-8c13-3b38b5d51b61/sketch-implementation-390-dark-pass2.jpg`
- Final desktop comparison: `C:/Users/rooki/.codex/visualizations/2026/07/24/019f935e-d017-7c53-8c13-3b38b5d51b61/sketch-comparison-desktop-final.jpg`
- Final mobile comparison: `C:/Users/rooki/.codex/visualizations/2026/07/24/019f935e-d017-7c53-8c13-3b38b5d51b61/sketch-comparison-mobile-pass2.jpg`
- Browser: Codex inbyggda webbläsare.
- Route och state: `/sketch`, administratör med `full` åtkomst, Simple som startläge och befintligt Simple-utkast.
- Implementationens viewport: 1440 × 900 px och 390 × 844 px, DPR cirka 1.
- Målbildernas originalstorlek: 1487 × 1058 px och 853 × 1844 px. De normaliserades till respektive implementationsviewport för sida-vid-sida-jämförelsen.
- Console errors/warnings efter slutlig navigering: 0.

## Full-view comparison evidence

Desktopjämförelsen visar samma grundhierarki som målbilden: ett enda kompakt arbetsfält, stor canvas, fast 360 px-panel, sekundärt lägesval, autosparstatus och en tydlig offertåtgärd. Implementationens ritning använder den verkliga sektionsgeometrin och får därför högre informationsdensitet än målbildens förenklade exempel, men canvasens dominans och panelens proportioner är bevarade.

Mobiljämförelsen gjordes två gånger. Första passet visade att ett överlagrat bottom sheet dolde för mycket av ritningen. Panelen ändrades därför till ett dockat bottom sheet under 768 px. Andra passet visar hela ritningen, statusraden och flikpanelen samtidigt utan intern sidscroll.

## Focused region comparison evidence

- Header: `Tillbaka`, titel, lägesval, autosparstatus, readiness, primär åtgärd och overflow ryms utan att den globala portalnavigationen visas.
- Canvasverktyg: produktval ligger uppe till vänster; undo/redo, zoom och anpassa vy ligger uppe till höger. Vid 768–1279 px flyttas verktygsgruppen undan den öppna drawern.
- Panel: `Ritning`, `Egenskaper` och `Material` använder en gemensam tablist med korrekt `aria-selected`.
- Statusrad: mått, sektionsantal och exportstatus ligger lågt och täcker inte ritningen.
- Kort viewport/200 %-motsvarighet: en effektiv CSS-viewport på 720 × 450 px verifierades. Panelens minimihöjd togs bort så canvasen förblir synlig och panelen fortsätter att internscrolla.

## Comparison history

- Pass 1, desktop: hierarkin stämde; Simple öppnade dock i `Egenskaper` eftersom en sparad kant räknades som en ny markering.
- Fix: startfliken låstes till `Ritning`; verkliga canvasmarkeringar öppnar fortfarande `Egenskaper`.
- Pass 1, mobil: den absoluta panelen täckte större delen av ritningen.
- Fix: dockat bottom sheet under 768 px och obruten `min-h-0`-kedja.
- Pass 1, tablet: högerskjutbar drawer täckte canvasens vyverktyg.
- Fix: verktygsgruppen får responsiv högerindragning medan drawern är öppen.
- Pass 1, kort viewport: panelens minsta höjd pressade bort canvasen.
- Fix: proportionell panelhöjd med intern scroll utan fast minsta höjd.
- Pass 2: desktop- och mobiljämförelser godkända.

## Required fidelity surfaces

- Fonts and typography: godkänd; befintlig typografi och viktstruktur återanvänds.
- Spacing and layout rhythm: godkänd vid 1440, 1024, 768 och 390 px.
- Colors and visual tokens: godkänd i mörkt och ljust tema; canvasen behåller avsiktligt mörk ritbakgrund i båda teman.
- Image quality and asset fidelity: godkänd; Tabler-ikoner används och inga emoji- eller specialteckenikoner har lagts till.
- Copy and content: godkänd i browser och encoding-test.

## Implementation checklist

| Kontroll | Mörkt | Ljust | Godkänd |
| --- | --- | --- | --- |
| 1440 px, Simple och fast panel | Kontrollerad | Kontrollerad | Ja |
| 1440 px, Advanced | Kontrollerad | Komponenttestad | Ja |
| 1024 px, högerskjutbar drawer | Kontrollerad | Kontrollerad | Ja |
| 768 px, drawer och flyttade canvasverktyg | Kontrollerad | Kontrollerad | Ja |
| 390 px, dockat bottom sheet | Kontrollerad | Kontrollerad | Ja |
| Kort viewport / 200 %-motsvarande layouttryck | Kontrollerad | Tokens verifierade | Ja |

### Interaktionsmatris

| Kontroll | Status |
| --- | --- |
| Lägesbyte Simple/Advanced och separata utkast | Godkänd i browser och test |
| Autosave, debounce, dedupe och flush | Godkänd i test och browsercopy |
| Paneltabs och automatisk `Egenskaper` vid val | Godkänd i test |
| Panel Escape och fokusåterställning | Godkänd i browser och test |
| Overflow ARIA, Escape, utanför-klick och fokusåterställning | Godkänd i browser och test |
| Rollstyrd primär åtgärd | Godkänd i komponenttest |
| Advanced-reset via `confirmAction` | Godkänd i komponenttest |
| Positiv SVG/Konva-höjd | Godkänd i layoutkontrakt och browser |
| Webbkonsol | 0 fel, 0 varningar |

final result: passed

---

# Design QA — BaHaMa QR-stöd

Den fullständiga QR-granskningen finns i [docs/design-qa-qr.md](docs/design-qa-qr.md). Desktop- och mobilkoncepten jämfördes sida vid sida med browser-renderad implementation, interaktionerna verifierades och inga blockerande avvikelser återstår.

final result: passed
