# Godkänn 3D-arbetsflödet och bildexporten

Type: prototype
Status: resolved
Assignee: Codex
Parent: ../map.md
Blocked by: 06

## Question

Hur ska användaren gå från Simple Sketch till den skrivskyddade 3D-vyn, förstå dess status, navigera scenen, exportera en bild och återvända utan att skissens state eller URL-historik blir överraskande?

Prototypen ska täcka egen URL-route, aktuellt autosparat utkast, laddning och assetfel, automatisk kamerainpassning, orbit/zoom, återställ kamera, mobil, återgång, tydlig skrivskyddad status och PNG-export med diskret projektnamn eller offertnummer utan prisinformation. Behåll samma sketchbehörighet och använd befintligt notificationsystem. Lös inte ticketen utan användarens uttryckliga godkännande.

## Comments

2026-09-06: Claimed on `codex/prototype-3d-workflow`. Extend the approved scene into a reviewable workflow using the current sketch, camera controls and PNG export. This remains a prototype pending the user's review.

2026-09-06: Review artifact implemented on `codex/prototype-3d-workflow`: `src/prototypes/3d-workflow-prototype/README.md`. The existing `/sketch/3d-prototype` entry now reads the current draft and supports same-tab return; the standalone fixture compares A (review sidebar) and B (presentation drawer). Includes camera controls, status/fallback simulations and 2560 × 1440 PNG with project label/disclosure. Browser fixture and focused routing checks passed; authenticated end-to-end review remains outstanding. Geometry and adapter are explicitly temporary. User verdict is still pending; do not resolve this ticket yet.

### Användarens godkännande

2026-09-07: Användaren svarade ”ser bra ut” på frågan om arbetsflödet känns rätt efter genomgång av prototypen. Detta godkänner arbetsflödet; det är inte ett godkännande av produktionsberedskap eller driftsättning. A · Granska behålls som rekommenderad och befintlig standard; användaren angav inget separat variantval.

## Answer

Den skrivskyddade 3D-vyn öppnas från Enkel skiss i samma flik på en egen skyddad URL, med det aktuella skissutkastet. Återgång bevarar ursprunglig skiss- och URL-kontext. Ingen separat kamera- eller 3D-state sparas i offerten.

Arbetsflödet omfattar automatisk kamerainpassning, orbit/zoom, återställning, ovanifrånkamera och tekniskt läge. Status och fokuserbara problem förblir åtkomliga på desktop och mobil. A · Granska är standard med granskningspanel; B · Presentera finns som alternativ i prototypen.

PNG exporteras i 2560 × 1440 från aktuell kameravy, med diskret projekt-/offertrad och information om förenklingar, utan priser. Utelämnade delar och terminala renderingsfel blockerar export. Laddning, fallback, fel och återhämtning följer det visade flödet och befintligt notificationsystem.

Primärkälla: prototypgren `codex/prototype-3d-workflow`, commit `16811cc`, med [körinstruktioner och avgränsningar](../../../src/prototypes/3d-workflow-prototype/README.md). Godkännandet avser UX-beslutet: temporär adapter, procedurmodeller och simulerade assetfel ersätter inte slutligt kontrakt, verklig assetleverans eller inloggad helflödesverifiering. Dessa återstår inför produktion.
