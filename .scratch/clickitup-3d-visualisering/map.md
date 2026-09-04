# 3D-visualisering från Enkel skiss

Label: wayfinder:map

## Destination

En godkänd, implementationklar specifikation för en integrerad och skrivskyddad 3D Visualization i QuoteGenerator som härleder en måttriktig offert- och planeringsvy från den aktuella Simple Sketch, visar ClickitUp, placerade BaHaMa-parasoller och Fiesta-värmare samt kan exportera en högupplöst PNG.

## Notes

- Denna Wayfinder-karta producerar beslut och en implementationklar specifikation; produktionsimplementation ingår inte.
- Konsultera `wayfinder`, `grilling`, `domain-modeling`, `prototype`, `web-3d-asset-pipeline`, `react-best-practices` och `frontend-testing-debugging` i de tickets där de är relevanta.
- Simple Sketch är enda källa till sanningen. Advanced Sketch ingår inte.
- 3D Visualization öppnas från Simple Sketch som en egen URL-baserad vy och kan använda den aktuella autosparade skissen utan föregående offertöverföring.
- Vyn är skrivskyddad. Den får inte ändra, normalisera eller korrigera skissen och sparar inte kamera eller annan separat 3D-state i Quote eller Quote Revision.
- Mått, sektionsbredder, dörrar och objektplaceringar ska vara trogna skissen, men resultatet är inte ett installations- eller konstruktionsunderlag.
- Problem ska visas med en best-effort-tolkning och tydlig diagnostik. En saknad färdig produktmodell ersätts av en Simplified Product Model med varning.
- Första versionen använder fasta trovärdiga standardmaterial och inför inga nya val för ClickitUp-färg, glastyp, parasollduk eller tillbehör.
- 3D-vyn följer dagens sketchbehörighet: fulla användare och `sketch-only` får åtkomst; roller utan sketchbehörighet får det inte.
- Bildexporten är en högupplöst PNG med diskret projektnamn eller offertnummer och utan prisinformation.
- Källasseten är `C:\Users\Najk\Documents\ChatGPT\3d model\clickitup.dae`. Originalet ska förbli orört. Den observerade exporten är cirka 1500 × 180 × 1413 mm, 19 345 trianglar, 51 geometrier och 7 material med extern aluminiumtextur.
- `C:\Users\Najk\Documents\ChatGPT\Bahama-visualizer` är referensimplementation för Three.js-miljö och procedurgenererade parasoller, inte en separat runtime eller kommersiell datakälla.
- QuoteGenerators `calculationEngine` och katalogflöden förblir auktoritativa för kommersiella värden; 3D-modulen får inte införa parallell prislogik.
- Följ URL-first-arkitekturen, befintlig sketchhydrering och `notificationService`. Om någon framtida lösning ändrar persisted quote state ska det behandlas som en migration med fokuserade tester.

## Decisions so far

<!-- Stängda tickets indexeras här med en kort gist och länk till ticketens fullständiga svar. -->

- [Fastställ ClickitUp-assetens webbförutsättningar](issues/01-faststall-clickitup-assetens-webbforutsattningar.md): DAE-källan räcker för första prototypen och ska bli en semantiskt uppdelad Y-up/meter-GLB där fasta ändpartier bevaras och endast tre identifierade span-delar längdanpassas.
- [Välj Visualiseringsplanens kontrakt](issues/02-valj-visualiseringsplanens-kontrakt.md): 3D-modulen får en transient, versionerad och renderingsneutral millimeterplan med explicita löp, produkter och problem i stället för `QuoteState`, lösarinterna eller scengrafdetaljer.
- [Godkänn ClickitUp-sektionens visuella byggsätt](issues/03-godkann-clickitup-sektionens-byggsatt.md): En semantiskt uppdelad GLB med längdanpassade span och delade skarv-, hörn- och ändkomponenter blir primärmodell; en tydligt förenklad procedurmodell blir fallback.
- [Välj produktmodellstrategi för BaHaMa och Fiesta](issues/04-valj-produktmodellstrategi-for-bahama-och-fiesta.md): Jumbrella använder den befintliga måttdrivna procedurgeometrin som primärmodell, Fiesta börjar som verifieringskrävande Simplified Product Model och framtida GLB-assets kan ersätta exakta visuella variantnycklar utan katalog- eller priskoppling.

## Not yet specified

- Exakta visuella och prestandamässiga acceptansnivåer för stora skisser; dessa kan preciseras först när optimerad ClickitUp-geometri och flera produktinstanser har mätts tillsammans.

## Out of scope

- Advanced Sketch och överföring från godtyckliga nod-/kantnät.
- Redigering i 3D eller återföring av ändringar från 3D till 2D.
- Installations-, konstruktions- eller tillverkningsunderlag.
- Fotorealistisk rendering eller löfte om materialexakt kundvisualisering.
- Nya produkt-, färg-, tyg-, glastyp- eller tillbehörsval i 3D.
- Persistens av kamera, miljö eller annan separat 3D-state.
- GLB-, glTF- eller annan 3D-filexport till användaren.
- Åtkomst för retailer eller andra roller utan sketchbehörighet.
- Ändringar av offertpriser, kalkylmotor eller kommersiella katalogregler.
