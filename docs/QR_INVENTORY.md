# QR-stöd för BaHaMa-lagret

## Åtkomst

- Etikettgeneratorn, skanningen och parasolldetaljerna kräver appens befintliga adminbehörighet.
- Både uttryckliga administratörer och befintliga legacy-administratörer omfattas av samma adminregel.
- Övriga roller och oklassificerade konton har inte åtkomst.
- Firestore tillåter endast dokumenthämtning av ett känt QR-ID; listning av `bahama_qr_items` är spärrad.

## Backfill

Alla befintliga `bahamaV2`-poster måste få ett oföränderligt `qrId` och en läsprojektion i `bahama_qr_items`.

```powershell
npm run inventory:qr-backfill
npm run inventory:qr-backfill -- --apply
```

Första kommandot är en dry run. Granska antalet poster, nya QR-ID:n och projektioner innan `--apply` används. Skriptet avbryter vid dubbletter eller ogiltiga identifierare.

## Utrullningsordning

1. Kör QR-backfill först i dry-run-läge och därefter med `--apply`.
2. Distribuera `firestore.rules`.
3. Bygg och distribuera webbappen.
4. Öppna `/inventory/qr` som administratör från produktionsdomänen och skapa skarpa etiketter därifrån. QR-länkarna använder den domän som generatorn körs på.

## Verifiering

```powershell
npm run typecheck
npm run test:run
npm run test:firestore-qr
npm run build
```

`test:firestore-qr` använder en lokalt pinnad Firebase CLI-version som fungerar med projektmaskinens Java 8-runtime. Ingen produktionsdata används.
