# Mät det dimensionerande 3D-kundfallet

Type: task
Status: closed
Parent: ../map.md
Blocked by: 03, 04, 06, 07

## Question

**Avförd ur scope 2026-09-07 på användarens begäran. Arbetet nedan är historik och ska inte genomföras som del av denna karta.**

Ta fram det mätunderlag som krävs för att besluta runtime- och assetbudgetar för cirka 30 ClickitUp-sektioner, 4 parasoller och 2 Fiesta-värmare på dator och fysisk mobil.

Arbetet är en avgränsad mätförberedelse, inte produktionsimplementation: lokalisera oförändrad källasset och textur, förbered ett semantiskt optimerat GLB-mätexemplar enligt det redan godkända byggsättet, och kör samma explicita Visualization Plan med referensmodeller och markerade fallbacks. Saknade verifierade dörr-/Fiesta-modeller ska framgå; de får inte ersättas med påstått produktionskorrekta modeller.

Jämför det föreslagna enkla leveransläget med riktade alternativ endast när mätningen visar ett problem. Redovisa assetbytes, laddning/avkodning, renderingskostnad, bildtidsfördelning, resurslivscykel och PNG-kostnad i liten scen, det dimensionerande kundfallet och ett stressfall. Anteckna exakta scenantal, build/assetversion, kameravy, kvalitetsnivå, enhet, webbläsare och nätförutsättningar. Skilj skuggpass och scenhjälpmedel från produktgeometri där mätmetoden kräver det.

Fysisk mobil kräver tillgång till verkliga testapparater eller hjälp från användaren. En smal desktop-viewport eller CPU-throttling får inte rapporteras som iPhone-/Android-mätning. Brist på källasset eller apparat ska dokumenteras konkret, inte fyllas med uppskattade mätvärden.

## Comments

2026-09-07: Användaren beslutade ”vi skippar mätningen helt faktiskt, det verkar fungera bra som det är”. Ticketen stängs därför som avförd, inte som genomförd. Ingen benchmark eller assetkonvertering för mätning har gjorts och inga prestandagränser har verifierats. Den blockerar inte längre **Lås runtime- och assetleveransen**. Återuppta inte detta mätarbete utan en ny uttrycklig begäran.

2026-09-07: Skapad när användaren fastställde kundprofilen 30/4/2. Resultatet avblockerar **Lås runtime- och assetleveransen**. Ingen mätning eller assetkonvertering har ännu genomförts i denna ticket. Gränsvärden och leveranslöften beslutas i den överordnade runtime-ticketen efter mätningen.

### Verifierad tillgång till källmaterial

Läsgranskning 2026-09-07 verifierar att `C:\Users\Najk\Documents\ChatGPT\3d model\clickitup.dae` finns (1 746 429 byte) och att SHA-256 fortfarande matchar ursprungsgranskningen: `42B900BFE9DDD7D03511D43AADD0BDD9396342BFB3CA2E327AF76769752ED8D8`. Texturen `clickitup\Metal_Aluminum_Anodized.jpg` finns (4 356 byte). Ingen konverterad GLB/glTF hittades i den namngivna modellmappen eller BaHaMa-referensprojektet, exklusive beroenden och git-internals.

`C:\Users\Najk\Documents\ChatGPT\Bahama-visualizer\src\components\ParasolScene.tsx` finns som procedurkälla. Inga externa källfiler ändrades. Nästa praktiska steg är alltså att förbereda ett separat mätexemplar, inte att be användaren återskapa eller skicka originalmodellen igen.
