# TypeScript Migration Tracker

Last updated: 2026-04-16
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
- Remaining temporary escape hatches: `0` files still use `// @ts-nocheck`.

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

### 8. Sketch domain slice

- [x] Removed `// @ts-nocheck` from:
  - `src/views/SketchTool.tsx`
  - `src/components/features/SketchCanvas.tsx`
  - `src/components/features/SketchConfig.tsx`
  - `src/components/features/SketchBom.tsx`
  - `src/components/features/StockComparisonModal.tsx`
  - `src/features/sketchExportState.ts`
  - `src/utils/sectionCalculator.ts`
  - `src/utils/parasolGeometry.ts`
- [x] Added shared sketch-domain contracts for:
  - `SketchToolProps`
  - `SketchWorkspace`
  - `SketchCamera`
  - `SketchSelection`
  - `SketchConfigState`
  - `SketchEdgeKey`
  - `SketchDensity`
  - `SketchMode`
  - `DoorSegment`
  - `ManualSectionPin`
  - `DoorSegmentsByEdge`
  - `ManualSectionsByEdge`
  - `SectionCountByEdge`
  - `LayoutWarning`
  - `LayoutSuggestion`
  - `EdgeSummary`
  - `EdgeDiagnostic`
  - `ComputedLayoutResult`
  - `ParasolPreset`
  - `PlacedParasol`
  - `PlacedFiesta`
  - `StockComparisonRow`
  - sketch component prop types for `SketchCanvas`, `SketchConfig`, `SketchBom`, and `StockComparisonModal`
- [x] Typed the sketch pure-helper boundary end to end without changing runtime behavior:
  - `computeLayout`
  - section-sizing helpers
  - parasol preset parsing/grouping helpers
  - parasol overlap warnings
  - `buildSketchExportState`
- [x] Preserved persisted `sketchDraft` structure while tightening its TypeScript shape in shared contracts.
- [x] Fixed visible mojibake in the touched sketch files only.

### 9. Planner slice

- [x] Removed `// @ts-nocheck` from:
  - `src/views/Planner.tsx`
- [x] Kept planner project CRUD, weekly filtering, modal editing, and undo-delete behavior unchanged.
- [x] Tightened the Firestore update boundary used by the project details modal so planner saves typecheck cleanly.
- [x] Extended smoke coverage for the planner empty/loading state and form labels.

### 10. PDF export slice

- [x] Removed `// @ts-nocheck` from:
  - `src/features/pdfExport.ts`
  - `src/features/pdfExportLayout.ts`
- [x] Added concrete TypeScript boundaries around PDF export inputs:
  - quote-state/customer-info payloads
  - grouped summary totals
  - PDF layout column styles and color tuples
- [x] Preserved runtime PDF behavior for:
  - valid-until date handling
  - grouped quote-table rendering
  - totals/payment/terms/signature rendering
  - multi-page footer rendering
- [x] Normalized touched PDF-export copy to clean Swedish text where the slice already touched visible strings.
- [x] Kept existing PDF tests green while removing the export-layer escape hatches.

### 11. Builder/grid slice

- [x] Removed `// @ts-nocheck` from:
  - `src/components/features/BuilderConfig.tsx`
  - `src/components/features/BuilderItem.tsx`
  - `src/components/features/GridConfig.tsx`
  - `src/utils/gridAutoScale.ts`
- [x] Added builder/grid-domain contracts for:
  - `BuilderConfigProps`
  - `BuilderItemProps`
  - `GridConfigProps`
  - `GridAddonSyncMode`
  - `GridAddonDiscountSyncMode`
  - `GridAddonState`
  - `GridCustomItemRow`
  - `EffectiveGridAddonState`
  - `EffectiveGridLineSelection`
  - narrow catalog-facing builder/grid line, model, item, and add-on shapes used by this slice
- [x] Tightened shared builder/grid state typing without changing reducer actions or runtime data flow:
  - `GridLineSelection`
  - `BuilderAddon`
  - `BuilderItem`
