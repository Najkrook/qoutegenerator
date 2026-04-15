# TypeScript Migration Tracker

Last updated: 2026-04-15
Working branch: `feat/typescript-migration`

This is a living tracker for the QuoteGenerator TypeScript migration. Update it after each migration slice so we keep one source of truth for what is done, what is intentionally deferred, and what should happen next.

## Current Snapshot

- `src/` is fully migrated to `.ts` and `.tsx`.
- No `.js` or `.jsx` files remain under `src/`.
- TypeScript is part of the toolchain via `typescript`, `@types/react`, and `@types/react-dom`.
- `package.json` includes `npm run typecheck`.
- `tsconfig.json` typechecks real source files in `src/`.
- CI runs:
  - `npm run test:confidence`
  - `npm run typecheck`
  - `npm run build`
- `index.html` loads `/src/main.tsx`.
- Only one declaration file remains in `src/`: `src/types/global.d.ts`.
- Remaining temporary escape hatches: `16` files still use `// @ts-nocheck`.

## Implemented

### 1. Foundation and mixed-code setup

- [x] Added TypeScript tooling to the app.
- [x] Added React type packages.
- [x] Added `typecheck` script in `package.json`.
- [x] Expanded `tsconfig.json` so TypeScript validates actual app source in `src/`.
- [x] Switched the app entry to `src/main.tsx`.
- [x] Added CI enforcement for `npm run typecheck`.

### 2. Source-file migration baseline

- [x] Converted the app source tree in `src/` from `.js/.jsx` to `.ts/.tsx`.
- [x] Kept runtime exports and app behavior intact during the rename pass.
- [x] Left heavy modules on temporary `// @ts-nocheck` rather than blocking the full rename.

### 3. Shared contracts and core typing

- [x] Added shared app contracts in `src/types/contracts.ts`.
- [x] Added global browser/runtime declarations in `src/types/global.d.ts`.
- [x] Typed key quote-state and access-control contracts, including:
  - `QuoteState`
  - `QuoteStep`
  - `QuoteReducerAction`
  - `QuoteContextValue`
  - `AccessLevel`
  - `AccessCapabilities`
  - repository metadata/revision shapes

### 4. Core typed modules already in good shape

- [x] `src/main.tsx`
- [x] `src/store/AuthContext.tsx`
- [x] `src/store/QuoteContext.tsx`
- [x] `src/store/quoteStateSchema.ts`
- [x] `src/store/quoteStatePersistence.ts`
- [x] `src/config/accessControl.shared.ts`
- [x] `src/services/authService.ts`
- [x] `src/services/quoteRepository.ts`
- [x] `src/services/quoteSaveService.ts`
- [x] `src/services/activityLogService.ts`
- [x] `src/services/exportDataBuilders.ts`
- [x] `src/utils/fileUtils.ts`

### 5. Shell and access UI slice

- [x] Removed `// @ts-nocheck` from:
  - `src/App.tsx`
  - `src/components/layout/Header.tsx`
  - `src/components/layout/ErrorBoundary.tsx`
  - `src/views/Login.tsx`
  - `src/views/Dashboard.tsx`
  - `src/views/ProductLineSelection.tsx`
  - `src/views/Configuration.tsx`
- [x] Added explicit prop types for the shell/access slice.
- [x] Tightened step-routing and access-gating types end to end.
- [x] Fixed visible mojibake in the touched shell/access files.

### 6. Quote-flow slice

- [x] Removed `// @ts-nocheck` from:
  - `src/views/Pricing.tsx`
  - `src/views/SummaryExport.tsx`
  - `src/views/History.tsx`
  - `src/components/features/PricingTable.tsx`
  - `src/components/features/CustomCosts.tsx`
  - `src/components/features/FinalSummaryTable.tsx`
  - `src/components/features/CustomerInfoForm.tsx`
  - `src/components/features/TermsAndPaymentPanel.tsx`
- [x] Added quote-flow contracts for:
  - `PricingProps`
  - `SummaryExportProps`
  - `HistoryProps`
  - `QuoteTotalsResult`
  - `QuoteTotalsRow`
  - `QuoteTotalsRowSource`
  - `CustomCostRow`
  - history/template helper shapes used by this slice
- [x] Kept runtime quote-flow behavior unchanged while typing pricing, save/export, and history handoff surfaces.
- [x] Fixed visible mojibake in the touched quote-flow files.
- [x] Extended tests to cover the cleaned customer-info copy and added quote-flow smoke coverage for Pricing and History.

### 7. Retailer + inventory/admin slice

- [x] Removed `// @ts-nocheck` from:
  - `src/views/RetailerManager.tsx`
  - `src/views/InventoryManager.tsx`
  - `src/views/InventoryLogs.tsx`
  - `src/views/ActivityLogs.tsx`
  - `src/components/features/InventoryTable.tsx`
  - `src/components/features/InventoryItemModal.tsx`
  - `src/components/features/PendingChangesPanel.tsx`
  - `src/components/features/ClickitupStockGrid.tsx`
