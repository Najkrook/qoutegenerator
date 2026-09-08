# Lås runtime- och assetleveransen

Type: grilling
Status: resolved
Assignee: Codex
Parent: ../map.md
Blocked by: 03, 04, 06

## Godkänt underlag

2026-09-07: Runtime- och assetleveransen är sammanställd i [implementationsspecifikationen](../implementation-spec.md), tillsammans med ticket 09. Dokumentet är aktuellt beslutsunderlag och ersätter det preliminära förslaget nedan där det preciserar leveransen. Det omfattar paketering, GLB/texturer, komponent- och resursdelning, scenägd livscykel, lazy loading, kamera, mobilkvalitet och vanlig funktionskontroll.

Inga separata prestandamätningar eller nya prototyprundor återstår. Referensfallet är 30 ClickitUp-sektioner, 4 parasoller och 2 Fiesta, med samma funktioner på mobil och bibehållen PNG-storlek. Kontrollmått och produktidentitet är kvarvarande produktionsgrindar, inte genomförda kontroller. Användaren godkände det sammanhållna underlaget med ”go ahead” som svar på frågan om slutlig specifikation för tickets 08 och 09. Ticketen är därmed resolved; godkännandet innebär ingen driftsättning.

## Question

Vilka konkreta runtime-, paketerings- och prestandakrav ska implementationen uppfylla för att 3D Visualization ska vara hållbar i QuoteGenerator?

Besluta GLB- och texturformat, materialåteranvändning, geometriinstancing eller kloning, cache och livscykel, lazy loading och chunk-separation, kamera-bounds, kundprofil, fallback vid låg kapacitet samt vanlig funktionskontroll före leverans. Enligt användarens scopeändring 2026-09-07 ingår ingen separat prestandamätning, benchmark eller numerisk desktop-/mobilbudget. Tidigare mätkrav i historiska kommentarer är ersatta av detta beslut; inga obekräftade kapacitetslöften ska införas.

## Comments

2026-09-07: Claimed by Codex. Inspect measured prototype costs and delivery seams, then agree runtime requirements with the user. No production implementation or performance guarantee is implied by the workflow approval.

### Godkänt: mobilprioritering

2026-09-07: Användaren svarade ”låter bra” på rekommendationen att mobilen ska ha samma funktioner som datorn, inklusive PNG, men får sänka skuggor och upplösning i den interaktiva vyn vid låg kapacitet. Produktmått, placeringar och varningar förblir oförändrade. Detta är ett funktionskrav, inte ett redan verifierat prestandalöfte för alla mobiler. Den godkända PNG-storleken ändras inte av lägre interaktiv upplösning.

Visualization Quality Level skiljs från Simplified Product Model och Visualization Problem i projektets ordlista: lägre presentationskvalitet innebär inte att produkter får utelämnas eller att produktdiagnostik får döljas.

### Angivet dimensionerande kundfall

2026-09-07: Användaren uppskattar största realistiska kundskissen till ”4 parasoller, kanske 30 sektioner clickitup” och godkände därefter förslaget om 2 Fiesta-värmare med ”kör på”. Mätprofilen ska därför omfatta cirka 30 ClickitUp-sektioner, 4 placerade parasoller och 2 Fiesta tillsammans. Detta är ett dimensionerande kundfall, inte en godkänd hård produktgräns eller ett verifierat kapacitetslöfte. Representativa dörrar, hörn och sektionsbredder ska ingå när testskissen konkretiseras; deras exakta fördelning är inte specificerad av användaren.

### Öppna förutsättningar

- Separat mätning och numeriska prestandagränser är bortvalda; det tidigare mätberoendet är borttaget.
- Det tekniska förslaget kvarstår för slutlig sammanställning. Att användaren avstår mätning ska inte registreras som separat godkännande av varje tidigare föreslagen implementationsteknisk detalj.

### Beslut: ingen separat prestandamätning

2026-09-07: Användaren säger ”vi skippar mätningen helt faktiskt, det verkar fungera bra som det är”. Den upplevda funktionen i den granskade prototypen räcker för att gå vidare i planeringen. [Mät det dimensionerande 3D-kundfallet](10-mat-det-dimensionerande-3d-kundfallet.md) avförs ur scope och är inte en leveransgrind. Ingen FPS-, minnes-, laddtids- eller exporttidsbudget ska krävas eller påstås vara verifierad. Kundprofilen 30 ClickitUp-sektioner, 4 parasoller och 2 Fiesta kvarstår som representativt funktionsfall, inte en garanterad kapacitetsgräns.

Beslutet tar inte bort vanlig funktionskontroll, korrekt geometri, felhantering, behörighet eller de tidigare besluten om produktmodeller och nödvändiga kontrollmått. Det innebär inte att de befintliga proxy-modellerna eller aktuell kod därmed är produktionsfärdiga. Ingen benchmark återinförs indirekt genom enhetsmatris, stressfall eller krav på ett särskilt GLB-mätexemplar.

### Faktaunderlag inför nästa beslutsrunda

Läsgranskning 2026-09-07, inga nya runtime- eller enhetsmätningar:

