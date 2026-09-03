# Fastställ ClickitUp-assetens webbförutsättningar

Type: research
Status: resolved
Parent: ../map.md

## Question

Vilka verifierade egenskaper, begränsningar och förberedelser hos `C:\Users\Najk\Documents\ChatGPT\3d model\clickitup.dae` måste styra den framtida webbleveransen?

Undersök källenhet och axlar, verkliga bounds, pivot/origo, mesh- och triangelfördelning, material och transparens, texturberoenden, namnhierarki, möjliga dubbletter, möjlighet att separera fasta stolpar från längdberoende skenor/glas samt lämplig GLB-, material- och instancingstrategi. Använd lokala källfiler och primärkällor för DAE/glTF/Three.js. Resultatet ska skilja verifierade fakta från rekommendationer och sparas som en länkad research-anteckning utan att ändra originalasseten.

## Answer

[Researchanteckningen](../research/01-clickitup-assetens-webbforutsattningar.md) verifierar en 1500 × 180 × 1413 mm SketchUp-export med Z-up, tumenhet, 19 345 trianglar, 51 generiskt namngivna geometrier, 7 material och en extern 256×256-textur.

DAE-filen är en användbar oföränderlig källa men ska inte vara runtime-kontrakt. Tre befintliga mesh löper över spannet och kan isoleras som längdberoende glas/skena; övrig geometri kan grupperas som fasta ändpartier. Första breddprototypen kan därför genomföras utan ny SketchUp-export. Webbasseten bör bli en semantiskt namngiven, meterbaserad Y-up-GLB med inbakad textur, separat glas, materialmerge inom respektive del och mätstyrd Three.js-instancing. Exakta spel- och infästningsmått avgör senare om kompletterande produktmått eller separata exporter behövs.

Researchen producerades på branch `research/clickitup-asset-webbforutsattningar`, commit `98646754a5163d1fcd52e19797983ebd6355f2f7`. Originalasseten ändrades inte.
