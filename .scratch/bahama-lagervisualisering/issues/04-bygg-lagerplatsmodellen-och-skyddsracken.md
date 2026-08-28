# Bygg Lagerplatsmodellen och skyddsräcken

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 02

## Question

Implementera den beslutade Lagerplatsrepresentationen, parsern, formatteringen, normaliseringen och rena grupperingarna för fyra Grenställ × fem Våningar × två Djupplatser. Lägg till fokuserade tester för kanoniska, äldre, tomma, dubbla och okända värden samt för fulla och lediga Lagerplatser.

Arbetet ska bevara gamla eller okända platser som `Ej placerade`, hålla `qrId` stabilt och inte skapa en parallell auktoritativ lagersaldo-källa. Svara med vad som implementerades och vilka verifieringar som passerade.

## Answer

En ny ren domänmodul i `src/services/bahamaStorageLocation.ts` implementerar den beslutade 4×5×2-modellen utan att ändra `BahamaInventoryV2Item`, QR-schema, quote-state eller Firestore-regler.

- Parsern accepterar endast fullständiga Lagerplatser inom Grenställ 1–4 och Våning 1–5 med Främre/Bakre plats. Den tolererar skiftläge och extra blanksteg men förändrar inte råvärdet.
- Formatteraren och serialiseraren producerar den kanoniska `location`-strängen och serialiserar ett uttryckligt val av Ej placerad som tom sträng. Runtime-skydd hindrar serialisering utanför den fysiska modellen.
- Normaliseringen är en härledd, kanonisk läsvy. Tomma, äldre/ofullständiga, okända och utanförliggande värden blir `null` i läsvyn men bevaras oförändrade på artikeln och grupperas som Ej placerade.
- Den rena grupperingen skapar fyra Grenställ med tio Lagerplatser vardera, ordnade uppifrån med Våning 1 längst ned, och redovisar upptagna, lediga och konfliktfyllda platser separat.
- Flera artiklar på samma giltiga Lagerplats ger `conflict`: ingen artikel får platsen, samtliga hamnar under Ej placerade och platsen räknas inte som belagd eller ledig.
- `qrId` är artikelidentiteten. Saknade eller dubbla ID:n avvisas före gruppering, konfliktresultat pekar ut alla berörda `qrId`, och testerna verifierar att artikelmängden är stabil utan tapp eller överskrivning.

Verifiering i den aktuella worktreen:

- `tests/bahamaStorageLocation.test.js`: 8/8 passerade.
- Utökad körning av Lagerplats-, inventoryData-, quoteStateSchema-, bahamaQrService- och textEncodingGuard-tester: 53/53 passerade.
- `npm run typecheck`: passerade.
- `git diff --check`: passerade.

Produktions-UI, drag-and-drop och Flytta-flödet ingår inte i denna biljett och har inte implementerats här.
