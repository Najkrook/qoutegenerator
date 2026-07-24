# CRM-backfill från befintliga offerter

Skriptet `scripts/backfill-crm-from-quotes.mjs` bygger ett första CRM-register från befintliga offerter. Det körs alltid som en skrivskyddad förhandsgranskning om inte `--apply` anges uttryckligen.

Av säkerhetsskäl behandlas endast offerter vars ägare har full adminåtkomst. Adminlistan är unionen av `user_roles/{uid}` med `role: admin` och de tre fasta admin-UID:erna i `src/config/accessControl.shared.ts`. Icke-adminofferter läses för rapporten men skapar inga CRM-poster och får ingen `crmDealId`.

## Förhandsgranska

1. Konfigurera Firebase Admin-inloggning via `GOOGLE_APPLICATION_CREDENTIALS` eller den säkra standardmiljön för projektet.
2. Kör:

   ```powershell
   cmd /c npm run crm:backfill
   ```

3. Granska särskilt:

   - antal aktiva icke-adminofferter som hoppats över;
   - dubbletter och tvetydiga företag, kontakter eller CRM-medlemmar;
   - arkiverade eller motstridigt länkade affärer;
   - befintliga affärer som behöver en kontrollerad återlänkning till offert.

   Tvetydiga poster hoppas över och behöver lösas manuellt.

## Verkställ

När dry-run-rapporten är granskad:

```powershell
cmd /c npm run crm:backfill -- --apply
```

Skriptet är idempotent och använder deterministiska dokument-id:n. Det:

- skapar bara saknade CRM-medlemmar, företag, kontakter och affärer;
- bygger CRM-medlemmar från unika `savedByUid` och återanvänder en entydig befintlig medlem med samma normaliserade e-post;
- uppgraderar återanvända CRM-poster som ingår i en entydig migrering till `schemaVersion: 1` och säkerställer att befintliga affärer har en tagglista utan att ersätta en redan befintlig array;
- låter affärens `ownerId` peka på den skapade eller återanvända CRM-medlemmen;
- lägger `CustomerInfo.extraNotes` på företaget, eller på kontakten för en fristående privatkund, och deduplicerar identiska noteringar;
- kompletterar saknade noteringar på befintliga kundposter transaktionellt utan att radera befintlig text;
- hoppar över arkiverade offerter;
- hoppar över samtliga aktiva offerter som inte ägs av en full-adminanvändare;
- ändrar aldrig offertrevisioner;
- skriver endast `crmDealId` till offertens metadata och gör det i en transaktion;
- skriver länken bara om `crmDealId` fortfarande är tomt eller redan har samma värde; en konkurrerande länk hoppas över och rapporteras som konflikt;
- återlänkar en befintlig affär med tomma offertfält endast efter en transaktionell kontroll;
- behandlar en arkiverad matchande affär som en manuell konflikt och återlänkar den aldrig automatiskt;
- raderar eller slår aldrig ihop befintlig data.

Konflikter som uppstår mellan dry-run och `--apply` skrivs ut efter körningen och skrivs inte över. Kör alltid en ny dry-run efter att tvetydigheter eller konflikter har rättats och innan `--apply` används igen.