- [Den sammansatta scenens tidigare mätning](06-godkann-den-sammansatta-3d-scenen.md) visar 193 draw calls och 9 828 renderade trianglar för miljövyn vid 1440 × 900. Det är procedur-/proxygeometri, inklusive scenens renderingskostnader, inte en produktionsbudget. Mobilkontrollen 390 × 844 verifierade layout och interaktion, inte fysisk mobilprestanda.
- Inga GLB-, glTF- eller DAE-filer finns i denna checkout. Slutlig optimerad ClickitUp-GLB är alltså inte uppmätt här. De redan godkända modellvalen kvarstår: semantisk GLB för ClickitUp, måttdriven procedurgeometri för Jumbrella och Simplified Product Model för Fiesta tills identiteten verifierats.
- Nuvarande kod har lazy route i `src/App.tsx` och separat dynamisk rendererimport i `WorkflowPreview.tsx`. `scene.js` delar material inom scenen men bygger ny geometri per del; ingen instancing eller assetcache finns. Rendering fortsätter även i vila.
- Normalt scenavslut städar renderer, kontroller, geometrier och material. Verkliga texturer, cacheägarskap och partiellt startfel behöver en uttrycklig livscykel. Three.js beskriver att material och texturer måste frigöras separat och att delade resurser kräver ägarskap: [How to dispose of Objects](https://threejs.org/manual/en/how-to-dispose-of-objects.html).
- Bildtidsfördelning, kall/varm laddning, upprepad öppning/minnestrend, fysisk mobilmatris samt PNG-tid och minnestopp saknar mätresultat. Befintlig byggutmatnings storlek är inte samma sak som uppmätt nätverksöverföring eller starttid.

Fynden ovan behålls som historiskt faktaunderlag, inte som krav att genomföra de bortvalda mätningarna. Ingen ny produktionskod införs i denna beslutsrunda.

### Samlat förslag — ännu inte slutligt godkänt

Förslaget nedan är uppdaterat efter användarens bortval av mätning. Det är inte ett redan implementerat eller verifierat beteende; slutlig sammanställning kräver inget mätunderlag.

1. **Paketering:** behåll Three.js i befintlig React-app, utan en parallell runtime. Route, renderer och modellfiler laddas på begäran när 3D öppnas. Modellfiler levereras som versionssatta, statiska resurser tillsammans med appen; inga lokala absoluta sökvägar, externa runtime-CDN:er eller modellbibliotek kopplade till kund-/offertstate.
2. **Assets:** ClickitUp följer det redan godkända semantiska GLB-kontraktet med meter/Y-up, separat glas och fasta kopplingsdelar. Föreslaget enkelt startläge använder inbäddad befintlig JPEG/PNG-textur och återanvändbar geometri utan obligatorisk ny decoder. Meshopt/KTX2 och jämförande optimeringsarbete är inget krav i denna leverans. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) beskriver extra decoder-/loaderkonfiguration för komprimerade format; den komplexiteten införs inte utan ett nytt konkret behov.
3. **Återanvändning:** opaka delar slås ihop per material inom varje semantisk komponent. Geometri/material delas mellan placerade delar; transform och produktidentitet är separata. Instancing för upprepade opaka ClickitUp-delar är en möjlig implementation, inte en obligatorisk benchmarkstyrd optimering. Glas hålls separat för visuell kontroll. Parasoller delar geometri bara vid samma visuella mått/variant. Ingen kloning av hela kompletta sektioner med dubblerade skarvstolpar. Om [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) används ska bounds och visuell funktion kontrolleras, utan krav på uppmätt prestandavinst.
4. **Cache och livscykel:** scenägda resurser återanvänds under en öppnad 3D-vy. Vid återgång eller startfel städas renderer, lyssnare, kontroller, geometrier, material, texturer och bildresurser exakt en gång per ägd resurs. Sena laddningssvar får inte återmontera en stängd scen. Webbläsarens HTTP-cache kan återanvända versionssatta filbytes; ingen obegränsad global cache av levande GPU-resurser införs som standard. Återöppning funktionskontrolleras utan tids- eller minnesbenchmark.
5. **Rendering och kamera:** rita om vid scen-/kameraförändring, pågående dämpning och export, men stoppa kontinuerlig rendering när vyn är stilla eller dold. Bounds inkluderar footprint och alla tolkningsbara produkter, även utanför ytan; dekor ska inte dra ut kameran. Återställning och resize använder både horisontellt och vertikalt synfält. Extremt eller ogiltigt underlag ger diagnostik, aldrig tyst klippning eller korrigering av skissen.
6. **Låg kapacitet:** den godkända mobilprioriteringen styr. Sänk interaktiv upplösning och skuggkostnad utan att ändra produktmått, placeringar eller varningar. PNG kvarstår som 2560 × 1440 med disclosure. Om export eller 3D inte kan köras säkert ska ett tydligt fel och återgång/återförsök erbjudas; ingen tyst lågupplöst export eller bild med utelämnade produkter.
7. **Leveranskontroller:** vanlig funktionskontroll av representativ skiss, inloggat routeflöde, kamera, PNG, varningar, återgång, assetfel och avbruten laddning. Kontrollera responsiv layout och glasets läsbarhet i flera kameravinklar. Kundprofilen 30/4/2 är ett relevant funktionsfall, men separat stressfall, benchmarkrapport och fysisk enhetsmatris för prestanda är bortvalda. Redovisa vilka kontroller som faktiskt gjorts; emulerad mobilstorlek får inte påstås bevisa fysisk mobilprestanda.

Inga FPS-, megabyte- eller maxantal deklareras som verifierade gränser. Användaren har valt att gå vidare med prototypens upplevda funktion som underlag, utan separat prestandamätning. Varken kundprofilen eller större skisser får därför ett numeriskt kapacitetslöfte, och ingen hård antalsgräns införs här.
