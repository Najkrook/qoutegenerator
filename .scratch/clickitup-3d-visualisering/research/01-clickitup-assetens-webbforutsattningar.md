# ClickitUp-assetens webbförutsättningar

Datum: 2026-09-03

Källasset: `C:\Users\Najk\Documents\ChatGPT\3d model\clickitup.dae`

SHA-256: `42b900bfe9ddd7d03511d43aadd0bdd9396342bfb3ca2e327af76769752ed8d8`

## Slutsats

DAE-filen är en användbar källa för en måttriktig ClickitUp-sektion, men bör inte vara webbens runtime-kontrakt. Den kan delas vid befintliga meshgränser i tre längdberoende span-delar och fasta ändpartier. Rekommenderad leverans är därför en sanerad, semantiskt namngiven GLB i meter och Y-up, där ändpartierna inte sträcks och endast glas/skena i spannet får längdanpassas.

Den viktigaste risken är inte polygonantalet utan strukturen: källan har generiska namn, koordinater inbakade i 51 separata geometrier och 65 renderbara primitivgrupper. En naiv konvertering och kloning per sektion skulle ge onödigt många draw calls och göra breddsanpassningen skör.

## Metod och avgränsning

Filen och dess relativa textur analyserades direkt som COLLADA 1.4.1 XML. Bounds räknades från de positioner som faktiskt refereras av trianglar/linjer och multiplicerades med filens deklarerade `unit meter="0.0254"`. Meshar jämfördes även efter translationsnormalisering för att hitta kandidater till återanvändning. Ingen DAE-, textur- eller GLB-fil ändrades eller skapades.

Analysen verifierar källstruktur och ger en leveransrekommendation. Den verifierar inte hur en viss Blender-version tolkar utseendet; DAE→GLB måste därför rendergranskas i den valda Three.js-runtimen.

## Verifierade fakta i källasseten

### Koordinater, mått och origo

- Exportör: SketchUp `26.1.252`; format: COLLADA `1.4.1`.
- Källenhet: tum, där en koordinatenhet är `0,0254` meter.
- Uppaxel: `Z_UP`; råa axlar är alltså X = sektionens längd, Y = djup och Z = höjd.
- Råa globala bounds efter enhetskonvertering är:

| Axel | Min | Max | Utsträckning |
| --- | ---: | ---: | ---: |
| X | −4,833 mm | 1495,167 mm | 1500,000 mm |
| Y | −3,222 mm | 176,778 mm | 180,000 mm |
| Z | 0,000 mm | 1413,000 mm | 1413,000 mm |

- Modellen står redan på markplanet (`Z min = 0`), men origo ligger inte i den geometriska mittpunkten. Ett rent koordinatskift på `(+4,833, −86,778, 0) mm` skulle ge nominellt X-intervall `0…1500`, djup `−90…90` och golv `0` utan att ändra storlek.
- Rotnoden `SketchUp` har ingen transform. De 51 geometrierna instansieras direkt utan individuella transforms; placeringen är inbakad i vertexkoordinaterna. De enda undernoderna är fyra exporterade SketchUp-kameror.