- [x] Added admin-domain contracts for:
  - retailer form and retailer product-line shapes
  - BaHaMa inventory rows and inventory basket rows
  - ClickitUp stock entry and field-key contracts
  - inventory/activity log rows, filters, and paginated page state
  - admin view/component prop types for the touched slice
- [x] Tightened retailer, activity-log, and CSV-normalizer service boundaries to return typed shapes without changing runtime behavior.
- [x] Fixed visible mojibake in the touched admin views, components, and service strings.
- [x] Extended smoke coverage for `RetailerManager`, `InventoryManager`, and `InventoryLogs`, and updated touched service tests for cleaned text/output.

### 8. Validation already passing

- [x] `npm run typecheck`
- [x] `npm run test:confidence`
- [x] `npm run build`

## Remaining Work

### 1. Remove remaining `// @ts-nocheck` files

Current backlog by area:

- `components`: 7
- `views`: 2
- `features`: 3
- `utils`: 3
- `data`: 1

Remaining files:

#### Views

- [ ] `src/views/SketchTool.tsx`
- [ ] `src/views/Planner.tsx`

#### Components

- [ ] `src/components/features/BuilderConfig.tsx`
- [ ] `src/components/features/BuilderItem.tsx`
- [ ] `src/components/features/GridConfig.tsx`
- [ ] `src/components/features/SketchCanvas.tsx`
- [ ] `src/components/features/SketchBom.tsx`
- [ ] `src/components/features/StockComparisonModal.tsx`
- [ ] `src/components/features/SketchConfig.tsx`

#### Features

- [ ] `src/features/sketchExportState.ts`
- [ ] `src/features/pdfExportLayout.ts`
- [ ] `src/features/pdfExport.ts`

#### Utils

- [ ] `src/utils/sectionCalculator.ts`
- [ ] `src/utils/parasolGeometry.ts`
- [ ] `src/utils/gridAutoScale.ts`

#### Data

- [ ] `src/data/catalog.ts`

### 2. Improve type quality inside already-migrated files

- [ ] Reduce broad `any` and `Record<string, any>` usage in shared contracts.
- [ ] Tighten repository and Firestore payload typing where current shapes are still permissive.
- [ ] Replace loose shell-to-feature payloads with exported domain-specific interfaces where practical.
- [ ] Add stronger typing around catalog-derived data so components do not rely on untyped object indexing.

### 3. Continue mojibake cleanup outside the finished slices

- [ ] Fix visible mojibake in untouched admin, sketch, catalog, and helper-heavy files.
- [ ] Keep text cleanup scoped to files actively being migrated so behavior changes stay reviewable.

### 4. Longer-term hardening

- [ ] Remove all remaining `// @ts-nocheck` markers from `src/`.
- [ ] Re-evaluate compiler strictness after the escape-hatch backlog is gone.
- [ ] Consider tightening options like `noImplicitAny` and related strict flags in a dedicated follow-up.
- [ ] Decide separately whether tests and scripts should also migrate to TypeScript. This is intentionally out of scope for the main app-source migration.

## Recommended Next Slices

Recommended order from here:

1. `Sketch domain` slice
   - Target:
     - `SketchTool`
     - `SketchCanvas`
     - `SketchConfig`
     - `SketchBom`
     - `sketchExportState`
     - geometry/math helpers
   - Why:
     - This is now the largest remaining product surface.
     - These files share state, geometry, and export-shape pressure and should move as one coordinated slice.

2. `Planner` follow-up slice
   - Target:
     - `Planner`
   - Why:
     - It is now the only remaining admin-facing view outside the sketch domain.
     - Keeping it separate avoids mixing planning CRUD with the heavier geometry work.

3. `Catalog + PDF/export internals` slice
   - Target:
     - `catalog.ts`
     - `pdfExport.ts`
     - `pdfExportLayout.ts`
   - Why:
     - These files will benefit from stronger domain models already established by the previous slices.

## Definition of Done for the Migration

The app-source migration is complete when all of the following are true:

- [x] No `.js` or `.jsx` files remain under `src/`.
- [x] `typecheck` validates actual source files.
- [x] CI runs `npm run typecheck`.
- [ ] No `// @ts-nocheck` files remain under `src/`.
- [ ] Remaining `any` usage is deliberate and minimal rather than structural.
- [ ] Main quote, admin, and sketch flows are all typechecked without escape hatches.
- [ ] Backward compatibility for persisted quote/revision data is still intact after cleanup.

## Update Checklist For Future Slices

When a migration slice is completed, update this file with:

- the date
- the files moved out of `// @ts-nocheck`
- any new shared types added
- any user-visible text fixes made in the touched files
- the new remaining `// @ts-nocheck` count
- whether `typecheck`, `test:confidence`, and `build` passed
