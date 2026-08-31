# Bygg säker och tillgänglig flytt

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 03, 05

## Question

Implementera den godkända drag-and-drop- och Flytta-interaktionen med tomma mål, bekräftad platsväxling, flytt mellan Grenställ, `Ej placerade`, ångra, mobil/tangentbord och fokusåterställning.

Varje flytt ska uppdatera befintlig lokal lagerarbetskopia, synas i dagens pending-changes-flöde och sparas via befintlig batch, QR-projektion och lagerlogg. Ingen artikel får skrivas över, tappas eller sparas automatiskt utanför det godkända arbetsflödet.

## Answer

Den godkända flyttinteraktionen är implementerad ovanpå den befintliga lokala lagerarbetskopian. Ingen separat Firestore- eller autosparväg har införts.

- En ren, testad flyttmotor planerar tomma flyttar, `Ej placerade` och atomiska platsväxlingar utan att mutera indata. En upptagen målplats kräver `Bekräfta platsväxling`; en konfliktplats blockeras utan förändring. Om källan var ej placerad eller konfliktfylld blir den undanträngda artikeln uttryckligen ej placerad.
- Placerade och ej placerade artiklar är HTML-dragkällor. Tomma och upptagna Lagerplatser samt hela `Ej placerade` är släppmål. Under drag öppnas ett annat Grenställ efter 0,6 sekunders hover och ett avbrutet drag återför fokus till källartikeln.
- Varje artikel har en separat `Flytta`-knapp för tangentbord och mobil. Dialogen väljer Grenställ, Våning och Främre/Bakre eller `Ej placerade`, visar ledig/upptagen/konfliktstatus och återanvänder samma flyttmotor och platsväxlingsbekräftelse som dragflödet.
- En godkänd flytt ändrar bara `inventoryData.bahamaV2`, uppdaterar auditfält, väljer artikeln, navigerar URL-first till målgrenstället och flyttar fokus till artikeln på målet. Dagens pending-changes-panel och `Spara ändringar` aktiveras därmed naturligt.
- `Ångra senaste flytten` återställer samtliga berörda artiklar och deras metadata atomiskt. Flera flyttar kan ångras i omvänd ordning. Historiken nollställs först efter lyckad molnsparning eller när en annan artikeländring gör den gamla flyttåterställningen osäker; ett sparfel behåller arbetskopia och ångrahistorik.
- Befintlig save-batch, QR-projektion och lagerlogg är oförändrade och tar emot den väntande arbetskopian först när användaren väljer `Spara ändringar`.

Verifiering i den aktuella worktreen:

- Ren flyttmotor: 6/6 tester för tom plats, platsväxling, Ej placerade, konflikt, no-op och exakt atomisk ångring.
- Utökad BaHaMa-/inventory-/routing-/encoding-körning: 64/64 tester passerade.
- Slutlig UI-körning efter direkt dragkälla på artikelknappen: 17/17 tester passerade, inklusive dragstart/släppmål, 0,6 sekunders Grenställsbyte, fokus och Flytta-dialog.
- `npm run typecheck`: passerade.
- `npm run build`: passerade; den befintliga Rollup-varningen om stora chunks kvarstår.
- Inloggad Browser/IAB-QA: den verkliga ej placerade artikeln `421` flyttades med `Flytta` från en äldre plats till Grenställ 2, Våning 4, Bakre. URL, pending changes, aktiverad spara-knapp och fokus på målartikeln verifierades. `Ångra` återställde Ej placerade, fokus och avaktiverad spara-knapp; inget sparades till Firestore. Dialog och Escape/fokus verifierades på 390×844, rack/högerspår på 1440×1000 och konsolen var ren.

Kvarvarande verifieringspunkt för ticket 07: Browser-verktygets fysiska musgest genererade inte ett HTML5-drop-event trots direkt `draggable`-källa. Den exakta dragstart-/dragover-/drop-kedjan är grön i renderade komponenttester, men ett manuellt verkligt drag ska fortfarande ingå i den samlade slut-QA:n tillsammans med fylld Lagerplats och bekräftad platsväxling.
