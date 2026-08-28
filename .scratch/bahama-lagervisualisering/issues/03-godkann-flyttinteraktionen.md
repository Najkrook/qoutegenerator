# Godkänn drag-and-drop- och Flytta-interaktionen

Type: prototype
Status: resolved
Parent: ../map.md
Blocked by: 01, 02

## Comments

### Körbar interaktionsprototyp för godkännande

- [Öppna den fristående flyttinteraktionsprototypen](../assets/flyttinteraktion-prototyp-v1.html)
- Prototypen använder endast minnesstate. Den skriver inte till QuoteGenerator, lokal lagring eller Firestore och är inte produktionsimplementation.
- Den accepterade mörka Grenställsdetaljen, fem Våningar, Främre/Bakre plats, valt-artikel-spåret och `Ej placerade` är bevarade. Ovanför lagerytan finns en prototypguide och ett synligt tillståndskort som avsiktliga granskningshjälpmedel.

Föreslagen interaktion i prototypen:

1. Släpp på tom Lagerplats skapar omedelbart en väntande, ångringsbar `location`-ändring och flyttar fokus till artikeln på målplatsen.
2. Släpp på upptagen Lagerplats ändrar ingenting förrän dialogen `Bekräfta platsväxling` godkänns. Båda artiklarnas `location` ändras därefter atomärt som en ångringsbar åtgärd. Om källan är Ej placerad blir den undanträngda artikeln uttryckligen Ej placerad.
3. Under drag kan användaren hålla över en annan Grenställsknapp i 0,6 sekunder. Det byter detaljvy utan att avsluta draget; släppet kan sedan göras på en målplats i det nya Grenstället.
4. Högerspåret `Ej placerade` är en drop target. En uttrycklig flytt dit skriver tom `location`. Äldre råvärden visas oförändrade tills användaren väljer en ny giltig plats eller Ej placerad.
5. En Lagerplats med `Platskonflikt` visas blockerad. Ett flyttförsök dit ger fel, lämnar ändringskön orörd och behåller samtliga artiklar.
6. `Ångra senaste` arbetar per användaråtgärd; en platsväxling återställer därför båda artiklarna tillsammans.
7. `Spara ändringar` använder samma väntande grupp som resten av lagervyn. Simulerat sparfel behåller hela arbetsläget för omförsök eller ångring; lyckad sparning gör arbetsläget till ny baslinje.
8. Släpp utanför en målplats, Escape och `Avbryt` ändrar ingen Lagerplats. Fokus återgår till källartikeln eller samma `Flytta`-knapp som öppnade dialogen.
9. `Flytta` är det fullständiga alternativet för tangentbord och mobil: välj Grenställ, Våning och Främre/Bakre plats eller välj Ej placerad. En upptagen destination går vidare till samma bekräftade platsväxling som dragflödet.

Browser-QA utfördes på 1536×1024 och 390×844. Verifierade flöden: verklig pointer-dragning till tom plats, byte till Grenställ 2 under drag, upptagen målplats och platsväxling, avbrutet släpp, Ej placerade, blockerad Platskonflikt, atomär ångring, sparfel och lyckat omförsök samt Escape/fokusåterställning i `Flytta`. Alla genomgångar behöll `16/16 artiklar`, gav inga relevanta konsolfel och mobilvyn hade inget horisontellt överflöde efter korrigering.

Användaren godkände prototypen uttryckligen den 28 augusti 2026 utan ändringsönskemål.

## Question

Hur ska den accepterade visuella riktningen konkret bete sig när en användare flyttar ett parasoll inom eller mellan Grenställ?

Prototypa vanlig flytt till tom plats, bekräftad platsväxling, drag över en annan Grenställsknapp, ångra, väntande ändring, `Ej placerade`, sparande och det alternativa `Flytta`-flödet för mobil/tangentbord. Verifiera även fokusåterställning, tydliga drop targets, fel- och avbrytlägen samt att inget släpp kan skriva över eller tappa en artikel. Lös inte ticketen utan användarens uttryckliga godkännande.

## Answer

Användaren godkände den 28 augusti 2026 den körbara [flyttinteraktionsprototypen](../assets/flyttinteraktion-prototyp-v1.html) utan ytterligare ändringar. Följande beteende är därmed låst för produktionsimplementationen:

- Ett släpp på en tom Lagerplats blir direkt en väntande och ångringsbar `location`-ändring. Fokus flyttas till artikeln på målplatsen.
- Ett släpp på en upptagen Lagerplats ändrar ingenting innan användaren uttryckligen bekräftar platsväxlingen. Därefter uppdateras båda artiklarna atomärt; om källan var Ej placerad blir den undanträngda artikeln uttryckligen Ej placerad.
- Under drag byter 0,6 sekunders hålltid över en annan Grenställsknapp detaljvy utan att avsluta draget. Användaren kan därefter släppa i det nya Grenstället.
- Ett uttryckligt släpp eller Flytta-val till Ej placerade skriver tom `location`. Äldre och okända råvärden bevaras tills användaren gör ett sådant uttryckligt val eller väljer en giltig Lagerplats.
- En Lagerplats med Platskonflikt är blockerad som mål. Försöket ger ett tydligt fel utan att ändringskön eller någon artikel förändras.
- Ångring sker per användaråtgärd, så en platsväxling återställs atomärt. Flyttar sparas genom befintliga `Spara ändringar`; sparfel behåller hela arbetsläget för omförsök eller ångring.
- Släpp utanför mål, Escape och `Avbryt` ändrar ingen Lagerplats och återställer fokus till källartikeln eller den `Flytta`-knapp som öppnade dialogen.
- `Flytta` är det likvärdiga flödet för mobil, tangentbord och andra icke-dragbaserade inmatningssätt, med strukturerade val för Grenställ, Våning, Främre/Bakre plats och Ej placerad samt samma bekräftade platsväxling.

Prototypen är beslutsunderlag, inte produktionskod. Implementationen ska återanvända den befintliga ändringskön, `Spara ändringar`, loggningen och batch-save-vägen och får aldrig skriva över, gissa bort eller tappa en artikel.
