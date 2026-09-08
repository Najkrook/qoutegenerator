# Implementationsspecifikation: 3D från Enkel skiss

Datum: 2026-09-07. Gren: `codex/prototype-3d-workflow`.
Status: slutligt godkänt av användaren 2026-09-07. Ingen produktionsimplementation eller driftsättning är beställd genom detta dokument.

## Beslutsgrund och omfattning

Detta är den sammanhållna specifikationen för tickets 08 och 09. Godkända beslut i [01](issues/01-faststall-clickitup-assetens-webbforutsattningar.md), [02](issues/02-valj-visualiseringsplanens-kontrakt.md), [03](issues/03-godkann-clickitup-sektionens-byggsatt.md), [04](issues/04-valj-produktmodellstrategi-for-bahama-och-fiesta.md), [05](issues/05-las-fel-och-fallbacktolkningen.md), [06](issues/06-godkann-den-sammansatta-3d-scenen.md) och [07](issues/07-godkann-3d-arbetsflodet-och-bildexporten.md) ligger fast. Tekniska preciseringar nedan godkändes tillsammans med det sammanhållna underlaget 2026-09-07; de ingick inte i de tidigare besluten 01–07.

Aktuell Enkel skiss är enda källa till mått och placeringar. Vyn är skrivskyddad, öppnas i samma flik och kan användas före offertöverföring. Den visar ClickitUp, placerade parasoller och Fiesta och exporterar PNG utan priser. Advanced Sketch, 3D-redigering, kommersiell logik, nya materialval, separat 3D-persistens och 3D-filexport ingår inte. Visualiseringen är inte installations- eller konstruktionsunderlag.

Referensfallet är **30 ClickitUp-sektioner, 4 parasoller och 2 Fiesta**. Dörrfall kontrolleras dessutom uttryckligen, så att dörrar inte av misstag räknas som vanliga sektioner. Antalen är ett representativt funktionsfall, ingen hård produktgräns eller verifierad kapacitetsgaranti. Mobilen har samma funktioner, inklusive PNG; interaktiv visuell kvalitet får förenklas.

Separata prestandamätningar är uttryckligen bortvalda. Ingen benchmark, FPS-, minnes-, laddtids- eller exporttidsbudget, stressprofil, fysisk prestandamatris eller särskilt GLB-mätexemplar krävs. Historiska mätkrav i tidigare tickets är ersatta av detta scopebeslut. Inga fler prototyprundor behövs.

## Befintlig prototyp och kvarvarande arbete

Läsgranskning i aktuell checkout, utan nya körtester av appen:

| Område | Befintlig prototyp | Produktionsarbete som återstår |
| --- | --- | --- |
| Integration | `src/App.tsx`, `src/navigation/routes.ts`, `src/navigation/useAppNavigation.ts` och `src/views/Sketch3dPrototype.tsx` ger lazy route `/sketch/3d-prototype`, sketchåtkomst och återgång. | Produktionsroute, skyddat helflöde, aktuellt utkast, direktlänk och återgång verifieras tillsammans. |
| Adapter | `src/prototypes/3d-workflow-prototype/plan.ts` anropar lösaren men har temporär form med `runs`, `products` och lokaliserade problem. | Ren adapter och validering för det godkända `VisualizationPlanV1`; komplett diagnostik och geometriska relationer. Att prototypen skriver `schemaVersion: 1` gör den inte kontraktskompatibel. |
| Modeller | Procedur-/proxygeometri och antagna höjder. | Semantisk ClickitUp-GLB, måttkontroller, visuellt register, rena Jumbrella-fabriker och ärliga fallbacks. |
| Arbetsflöde | `WorkflowPreview.tsx` har Granska, kamera, tekniskt läge, PNG och simulerade scenfel. | Produktionskomponenter, verkliga assetfel, samlad exportpolicy, resursägarskap och tillgänglighet. |
| Runtime | Dynamisk rendererimport, viss städning och delade material. | Händelsestyrd rendering, delad geometri, texturlivscykel, partiella startfel, avbruten laddning och exportåterställning. |
| Verifiering | README redovisar historiska fixture- och testresultat; inloggat helflöde med riktiga assets saknas. | Aktuella tester och vanlig funktionskontroll enligt matrisen nedan. Historiska resultat gäller inte som ny verifiering. |

