# Godkänn den sammansatta 3D-scenen

Type: prototype
Status: resolved
Parent: ../map.md
Blocked by: 03, 04, 05

## Question

Vilken sammansatt scen ska vara den visuella produktionsspecifikationen för 3D Visualization?

Bygg en billig körbar prototyp från en representativ Simple Sketch med olika ClickitUp-bredder, minst en dörr, hörn och fria ändar, flera parasoller, Fiesta och minst en beslutad fallback. Jämför vid behov ett tekniskt neutralt och ett mer miljösatt uttryck. Bedöm skala, orientering, glasläsbarhet, material, markplan, ljus, skuggor, kamera och problemmarkeringar på desktop och mobil. Lös inte ticketen utan användarens uttryckliga godkännande.

## Comments

### Körbar sammansatt scenprototyp

Prototypen finns på branch `codex/prototype-composite-3d-scene`, commit `dc22b13`, och startas från repo-roten med:

```powershell
node src/prototypes/composite-3d-scene-prototype/server.mjs
```

Öppna sedan `http://127.0.0.1:4186/?variant=environment`. Två URL-styrda varianter visar exakt samma renderingsneutrala testplan:

- `technical`: mörk, tekniskt neutral granskningsscen med metergrid och tydlig ytgräns;
- `environment`: återhållen dagsljusmiljö med stenlagd uteplats, gräs, diskret vegetation och varma riktningsskuggor.

Testplanen innehåller en 8 × 6 m yta, ClickitUp-medlemmar på 1 000, 1 500, 2 000 och 2 500 mm, en 1 000 mm dörr, ett 90-gradershörn, två fria ändar, tre Jumbrella-instanser, en roterad rektangulär Jumbrella samt en Fiesta. Den redan godkända ClickitUp-strategin representeras av en måttriktig semantisk scenproxy; ticketen laddar inte den råa DAE:n och introducerar inget nytt runtimeformat. Jumbrella är procedurgenererad. Dörr och Fiesta är tydligt blå Simplified Product Models med amber ikon och beständiga, fokuserbara problemrader.

Den rekommenderade kandidaten är den miljösatta varianten som standardperspektiv, kompletterad med den tekniskt neutrala stilen som granskningsläge och en separat ovanifrånkamera. Miljön ger starkare skala, glas- och skuggläsning utan fotorealistiskt anspråk. Den tekniska varianten gör footprints, rotationer och ytgräns lättare att kontrollera. Samma fasta produktmaterial, plan, problem och kamerakontrakt används i båda.

Browser-QA verifierade sididentitet, meningsfull DOM, frånvaro av framework-overlay, noll konsolvarningar och konsolfel, URL-stabil variantväxling, perspektiv/ovanifrånkamera, fokusering från Fiesta-problemraden samt desktop 1 440 × 900 px och mobil 390 × 844 px. I desktopperspektiv mätte den tekniska scenen 185 draw calls, 9 184 renderade trianglar och 91 geometrier; miljöscenen 193 draw calls, 9 828 trianglar och 95 geometrier. Värdena omfattar skuggpass, problemikoner och prototypkontext och är scenjämförelser, inte produktionsbudgetar. Encodingvakten och UI-textsmoketestet passerade, 21 tester totalt.

### Föreslaget beslut — väntar på visuellt godkännande

Använd den återhållna dagsljusmiljön som 3D Visualization-standard och behåll en tekniskt neutral vy som granskningsalternativ. Standardkameran är ett högt trekvartsperspektiv med orbit, begränsad zoom och förbjuden vy under markplanet; en explicit ovanifrånkamera används för footprint- och orienteringskontroll. Markplanet ska alltid visa skissytans verkliga 8 × 6 m footprint och får kompletteras med enkel omgivningskontext utanför ytan utan att antyda en verklig kundmiljö.