COLLADA-specifikationen definierar att `unit@meter` anger meter per koordinatenhet och att `up_axis` kan ange bland annat Z-up. Three.js `ColladaLoader` stöder endast en delmängd av COLLADA och roterar en Z-up-scen till Y-up på scennivå utan att skriva om vertexdata. Råa bounds får därför inte återanvändas efter load utan att den resulterande världstransformen appliceras. Se [COLLADA 1.4.1, avsnitt om asset/unit/up_axis](https://www.khronos.org/files/collada_spec_1_4.pdf) och [Three.js ColladaLoader](https://threejs.org/docs/pages/ColladaLoader.html).

### Geometri och sannolik delbarhet

- 51 geometrier, alla med namnet `geometry`.
- 61 triangelprimitivgrupper med totalt **19 345 trianglar**.
- Fyra ytterligare linjegeometrier med totalt 16 linjesegment.
- 47 geometrier har exporterade normaler. De fyra återstående är linjegeometrierna.
- Nio geometrier har UV-koordinater.
- Inga animationer, skins/controllers, ljus eller kollisionsproxyer finns.

Endast tre geometrier löper över praktiskt taget hela sektionsbredden:

| Geometri | Material | Bounds (X × Y × Z) | Tolkning som måste visuellt bekräftas |
| --- | --- | ---: | --- |
| `ID6` | `Translucent_Glass_Gray` | 1484,6 × 6 × 850 mm | övre glasskiva |
| `ID14` | `material` | 1485 × 44 × 3 mm | övre skena/list |
| `ID22` | `Translucent_Glass_Gray` | 1500 × 8 × 1050 mm | undre glasskiva |

Alla övriga meshbounds är högst 50 mm i X och ligger vid vänster eller höger ände. Det gör en uppdelning tekniskt möjlig utan att först skära trianglar: de tre span-mesharna kan isoleras, medan resterande geometrier grupperas till fasta vänster- och högerändpartier. Delarnas betydelse måste dock märkas upp manuellt eftersom filen saknar semantisk namnhierarki.

En translationsnormaliserad jämförelse av använda positioner och material hittade tio kandidatgrupper med sammanlagt 25 geometrier som delar samma lokala form. Exempel är fyrgrupperna `ID321/ID327/ID331/ID335` och tregrupperna `ID109/ID115/ID121` samt `ID265/ID271/ID277`. Detta är stark evidens för återanvändbara beslag, men inte ett bevis på identiska render-meshar eftersom jämförelsen inte normaliserade spegling, winding, normaler eller UV-index. Kandidaterna ska dedupliceras först efter visuell och topologisk kontroll i DCC/importpipeline.

### Material och textur

Filen deklarerar sju material. Triangelfördelningen är:

| Material | Trianglar |
| --- | ---: |
| `Color_002` | 10 918 |
| `material` | 4 421 |
| `Metal_Aluminum_Anodized` | 3 698 |
| `Color_000` | 180 |
| `Translucent_Glass_Gray` | 64 |
| `Color_009` | 64 |

Det sjunde materialet, `edge_color255255255255`, används av de 16 linjesegmenten och inte av trianglar.

- `Translucent_Glass_Gray` är ett COLLADA Lambert-material med både diffus alfa, `transparent`-färg och `transparency=1`. Filen uttrycker alltså transparens, men det exakta visuella resultatet kan inte antas överleva konverteringen oförändrat.
- `Metal_Aluminum_Anodized` är enda texturerade materialet.
- Enda externa beroendet är `clickitup/Metal_Aluminum_Anodized.jpg`, som finns bredvid DAE-filen, är 256 × 256 px, 4 356 byte och har SHA-256 `9DFB6BD57466AF4A27BECC003821AD0D05D34019CCF2BCA5920975502682DBDB`.
- `material` och `Color_000` är båda vita Lambert-material i källan och är möjliga konsolideringskandidater. `Color_002` är ljusgrått och `Color_009` svart. Visuell kontroll krävs innan material slås ihop eftersom meshroller och ytegenskaper inte framgår av namnen.

Blenders glTF-export dokumenterar att bara stödda materialnodmönster mappas till glTF; materialkonverteringen ska alltså behandlas som en ny PBR-tolkning, inte en förlustfri överföring. Se [Blender glTF 2.0-export: materials](https://docs.blender.org/manual/en/4.4/addons/import_export/scene_gltf2.html#materials).

## Rekommenderad webbasset

### 1. Offlinekonvertering och koordinatkontrakt

1. Importera DAE i Blender med dess deklarerade enhet, inte som enhetslösa millimetertal. Blenders COLLADA-import kan antingen skala till aktuell scenenhet eller anta filens enhet; valet måste vara explicit. Se [Blender COLLADA-import: Import Units](https://docs.blender.org/manual/en/4.1/files/import_export/collada.html).
2. Kontrollmät 1500 × 180 × 1413 mm före och efter konvertering.
3. Gör asseten Y-up och meterbaserad vid export. glTF definierar meter och ett högerhänt koordinatsystem med +Y upp. Se [glTF 2.0: Coordinate System and Units](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units).
4. Sätt runtime-origo vid sektionens vänstra nominella ändpunkt på mark och djupets centrum. Det ger ett stabilt ankare mot en Simple Sketch-kant; X pekar längs kanten, Y upp och Z tvärs kanten.
5. Applicera/normalisera exporttransforms och verifiera world-space bounds i den färdiga GLB-filen. Radera de fyra SketchUp-kamerorna och linjegeometrierna om en renderjämförelse visar att de inte bär avsedd produktinformation.

### 2. Semantisk uppdelning för standardbredder

Rekommenderad minsta nodstruktur är:

```text
clickitup-section
├── left-end-fixed
├── right-end-fixed
├── lower-glass-span
├── upper-glass-span
└── top-rail-span
```

Utgå från 1500 mm som referens. För bredd `W` flyttas högerändpartiet med `W − 1500 mm`; bara de tre span-delarna ändras längs lokal X. Deras Y/Z-mått och alla ändbeslag förblir oförändrade. Innan detta blir ett produktionskontrakt måste en renderad prototyp bekräfta var glasets verkliga spelmått och infästningsöverlapp ska ligga. Om de inte kan härledas säkert från modellen behövs standardbreddsmått eller separata godkända SketchUp-exporter.

Att skala hela sektionen är olämpligt eftersom glTF visserligen tillåter icke-uniform nodskalning, men då skulle även stolpar och beslag deformeras. Se [glTF 2.0: Transformations](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#transformations).

### 3. Materialkontrakt

- Skapa avsiktliga glTF-PBR-material för minst glas, anodiserad aluminium, ljus struktur och mörka detaljer.
- Baka in den lilla JPEG-texturen i GLB eller ersätt den med ett verifierat PBR-material; lämna inte ett löst relativt runtime-beroende.
- Behåll glasskivor som separata, ensidiga renderdelar så att transparens kan sorteras och justeras oberoende. Undvik `DoubleSide` om renderjämförelsen inte kräver det; Three.js dokumenterar en extra pass för dubbelsidiga transparenta material. Se [Three.js Material](https://threejs.org/docs/pages/Material.html#forceSinglePass).
- Välj `alphaMode: BLEND` eller `KHR_materials_transmission` först efter visuell QA i den faktiska scenmiljön. glTF beskriver sorteringsbegränsningar för BLEND, och Blender skiljer fysisk transmission från alfatransparens. Se [glTF 2.0: Alpha Coverage](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#alpha-coverage) och [Blender glTF: Transmission](https://docs.blender.org/manual/en/4.4/addons/import_export/scene_gltf2.html#transmission).

### 4. Mesh-, GLB- och instancingstrategi

- Leverera **GLB**, inte DAE. GLB kan samla JSON, binär geometri och bilddata i en fil och minskar risken för saknade sidecars. Se [glTF 2.0: GLB-stored Buffer](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#glb-stored-buffer).
- Slå ihop opaka meshdelar per material **inom respektive semantisk del**. Slå inte ihop vänsterände, högerände och spann till en enda mesh; då förloras breddsanpassningen.
- Bevara glasskivorna separat för transparent sortering. En glTF-primitiv motsvarar data för ett GPU-draw call, så dagens 61 triangelprimitiver per sektion är ett tydligt optimeringsmål. Se [glTF 2.0: Meshes](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes).
- Återanvänd samma GLB-geometrier för alla sektioner. glTF kan referera samma mesh från flera noder, vilket sparar assetdata men inte garanterar en enda draw call. Se [glTF 2.0: Instantiation](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#instantiation).
- Bunta återkommande fasta beslag och span-delar med Three.js `InstancedMesh` när mätning visar att många sektioner dominerar draw calls. Instanser kan bära olika transformmatriser; fasta ändar translateras/roteras och span-delar kan få X-skala per bredd. Three.js beskriver `InstancedMesh` uttryckligen som ett sätt att minska draw calls. Se [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
- Kör prune/dedup och eventuell Meshopt-kompression med glTF Transform efter export, men välj kompression utifrån uppmätt filstorlek och decode-kostnad. Den enda 4 KB-texturen motiverar inte ensam KTX2/BasisU.
- LOD och förenklade beslag behövs inte beslutas innan en scen med verkligt maxantal sektioner har mätts. Förhandsräkning ger cirka 387 000 trianglar för 20 ooptimerade sektioner respektive 967 250 för 50; draw calls är sannolikt det första problemet eftersom varje källsektion har 65 primitiv-/linjegrupper.
- Ingen kollisionsmesh behövs för den beslutade skrivskyddade orbit-vyn, så länge ingen fysik eller meshbaserad picking introduceras.

### 5. Verifieringsgrind före godkännande

Den färdiga GLB-asseten ska inte godkännas förrän följande är dokumenterat:

- validatorn ger inga blockerande glTF-fel;
- world-space bounds är 1,500 × 0,180 × 1,413 meter för referensbredden;
- pivot/origo och riktningar följer det angivna kantkontraktet;
- renderjämförelse bekräftar glas, aluminium, normalsidor och borttagna linjer/kameror;
- minst två andra standardbredder visar oförändrade stolpar/beslag och korrekt span;
- mesh/material/primitivantal samt GLB-storlek är registrerade före och efter optimering;
- en scen med representativt högt sektionsantal mäts i målwebbläsaren innan instancing/LOD anses färdigbeslutat.

## Beslut som denna analys möjliggör

- **Ingen ny full SketchUp-export krävs för den första breddprototypen.** De tre längdberoende meshgränserna är tillräckliga för att testa 1500 mm och minst två alternativa bredder.
- **En separat godkänd export eller produktmått krävs** om prototypen visar att spelmått, glasöverlapp eller ändinfästningar inte kan valideras visuellt/måttmässigt.
- DAE-filen ska behandlas som oföränderlig källasset. Den sanerade GLB-filen och dess semantiska nodkontrakt blir webbens versionshanterade leveransasset.

## Primärkällor

- [Khronos COLLADA 1.4.1 specification](https://www.khronos.org/files/collada_spec_1_4.pdf)
- [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Three.js ColladaLoader documentation](https://threejs.org/docs/pages/ColladaLoader.html)
- [Three.js GLTFLoader documentation](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html)
- [Three.js transparency manual](https://threejs.org/manual/en/transparency.html)
- [Blender COLLADA manual](https://docs.blender.org/manual/en/4.1/files/import_export/collada.html)
- [Blender glTF 2.0 exporter manual](https://docs.blender.org/manual/en/4.4/addons/import_export/scene_gltf2.html)
- [glTF Transform documentation](https://gltf-transform.dev/)

