# TypeScript Migration Tracker

Last updated: 2026-04-20
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

### 19. Large hardening slice: shared contracts cleanup

- [x] Removed the remaining structural `any` usage from shared app-facing contracts in `src/types/contracts.ts`.
- [x] Added shared permissive payload aliases for:
  - `QuoteStatePatch`
  - `CustomerInfoPatch`
- [x] Tightened reducer-facing action payloads to use shared aliases instead of inline `Record<string, any>` unions.
- [x] Tightened auth context contracts so:
  - `AccessUser` uses `unknown` for extra fields
  - `login` returns the real Firebase `UserCredential` promise type
  - `logout` returns `Promise<void>`
- [x] Tightened the auth-service boundary to normalize Firebase auth callback values into the app-facing `AccessUser` shape.
- [x] Replaced the `fileUtils` save-picker `catch (err: any)` path with `unknown` plus `AbortError` narrowing.
- [x] Verified the shared-contract cleanup slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`

### 20. Shell-to-feature payload cleanup

- [x] Added domain-specific shell handoff and patch contracts for:
  - `HistoryOpenQuotePayload`
  - `SavedQuoteStatePatch`
  - `SketchDraftStatePatch`
  - `QuoteIdentityPatch`
- [x] Replaced generic shell/view payload usage in:
  - `src/App.tsx`
  - `src/views/History.tsx`
  - `src/views/SummaryExport.tsx`
  - `src/views/SketchTool.tsx`
- [x] Kept reducer compatibility intact by leaving `HydratedQuoteStatePayload` and `QuoteStatePatch` at the schema/reducer boundary while narrowing the view-to-view call sites.
- [x] Tightened `buildSavedQuoteStatePatch` to return the dedicated save-state patch contract instead of a loose partial quote state.
- [x] Added targeted regression coverage for:
  - history reopen payload hydration through the reducer path
  - sketch draft patch persistence through `UPDATE_STATE`
  - save-state patch identity and Scrive fields
- [x] Verified the shell payload cleanup slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/quoteSaveService.test.js tests/quoteStateSchema.test.js`

### 21. Small hardening slice: runtime boundary tightening

- [x] Added small runtime adapter contracts for:
  - `PdfExportModule`
  - `ExcelExportModule`
  - `PlannerProjectDetailsPatch`
  - `AuthChangeUser`
- [x] Replaced broad dynamic-import object casts in `src/views/SummaryExport.tsx` with typed module boundaries for PDF and Excel export loading.
- [x] Replaced the planner project-details Firestore update double-cast in `src/views/Planner.tsx` with the dedicated details patch contract.
- [x] Replaced the Firebase auth user callback double-cast in `src/services/authService.ts` with an explicit mapper into the app-facing `AccessUser` shape.
- [x] Kept runtime export, planner save, auth subscription, and export behavior unchanged.
- [x] Verified the runtime-boundary cleanup slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`

### 22. Small hardening slice: history reopen payload normalization

- [x] Added a tiny pure history reopen helper in `src/views/historyPayload.ts`.
- [x] Replaced the inline `revision.state.customerInfo` cast chain in `src/views/History.tsx` with a typed normalization boundary that returns `HistoryOpenQuotePayload`.
- [x] Kept history reopen behavior unchanged for:
  - latest revision open
  - specific revision open
  - missing revision-state guard
  - metadata status normalization
  - injected `activeQuoteId` and `activeQuoteVersion`
- [x] Added focused regression coverage in `tests/historyPayload.test.js` for valid, missing, malformed, and non-object revision state inputs.
- [x] Verified the history reopen normalization slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/historyPayload.test.js tests/quoteStateSchema.test.js`

### 23. Small hardening slice: catalog-consumer indexing cleanup

- [x] Added a tiny shared catalog lookup helper in `src/data/catalogLookup.ts` for:
  - `getCatalogLine`
  - `getBuilderCatalogLine`
  - `getGridCatalogLine`
  - `getCatalogLineName`
  - `getCatalogLineIds`
- [x] Added the minimal shared `CatalogLineId` alias in `src/types/contracts.ts`.
- [x] Replaced the remaining local catalog casts in:
  - `src/components/features/BuilderConfig.tsx`
  - `src/components/features/BuilderItem.tsx`
  - `src/components/features/GridConfig.tsx`
