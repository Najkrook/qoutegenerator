# Lås fel- och fallbacktolkningen

Type: grilling
Status: resolved
Parent: ../map.md
Blocked by: 02, 03, 04

## Question

Hur ska 3D Visualization entydigt tolka och kommunicera varje relevant brist utan att ändra Simple Sketch?

Besluta beteendet för ogiltiga eller autojusterade ClickitUp-kanter, sektioner som saknar färdig asset, överlappande eller utanförliggande parasoller och Fiesta, okända produktnycklar, trasiga texturer och assetladdningsfel. Varje fall ska ange vad som fortfarande renderas, vilken Simplified Product Model eller markering som används, vilken varning användaren ser och när bildexport ska tillåtas eller blockeras.

## Comments

### Verifierade förutsättningar

Faktakontrollen mot aktuell Simple Sketch och dess fokuserade tester visade följande:

- Sektionslösarens nåbara fel är `NO_DOOR_COMBINATION`, `NO_SECTION_SOLUTION` och `WRONG_COUNT`. Ett ogiltigt löp får inga lösta medlemmar, medan övriga giltiga löp och placerade produkter kan finnas kvar.
- `autoAdjusted`, `requestedDoorSize` och `resolvedDoorSize` finns i dagens kontrakt och UI, men ingen returväg i den aktuella lösaren sätter `autoAdjusted` till `true`. Normalisering av mått, dörrstorlek, manuella sektioner och antal är en separat sanitiseringsprocess som inte bevarar ursprungsvärdet som en diagnos.
- Simple Sketch tillåter avsiktligt att ett parasolltak går över ClickitUp och täcker en Fiesta. Parasoll kontrolleras i dag mot andra parasoller, medan Fiesta markeras i canvasen mot footprint och andra Fiesta. Ny placering kräver bara att produktens centrum ligger inom ytan; dimensionsändringar och äldre data kan därför lämna produkter helt eller delvis utanför.
- Den aktuella checkouten har ingen produktionsimplementation för 3D, assetladdning eller 3D-PNG. Runtimeproblemen behöver därför en ny presentationsseam och får inte beskrivas som befintligt beteende.

De fokuserade testerna för sektionslösning, parasollgeometri och canvas-kollision passerade, 26 tester totalt.

### Godkända grundprinciper

Användaren godkände att en `degraded` 3D Visualization är exportbar när samtliga rumsligt betydelsefulla entiteter fortfarande återges med tillförlitliga mått eller markeringar. En `omitted` entitet, en otolkbar Visualization Plan eller ett misslyckat renderings-/bildfångststeg blockerar PNG-export. Problemets `severity`, dess `effect` och exportstatus är separata axlar; ett `error` kan alltså vara exportbart när scenen fortfarande är komplett och ärligt markerad.

3D Visualization ska följa Simple Sketchs avsiktliga överlappssemantik i stället för att införa en strikt fysisk kollisionsmodell. Parasoll–parasoll och Fiesta–Fiesta överlapp diagnostiseras. En Fiesta-footprint utanför ytan diagnostiseras. Ett parasolltak får gå över ClickitUp, utanför ytans gräns eller över en Fiesta utan problem så länge centrum ligger inom ytan. Ett produktcentrum utanför ytan är däremot ett fel. Ingen position flyttas eller klipps.

Endast explicita lösardiagnoser får kallas autojusteringar. 3D-adaptern får inte försöka rekonstruera värden som tidigare har ändrats av Simple Sketchs sanitiseringssteg.

Användaren godkände en beständig problemsammanfattning, fokuserbara entitetsmarkeringar och disclosure i exporterbara bilder. Toast används för nya runtimehändelser och exportförlopp, inte som enda bärare av bestående problem.

### Användarens godkännande

Användaren godkände både grundprinciperna och den fullständiga fallmatrisen nedan.

## Answer

