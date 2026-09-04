# Godkänn ClickitUp-sektionens visuella byggsätt

Type: prototype
Status: resolved
Parent: ../map.md
Blocked by: 01, 02

## Question

Vilket visuellt och tekniskt byggsätt ska användas för måttriktiga ClickitUp-sektioner och dörrar i bredderna som Simple Sketch producerar?

Ta fram en billig körbar prototyp som jämför relevanta alternativ utifrån assetundersökningen: optimerad fast 1500 mm-modell, kontrollerad uppdelning med fasta stolpar och längdberoende glas/skenor, separata storleksassets eller en procedurgenererad fallback. Visa minst två olika sektionsbredder, hörn, fri ände, glas och en dörr. Redovisa visuella avvikelser och runtime-kostnad. Lös inte ticketen utan användarens uttryckliga godkännande av byggsättet.

## Comments

### Körbar jämförelseprototyp

Prototypen finns på branch `codex/prototype-clickitup-section-build`, commit `159b21866ed083fad7ba83389236870a4f06f205`. Den startas från repo-roten med:

```powershell
node src/prototypes/clickitup-section-build-prototype/server.mjs
```

Öppna sedan `http://127.0.0.1:4183/?variant=split`. Prototypen läser original-DAE:n och dess textur från den verifierade lokala källplatsen utan att ändra dem. Fyra URL-styrda varianter jämför fast 1500 mm-källmodell, semantisk uppdelning med fasta ändar och längdspan, simulerade separata breddassets samt en procedurgenererad Simplified Product Model.

Den gemensamma testlayouten visar 1000 och 2000 mm sektioner, en tydligt markerad 1000 mm dörrproxy, ett 90-gradershörn, en fri ände och transparent glas. Desktopmätningen för den råa DAE-baserade semantiska splitten gav 210 draw calls, 60 693 renderade trianglar och 156 geometrier i denna scen. Den procedurgenererade fallbacken gav 70 draw calls, 3 048 trianglar och 33 geometrier. Siffrorna inkluderar prototypens markörer, skuggpass och synligt innehåll och är jämförelsevärden, inte produktionsbudgetar.

Prototypen visar att:

- en oförändrad 1500 mm-modell ger överlapp vid 1000 mm och tomrum vid 2000 mm;
- den semantiska splitten är den enda befintliga källstrategin som når flera bredder utan att deformera stolpar och beslag;
- en rå medlemsvis kloning ger dubbla ändbeslag i skarvar och hörn, så leveransasseten behöver separata semantiska änd-, skarv- och hörndelar med delad stolpinstans;
- spel för glas och skeninfästning inte kan godkännas visuellt från DAE:n utan kontrollmått;
- en verifierad dörrasset saknas och dörren därför bara kan visas som proxy i denna ticket;
- separata breddassets kan ge samma målfidelitet men kräver en ännu icke existerande familj av exporter och multiplicerad QA;
- den procedurgenererade modellen är måttriktig och billig men visuellt för förenklad som primär kundmodell.

Browser-QA verifierade variantväxling, URL-state, desktop och mobil, laddad scen, synliga måttfall och runtime-statistik. Den enda konsolvarningen är den förväntade `ColladaLoader`-varningen om Z-up-källan; prototypen normaliserar geometrin till Y-up efter import. Encodingvakten och UI-textsmoketestet passerade, 21 tester totalt.

### Användarens godkännande

Användaren godkände det rekommenderade byggsättet: semantiskt uppdelad GLB som primär modell, delade stolp- och kopplingsinstanser vid skarvar och hörn, separat verifierad dörrasset, kontrollmått som produktionsgrind samt en tydligt avvikande procedurgenererad Simplified Product Model som fallback.

## Answer

ClickitUp ska primärt byggas som en semantiskt uppdelad, meterbaserad och Y-up-normaliserad GLB härledd från den oförändrade DAE-källan. En komplett 1500 mm-sektion får inte skalas eller klonas som ett odelbart objekt för varje medlem. I stället ska 3D-assemblern skapa varje ClickitUp Run av separata längdspan och delade ClickitUp Junctions.

Den godkända minsta assetstrukturen är:

```text
clickitup
├── junctions
│   ├── straight-shared
│   ├── corner-90
│   └── free-terminal
├── section
│   ├── lower-glass-span
│   ├── upper-glass-span
│   └── top-rail-span
└── door
    └── verified-door-assembly
```

De tre verifierade span-delarna från 1500 mm-källan längdanpassas endast längs sin lokala X-axel. Stolpar, beslag, djup och höjd behåller sina mått. Ett Run skapar exakt en delad junction vid varje intern medlemsgräns; angränsande sektioner får alltså inte bidra med var sitt överlappande ändparti. Run-terminalen väljer hörn- eller fri-ände-komponent från Visualiseringsplanens explicita terminaltyp. En `unresolved` terminal får ingen påhittad koppling och hanteras genom den senare fel- och fallbackpolicyn.

Denna modell stödjer samtliga sektionsbredder som Simple Sketch producerar från en gemensam geometriuppsättning. Den fasta 1500 mm-modellen avvisas som generell strategi eftersom den ger överlapp vid smalare sektioner och tomrum vid bredare. Separata GLB-assets per standardbredd avvisas som standardstrategi eftersom ingen sådan verifierad assetfamilj finns och den skulle multiplicera export-, cache- och QA-arbetet. Separata exporter får endast återkomma som en riktad reservåtgärd om kontrollmått visar att en viss komponent inte kan längdanpassas utan geometriskt fel.

DAE-källan innehåller ingen verifierad dörrassembly. Produktionsleveransen behöver därför en separat, måttriktig dörrasset med samma ankare, axlar, höjd- och materialkontrakt som en vanlig medlem. Tills den finns ska en dörr visas med en tydligt avvikande Simplified Product Model och ett problem; prototypens gula dörr är endast bevis på kontraktet, inte en godkänd produktmodell.

Den procedurgenererade modellen godkänns enbart som fallback. Den ska bära rätt yttre bredd och footprint samt visa stolpar, glasfält och toppskena, men vara synligt enklare än den färdiga GLB-modellen. Den får inte användas som om den vore en material- eller detaljexakt ClickitUp-visualisering.

Prototypen mätte den råa DAE-baserade testscenen till 210 draw calls, 60 693 renderade trianglar och 156 geometrier, jämfört med 70 draw calls, 3 048 trianglar och 33 geometrier för den procedurgenererade fallbacken. Värdena inkluderar prototypens scenhjälpmedel och skuggpass och är inte produktionsbudgetar, men visar att råa DAE-primitiver inte får bli leveransstruktur. Den slutliga GLB:n ska slå ihop opak geometri per material inom varje semantisk del, behålla glas separat och återanvända geometri/material; exakta budgetar och instancingkrav låses i **Lås runtime- och assetleveransen** efter sammansatt scenmätning.

Visuell prototypkontroll räcker inte för att fastställa glasspel, skenornas infästningsöverlapp eller dörrens exakta geometri. Dessa kontrollmått och en verifierad dörrkälla är uttryckliga produktionsgrindar. En ny full SketchUp-export per vanlig sektionsbredd krävs däremot inte så länge kontrollmåtten bekräftar den semantiska splitten.

Prototypen är bevarad som primärkälla på branch `codex/prototype-clickitup-section-build`, commit `159b21866ed083fad7ba83389236870a4f06f205`. Produktionsimplementation ingår inte i denna ticket.
