# 3D från Enkel skiss

Implementerad på `codex/prototype-3d-workflow`, 2026-09-08, efter godkännandet av
[implementationsspecifikationen](../.scratch/clickitup-3d-visualisering/implementation-spec.md).
Ingen driftsättning ingår. Koden fungerar med uttryckliga modellförenklingar;
detta innebär inte att alla produktionsgrindar för produktmodeller är passerade.

## Användning och integration

Enkel skiss → **Visa 3D** öppnar `/sketch/3d` i samma flik. Det aktuella utkastet
förs över via befintlig autosparning, även när den ursprungliga standardskissen
ännu inte har ändrats. `/sketch/3d-prototype` omdirigerar till produktionsvyn med
bevarad query-kontext. Direktlänk utan enkelt utkast visar återgång till skissen.
Full och sketch-only har åtkomst; övriga roller saknar åtkomst.

Kamera, kvalitetsnivå, miljö och diagnostik är transient state. PNG är
2560 × 1440 på desktop och mobil, med aktuell kamerainramning, separat projekt-/
offertrad och svensk eller engelsk disclosure. Enklare interaktiv kvalitet ändrar
inte produktgeometri eller PNG-dimensioner. `omitted` och terminala fel blockerar
export; `degraded` behåller markeringar och disclosure. Inga priser eller marginaler
ingår och ingen quote-/revision-/Firestore-form ändras.

## Kodgränser

- `src/views/SketchVisualization.tsx` läser utkast och exportpresentation från
  befintlig context. `VisualizationWorkspace.tsx` äger UI och asynkron livscykel.
- `src/features/visualization/buildVisualizationPlan.ts` använder befintlig lösare
  och producerar ett renderingsneutralt, validerat `VisualizationPlanV1`.
- `visualProductRegistry.ts` innehåller visuella sekundärmått och exakt variant-
  matchning; renderern läser inte offertkatalogen.
- `runtime/` äger assetladdning, geometri, scen, kamera, export och resursstädning.
  Renderer/Three.js laddas dynamiskt. Resurser delas inom en öppnad scen och
  frigörs vid stängning, avbrott eller startfel. Sena laddningssvar får inte
  återmontera en scen. Rendering stannar när vyn är stilla eller dold.
- Prototypkoden behålls som historisk referens. Produktionsvyn importerar den
  inte, och prototypens HTML-sidor ingår inte längre i Vite-produktionsbygget.

V1 har tre valfria, renderingsneutrala preciseringar: `trailingPostMm` återger den
fasta delen som Enkel skiss faktiskt ritar **efter** sidans sektioner;
`connectionGapMm` beskriver lösarens avsiktliga 20 mm sidoförskjutning vid hörn;
`VisualizationProblemV1.location` bevarar ett känt ankare för en utelämnad produkt.
För en sida på 6000 mm blir medlemmarna sammanlagt 5900 mm, följda av 80 mm fast
del, med slutpunkt 20 mm från framkanten. Ingenting läggs till två gånger.
En verkligt frånkopplad bakkant förblir `unresolved` och blockerar PNG.

En gammal/partiell skiss som saknar nödvändiga fält blir ett tydligt feltillstånd
vid direktlänk. Återgång till Enkel skiss använder editorns befintliga hydrering/
normalisering; 3D-vyn skriver inte en egen korrigerad skiss.

## ClickitUp-asset och återstående produktarbete

`public/assets/visualization/v1/clickitup-source.glb` är konverterad från den
inspekterade DAE-filen. Källans SHA-256 är
`42b900bfe9ddd7d03511d43aadd0bdd9396342bfb3ca2e327af76769752ed8d8` och originalet
är orört. Meter/Y-up, markankare och referensbounds 1,500 × 1,413 × 0,180 m
(X/Y/Z) kontrolleras. JPEG-texturen är inbäddad. Opaka delar sammanförs per material
inom varje komponent, identiska vertexdata återanvänds och inget extra
komprimerings-/decoderformat krävs.

Konverteringen är reproducerbar och accepterar endast den inspekterade källhashen:

```powershell
python scripts/prepare-clickitup-asset.py "C:/Users/Najk/Documents/ChatGPT/3d model/clickitup.dae"
```

`clickitup-source.json` registrerar käll-/utdatahash, normaliserade bounds och
varje komponents min/max. De tre riktiga span-delarna används i vyn. Endast X
längdanpassas; källans ändmarginaler, djup och höjd bevaras. Rå DAE läses aldrig
i webbläsaren. Runtimevalidering, saknad GLB och felande inbäddad textur har
separat diagnostik/fallback.