- [x] Preserved current runtime behavior for:
  - builder default item creation
  - builder add-on toggling and custom add-on rows
  - grid section qty editing, custom rows, and auto-scaled add-ons
  - global-discount propagation in `gridAutoScale.ts`
- [x] Fixed visible mojibake only in the touched builder/grid files and tests.

### 12. Validation already passing

- [x] `npm run typecheck`
- [x] `npm run test:confidence`
- [x] `npm run build`
- [x] `vitest run tests/sectionCalculator.test.js tests/parasolGeometry.test.js tests/sketchExportState.test.js tests/sketchConfig.test.jsx`
- [x] `vitest run tests/builderItem.test.jsx tests/gridConfig.test.jsx tests/gridAutoScale.test.js`

### 13. Catalog slice

- [x] Removed `// @ts-nocheck` from:
  - `src/data/catalog.ts`
- [x] Added the final shared catalog contracts needed to type the catalog boundary:
  - `CatalogLineData`
  - `CatalogData`
- [x] Typed the catalog helper utilities that annotate builder add-on categories.
- [x] Preserved all runtime catalog keys, labels, prices, and nested data without schema changes.
- [x] Finished the app-source migration milestone: no `// @ts-nocheck` files remain under `src/`.

### 14. Small hardening slice: catalog consumers and quote hydration

- [x] Tightened the retailer catalog boundary to consume `CatalogData` directly instead of a loose `Record<string, unknown>`.
- [x] Removed an extra local catalog-cast shim in `RetailerManager` and used the typed catalog boundary directly for product-line labels.
- [x] Reused the shared `HydratedQuoteStatePayload` contract in `App` for history-to-editor quote reopening instead of an inline `Record<string, any>` payload type.
- [x] Kept runtime retailer CRUD and quote hydration behavior unchanged.

### 15. Small hardening slice: save/export helpers

- [x] Added helper-facing contracts for:
  - `SaveQuoteToRepositoryParams`
  - `SavedQuoteLike`
  - `ExportSummaryResult`
  - `PdfTableRow`
  - `PdfTableOptions`
  - narrow save/export input types built from existing quote contracts
- [x] Removed broad `any` usage from `src/services/quoteSaveService.ts`.
- [x] Removed broad `any` usage from `src/services/exportDataBuilders.ts`.
- [x] Kept quote saving, state-patch generation, VAT handling, zero-discount detection, and PDF/Excel export row output unchanged.

### 16. Small hardening slice: pricing surface

- [x] Added narrow pricing/grid helper contracts for:
  - `PricingGridItemsMap`
  - `PricingGridAddonsMap`
  - `PricingEffectiveGridAddonsMap`
- [x] Removed the remaining local `Record<string, any>` reducer accumulators from `src/views/Pricing.tsx`.
- [x] Removed the remaining local effective-grid-addon cast from `src/components/features/PricingTable.tsx`.
- [x] Replaced the pricing view’s inline untyped grid-addon lookup with a typed grid-category traversal.
- [x] Kept global discount follow behavior unchanged for builder rows, grid rows, auto-scale add-ons, and custom grid rows.

### 17. Large hardening slice: quote state schema

- [x] Added schema-facing raw input contracts for:
  - `UnknownRecord`
  - `RawPersistedCustomerInfo`
  - `RawPersistedInventoryData`
  - `RawPersistedBuilderAddon`
  - `RawPersistedBuilderItem`
  - `RawPersistedSketchMeta`
  - `RawPersistedGridLineSelection`
  - shared `HydratedQuoteStatePayload`
- [x] Replaced broad `any`-based migration and hydration helpers in `src/store/quoteStateSchema.ts` with typed narrowing helpers built around `unknown`.
- [x] Tightened the schema-adjacent boundaries in:
  - `src/store/QuoteContext.tsx`
  - `src/store/quoteStatePersistence.ts`