Prototypen är visuell och funktionell referens. Produktionsvyn ska inte importera från `src/prototypes/`, använda lokala externa sökvägar eller leverera prototypens scenario-väljare och A/B-väljare. Granska är produktionslayout; Presentera är endast ett prototypalternativ, inte ytterligare ett leveranskrav.

## Dataflöde och kontrakt

```text
Befintlig hydrering och Enkel skiss-autosparning
  → normaliserad SketchConfigState + befintlig ren sektionslösare
  → ren Simple Sketch-adapter → validerad VisualizationPlanV1
  → produktregister + assetresolver + scenassembler → renderer
  → samlade plan-/runtimeproblem → UI-status och PNG-policy

Projekt-/offertrad → separat exportpresentation, aldrig in i planen
```

Den fullständiga TypeScript-formen i [ticket 02](issues/02-valj-visualiseringsplanens-kontrakt.md#answer) är normativ och ska införas utan att ersättas med prototypens form. Delade typer exponeras via `src/types/contracts.ts`; implementationen kan ligga i en avgränsad `src/features/visualization/`-modul. Föreslagen ansvarsfördelning:

| Modul | Ansvar |
| --- | --- |
| `buildVisualizationPlan.ts` | Ren adapter kring normaliserad skiss, `computeLayout` och befintliga geometrifunktioner; känner till källformatet. |
| `validateVisualizationPlan.ts` | Version, ändliga värden, mått, identiteter och referenser; ger uttryckliga fel utan mutation. |
| `visualProductRegistry.ts` | Versionerade visuella sekundärmått och exakta geometrinycklar, inga priser eller katalogobjekt. |
| `visualizationProblems.ts` | Stabil kodning, sammanställning och gemensam exportpolicy. Lokaliserad text ligger utanför planen. |
| `runtime/` | Assetladdning, ClickitUp-assembler, produktfabriker, scen, kamera och resursägarskap. |
| `captureVisualization.ts` | PNG från färdig scen med separat exportetikett, markeringar och disclosure. |
| `src/views/SketchVisualization.tsx` | React-vy för laddning, scen, problem, kontroller, återgång och export. |

Filnamnen är implementationsordningens föreslagna placeringar, inte påståenden om befintlig kod. Inget separat framework eller backend införs.

Planen har `schemaVersion: 1`, heltalsmillimeter, högerhänt Y-up och X/Z som markplan. Origo är främre vänster; +X åt höger, +Z bakåt. Endast renderern konverterar till meter. Adaptern översätter 2D-koordinater och rotationsriktning till denna bas; asymmetrisk footprint och roterat rektangulärt parasoll ska bevisa att inget speglas. Footprintens ordning är främre vänster, främre höger, bakre höger, bakre vänster.

Löp bär `id`, `start`, `end`, ordnade `section | door`-medlemmar med `index` och `lengthMm` samt explicita `corner | free | unresolved`-terminaler. Start/slut och medlemsankare ska följa lösarens faktiska längdsemantik inklusive fasta anslutningsmått; dessa får inte läggas till en gång till i renderern. Tester ska koppla samman källans yttermått, medlemsmått och verkliga assetankare. Vid diagonal footprint och horisontell bakkant bevaras båda; saknad anslutning blir `unresolved`, aldrig ett konstruerat hörn.

Placerade produkter bär `instanceId`, `productType`, eventuell `variantKey`, centrum, rotation och självförsörjande rektangulär/cirkulär footprint. Unika käll-ID:n bevaras. Reserv-ID:n ska genereras deterministiskt och kollisionsfritt även gentemot befintliga käll-ID:n och ge `PRODUCT_INSTANCE_ID_REPAIRED`. Problem innehåller kod, severity, entityRef och effect; inga UI-strängar.

Okänd version avvisas. Version 1 får endast bakåtkompatibla valfria tillägg. Icke ändliga koordinater eller rotationer får aldrig nå Three.js: fel på grundplanen ger `PLAN_INVALID`; en isolerat otolkbar produkt utelämnas med entitetsproblem och blockerad PNG. Ingen tyst ersättning med origo eller nollrotation. Saknad eller ogiltig skiss visas som tom-/feltillstånd med återgång, ingen fabricerad exempelscen.

Planen är transient och deterministisk. Varken den, kamera, kvalitetsnivå, miljö, exportetikett eller runtimeproblem sparas i Quote/Revision. Vyn konsumerar befintligt hydrerat utkast och normaliserar eller korrigerar det inte på nytt. Ingen quote-state-migration, Firestore-ändring eller offertsave behövs för detta scope.

## Runtime- och assetleverans

Three.js används i befintlig React/Vite-app. Route och renderer laddas på begäran. Modellfiler hämtas först när 3D behöver dem. Leveransen använder versionssatta statiska resurser tillsammans med appen, exempelvis `public/assets/visualization/v1/`, med ett litet manifest i featuremodulen. Inga runtime-CDN:er eller externa lokala filberoenden.

ClickitUp levereras som GLB med meter, Y-up, applicerade transformeringar, stabila semantiska nodnamn, dokumenterade ankare och validerade bounds. JPEG/PNG-textur bäddas in. Ingen obligatorisk Meshopt-, Draco- eller KTX2-decoder införs. Ursprunglig DAE och textur förblir orörda; konverteringsunderlag, källhash, utdatafil/version och kontrollmått dokumenteras med leveransen. Källsökvägen i ticket 01 är historisk proveniens och måste vara åtkomlig vid framtida assetarbete, inte i kundens webbläsare.

Den semantiska strukturen är `junctions/straight-shared`, `junctions/corner-90`, `junctions/free-terminal`, `section/lower-glass-span`, `section/upper-glass-span`, `section/top-rail-span` och separat `door/verified-door-assembly`. Endast de tre span-delarna längdanpassas längs lokal X. Stolpar, beslag, djup och höjd får inte deformeras. Ett internt medlemsmöte får exakt en junction; ett hörn som två löp refererar till ägs gemensamt och skapas bara en gång. `unresolved` får ingen påhittad koppling.

Opak geometri slås ihop per material inom varje semantisk komponent, medan glas hålls separat. Placeringar delar geometri och material men har egna transformeringar och entitetsreferenser för problemfokus. Ingen djupkloning av komplett sektion med dubbla stolpar. Instancing är tillåten för upprepade opaka delar men inte obligatorisk; korrekt bounds, material och entitetskoppling ska då funktionskontrolleras. Jumbrella delar geometri endast när geometrinyckel och mått stämmer.

Assetmanifestet anger version, URL, förväntade noder, ankare och tillåtna mått för runtimevalidering. Felande struktur, saknade delar eller ogiltiga bounds väljer entitetens fallback och ger diagnostik. Saknad fristående textur ger neutralt material; om ett inbäddat texturfel gör hela GLB:n oläsbar används modellfallback. Ett assetfel får aldrig välja närmaste produktvariant.

Resurser ägs av den öppnade scenen. Scenen återanvänder sina resurser; HTTP-cache kan återanvända versionssatta bytes mellan öppningar. Ingen obegränsad global cache med levande GPU-objekt införs. `dispose` ska vara idempotent och frigöra renderer, kontroller, lyssnare, observers, animationsbegäranden, geometrier, material, texturer, render targets, bildresurser och blob-URL:er exakt en gång per ägd resurs. Detta gäller också partiellt startfel, retry, scenbyte och navigation under laddning/export. Sena asynkrona svar ska avvisas och deras resurser städas; de får inte återmontera en stängd scen.

Rendering sker vid scen-/kameraförändring, resize, dämpning och export. Ingen kontinuerlig renderloop när vyn är stilla eller dold. Kontextförlust visar terminalt renderingsfel och återförsök/återgång; återförsök bygger en ny scen från samma plan. Skissen förblir orörd.

## Produktmodeller och produktionsgrindar

| Produkt | Första leveransens modell | Kvarvarande kontroll och konsekvens |
| --- | --- | --- |
| ClickitUp | Semantisk GLB som primärmodell; blå måttbevarande procedurfallback vid saknad/felande modell. | Verifiera glasspel, skeninfästning, fasta ändmått, skarvar och hörn. Färdig primärmodell får inte deklareras korrekt innan kontrollmåtten stämmer. |
| Dörr | Separat verifierad assembly med kompatibla ankare. | Verifierad dörrkälla och mått återstår. Tills dess synlig blå Simplified Product Model med varning; ingen påstått färdig dörrmodell. |
| Jumbrella | Rena lokala procedurfabriker för mast, duk, ekrar, stag och nav. | Mappa källans exportmetadata i adaptern till `bahama.jumbrella` och exakta form-/dimensionsnycklar; verifiera sekundärmått per stödd variant i registret. Saknat måttunderlag får inte ersättas med prototypantaganden. |
| Fiesta | Namngiven blå Simplified Product Model; preliminärt `fiesta.f1-f` / `standard`. | BRIXX behöver bekräfta handelsmodell och 700/860 mm-avvikelsen före produktionsleverans enligt ticket 04. Planens 700 mm placeringsfootprint bevaras; underlagets 860 mm synliga bredd och 2260 mm höjd särredovisas med identitetsvarning tills verifiering finns. |

Kontrollmåtten, dörrkällan och Fiesta-identiteten är återstående produktionsförutsättningar, inte skäl för ytterligare prototyper eller benchmark. Godkännandet av detta dokument innebär inte att dessa kontroller är utförda. En fallback är exportbar enligt felpolicyn men ersätter inte produktionsgrindarnas krav på verifiering eller ett uttryckligt senare scopebeslut om leverans med kvarstående brister.

Registret innehåller endast visuella sekundärmått och verifieringsstatus/proveniens. Planens footprint, centrum och rotation är alltid placeringsauktoritativa. Exakta framtida GLB-ersättare registreras per produkt-/variantnyckel utan katalog- eller priskoppling. Fallback är blå och enklare; det gäller Fiesta även om framtida färdig modell skulle ha svart/rostfri materialstandard.

## Vy, route, kamera och mobil

Produktionsroute föreslås vara `/sketch/3d`, med route-ID i `src/navigation/routes.ts`, accesskategori `sketch`, lazy sida i `src/App.tsx` och navigation via `useAppNavigation.ts`. Ersätt appens prototypingång. Låt gamla `/sketch/3d-prototype` omdirigera inom samma behörighetsgräns och bevara relevant query-kontext. Ingen `state.step`-styrd rendering införs.

Full och sketch-only får åtkomst; guest, quote-only och retailer får inte åtkomst. Ingången finns endast från Enkel skiss. Befintlig autosparning ska hinna överföra aktuell konfiguration innan navigation, utan offertöverföring eller nytt revisionssave. Återgång bevarar sketch-/return-/CRM-kontext och öppnar ingen ny flik. Direktlänk och omladdning använder befintligt hydrerat enkelt utkast; saknat enkelt utkast ger tydlig återgång till skissen. Befintlig bekräftelse vid byte mellan Enkel och Avancerad skiss samt full-only offertöverföring ska bestå.

Granska har beständig problemsida på desktop och scrollbar bottendel på mobil. Dagsljusmiljö är standard, teknisk miljö ett val; ovanifrånkamera är en separat kamerafunktion. Behåll godkänd stenlagd footprint, diskret omgivning, varm huvudbelysning, kall fyllning, cyan glas och mörka profiler. Miljö är visuell kontext, inte uppgift om kundens verkliga plats.

Kameran börjar högt i trekvartsperspektiv med orbit, begränsad zoom och spärr under markplanet. Bounds omfattar footprint och alla tolkningsbara produkters fulla geometri även utanför ytan; dekor påverkar inte inpassningen. Fit/reset, ovanifrån, fokus och resize tar hänsyn till båda synfälten. Problem utan känt läge förklaras i listan och får ingen missvisande fokusknapp. Kontroller och problem är tangentbordsåtkomliga, touch fungerar och färg kompletteras med ikon och text.

Kvalitetsnivån är transient presentation och skiljs från produktfallback och diagnostik. Börja med normal kvalitet; erbjud enklare interaktiv kvalitet med lägre upplösning och förenklade skuggor utan en mätbaserad adaptionsmotor. Enkel kontaktmarkering kan ersätta dyrare mjuka skuggor. Mobil har samma kamera, problemfokus, miljöval, återgång och PNG. Ingen nivå får utelämna produkter, ändra mått eller dölja problem. Om rendering inte fungerar erbjuds fel/återförsök, inget falskt kapacitetslöfte.

## Felpolicy och PNG

Den fullständiga kod- och textmatrisen i [ticket 05](issues/05-las-fel-och-fallbacktolkningen.md) gäller. Implementera en gemensam policy för både knappstatus och själva exportanropet, baserad på planproblem plus aktuella runtimeproblem.

| Fall | Scen | PNG |
| --- | --- | --- |
| Ingen sektions-/dörrlösning eller fel medlemsantal | Bevara användbar scen, utelämna olösbara medlemmar, rödstreckat avsett löp. | Blockerad: `omitted`. |
| Frånkopplad endpoint | Bevara lösta medlemmar, markera endpoint, bygg ingen junction. | Blockerad även om medlemmarna syns. |
| Autojusterad dörr med explicit lösardiagnos, reparerat ID | Faktiska lösta mått och entitetsmarkering. | Tillåten med disclosure. |
| Okänd/saknad modell eller modellassetfel | Blå måttbevarande Simplified Product Model. | Tillåten med disclosure om fallback lyckas. |
| Texturfel | Samma geometri med neutralt material. | Tillåten med disclosure. |
| Oanvändbara produktmått/positioner eller misslyckad fallback | Utelämna entitet, markera känt centrum om möjligt. | Blockerad. |
| Centrum utanför ytan, Fiesta delvis utanför, överlapp inom samma produkttyp | Oförändrad placering och beständig diagnostik. | Tillåten med disclosure; även `error / degraded` är exportbart. |
| Ogiltig plan/okänd version eller terminalt renderingsfel | Tydligt feltillstånd. | Blockerad. |
| Bildfångst misslyckas | Återställ och behåll interaktiv scen, erbjud nytt försök. | Ingen fil; `IMAGE_CAPTURE_FAILED`. |

Parasolltak får gå utanför ytan, över ClickitUp och över Fiesta om centrum ligger inne. Parasoll–Fiesta är inget konfliktpar. Beröring utan positiv överlappningsarea är inget överlapp. Använd korrekt roterad footprint, inte prototypens förenklade bounding-box-test som slutlig kollisionsregel. Problem ska vara beständiga, entitetskopplade och fokuserbara där position är känd. `notificationService` används för tillfälliga laddnings-/export-/felmeddelanden, aldrig som ersättning för problemlistan.

PNG är exakt **2560 × 1440**, från aktuell kamerariktning och fokus, med kontrollerad 16:9-inramning. Anpassa projektion till exportformatet utan att ändra produktgeometri och återställ viewport, kamera/projektion, pixel ratio och render state även vid fel. Interaktiv kvalitetsnivå får inte sänka PNG-dimensionerna. Export kräver färdig scen, avgjorda assetladdningar, inga `omitted`/terminala problem och endast ett aktivt exportförsök. Vid navigation avbryts leveransen av sen bild.

Projekt-/offertrad tas separat från befintlig sidkontext, med offertnummer eller projektreferens och neutral reservetikett. Inga priser, marginaler, rabatter eller kundkontaktuppgifter hämtas för exporten. Kundexportens svenska/engelska texter följer `src/services/exportLocalization.ts`; UI följer copyguiden. En scen med `degraded` behåller problemmarkeringar och raden ”Visualiseringen innehåller förenklade modeller eller markerade avvikelser.” Problemfri bild saknar raden. Exportblockering visar orsak vid knappen; ingen ”Exportera ändå”. Mobil använder samma filformat och dimensioner; misslyckad fångst ger ett ärligt fel, aldrig tyst nedskalning.

## Konkret implementationsordning efter godkännande

1. **Kontrakt och ren adapter.** Läs aktuell sektionslösare, sketchhydrering och fokuserade tester. Inför V1-typer, validering, deterministisk ID-hantering och normaliserade problem. Klart när mm/axlar, löp, dörrar, footprint och placeringar stämmer utan mutation; renderer behövs inte för dessa tester.
2. **Produktregister och assetleverans.** Dokumentera verifierade sekundärmått, konvertera kopia av ClickitUp-källan, kontrollera ankare/spel och separata junctions, hantera dörrkällan och Fiesta-bekräftelsen. Paketera versionssatta filer och manifest. Klart när verifierade modeller tydligt skiljs från kvarvarande fallbacks och produktionsgrindarna har dokumenterat utfall.
3. **Modellfabriker, assembler och runtime.** Bygg rena lokala fabriker, delade resurser, verklig assetresolver, scenägarskap och händelsestyrd rendering. Klart när samma plan ger korrekt geometri, entitetsfokus och städning även vid verkligt laddningsfel och avbrott.
4. **Produktionsvy och navigation.** Koppla `/sketch/3d` till aktuellt utkast, Granska, skyddad åtkomst, kamera, tekniskt läge och samma funktioner på mobil. Ersätt prototypkopplingar i appflödet; behåll prototypfiler som historisk referens utan produktionsimporter.
5. **PNG och samlad felhantering.** Koppla riktig asset-/planstatus till samma exportpolicy, implementera 2560 × 1440, lokalisering, projektrad, disclosure och återställning vid fel. Klart när även mobilflödet kan skapa/ta emot korrekt bild och blockerade scener aldrig ger fil.
6. **Samlad funktionsverifiering och leveransredovisning.** Kör matrisen nedan och relevanta projektkontroller. Redovisa verkligt utfall, kvarstående produktionsgrindar och begränsningar. Ingen ny prototyprunda eller separat prestandamätning. Driftsättning ingår inte i detta uppdrag eller dokumentgodkännande.

## Acceptans och verifiering för framtida implementation

| Kontroll | Metod och godkänt utfall |
| --- | --- |
| Adapter och kontrakt | Fokuserade enhetstester: determinism, fryst input utan mutation, gamla/partiella hydrerade payloads, okänd version, ogiltiga tal, ID-kollisioner, mm/axlar/rotation, samtliga löptyper och explicita problemkoder. |
| Geometri och assets | Kontrollmått vid smal/bred sektion, dörr, rak skarv, hörn och fri ände; exakt en delad junction och oförändrade fasta delar. Kontrollera glas från flera vinklar, inbäddad textur, manifest och riktig filinläsning. |
| Produktdiagnostik | Rotationsriktning, centrum utanför, Fiesta-footprint, positiv överlappning/ren beröring, tillåtet parasollöverhäng och parasoll–Fiesta. Okänd variant får fallback, aldrig närmaste modell. |
| Referensfall 30/4/2 | Vanlig funktionskontroll med exakt dokumenterade antal, varierade sektionsbredder, hörn/fria ändar och roterat rektangulärt parasoll; komplettera med dörrfall. Alla tolkningsbara entiteter visas, kan ramas in och omfattas av PNG/policyn. Ingen tidtagning eller kapacitetsrapport. |
| Behörighet och navigation | Route-/apptester samt inloggad browserkontroll: full och sketch-only, nekade övriga roller, senaste ändring före navigation, återgång med query/CRM-kontext, omladdning/direktlänk och saknat enkelt utkast. Ingen offert- eller skissmutation. |
| Desktop och mobil | Vanlig responsiv/touchkontroll av alla funktioner, scrollbar problemlista, ikon/text, tangentbordsfokus och enklare kvalitet. Dokumentera faktisk browser/enhet; emulerad viewport beskrivs som layoutkontroll, inte fysisk mobilprestanda. Ingen separat enhetsmatris krävs. |
| Runtimefel och livscykel | Verkligt saknad/trasig asset, texturfel, fallbackfel, avbruten laddning, partiellt startfel, upprepad öppning/stängning, kontextförlust och retry. Inga sena scenmonteringar eller dubbla resursfrigöringar. Ingen minnesbenchmark. |
| PNG | Avkoda utdata och kontrollera 2560 × 1440, aktuell kamera, etikett utan kommersiella data, språk, markering/disclosure, samtliga blockeringsfall, exportfel och återställd interaktiv vy. Kontrollera även funktion vid mobilstorlek och enkel kvalitet. |

Kör smala nya tester först tillsammans med relevanta befintliga `tests/sketchConfig.test.jsx`, `tests/parasolGeometry.test.js`, `tests/routes.test.js` och `tests/appRouting.test.jsx`. För denna framtida ändring av routing/delade kontrakt/export: `npm run typecheck`, `npm run test:confidence`, relevanta exporttester och `npm run build`. Vid svenska UI-ändringar: encoding guard och UI text smoke. Kör git-säkerhetskontrollen före leverans. Firestore-regeltester behövs om implementationen trots detta scope faktiskt ändrar regler eller dokumentformer; någon sådan ändring är inte planerad.

## Godkännandepunkt

Användaren godkände underlaget och implementationsordningen för tickets 08 och 09 med ”go ahead” 2026-09-07. Båda tickets är resolved och Wayfinder-planens destination är nådd. Inga nya produktval eller prototyper krävs inom detta planeringsuppdrag. Produktionskontrollerna ovan återstår att utföra och får inte markeras som klara genom dokumentgodkännandet.

Godkännandet avser denna specifikation, runtime-/assetleveransen och implementationsordningen. Det innebär varken att produktionsarbete redan är utfört eller tillstånd att driftsätta. Produktionsimplementation och driftsättning ligger fortsatt utanför detta avslutade planeringsuppdrag.
