# Välj produktmodellstrategi för BaHaMa och Fiesta

Type: prototype
Status: resolved
Parent: ../map.md
Blocked by: 02

## Question

Hur ska placerade BaHaMa-parasoller och Fiesta-värmare i Simple Sketch bli stabila 3D-objekt utan att 3D-modulen duplicerar QuoteGenerators katalog- eller prislogik?

Jämför återanvändning av de procedurgenererade parasollmodellerna från Bahama-visualizer med GLB-assets och Simplified Product Models. Prototypa minst ett måttriktigt Jumbrella-objekt, ett roterat rektangulärt objekt, flera instanser och en Fiesta-värmare. Besluta produktnycklar, dimensionskälla, materialstandard och fallbackbeteende; lös inte ticketen utan användarens visuella godkännande.

## Comments

### Körbar jämförelseprototyp

Prototypen finns på branch `codex/prototype-bahama-fiesta-model-strategy`, commit `0cc1432566537304c0547789da67966a3cf79761`. Den startas från repo-roten med:

```powershell
node src/prototypes/bahama-fiesta-model-strategy-prototype/server.mjs
```

Öppna sedan `http://127.0.0.1:4184/?variant=procedural`. Tre URL-styrda varianter visar samma renderingsneutrala testplan:

- en detaljerad och måttdriven procedurmodell;
- en ärlig GLB-strategi där saknade källassets visas som gula wireframe-proxies;
- avsiktligt blå Simplified Product Models.

Den gemensamma scenen innehåller två 3 × 3 m Jumbrella-instanser, ett 4 × 3 m Jumbrella roterat 90 grader och en Fiesta-värmare. Ljusa marklinjer visar respektive footprint från Visualiseringsplanen. Fiesta visar dessutom en orange 860 mm-ring runt den befintliga 700 mm placeringscirkeln så att skillnaden mellan nuvarande sketchkontrakt och verifierad synlig produktbredd inte döljs.

Browser-QA verifierade standardvyn, URL-styrd variantväxling, ovanifrånvyn, desktop och 390 × 844 px samt frånvaro av konsolvarningar och konsolfel. Procedurvyn mätte 81 draw calls och 2 526 renderade trianglar i desktopscenen; GLB-proxyn 20 draw calls och 554 trianglar; Simplified Product Models 17 draw calls och 610 trianglar. Siffrorna inkluderar prototypens markörer och är jämförelsevärden, inte produktionsbudgetar. Encodingvakten och UI-textsmoketestet passerade, 21 tester totalt.

### Källfynd

