# Godkänn det schematiska lagerkonceptet

Type: prototype
Status: resolved
Parent: ../map.md

## Question

Vilket fullständigt visuellt koncept ska styra implementationen av BaHaMa-lagerkartan och Grenställsdetaljen?

Prototypen ska visa den befintliga mörka BRIXX-lagersidan med `Lagerkarta` som standard och `Lista` som alternativ, de fyra lika stora Grenställen i godkänd placering, beläggning och 5×2-indikator, ett tomt lagerläge, ett delvis fyllt läge, `Ej placerade`, samt en schematisk detaljvy med fem Våningar och Främre/Bakre plats. Tubtext, statusmarkering, vald artikel och kopplingen till inspektören måste vara tillräckligt tydliga för att fungera som en låst produktionsspecifikation.

Använd `prototype`, `frontend-app-builder` och `imagegen`. Presentera konceptet för användaren och lös inte ticketen utan uttryckligt godkännande.

## Comments

### Översiktsvarianter för granskning

Tre strukturellt olika koncept har genererats mot samma godkända 4×5×2-modell och befintliga mörka BRIXX-palett:

- [Variant A – Planritningsfokus](../assets/overview-variant-a-floorplan.png): den fysiska kartan är huvudytan och ett smalt högerspår visar valt Grenställ samt `Ej placerade`.
- [Variant B – Operationsgång](../assets/overview-variant-b-operations-aisle.png): schematiska Grenställselevationer omger en tydlig central gång och kopplar starkast till den fysiska lagerupplevelsen.
- [Variant C – Kontrollkarta](../assets/overview-variant-c-control-map.png): en tätare teknisk karta kombineras med sammanfattningsspår och en dockad detaljlista.

Ticketen inväntar användarens val eller kombination av varianter. Efter valet ska en ny, fristående Grenställsdetalj och ett tomt lagerläge genereras i samma accepterade designsystem innan ett slutligt godkännande kan registreras.

### Vald riktning och koordinerat konceptset

Användaren valde Variant B:s operationsgång och schematiska Grenställ i kombination med Variant A:s högerspår för markerat Grenställ och `Ej placerade`.

Det koordinerade setet för slutlig granskning är:

- [Kombinerad lageröversikt](../assets/overview-approved-direction-v1.png)
- [Grenställsdetalj](../assets/rack-detail-approved-direction-v1.png)
- [Tomt lagerläge](../assets/overview-empty-approved-direction-v1.png)

Detaljvyn visar exakt fem Våningar, Främre/Bakre Djupplats, sju placerade tuber och tre tomma mål. Tomläget visar samtliga fyra navigerbara Grenställ med 0/10 och utan dekorativa tuber som kan misstolkas som saldo.

Ticketen inväntar uttryckligt slutgodkännande av hela konceptsetet.

## Answer

Användaren godkände den 27 augusti 2026 det fullständiga koordinerade konceptsetet utan ytterligare ändringar. Följande tillgångar är därmed låst visuell produktionsspecifikation:

- [Kombinerad lageröversikt](../assets/overview-approved-direction-v1.png): Variant B:s operationsgång och schematiska Grenställ kombineras med Variant A:s högerspår för valt Grenställ och `Ej placerade`.
- [Grenställsdetalj](../assets/rack-detail-approved-direction-v1.png): fem Våningar, Främre/Bakre plats, tubetiketten `Storlek – stativfärg`, separat status och befintlig artikelinspektör.
- [Tomt lagerläge](../assets/overview-empty-approved-direction-v1.png): fyra fortsatt navigerbara Grenställ med 0/10 platser och utan visuella fantomartiklar.

Implementationen ska följa detta designsystem responsivt. Exakta beläggningstal och platsindikatorer ska härledas från lagermodellen, inte hårdkodas från bildprototypens exempeldata.