3D Visualization ska använda en enda deterministisk policy för källproblem och runtimeproblem utan att ändra Simple Sketch. Planadaptern producerar lokaliseringsneutrala Visualization Problems i `VisualizationPlanV1`; renderern producerar separata runtimeproblem. UI:t sammanför dem i samma beständiga problemsammanfattning, men runtimeproblem får aldrig skrivas tillbaka till eller mutera Visualization Plan.

### Problem- och exportmodell

Varje problem ska minst ha stabil kod, `severity`, entitetsreferens och `effect` enligt det beslutade plankontraktet. Exportbedömningen härleds separat:

- `degraded` betyder att scenen fortfarande innehåller en tillförlitlig återgivning eller markering av entiteten. PNG är tillåten och måste bära disclosure.
- `omitted` betyder att en rumsligt betydelsefull entitet eller koppling inte kan återges tillförlitligt. PNG är blockerad.
- `warning` och `error` uttrycker användarens behov av uppmärksamhet, inte exportstatus. Exempelvis är ett oflyttat produktcentrum utanför ytan ett `error` med `effect: degraded` och förblir exportbart med tydlig markering.
- Ett fel innan en plan kan tolkas, ett rendererstartfel och ett bildfångstfel är terminala runtime- eller kontraktsfel utanför den läsbara planens `problems`-array och blockerar exporten direkt.

Flera problem får samexistera. Identiska runtimefel grupperas i listpresentationen, men varje berörd entitet ska fortfarande kunna fokuseras via sin egen entitetsreferens. Ingen fallback får flytta, normalisera, klippa eller på annat sätt läka källgeometrin.

### ClickitUp Runs och Junctions

| Kod | Situation | Severity / effect | Vad som renderas och markeras | Svensk UI-text | PNG |
| --- | --- | --- | --- | --- | --- |
| `RUN_NO_DOOR_COMBINATION` | Löpets längd kan inte fyllas med vald dörr och övriga medlemmar. | `error / omitted` | Footprint, övriga löp och produkter renderas. Berörda medlemmar utelämnas; löpets avsedda start–slut-linje visas rödstreckad med felikon och ändpunkter. | `[Löp] kan inte byggas med vald dörrstorlek.` | Blockerad |
| `RUN_NO_SECTION_SOLUTION` | Ingen exakt sektionslösning finns. | `error / omitted` | Samma markering som ovan; inga sektionslängder gissas. | `[Löp] saknar en giltig sektionskombination.` | Blockerad |
| `RUN_WRONG_MEMBER_COUNT` | Löpets längd kan inte fyllas med det manuellt valda antalet medlemmar. | `error / omitted` | Samma markering som ovan. Texten använder *medlemmar* eftersom lösarens antal omfattar både sektioner och dörrar. | `[Löp] kan inte byggas med valt antal medlemmar.` | Blockerad |
| `DOOR_AUTO_ADJUSTED` | Lösaren har uttryckligen ersatt en begärd dörrstorlek med en annan giltig storlek. | `warning / degraded` | Lösarens faktiska medlemmar och dörrmått renderas. Dörren och löpet får amber markering. | `Dörrstorleken på [löp] har autojusterats.` | Tillåten med disclosure |
| `RUN_ENDPOINT_DISCONNECTED` | Ett avsett hörn möter inte sitt angränsande löp, exempelvis vid diagonal footprint och horisontellt bakre löp. | `error / omitted` | Löpets lösta medlemmar renderas, men ingen ClickitUp Junction hittas på. Den `unresolved` terminalen markeras röd; den får aldrig behandlas som en fri ände. | `[Löp] ansluter inte till den intilliggande ClickitUp-sträckningen.` | Blockerad |

Adaptern mappar dagens råa sektionskoder till ovanstående kanoniska problemkoder. Avaktiverade tomma löp är giltig frånvaro och ska inte ge problem. Tidigare, tyst sanitiserade värden är den normaliserade Simple Sketch som planen härleds från; utan en explicit uppströmsdiagnos skapas inget `DOOR_AUTO_ADJUSTED` i efterhand.

