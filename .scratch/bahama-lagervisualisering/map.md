# Visuell BaHaMa-lagernavigering

Label: wayfinder:map

## Destination

En färdig, administratörsbegränsad och webbläsarverifierad lagerkarta i `/inventory` där användaren kan navigera mellan fyra BaHaMa-grenställ, se verkligt lagersaldo på exakta platser och flytta parasoller med drag-and-drop eller ett tillgängligt Flytta-flöde.

## Notes

- Utförande ingår uttryckligen i denna Wayfinder-karta efter att berörda prototyper och beslut har godkänts.
- Konsultera `wayfinder`, `prototype`, `frontend-app-builder`, `imagegen`, `react-best-practices`, `frontend-testing-debugging` och Browser-färdigheten i de tickets där de är relevanta. Använd `domain-modeling` om lagerterminologin behöver ändras.
- Läs `docs/COPY_EDITING_GUIDE.md` före ändringar av svensk användartext och kör encoding-vakten efteråt.
- Den godkända fysiska modellen är fyra lika stora Grenställ med fem Våningar vardera. Våning 1 är längst ned. Varje Våning har en Främre plats och en Bakre plats, totalt 10 Lagerplatser per Grenställ och 40 i lagret.
- Kartplaceringen följer referensskissen ungefärligt. Numreringen är övre vänster 1, övre höger 2, nedre höger 3 och nedre vänster 4.
- `Lagerkarta` är standardläget för BaHaMa och dagens `Lista` finns kvar. Rackval och återgång ska följa projektets URL-first-arkitektur och stödja webbläsarens bakåtknapp.
- Grenställsvyn ska vara schematisk. Tubtext visar `Storlek – stativfärg`, exempelvis `4x4 – 7016`. Status visas separat med text och färg; lager-ID och övriga egenskaper visas vid val i den befintliga inspektören.
- Översikten visar Grenställets namn, beläggning som `6/10 platser` och en 5×2-indikator. Saknade storleks-/stativuppgifter visas delvis när möjligt, annars som `Uppgifter saknas`.
- Alla placerade artiklar visas oavsett status. Tomma eller icke igenkända platser samlas under `Ej placerade`.
- Drag-and-drop ska fungera inom och mellan Grenställ. Ett släpp på en upptagen Lagerplats erbjuder en bekräftad platsväxling. Flyttar blir väntande ändringar, kan ångras och sparas genom befintliga `Spara ändringar`.
- Mobil, tangentbord och andra icke-dragbaserade flöden använder `Flytta` och väljer Grenställ, Våning och Främre/Bakre plats.
- `stock/main_inventory.bahamaV2` är auktoritativ källa för översikten. Använd stabilt `qrId` som artikelidentitet och återanvänd befintlig inspektör, ändringskö, loggning och batch-save i stället för en parallell skrivväg.
- Nuvarande kod har sex Grenställ med sju Våningar och en fritextbaserad `location`. Övergången till fyra gånger fem gånger två måste bevara gamla eller okända värden som `Ej placerade`; inga poster får tyst raderas.

## Decisions so far

<!-- Stängda tickets indexeras här med en kort gist och länk till ticketens fullständiga svar. -->

- [Godkänn det schematiska lagerkonceptet](issues/01-godkann-det-schematiska-lagerkonceptet.md): Låser Variant B:s operationsgång med Variant A:s högerspår samt samordnade detalj- och tomlägen som visuell produktionsspecifikation.
- [Välj en kompatibel representation för Lagerplats](issues/02-valj-kompatibel-representation-for-lagerplats.md): Behåller `location` som enda källa med ett kanoniskt 4×5×2-format, förlustfri hantering av äldre värden och explicit platskonflikt.
- [Godkänn drag-and-drop- och Flytta-interaktionen](issues/03-godkann-flyttinteraktionen.md): Låser väntande och ångringsbara flyttar, 0,6 sekunders Grenställsbyte under drag, bekräftad atomär platsväxling, Ej placerade och det tillgängliga `Flytta`-flödet.
- [Bygg Lagerplatsmodellen och skyddsräcken](issues/04-bygg-lagerplatsmodellen-och-skyddsracken.md): Inför en testad, ren 4×5×2-domänmodell med kanonisk serialisering, förlustfri Ej placerad-gruppering, explicit platskonflikt och stabil `qrId`-identitet.
- [Bygg lagerkartan och Grenställsdetaljen](issues/05-bygg-lagerkartan-och-grenstallsdetaljen.md): Levererar URL-styrd Lagerkarta, fyra 5×2-Grenställ, schematisk detalj, Ej placerade/konflikter och återanvänd artikelinspektör med desktop- och mobil-QA.
- [Bygg säker och tillgänglig flytt](issues/06-bygg-saker-och-tillganglig-flytt.md): Levererar en atomisk och ångringsbar flyttmotor, dragmål, bekräftad platsväxling, 0,6-sekunders Grenställsbyte samt en gemensam tangentbords- och mobilvänlig Flytta-dialog ovanpå befintlig arbetskopia och save-batch.

## Not yet specified

- Browser-QA kan avslöja specifika fidelity- eller interaktionsproblem som ska bli nya tickets först när de är konkreta.

## Out of scope

- Att öppna lagervyn för andra åtkomstnivåer än dagens fulla administratörsbehörighet.
- Att ändra ClickitUp-lagret eller dess arbetsflöden.
- En generell lagerbyggare för godtyckligt antal Grenställ, Våningar eller Djupplatser.
- Realtidssamarbete eller en ombyggnad av dagens Firestore-konfliktmodell för samtidiga lagerredigeringar.
- Exakt fysisk ritningsmätning utöver den ungefärliga placeringen i referensskissen.
