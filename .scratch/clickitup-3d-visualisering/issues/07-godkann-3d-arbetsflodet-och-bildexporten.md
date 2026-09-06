# Godkänn 3D-arbetsflödet och bildexporten

Type: prototype
Status: claimed
Assignee: Codex
Parent: ../map.md
Blocked by: 06

## Question

Hur ska användaren gå från Simple Sketch till den skrivskyddade 3D-vyn, förstå dess status, navigera scenen, exportera en bild och återvända utan att skissens state eller URL-historik blir överraskande?

Prototypen ska täcka egen URL-route, aktuellt autosparat utkast, laddning och assetfel, automatisk kamerainpassning, orbit/zoom, återställ kamera, mobil, återgång, tydlig skrivskyddad status och PNG-export med diskret projektnamn eller offertnummer utan prisinformation. Behåll samma sketchbehörighet och använd befintligt notificationsystem. Lös inte ticketen utan användarens uttryckliga godkännande.

## Comments

2026-09-06: Claimed on `codex/prototype-3d-workflow`. Extend the approved scene into a reviewable workflow using the current sketch, camera controls and PNG export. This remains a prototype pending the user's review.

2026-09-06: Review artifact implemented on `codex/prototype-3d-workflow`: `src/prototypes/3d-workflow-prototype/README.md`. The existing `/sketch/3d-prototype` entry now reads the current draft and supports same-tab return; the standalone fixture compares A (review sidebar) and B (presentation drawer). Includes camera controls, status/fallback simulations and 2560 × 1440 PNG with project label/disclosure. Browser fixture and focused routing checks passed; authenticated end-to-end review remains outstanding. Geometry and adapter are explicitly temporary. User verdict is still pending; do not resolve this ticket yet.