- [x] Preserved quote-state compatibility behavior for:
  - legacy `ClickitUP` to `ClickitUp`
  - validity-day parsing and normalized customer validity labels
  - malformed nested-object fallbacks
  - conservative forward-version hydration
  - custom builder add-ons and custom grid add-ons
  - sketch metadata and persisted draft preservation
- [x] Verified the schema hardening slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/quoteStateSchema.test.js tests/quoteStatePersistence.test.js tests/accessControl.shared.test.js tests/sketchExportState.test.js tests/uiTextSmoke.test.jsx`

### 18. Large hardening slice: repository + Firestore boundary

- [x] Added repository-facing raw document and payload contracts for:
  - `RawQuoteMetadataDoc`
  - `RawQuoteRevisionDoc`
  - `RawQuoteSummary`
  - `RepositoryQuoteStatePayload`
  - `RepositoryQuoteSummaryPayload`
  - `ScrivePatchInput`
- [x] Added explicit Firestore adapter contracts for:
  - document snapshots
  - query snapshots
  - document refs
  - write batches
  - transactions
- [x] Replaced broad `any` and `Record<string, any>` usage in `src/services/quoteRepository.ts` with `unknown`-based narrowing and typed normalization helpers.
- [x] Preserved repository behavior for:
  - create-vs-revision save flow
  - no-transaction fallback saves
  - latest-revision fallback to revision rows and legacy metadata snapshots
  - quote status updates and Scrive patch merging
  - cross-user history owner UID extraction
- [x] Extended repository tests to cover:
  - fallback save without `runTransaction`
  - latest-revision fallback without `latestRevisionId`
  - Scrive null/undefined merge behavior
- [x] Verified the repository hardening slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/quoteRepository.test.js`

## Remaining Work

### 1. Improve type quality inside already-migrated files

- [ ] Reduce broad `any` and `Record<string, any>` usage in shared contracts.
- [ ] Replace loose shell-to-feature payloads with exported domain-specific interfaces where practical.
- [ ] Continue tightening catalog-derived data access so components do not rely on broad object indexing or local fallback casts.
- [ ] Continue reducing broad `any` usage in repository helpers, file/export utilities, and shared runtime contracts.

### 2. Continue mojibake cleanup outside the finished slices

- [ ] Fix visible mojibake in untouched admin, sketch, catalog, and helper-heavy files.
- [ ] Keep text cleanup scoped to files actively being migrated so behavior changes stay reviewable.

### 3. Longer-term hardening

- [ ] Re-evaluate compiler strictness after the escape-hatch backlog is gone.
- [ ] Consider tightening options like `noImplicitAny` and related strict flags in a dedicated follow-up.
- [ ] Decide separately whether tests and scripts should also migrate to TypeScript. This is intentionally out of scope for the main app-source migration.

## Recommended Next Slices

Recommended order from here:

1. `Type hardening` follow-up
   - Target:
     - shared contracts cleanup
     - catalog-consumer indexing
     - remaining utility/service `any` cleanup
   - Why:
     - the migration itself is now complete for `src/`
     - quote-state normalization and repository boundaries are now tightened, so the next highest-value work is reducing permissive shared contracts

## Definition of Done for the Migration

The app-source migration is complete when all of the following are true:

- [x] No `.js` or `.jsx` files remain under `src/`.
- [x] `typecheck` validates actual source files.
- [x] CI runs `npm run typecheck`.
- [x] No `// @ts-nocheck` files remain under `src/`.
- [ ] Remaining `any` usage is deliberate and minimal rather than structural.
- [ ] Main quote, admin, and sketch flows are all typechecked without escape hatches.
- [x] Backward compatibility for persisted quote/revision data is still intact after cleanup.

## Update Checklist For Future Slices

When a migration slice is completed, update this file with:

- the date
- the files moved out of `// @ts-nocheck`
- any new shared types added
- any user-visible text fixes made in the touched files
- the new remaining `// @ts-nocheck` count
- whether `typecheck`, `test:confidence`, and `build` passed
