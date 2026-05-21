# Retailer Order Request Plan

## Summary

Lägg till ett retailer-specifikt flöde i `SummaryExport` där en sparad offert kan skickas som orderförfrågan till BRIXX via backend-e-post, med PDF-offerten bifogad. Samtidigt ska appen börja bygga ett adminspår i webappen genom en ny Firestore-baserad inbox för inkomna orderförfrågningar som visas i en ny avdelning på admin-startsidan.

## Key Changes

- Lägg till en ny retailer-knapp i `src/views/SummaryExport.tsx`
  - etikett: `Maila orderförfrågan`
  - visas endast för `isRetailer`
  - kräver sparad offert med `activeQuoteId` och `quoteNumber`
  - är disabled tills offerten är sparad
- Använd befintlig PDF-generering i frontend
  - återanvänd `createPdfBlob(...)` eller motsvarande PDF-exportmodul
  - generera PDF som bifogas orderförfrågan
- Inför en ny klientservice, till exempel `src/services/orderRequestService.ts`, som ansvarar för:
  - skapa `order_requests`-dokument i Firestore med status `sending_email`
  - anropa backend-endpoint för e-postutskick
  - uppdatera dokumentet till `emailed` eller `email_failed`
  - skriva aktivitetslogg för lyckat utskick och eventuella fel
- Backendspåret ska vara en dedikerad order-request-endpoint, inte `mailto:`
  - endpoint tar emot `orderRequestId`, `quoteId`, `quoteNumber`, retailer/customer-metadata, totals, samt PDF som base64- eller blob-payload
  - endpoint skickar mail till `team@brixx.se` plus en backend-konfigurerad lista av adminmottagare
  - mottagarlistan ska vara backend-konfigurerad, inte exponerad i frontend
- Adminspår i webappen
  - skapa ny Firestore-kollektion `order_requests`
  - admins läser denna kollektion direkt i webappen
  - lägg till en ny dashboard-sektion på startsidan, till exempel `Inkomna orderförfrågningar`
  - sektionen visar senaste orderförfrågningarna med status, offertnummer, retailer, kund, totalsumma, skickad tid och eventuell felstatus
- Dubblettbeteende
  - en orderförfrågan låses per sparad offertversion
  - om samma offertversion redan skickats ska knappen vara låst eller visa att orderförfrågan redan är skickad
  - om användaren sparar en ny version av offerten kan den nya versionen skickas som en ny orderförfrågan

## Interfaces And Data Model

- Lägg till nya typer i `src/types/contracts.ts`
  - `OrderRequestStatus = 'sending_email' | 'emailed' | 'email_failed'`
  - `OrderRequestRecord`
  - `OrderRequestEmailPayload`
  - eventuellt `OrderRequestSummary`
- Firestore-kollektion: `order_requests/{requestId}`
  - `quoteId`, `quoteNumber`, `quoteVersion`
  - `retailerId`, `retailerName`, `retailerEmail`
  - `customerName`, `company`, `reference`, `customerReference`
  - `selectedLines`
  - `totalSek`
  - `status`
  - `createdAtMs`, `emailedAtMs`, `lastError`
  - `createdByUid`, `createdByEmail`
- Firestore-regler
  - signed-in retailers får skapa nya `order_requests`
  - signed-in retailers får uppdatera egna requests under utskicksflödet
  - admins får läsa alla `order_requests`
- Backend recipient config
  - initialt: `team@brixx.se` plus explicit adminlista i backend-konfiguration
  - ingen recipientlista i frontend eller i retailer-läsbar Firestore-data

## UI And Flow Details

- Retailer-flöde i `SummaryExport`
  - om offerten inte är sparad: visa disabled-knapp plus hjälpcopy `Spara offerten först för att maila orderförfrågan.`
  - om PDF-generering misslyckas: inget request-dokument ska markeras som `emailed`
  - vid klick:
    - visa loading state på knappen
    - skapa request-record i Firestore med snapshotdata
    - skicka e-post via backend
    - uppdatera request-status
    - visa success/error-notis via befintlig notification service
- Admin dashboard
  - ny sektion under befintliga adminkort, endast för `canViewEverything`
  - initial version är en läs-yta, inte en full detaljvy
  - tomläge om inga orderförfrågningar finns ännu

## Test Plan

- Frontend/service
  - `SummaryExport` visar `Maila orderförfrågan` endast för retailers
  - knappen är disabled utan `activeQuoteId` eller `quoteNumber`
  - request-record byggs med rätt retailer-, quote- och kundsnapshot
  - utskick sätter status `emailed`, fel sätter `email_failed`
  - samma offertversion kan inte skickas två gånger
  - ny offertversion efter save kan skickas igen
- Dashboard/admin
  - admin-startsidan visar ny sektion för orderförfrågningar
  - retailer ser inte admin-sektionen
  - tomläge och senaste-lista renderas korrekt
- Rules/contract
  - retailer create/update av egna `order_requests`
  - admin read av `order_requests`
- Backend
  - payloadvalidering
  - recipient resolution
  - mail med PDF-bilaga
  - felrespons när e-post inte kan skickas
- Kör minst
  - relevanta `vitest`-tester för `SummaryExport`, dashboard, service och routing
  - `npm run typecheck`
  - Firestore rules-test om sådan harness finns, annars lägg till minimal täckning

## Assumptions

- Målet med `retailer_plan.md` är att beskriva både första retailer-mailflödet och grunden för admin-inbox på webappen.
- Knappen placeras i `SummaryExport`, eftersom det redan är offertens save/export-slutpunkt.
- V1 skickar PDF-bilaga plus en kort sammanfattning i mailkroppen.
- Orderförfrågan ändrar inte quote status i denna första leverans, utan loggas separat från `draft/sent/won/lost/archived`.
- Nuvarande repo saknar färdig mail-backend i `QuoteGenerator`; implementeringen ska därför skapa eller koppla in en dedikerad backend-endpoint som stödjer e-postutskick för detta flöde.
