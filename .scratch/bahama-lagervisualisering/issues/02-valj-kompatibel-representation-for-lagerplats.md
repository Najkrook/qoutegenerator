# Välj en kompatibel representation för Lagerplats

Type: grilling
Status: resolved
Parent: ../map.md

## Question

Hur ska Främre/Bakre Djupplats representeras och normaliseras så att drag-and-drop får en entydig Lagerplats utan att bryta befintlig `bahamaV2`, QR-projektion, lokal lagring, quote-state-hydrering, historik eller gamla fritextplatser?

Jämför åtminstone en utökad kanonisk `location`-sträng med ett nytt strukturerat placeringsfält, inklusive bakåtkompatibilitet, Firestore-regler, save/log-flöde, schemahydrering, okända värden och möjligheten att hålla QR-detaljens Lagerplats korrekt. Rekommendera den minsta robusta modellen och få användarens godkännande innan ticketen löses.

## Comments

### Val av representationsstrategi

Användaren valde den rekommenderade strategin att behålla `location` som enda persistenta källa för Lagerplats. Ett nytt parallellt strukturerat placeringsfält ska inte införas. Koden får tolka den kanoniska strängen till en typad intern vy, men lagring, lokal state, ändringskö, historik och QR-projektion fortsätter använda samma `location`-fält.

### Godkända följdbeslut

Användaren godkände samtliga rekommenderade följdbeslut:

- Giltiga platser serialiseras exakt som `Grenställ {1–4} våning {1–5} främre plats` eller `Grenställ {1–4} våning {1–5} bakre plats`. Läsning får tolerera versalskillnader och extra blanksteg; explicita platsändringar skriver kanonisk form.
- Tomma, ofullständiga, utanförliggande och i övrigt okända `location`-värden är Ej placerade. Råvärdet bevaras tills användaren uttryckligen väljer en giltig Lagerplats eller Ej placerad.
- Om flera artiklar anger samma giltiga Lagerplats får ingen automatiskt företräde. Lagerplatsen markeras som Platskonflikt och samtliga berörda artiklar behandlas som Ej placerade tills konflikten rättas.
- Fritextinmatningen ersätts av strukturerade val för Grenställ, Våning och Djupplats plus Ej placerad, så nya ogiltiga värden inte kan skapas.
- Översiktens beläggning räknar endast entydigt upptagna Lagerplatser. Platskonflikter räknas inte som en placerad artikel.

## Answer

`BahamaInventoryV2Item.location` förblir den enda persistenta representationen av en BaHaMa-artikels Lagerplats. Inget parallellt strukturerat placeringsfält införs.

En giltig Lagerplats serialiseras kanoniskt som:

- `Grenställ {1–4} våning {1–5} främre plats`
- `Grenställ {1–4} våning {1–5} bakre plats`

En gemensam tolk och serialiserare ska ge UI-koden en typad intern Lagerplats med Grenställ, Våning och Djupplats. Tolkningen får vara tolerant för versalskillnader och extra blanksteg, men får inte förändra lagrad data vid enbart läsning. En uttrycklig flytt eller redigering skriver den kanoniska formen; valet Ej placerad skriver tom `location`.

Tomma, ofullständiga, utanförliggande och andra okända värden behålls oförändrade i state och Firestore men klassificeras som Ej placerade. Därmed försvinner inte äldre fritextplatser, Grenställ 5–6 eller Våning 6–7 under hydrering eller normalisering. Inspektören kan visa råvärdet som reparationshjälp, medan karta och QR-detalj visar Ej placerad.

Om flera artiklar tolkar till samma giltiga Lagerplats får ingen artikel automatiskt företräde. Platsen markeras som Platskonflikt, alla berörda artiklar visas under Ej placerade och platsen räknas inte i Grenställets beläggning förrän konflikten har rättats.

Det befintliga fritextfältet ersätts av strukturerade val för Grenställ, Våning och Främre/Bakre plats samt Ej placerad. QR-projektionen fortsätter använda `location` och kan behålla schema version 1; dess visning använder samma tolkning. Firestore-reglerna behöver därför ingen ny fälttillåtelse. Befintlig lokal state, quote-state-hydrering, historik, diff, loggning och batch-save fortsätter transportera samma strängfält.

Beslutet kräver ingen ADR: modellen är avsiktligt liten, lokalt inkapslad och kan senare migreras till en strukturerad representation utan att Lagerplatsens verksamhetsbetydelse ändras.