| Del | Levererat beteende | Kvarstående produktionsförutsättning |
| --- | --- | --- |
| Glas och skena | Källans semantiska GLB-delar, med bibehållna ändmarginaler vid breddsanpassning. | Fysisk verifiering av spel och infästningar vid andra bredder än källans 1500 mm. |
| Änd-, skarv- och hörndelar | En delad, blå förenklad junction per möte; inga dubblerade kompletta sektioner. Källans vänster/höger-ändar finns dokumenterade i GLB:n men används inte som påstått verifierade skarvar. | Separata verifierade `straight-shared`, `corner-90` och slutkomponenter samt deras ankare behöver ersätta fallbackfabriken. En ändassembly från en ensam sektion bevisar inte hörn-/skarvbyggsättet. |
| Dörr | Blå måttbevarande dörrfallback med beständig varning. | Verifierad dörrassembly med rätt ankare och mått. Dörr finns inte i DAE-källan. |
| Jumbrella | Lokala måttdrivna fabriker för duk, mast, ekrar, stag och nav. Exakta variantnycklar; inga kommersiella data i renderern. | Registrets 6 × 6 m-variant är avsiktligt odefinierad: den aktuella tillverkartabellen anger passagehöjd större än öppen totalhöjd. Den visas förenklat tills måttet kan styrkas. |
| Fiesta | Namngiven blå modell med identitetsvarning; 700 mm placeringsfootprint bevaras och 860 mm synlig bredd särredovisas. | BRIXX behöver bekräfta F1.F-identiteten och skillnaden mellan placeringsyta och största synliga bredd. |

Jumbrellas sekundärmått kommer från
[Bahamas måttabell](https://bahama.de/en/parasols/jumbrella/), kontrollerad
2026-09-07; modellfabrikernas komponentidéer följer den godkända lokala referensen.
Fiestas preliminära mått och verifieringskrav följer det redan godkända
[produktmodellbeslutet](../.scratch/clickitup-3d-visualisering/issues/04-valj-produktmodellstrategi-for-bahama-och-fiesta.md).
Varken en fallback eller godkänd kodverifiering upphäver dessa produktionsgrindar.

## Verifiering

Slutkontroll i aktuell checkout 2026-09-08: `test:confidence` passerade med
229 tester i 21 filer, de kompletterande sketchtesterna med 16 tester i tre filer,
och `typecheck`, produktionsbygge, `git diff --check` samt git-säkerhetskontrollen
passerade. Bygget ger Vites varning om chunkar större än 500 kB; 3D-renderern är
dynamiskt inläst. Ingen driftsättning har gjorts.

Ordinarie funktionsfall omfattar 30 ClickitUp-sektioner, 4 parasoller och 2 Fiesta,
kompletterat med dörrar och varierade bredder. Inga separata prestandamätningar,
benchmarks eller numeriska kapacitetslöften har införts.

Fokuserade tester finns i `tests/visualizationPlan.test.js`,
`tests/visualizationRuntime.test.js` och `tests/visualizationWorkspace.test.jsx` och
ingår i `test:confidence`. De täcker geometri, V1-gräns, ID:n, positiva överlapp,
felankare, delade resurser, återgång under laddning/export, exportpolicy,
lokalisering, fel och retry. Route-/apptester täcker full/sketch-only,
nekade roller, gammal URL och query-kontext. Befintliga sketchtester kontrollerar
autosparning och ingången.

Browserkontroll av produktionskomponenterna körs med riktiga GLB-bytes i Chromium
på 1440 × 900 och 390 × 844. Kamerakontroller, kvalitetsbyte, PNG-dimensioner,
verkligt HTTP 404, trasig JPEG, blockerad frånkopplad bakkant, kontextförlust och
återöppning har kontrollerats. Testfixturen är tillfällig och ligger utanför repot;
den är inte en ny prototyp eller ett produktionsalternativ. Browser-skillen saknas
i sessionens katalog, så den automatiserade kontrollen använder befintlig
Playwright-installation; det inloggade appflödet kontrolleras separat i Edge via
Computer Use. Mobilstorleken är viewportemulering, inte fysisk mobilprestanda.

GLB-formatvalidering med Khronos `gltf-validator` gav noll fel och noll varningar
(endast information om oanvända UV-attribut på otexturerade delar). Under avsiktliga
assetfel loggar browsern förväntad 404 respektive texturavkodningsfel; normalfallet
har inga appvarningar eller konsolfel i den automatiserade kontrollen.
