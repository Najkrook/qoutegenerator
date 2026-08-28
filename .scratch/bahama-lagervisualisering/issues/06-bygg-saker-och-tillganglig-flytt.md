# Bygg säker och tillgänglig flytt

Type: task
Parent: ../map.md
Blocked by: 03, 05

## Question

Implementera den godkända drag-and-drop- och Flytta-interaktionen med tomma mål, bekräftad platsväxling, flytt mellan Grenställ, `Ej placerade`, ångra, mobil/tangentbord och fokusåterställning.

Varje flytt ska uppdatera befintlig lokal lagerarbetskopia, synas i dagens pending-changes-flöde och sparas via befintlig batch, QR-projektion och lagerlogg. Ingen artikel får skrivas över, tappas eller sparas automatiskt utanför det godkända arbetsflödet.