### Simplified Product Models och produktidentitet

`VISUAL_MODEL_SIMPLIFIED` används när en känd entitet saknar en färdig eller verifierad visuell representation. ClickitUp-delar, den ännu overifierade dörrassemblyn och Fiesta kan då använda en entitetsspecifik Simplified Product Model. Modellen ska bevara alla tillförlitliga yttre mått, ankare, footprint, centrum och rotation, vara tydligt blå och visuellt enklare än en färdig modell. Den får inte antyda okända material eller detaljer. Problemet är `warning / degraded`; UI:t visar `Färdig modell saknas för [entitet]. En förenklad produktmodell visas.` Fiesta kompletteras med `Produktidentiteten för Fiesta behöver verifieras.` PNG är tillåten med disclosure.

För placerade produkter gäller dessutom:

| Kod | Situation | Severity / effect | Rendering och markering | Svensk UI-text | PNG |
| --- | --- | --- | --- | --- | --- |
| `PRODUCT_KEY_UNKNOWN` | Produkt- eller variantnyckeln är okänd men footprinten är användbar. | `warning / degraded` | En generisk blå Simplified Product Model bevarar footprint, centrum och rotation. Närmaste kända variant väljs aldrig. | `Produktmodellen känns inte igen. En förenklad modell visas med skissens mått.` | Tillåten med disclosure |
| `PRODUCT_DIMENSIONS_INVALID` | Produkten saknar användbara mått. | `error / omitted` | Produkten utelämnas. Ett känt, ändligt centrum markeras rött; annars finns entiteten endast i problemlistan. | `Produkten kan inte visas eftersom användbara mått saknas.` | Blockerad |
| `PRODUCT_INSTANCE_ID_REPAIRED` | Ett käll-ID saknas eller är duplicerat. | `warning / degraded` | Produkten renderas med sitt deterministiska planlokala ID och amber problemikon. | `En produkt saknade unik identitet i skissen.` | Tillåten med disclosure |

En känd Jumbrella-variant använder den redan godkända procedurmodellen och får inget fallbackproblem. Fiesta är en namngiven Simplified Product Model tills dess exakta produktidentitet har verifierats enligt **Välj produktmodellstrategi för BaHaMa och Fiesta**.

### Placering och överlapp

Alla produktpositioner återges oförändrade. Beröring utan positiv överlappningsarea räknas inte som konflikt.

| Kod | Situation | Severity / effect | Rendering och markering | Svensk UI-text | PNG |
| --- | --- | --- | --- | --- | --- |
| `PRODUCT_CENTER_OUTSIDE` | Ett parasoll eller en Fiesta har sitt centrum utanför ytans footprint. | `error / degraded` | Produkten ligger kvar på exakt källposition och får röd footprint, outline och ikon. | `[Produkt] har sitt centrum utanför skissytan.` | Tillåten med disclosure |
| `FIESTA_FOOTPRINT_OUTSIDE` | Fiestas footprint ligger delvis utanför ytan trots att centrum ligger inom. | `warning / degraded` | Fiesta ligger kvar och dess footprint markeras amber. | `Fiesta ligger delvis utanför skissytan.` | Tillåten med disclosure |
| `PRODUCT_OVERLAP` | Två parasoller eller två Fiesta har positivt överlappande footprints. | `warning / degraded` | Båda entiteterna får amber footprint, outline och ikon. Ett problem skapas per berörd instans så båda är fokuserbara; listan får gruppera paret. | `Två parasoller överlappar varandra.` respektive `Två Fiesta överlappar varandra.` | Tillåten med disclosure |

