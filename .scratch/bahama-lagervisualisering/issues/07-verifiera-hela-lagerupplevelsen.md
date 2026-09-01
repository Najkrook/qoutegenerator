# Verifiera hela lagerupplevelsen

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 06

## Question

Verifiera den färdiga upplevelsen med fokuserade enhets-/komponenttester, relevanta regressionssviter, typecheck, build och Browser/IAB-QA på desktop och mobil.

Testa minst tomt lager, delvis fyllt lager, full Våning, drag till tom plats, platsväxling, flytt mellan Grenställ, ångra, spara, `Ej placerade`, val av artikel/inspektör, bakåtknapp, tangentbord och fokus. Jämför den senaste renderingen mot de godkända koncepten med `view_image`, dokumentera fidelity-ledgern och lös alla fixbara avvikelser innan ticketen stängs.

## Answer

Biljetten stängdes på användarens uttryckliga begäran med den verifiering som redan dokumenterats i de föregående implementeringsbiljetterna som slutligt acceptansunderlag.

- Den relevanta BaHaMa-/inventory-/routing-/encoding-körningen passerade 64/64 tester.
- De avslutande flytt- och UI-testerna passerade 17/17 och täcker bland annat tom/full Lagerplats, dragstart och släppmål, platsväxling, konfliktskydd, flytt mellan Grenställ, Ej placerade, ångra, tangentbordsdialog och fokus.
- `npm run typecheck` och `npm run build` passerade i den verifierade implementationen. Endast den befintliga Rollup-varningen om stora chunks kvarstod.
- Inloggad Browser/IAB-QA verifierade verklig data, URL-navigering, Flytta mellan Grenställ, pending changes, fokus på målartikeln, Ångra, återställd arbetskopia, desktop 1440×1000, mobil 390×844 och ren konsol. Ingen ändring sparades till Firestore under QA:n.
- Den renderade desktop- och mobilupplevelsen följde det godkända schematiska konceptets rackdetalj, högerspår, 5×2-platser, Ej placerade och Flytta-dialog utan någon noterad blockerande fidelity-avvikelse.

Accepterad kvarvarande risk vid stängning: Browser-verktyget lyckades inte generera ett verkligt HTML5-drop-event med sin automatiserade musgest. Dragkedjan och bekräftad platsväxling verifierades därför i renderade komponenttester, medan den tangentbords-/mobilvänliga Flytta-vägen verifierades i den inloggade webbappen. Ingen ytterligare manuell drag- eller molnsparningskontroll kördes i själva stängningssteget.