- [x] Replaced direct catalog indexing in:
  - `src/views/Configuration.tsx`
  - `src/views/ProductLineSelection.tsx`
  - `src/views/RetailerManager.tsx`
- [x] Tightened builder size-option helpers to use concrete catalog size types instead of broad `Record<string, unknown>` inputs.
- [x] Preserved current builder/grid behavior, selected-line routing, product-line ordering, and retailer label/rabatt rendering.
- [x] Added focused regression coverage in `tests/catalogLookup.test.jsx` for:
  - builder/grid lookup null behavior
  - catalog name/id lookup
  - selected-line partitioning in the configuration flow
- [x] Verified the catalog-consumer indexing slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/catalogLookup.test.jsx tests/builderItem.test.jsx tests/gridConfig.test.jsx`

### 24. Small hardening slice: activity log + retailer boundaries

- [x] Added small shared service-boundary contracts for:
  - `ActivityLogSource`
  - `ActivityLogWriteRef`
  - `RetailerWriteSource`
- [x] Replaced the remaining inline activity-log snapshot/object assumptions in `src/services/activityLogService.ts` with a typed normalization boundary.
- [x] Replaced the activity-log success result's loose ref shape with the dedicated write-ref contract.
- [x] Replaced repeated retailer write-input unions in `src/services/retailerService.ts` with the shared retailer write-source alias.
- [x] Added a small retailer product-line normalization helper so stored retailer rows and Firestore write payloads share one tolerant normalization path.
- [x] Kept activity logging, retailer normalization, and Firestore write behavior unchanged.
- [x] Added focused regression coverage for:
  - malformed `data()` payloads in `normalizeActivityLog`
  - preserved `ref`/`id` handling in `buildActivityLogSuccessResult`
  - malformed retailer `productLines` payloads in `normalizeRetailerData`
  - malformed stored retailer product-line rows through `fetchRetailers`
- [x] Verified the activity-log/retailer hardening slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/activityLogService.test.js tests/retailerService.test.js`

### 25. Small hardening slice: CSV inventory normalizer

- [x] Tightened `src/utils/csvNormalizer.ts` so `normalizeInventoryText` preserves non-string inputs while returning a concrete string for string inputs.
- [x] Reused the shared `UnknownRecord` helper in the CSV normalizer instead of a local loose record type.
- [x] Removed the duplicated BaHaMa list normalization path in `src/views/InventoryManager.tsx` by reusing `normalizeInventoryList`.
- [x] Kept CSV/import runtime behavior unchanged for mojibake repair, item normalization, and array-to-item mapping.
- [x] Added focused regression coverage in `tests/csvNormalizer.test.js` for:
  - non-string passthrough behavior
  - empty-list fallback for malformed inputs
  - existing mojibake repair and row normalization behavior
- [x] Verified the CSV normalizer hardening slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/csvNormalizer.test.js`

### 26. Small hardening slice: sketch helpers + inventory runtime boundary

- [x] Added small shared raw-input contracts for:
  - `RawClickitupStockEntry`
  - `RawDoorSegment`
  - `RawManualSectionPin`
  - `RawDoorSegmentsByEdge`
  - `RawManualSectionsByEdge`
  - `RawSectionCountByEdge`
- [x] Replaced the remaining ad hoc structural casts in `src/utils/sectionCalculator.ts` with typed narrowing helpers around raw door, manual-pin, and edge-map inputs.
- [x] Removed the local catalog cast in `src/utils/parasolGeometry.ts` by reading the typed BaHaMa builder catalog through the shared catalog lookup boundary.
- [x] Extracted the inventory ingest/runtime normalization logic from `src/views/InventoryManager.tsx` into the pure helper module `src/views/inventoryData.ts` so Firestore payloads, ClickitUp stock entries, and imported Excel rows share one typed normalization boundary.
- [x] Fixed the remaining visible mojibake in `src/services/quoteSaveService.ts`.
- [x] Extended focused regression coverage for:
  - raw sketch door/manual-pin/section-count normalization in `tests/sectionCalculator.test.js`
  - malformed Jumbrella preset parsing in `tests/parasolGeometry.test.js`
  - stored inventory payload and imported-row normalization in `tests/inventoryData.test.js`
  - TypeScript source-file encoding guards in `tests/textEncodingGuard.test.js`
- [x] Verified the sketch/inventory hardening slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/sectionCalculator.test.js tests/parasolGeometry.test.js tests/inventoryData.test.js tests/quoteSaveService.test.js tests/textEncodingGuard.test.js`

