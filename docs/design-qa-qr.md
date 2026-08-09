# Design QA – BaHaMa QR-stöd

## Underlag

- Desktopreferens: `C:\Users\Najk\.codex\generated_images\019fd25d-c5b2-7de1-86ab-e5570a020275\exec-16ac560e-5aba-4012-b8c3-e2d3cd10f845.png`
- Mobilreferens: `C:\Users\Najk\.codex\generated_images\019fd25d-c5b2-7de1-86ab-e5570a020275\exec-30020566-7d0f-41c8-8ab4-8b4e430cf43d.png`
- Desktop jämfördes vid 1536 × 1024.
- Skanner och detaljvy jämfördes vid 390 × 844.

## Jämförelse och åtgärder

Desktopgeneratorn följer konceptets mörka BRIXX-yta med kompakt filterrad, tät lagerlista och en fast konfigurationsyta till höger. Den första jämförelsen visade tre tydliga avvikelser som åtgärdades före slutpasset:

1. Tabellen saknade stativ, textil och belysning/värme. Kolumnerna lades till och lagerplatsen placerades under lager-ID:t.
2. Etikettstandarden gick inte att välja. En standardväljare för 70 × 50 mm, 90 × 50 mm och anpassad storlek lades till.
3. Förhandsvisningen visade ett helt A4-ark och gjorde etiketten svårläst. Den ersattes med en skalenlig, stor etikettförhandsvisning.

Valda rader har nu tydlig blå ton, återställning finns för filter och layout, och exportknapparna följer appens befintliga beige primärstil. Det avviker från konceptets blå–orange gradient men är avsiktligt för att följa produktens etablerade design tokens.

Mobilskannern matchar konceptets prioritering: stor kamerayta, en tydlig kameraåtgärd och manuell reservväg. Detaljvyn behåller samma informationsordning men grupperar parasollet och utrustningen i två staplade sektioner för snabbare avläsning. Ingen horisontell overflow förekommer vid 390 px.

## Funktion och tillgänglighet

- Sökning och modell-, status- och lagerplatsfilter verifierades.
- ”Välj alla filtrerade” valde åtta poster och aktiverade PDF- och ZIP-export.
- Byte till 90 × 50 mm uppdaterade bredden till 90 mm; återställning återgick till 70 × 50 mm.
- Ogiltig manuell QR-inmatning gav ett begripligt fel utan navigation.
- Ett giltigt QR-ID navigerade till rätt `/p/:qrId`-adress.
- Aktiv detalj visade lager-ID, modell, storlek, status, lagerplats, stativ, textil, fot, belysning, värme och kommentar.
- Formkontroller har semantiska etiketter, knappar och länkar är tangentbordsnåbara och synliga fokusmarkeringar verifierades.
- Kamerabehörighet accepterades inte under automatiserad QA. Kameran startas endast efter användarens uttryckliga knapptryckning; den manuella vägen verifierades fullt ut.
- Inga konsolfel eller varningar observerades i de verifierade QR-vyerna.

## Tekniska kontroller

- TypeScript: godkänd.
- Full Vitest-svit: 606 tester godkända, 5 emulatorbundna tester korrekt hoppade över i standardsviten.
- Firestore-emulator: 5 QR-regeltester godkända separat.
- Produktionsbygge: godkänt.
- UTF-8/textkodningskontroll: godkänd i fulla testsuiten.

final result: passed
