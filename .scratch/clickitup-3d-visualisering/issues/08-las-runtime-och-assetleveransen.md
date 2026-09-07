# Lås runtime- och assetleveransen

Type: grilling
Status: claimed
Assignee: Codex
Parent: ../map.md
Blocked by: 03, 04, 06, 10

## Question

Vilka konkreta runtime-, paketerings- och prestandakrav ska implementationen uppfylla för att 3D Visualization ska vara hållbar i QuoteGenerator?

Besluta GLB- och texturformat, materialåteranvändning, geometriinstancing eller kloning, cache och livscykel, lazy loading och chunk-separation, kamera-bounds, rimlig största stödda skiss, desktop- och mobilbudget, fallback vid låg kapacitet samt vilka mätvärden och webbläsartester som krävs före leverans. Kraven ska baseras på de godkända prototypernas uppmätta kostnad, inte godtyckliga generella budgetar.

## Comments

2026-09-07: Claimed by Codex. Inspect measured prototype costs and delivery seams, then agree runtime requirements with the user. No production implementation or performance guarantee is implied by the workflow approval.

### Godkänt: mobilprioritering

2026-09-07: Användaren svarade ”låter bra” på rekommendationen att mobilen ska ha samma funktioner som datorn, inklusive PNG, men får sänka skuggor och upplösning i den interaktiva vyn vid låg kapacitet. Produktmått, placeringar och varningar förblir oförändrade. Detta är ett funktionskrav, inte ett redan verifierat prestandalöfte för alla mobiler. Den godkända PNG-storleken ändras inte av lägre interaktiv upplösning.

Visualization Quality Level skiljs från Simplified Product Model och Visualization Problem i projektets ordlista: lägre presentationskvalitet innebär inte att produkter får utelämnas eller att produktdiagnostik får döljas.

### Angivet dimensionerande kundfall

2026-09-07: Användaren uppskattar största realistiska kundskissen till ”4 parasoller, kanske 30 sektioner clickitup” och godkände därefter förslaget om 2 Fiesta-värmare med ”kör på”. Mätprofilen ska därför omfatta cirka 30 ClickitUp-sektioner, 4 placerade parasoller och 2 Fiesta tillsammans. Detta är ett dimensionerande kundfall, inte en godkänd hård produktgräns eller ett verifierat kapacitetslöfte. Representativa dörrar, hörn och sektionsbredder ska ingå när testskissen konkretiseras; deras exakta fördelning är inte specificerad av användaren.

### Öppna förutsättningar

- Mätbaserade gränser kan låsas först efter [Mät det dimensionerande 3D-kundfallet](10-mat-det-dimensionerande-3d-kundfallet.md), med representativa modeller och enheter.
- Exakta prestandakrav, assetpaketering och leveranskontroller är ännu inte godkända; ticketen förblir öppen.

### Faktaunderlag inför nästa beslutsrunda

Läsgranskning 2026-09-07, inga nya runtime- eller enhetsmätningar:

