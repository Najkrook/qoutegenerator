# Bygg lagerkartan och Grenställsdetaljen

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 01, 04

## Question

Implementera det godkända schematiska konceptet som fokuserade React-komponenter för lageröversikt, Grenställsdetalj, 5×2-beläggning, status, tomt läge och `Ej placerade` inom befintliga `/inventory`.

Behåll dagens `Lista`, inspektör och adminåtkomst. Följ URL-first-arkitekturen för valt läge och Grenställ, använd semantiska knappar och tillgängliga namn, och matcha den godkända designen responsivt utan att introducera en separat skrivväg.

## Answer

Den godkända lagerkartan och Grenställsdetaljen är implementerade i befintliga `/inventory` med `stock/main_inventory.bahamaV2` som enda datakälla och den rena Lagerplatsmodulen som härledd 4×5×2-vy.

- `Lagerkarta` är BaHaMa-standard och dagens filtrerbara `Lista` finns kvar. URL-modellen är liten och direktlänkbar: `/inventory`, `?view=list` samt `?view=rack&rack=1..4`. Vanlig webbläsarhistorik återställer föregående läge.
- Fyra fokuserade, responsiva Grenställsytor visas i kartordningen 1 övre vänster, 2 övre höger, 3 nedre höger och 4 nedre vänster. Varje översikt visar exakt `{belagda}/10 platser` och fem Våningar × Främre/Bakre.
- Detaljen visar Våning 5 till 1, med Våning 1 längst ned, separata Djupplatser, status i text och färg samt tubetiketten `Storlek – stativfärg`. Deldata visas när den finns och annars `Uppgifter saknas`.
- Högerspåret visar markerat Grenställ, `Ej placerade`, rå äldre Lagerplats och tydliga platskonflikter. Konfliktartiklar räknas inte som belagda och ingen artikel tappas eller får företräde.
- Placerade och ej placerade artiklar kan väljas med semantiska, namngivna knappar och driver den befintliga artikelinspektören. Befintlig state, ändringskö, spara/logg/QR-väg och full/admin-åtkomst är oförändrade. Ingen flytt-, drag-and-drop-, platsväxlings- eller Ångra-logik infördes.

Verifiering i den aktuella worktreen:

- Fokuserad första körning: 26/26 tester passerade; slutlig omkörning efter `qrId`-urvalsgranskning och Fast Refresh-separation: 27/27.
- Utökad lager-, routing-, UI-text- och encoding-körning: 116/116 tester passerade.
- `npm run typecheck`: passerade.
- `npm run build`: passerade; den befintliga Rollup-varningen om stora chunks kvarstår.
- Browser-QA i den befintliga inloggade Edge-profilen: 1699×901, referensstorleken 1536×1024 och mobil 390×844. Verifierat karta → Grenställ, Lista → bakåt, Grenställ → bakåt, fyra rack, fem Våningar, Främre/Bakre, Ej placerade, tomma platser, rena konsolloggar och inget horisontellt överflöde. Godkända översikts- och detaljbilder jämfördes direkt med de senaste screenshotsen via `view_image`.

Kvarvarande risk: Browser-sessionens verkliga Firestore-data innehöll vid verifieringen en äldre ej placerad artikel och inga entydigt placerade artiklar. Fyllda platser, statusvarianter, deldata och konfliktpresentation verifierades därför renderat i de fokuserade komponenttesterna, inte mot muterad live-data.