Ljussättningen ska vara en stabil hemisfärisk grund, en varm huvudriktning och en svag kall fyllning. Mjuka kontaktskuggor krävs för skala. Glaset ska använda fast ljus cyan ton, låg opacitet och separata mörka profiler så att det förblir läsbart mot både neutral bakgrund och dagsljusmiljö. ClickitUp-metall förblir neutral aluminium/antracit; Jumbrella använder varm off-white duk och mörk stomme; Fiesta och andra Simplified Product Models använder den beslutade blå fallbackfärgen.

Beständiga problem visas i en högersida på desktop och en scrollbar bottendel på mobil. Färg kompletteras alltid med ikon, entitetsnamn och text. Ett problemval flyttar kameran till entiteten men ändrar aldrig skissen. `degraded` scen är exportbar med disclosure enligt **Lås fel- och fallbacktolkningen**.

### Användarens visuella godkännande

Användaren granskade den körbara miljösatta prototypen och godkände den sammansatta scenen utan begärda ändringar.

## Answer

3D Visualization ska som standard använda den godkända, återhållna dagsljusmiljön: en stenlagd yta som följer Simple Sketchs exakta footprint, diskret gräs och lågmäld vegetation utanför ytan samt fast, trovärdig belysning. Miljön ska ge skala, glasläsbarhet och kontaktskuggor utan att antyda en verklig kundmiljö eller fotorealistisk materialåtergivning. En tekniskt neutral vy med mörk bakgrund, metergrid och tydlig ytgräns ska finnas som granskningsalternativ.

Standardkameran är ett högt trekvartsperspektiv med orbit, begränsad zoom och spärr mot vy under markplanet. En explicit ovanifrånkamera kompletterar standardvyn för kontroll av footprint, rotationer, sektionsföljd och objektplaceringar. Kamera och scenuttryck är transient UI-state och skrivs inte till Quote eller Quote Revision.

Scenen använder en stabil hemisfärisk grundbelysning, en varm huvudriktning och en svag kall fyllning. Mjuka kontaktskuggor krävs. ClickitUp-glas återges med fast ljus cyan ton, låg opacitet och separata mörka profiler så att glaset förblir läsbart i båda scenuttrycken. ClickitUp-metall är neutral aluminium och antracit, Jumbrella har varm off-white duk och mörk stomme, och Fiesta samt övriga Simplified Product Models använder den beslutade blå fallbackfärgen. Materialen är fasta visualiseringsmaterial och representerar inga offertval.

Den sammansatta scenen ska visa olika ClickitUp-bredder, dörrar, hörn och fria ändar tillsammans med samtliga placerade produkter från Visualiseringsplanen. Känd Jumbrella använder den beslutade måttdrivna procedurgeometrin. Saknad eller ännu overifierad dörr- och Fiesta-modell visas som måttbevarande Simplified Product Model enligt **Lås fel- och fallbacktolkningen**; scenen får aldrig flytta eller korrigera källplaceringar.

Beständiga problem presenteras i en högersida på desktop och en scrollbar bottendel på mobil. Varje problem använder ikon, entitetsnamn och text utöver färg och kan fokusera entiteten genom att flytta kameran, utan att ändra skissen. En komplett `degraded` scen är exportbar med disclosure, medan `omitted` och terminala fel blockerar PNG enligt den redan beslutade felpolicyn.

Prototypmätningen visade att den tekniska testscenen och den miljösatta testscenen låg nära varandra i runtimekostnad: 185 respektive 193 draw calls och 9 184 respektive 9 828 renderade trianglar i 1 440 × 900-perspektivet. Dessa värden är jämförelsetal från procedur- och proxygeometri, inte produktionsbudgetar. Den optimerade GLB-leveransens slutliga budget, instancing och assetkrav beslutas i **Lås runtime- och assetleveransen**.

Den godkända prototypen är bevarad som primärkälla på branch `codex/prototype-composite-3d-scene`, commit `dc22b13`. Produktionsimplementation ingår inte i denna ticket.