Ett parasolltak får gå över ClickitUp, utanför skissytans gräns eller över en Fiesta utan Visualization Problem så länge parasollets centrum ligger inom ytan. Parasoll–Fiesta är inte ett konfliktpar. Detta bevarar Simple Sketchs avsiktliga användningsfall där värmare står under parasoll och tak kan skjuta över en avgränsning.

### Texturer, assets och runtimefel

| Kod | Situation | Severity / effect | Rendering och markering | Svensk UI-text | PNG |
| --- | --- | --- | --- | --- | --- |
| `TEXTURE_ASSET_FAILED` | En textur saknas, är trasig eller kan inte laddas. | `warning / degraded` | Geometrin behålls med ett fast neutralt material. Berörd entitet markeras amber. | `En textur kunde inte laddas. Ett neutralt material används.` | Tillåten med disclosure |
| `VISUAL_MODEL_ASSET_FAILED` | En färdig modell kan inte laddas eller klarar inte runtimevalideringen. | `warning / degraded` | Entitetens Simplified Product Model används med bibehållen tillförlitlig geometri och amber markering. | `[Entitetens] färdiga modell kunde inte laddas. En förenklad produktmodell visas.` | Tillåten med disclosure |
| `VISUAL_MODEL_FALLBACK_FAILED` | Även den deterministiska fallbacken misslyckas. | `error / omitted` | Entiteten utelämnas och ett känt ankare eller centrum markeras rött. | `[Entitet] kunde inte visas.` | Blockerad |
| `PLAN_SCHEMA_UNSUPPORTED` eller `PLAN_INVALID` | Planversionen är okänd eller planens footprint/obligatoriska data kan inte valideras. | Terminalt kontraktsfel | Ingen potentiellt missvisande scen visas. Canvasen ersätts av ett tydligt feltillstånd. | `3D-visualiseringen kan inte visas från den här skissen.` | Blockerad |
| `RENDERER_INITIALIZATION_FAILED` | 3D-renderern eller dess nödvändiga runtime kan inte starta. | Terminalt runtimefel | Canvasen ersätts av samma tydliga feltillstånd. | `3D-visualiseringen kunde inte startas.` | Blockerad |
| `IMAGE_CAPTURE_FAILED` | Den färdiga scenen kan inte fångas till PNG. | Terminalt exportfel | Den redan visade scenen förblir oförändrad; exportförsöket avslutas. | Toast: `Kunde inte skapa bild.` med möjlighet att försöka igen. | Ingen fil skapas |

Ett assetfel får aldrig orsaka att en närliggande produktvariant väljs eller att en hel färdig modell skalas till okända mått. Om en textur eller modell senare laddas framgångsrikt får motsvarande runtimeproblem försvinna utan att Visualization Plan ändras.

### Presentation och PNG-disclosure

3D-vyn ska ha en beständig problemsammanfattning som följer det etablerade språkbruket `Kräver åtgärd`, `Behöver översyn` och `Redo`. Blockerande problem visas separat från exportbara varningar. Varje rad anger berörd entitet och kan fokusera den i scenen. Röd respektive amber outline, footprint och ikon används tillsammans; färg får aldrig vara enda signal.

Toast via `notificationService` används när ett runtimefel först uppstår, medan en asset laddas om eller när PNG-export pågår eller misslyckas. Toast ersätter aldrig den beständiga problemlistan.

En PNG som innehåller minst ett `degraded` problem ska behålla scenens problemmarkeringar och få den diskreta raden `Visualiseringen innehåller förenklade modeller eller markerade avvikelser.` En problemfri PNG får ingen sådan rad. Blockeringsorsaken ska visas bredvid den inaktiverade exportåtgärden; användaren får ingen `Exportera ändå`-väg för `omitted` eller terminala problem.

Beslutet kräver ingen separat ADR. Policyn är en del av den samlade implementationsspecifikationen för denna Wayfinder-karta, och den detaljerade motiveringen samt de avvisade gissnings- och överskrivningsalternativen finns här.