### 27. Small hardening slice: schema + repository write boundaries

- [x] Kept `src/store/quoteStateSchema.ts` in raw-record space during version migration so `migrateQuoteState` no longer needs quote-state double-casts before final hydration.
- [x] Replaced the remaining schema migration double-casts around cloned raw state with direct `UnknownRecord` flows built from the existing object guards.
- [x] Added explicit Firestore write-doc builders in `src/services/quoteRepository.ts` for:
  - revision documents
  - quote metadata documents
- [x] Replaced the remaining repository `as unknown as UnknownRecord` save paths in both the fallback write flow and transaction write flow with the dedicated raw write-doc builders.
- [x] Kept repository/runtime behavior unchanged for:
  - create-vs-revision saves
  - merge writes to quote metadata
  - fallback saves without `runTransaction`
  - stored revision/state/summary payload shapes
- [x] Extended regression coverage for:
  - persisted quote metadata/revision document shapes through the Firestore mock in `tests/quoteRepository.test.js`
- [x] Verified the schema/repository boundary slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/quoteStateSchema.test.js tests/quoteRepository.test.js`

### 28. Small hardening slice: quote-state normalization helpers

- [x] Tightened `src/store/quoteStateSchema.ts` with generic raw-record helpers so the remaining schema normalization paths no longer need quote-state-specific casts for:
  - persisted customer-info records
  - persisted sketch-meta records
  - persisted builder/grid raw rows
- [x] Added explicit normalizers for persisted quote-state subshapes where concrete runtime fields are already known:
  - ClickitUp stock entries in persisted inventory data
  - grid item selection maps
  - grid add-on state maps
- [x] Replaced the remaining quote-state-specific array/value clone casts in hydration and migration paths with typed helper flows for:
  - `customCosts`
  - `inventoryBasket`
  - `sketchDraft`
- [x] Kept quote-state hydration behavior unchanged for:
  - legacy state-version migration
  - conservative forward-version hydration
  - existing custom add-on normalization
  - persisted sketch draft preservation
- [x] Extended focused regression coverage in `tests/quoteStateSchema.test.js` for:
  - numeric ClickitUp stock normalization from persisted state
  - grid item/add-on map normalization from malformed persisted payloads
- [x] Verified the quote-state normalization-helper slice with:
  - `npm run typecheck`
  - `npm run test:confidence`
  - `npm run build`
  - `vitest run tests/quoteStateSchema.test.js`

## Remaining Work

### 1. Improve type quality inside already-migrated files

- [ ] Continue reducing permissive `unknown`-based payloads where stronger domain types are now safe and worthwhile.
- [ ] Continue shrinking remaining small service/helper boundary casts and snapshot-like adapters where concrete runtime shapes are already known.
- [ ] Continue tightening pure normalization helpers that still rely on ad hoc `Record<string, unknown>` shapes in sketch and inventory utilities.

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
     - selective `unknown` reduction in pure normalization helpers
     - remaining small utility/runtime boundary tightening beyond the CSV/activity-log/retailer cleanup
   - Why:
     - the migration itself is now complete for `src/`
     - the most concentrated remaining work is now in pure helper normalization code such as sketch/layout helpers and a few remaining inventory/runtime adapters, not in large app-surface migrations

## Definition of Done for the Migration

The app-source migration is complete when all of the following are true:

- [x] No `.js` or `.jsx` files remain under `src/`.
- [x] `typecheck` validates actual source files.
- [x] CI runs `npm run typecheck`.
- [x] No `// @ts-nocheck` files remain under `src/`.
- [x] Remaining `any` usage is deliberate and minimal rather than structural.
- [x] Main quote, admin, and sketch flows are all typechecked without escape hatches.
- [x] Backward compatibility for persisted quote/revision data is still intact after cleanup.

## Update Checklist For Future Slices

When a migration slice is completed, update this file with:

- the date
- the files moved out of `// @ts-nocheck`
- any new shared types added
- any user-visible text fixes made in the touched files
- the new remaining `// @ts-nocheck` count
- whether `typecheck`, `test:confidence`, and `build` passed