- [Den sammansatta scenens tidigare mätning](06-godkann-den-sammansatta-3d-scenen.md) visar 193 draw calls och 9 828 renderade trianglar för miljövyn vid 1440 × 900. Det är procedur-/proxygeometri, inklusive scenens renderingskostnader, inte en produktionsbudget. Mobilkontrollen 390 × 844 verifierade layout och interaktion, inte fysisk mobilprestanda.
- Inga GLB-, glTF- eller DAE-filer finns i denna checkout. Slutlig optimerad ClickitUp-GLB är alltså inte uppmätt här. De redan godkända modellvalen kvarstår: semantisk GLB för ClickitUp, måttdriven procedurgeometri för Jumbrella och Simplified Product Model för Fiesta tills identiteten verifierats.
- Nuvarande kod har lazy route i `src/App.tsx` och separat dynamisk rendererimport i `WorkflowPreview.tsx`. `scene.js` delar material inom scenen men bygger ny geometri per del; ingen instancing eller assetcache finns. Rendering fortsätter även i vila.
- Normalt scenavslut städar renderer, kontroller, geometrier och material. Verkliga texturer, cacheägarskap och partiellt startfel behöver en uttrycklig livscykel. Three.js beskriver att material och texturer måste frigöras separat och att delade resurser kräver ägarskap: [How to dispose of Objects](https://threejs.org/manual/en/how-to-dispose-of-objects.html).
- Bildtidsfördelning, kall/varm laddning, upprepad öppning/minnestrend, fysisk mobilmatris samt PNG-tid och minnestopp saknar mätresultat. Befintlig byggutmatnings storlek är inte samma sak som uppmätt nätverksöverföring eller starttid.

Nästa runda ska utgå från användarens verkliga lastprofil. Numeriska gränser får inte presenteras som verifierade förrän representativa scenfall och slutlig asset har mätts. Ingen ny produktionskod införs i denna beslutsrunda.

### Samlat förslag — ännu inte slutligt godkänt

Förslaget nedan ska bekräftas av användaren efter mätunderlaget; det är inte ett redan implementerat eller verifierat beteende.

1. **Paketering:** behåll Three.js i befintlig React-app, utan en parallell runtime. Route, renderer och modellfiler laddas på begäran när 3D öppnas. Modellfiler levereras som versionssatta, statiska resurser tillsammans med appen; inga lokala absoluta sökvägar, externa runtime-CDN:er eller modellbibliotek kopplade till kund-/offertstate.
2. **Assets:** ClickitUp följer det redan godkända semantiska GLB-kontraktet med meter/Y-up, separat glas och fasta kopplingsdelar. Första mätbasen använder inbäddad befintlig JPEG/PNG-textur och optimerad geometri utan obligatorisk ny decoder. Meshopt eller KTX2 tillkommer endast om jämförelsemätning visar att överföring/minne förbättras utan oacceptabel startkostnad eller förlust av godkänd visuell kvalitet. Detta är ett föreslaget enkelt startläge, inte slutsatsen att komprimering saknar nytta. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) kräver särskild decoder-/loaderkonfiguration för dessa komprimerade format; stöd ska kontrolleras mot projektets låsta Three-version.
3. **Återanvändning:** opaka delar slås ihop per material inom varje semantisk komponent. Geometri/material delas mellan placerade delar; transform och produktidentitet är separata. Föreslagen startpunkt är instancing för upprepade opaka ClickitUp-delar, medan glas hålls separat för visuell kontroll. Parasoller delar geometri bara vid samma visuella mått/variant. Ingen kloning av hela kompletta sektioner med dubblerade skarvstolpar. [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) är avsett för delad geometri/material med olika transform; faktisk vinst och bounds måste verifieras i mätfallet.
4. **Cache och livscykel:** scenägda resurser återanvänds under en öppnad 3D-vy. Vid återgång eller startfel städas renderer, lyssnare, kontroller, geometrier, material, texturer och bildresurser exakt en gång per ägd resurs. Sena laddningssvar får inte återmontera en stängd scen. Webbläsarens HTTP-cache kan återanvända versionssatta filbytes; ingen obegränsad global cache av levande GPU-resurser införs som standard. Kall och varm återöppning mäts separat.
5. **Rendering och kamera:** rita om vid scen-/kameraförändring, pågående dämpning och export, men stoppa kontinuerlig rendering när vyn är stilla eller dold. Bounds inkluderar footprint och alla tolkningsbara produkter, även utanför ytan; dekor ska inte dra ut kameran. Återställning och resize använder både horisontellt och vertikalt synfält. Extremt eller ogiltigt underlag ger diagnostik, aldrig tyst klippning eller korrigering av skissen.
6. **Låg kapacitet:** den godkända mobilprioriteringen styr. Sänk interaktiv upplösning och skuggkostnad utan att ändra produktmått, placeringar eller varningar. PNG kvarstår som 2560 × 1440 med disclosure. Om export eller 3D inte kan köras säkert ska ett tydligt fel och återgång/återförsök erbjudas; ingen tyst lågupplöst export eller bild med utelämnade produkter.
7. **Leveranskontroller:** mät 30/4/2-fallet, ett litet referensfall och ett uttryckligt stressfall över kundprofilen. Redovisa kalla/varma laddningar, tid till användbar scen, bildtidsfördelning under orbit, draw calls/trianglar, resursantal över upprepad öppning och PNG-tid/minnesindikatorer. Kontrollera även inloggat routeflöde, assetfel, avbruten laddning, context loss, mobilrotation och genomskinligt glas i flera kameravinklar. Föreslagen enhetsmatris är dator med Chrome/Edge, fysisk iPhone med Safari och fysisk Android med Chrome; modell, OS, webbläsarversion, viewport och nätprofil ska dokumenteras. Emulerad mobilstorlek räknas inte som fysisk mobilprestanda.

Inga godtyckliga FPS-, megabyte- eller maxantal deklareras som uppmätta gränser. Mätresultatet och användarens upplevelse blir underlaget för att låsa acceptansnivåer och det slutliga tekniska paketet i denna ticket. Större skisser än kundprofilen är inte automatiskt förbjudna, men omfattas inte av något prestandalöfte förrän de verifierats.
