# Godkänn ClickitUp-sektionens visuella byggsätt

Type: prototype
Status: claimed
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