- QuoteGenerators `PlacedParasol` bär redan `widthMm`, `depthMm`, `rotationDeg`, `exportLine`, `exportModel` och `exportSize`. Jumbrella-presets härleds genom `getBuilderCatalogLine('BaHaMa')`; renderern behöver därför varken läsa katalogen eller tolka prisrader.
- QuoteGenerators `PlacedFiesta` normaliseras till 700 mm diameter. Offertkatalogen identifierar produkten som `FIESTA Biogasstolpe 12 kW` med storleken `Slim`, medan den nuvarande sketch-exportkonstanten använder storleken `Standard`. Den skillnaden får inte följa med som renderingslogik.
- Den lokala Bahama-visualizern har en användbar procedurgenererad Jumbrella med separata mast-, duk-, eker-, stag- och navdelar, men inga GLB-, glTF- eller andra produktassets utanför beroendekatalogen.
- Bahama anger 3 × 3 m Jumbrella till cirka 3 010 mm öppnad höjd och 2 300 mm passagehöjd samt 4 × 3 m till cirka 3 090 mm öppnad höjd och 2 400 mm passagehöjd. Källa: [Bahama Jumbrella — Dimensions & Technical Data](https://bahama.de/en/parasols/jumbrella/).
- Fiesta F1.F anges av tillverkaren till 2 260 mm totalhöjd och 860 mm största bredd. Källa: [Fiesta Heaters & Screens — Technical F1.F](https://www.fiestascreens.com/technical-f1-f/). Matchningen mellan QuoteGenerators handelsnamn och F1.F måste produktverifieras före produktionsleverans.

### Föreslaget beslut — väntar på visuellt godkännande

Använd följande renderingsneutrala nycklar i `VisualizationPlanV1`:

```text
productType: bahama.jumbrella
variantKey: square-3000x3000 | rectangular-4000x3000 | ...

productType: fiesta.f1-f
variantKey: standard
```

Simple Sketch-adaptern mappar källans exportmetadata till dessa nycklar vid kontraktsgränsen. En Jumbrella-variantnyckel är en lokaliseringsneutral geometrinyckel byggd av form och nominella millimetermått; den är varken katalognyckel, prisnyckel eller asset-ID. `instanceId`, `footprint`, `center` och `rotationDeg` fortsätter komma direkt från Visualiseringsplanen.

Produktlagret får ett litet, separat och versionerat `VisualProductRegistryV1` för endast visuella sekundärmått: öppnad höjd, passagehöjd, antal ekrar, Fiestas totalhöjd och största synliga bredd. Registret seedas från verifierade tillverkardata och får inte innehålla priser, rabatter, offertmängder, tillbehör eller lokaliserade katalogetiketter. Planens footprint är alltid placeringsauktoritativ; registret får aldrig ändra Simple Sketch eller flytta ett objekt.

Den återanvända Jumbrella-procedurgeometrin föreslås som första versionens primärmodell. Den täcker alla rektangulära och kvadratiska sketchstorlekar från en gemensam uppsättning komponenter utan att deformera mast, nav eller beslag. Koden ska vid produktionsimplementation extraheras till rena geometri-/materialfabriker och verifieras mot dimensionsregistret; prototypkoden ska inte flyttas direkt till produktion.

GLB är en framtida per-nyckel-uppgradering, inte en blockerande första strategi. En GLB får registreras endast för exakt `productType` + `variantKey`, med meter, Y-up, markcentrerat ankare, applicerade transformeringar, stabila nodnamn och validerade bounds. Saknad eller felande GLB får aldrig ersättas med en närliggande storlek eller helskalas i X/Z.

Fiesta-prototypens form bygger på tillverkarens publicerade yttermått och produktbild, men någon verifierad produktasset finns inte. Den ska därför behandlas som en namngiven Simplified Product Model tills BRIXX har bekräftat att F1.F är exakt handelsmodell och har godkänt 700/860 mm-avvikelsen. Ett framtida assetbyte använder samma produktnyckel och påverkar inte planen.

Fasta standardmaterial föreslås vara varm off-white, matt duk och antracitgrå metall för Jumbrella samt svart/stainless steel med diskret orange emitter för Fiesta. De är visualiseringsmaterial, inte återgivning av offertval, och UI/export ska inte påstå någon vald färg eller duktyp.

För en känd Jumbrella-nyckel används procedurmodellen. För en saknad eller felande färdig modell används en tydligt blå Simplified Product Model som bevarar footprint, centrum och rotation samt ger ett produktmodellproblem. En okänd variant väljer aldrig närmaste storlek. Objekt med oanvändbara planmått utelämnas i stället för att ges gissade dimensioner; exakt problemkod, användartext och exportpåverkan lämnas till ticket 05.

Ticketen hölls `claimed` tills användaren hade granskat prototypen och uttryckligen godkänt det visuella byggsättet, Fiesta-tolkningen och materialstandarden.

### Användarens visuella godkännande

Användaren godkände det föreslagna upplägget och bekräftade att riktiga BaHaMa-modeller eventuellt kan tas fram senare. Den befintliga Jumbrella-modellen i Bahama-visualizer godkändes som tillräckligt visuellt underlag för första versionen.

## Answer

Första versionen återanvänder Jumbrella-geometrin från `C:\Users\Najk\Documents\ChatGPT\Bahama-visualizer` som procedurgenererad primärmodell. Källprojektet innehåller inga färdiga GLB-, glTF- eller CAD-assets; det som återanvänds är modellfabrikerna för mast, duk, ekrar, stag och nav.

Produktionsimplementationen får inte importera kod eller resurser från den externa lokala sökvägen vid körning. De relevanta geometriidéerna ska i stället flyttas och skrivas om som rena, testbara Three.js-fabriker inne i QuoteGenerator. Fabrikerna ska konsumera `VisualizationPlanV1` och ett separat `VisualProductRegistryV1`, inte QuoteContext, katalogobjekt eller prisdata.

De stabila visuella nycklarna är `bahama.jumbrella` med en lokaliseringsneutral dimensionsvariant som `square-3000x3000` eller `rectangular-4000x3000`, samt `fiesta.f1-f` med `standard` som preliminär variant. Simple Sketch-adaptern mappar dagens exportmetadata till nycklarna och skickar footprint, centrum och rotation i planen. Renderern använder aldrig kommersiella exportnycklar som asset-ID:n.

Planens footprint och rotation är placeringsauktoritativa. Ett versionerat visuellt register bär endast sekundära produktmått som öppnad höjd, passagehöjd, antal ekrar, totalhöjd och största synliga bredd. Jumbrella-registret seedas från Bahamas verifierade tekniska data. Fiesta använder tills vidare 2 260 mm totalhöjd och 860 mm största synliga bredd från F1.F-underlaget, samtidigt som skissens befintliga 700 mm footprint bevaras och avvikelsen diagnostiseras. F1.F-matchningen är en produktionsgrind tills BRIXX har bekräftat den exakta handelsmodellen.

Fasta visualiseringsmaterial är varm off-white matt duk och antracitgrå metall för Jumbrella samt svart och rostfritt med diskret orange emitter för Fiesta. De representerar inte valda offertmaterial eller färger.

Kända Jumbrella-varianter använder procedurmodellen. Fiesta förblir en namngiven Simplified Product Model tills dess exakta modellidentitet eller en verifierad asset har bekräftats. En saknad eller felande färdig modell ersätts av en tydligt blå Simplified Product Model med bibehållen footprint, centrum och rotation samt ett problem. En okänd variant får aldrig använda närmaste storlek eller helskala en annan färdig produktmodell.

Framtida GLB-assets kan registreras som exakta per-nyckel-ersättare utan att Visualiseringsplanen ändras. De måste vara meterbaserade, Y-up, markcentrerade, transformnormaliserade, namnstabila och bounds-verifierade. Produktionsimplementation ingår inte i denna ticket.
