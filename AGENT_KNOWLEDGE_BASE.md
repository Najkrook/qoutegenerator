# Agent Knowledge Base

This file exists to help future agents understand the actual `QuoteGenerator` project shape before editing anything substantial.

Last verified: `2026-04-21`
Active branch at verification: `main`

`QuoteGenerator` is a React SPA repository. All active runtime logic lives under `src/`. `README.md` is useful for human onboarding; this file is the deeper agent map for implementation work.

## Executive Snapshot

- Internal quote, inventory, sketch, planner, retailer-management, and activity-logging portal for BRIXX.
- Main frontend stack is React 19 + Vite 5 + Tailwind 4 + Firebase Auth/Firestore.
- App-source TypeScript migration for `src/` is complete.
- Runtime architecture is a single React SPA with state-driven view switching, not React Router.
- In-progress quote state is persisted in localStorage under `offertverktyg_state` through `src/store/QuoteContext.tsx` and `src/store/quoteStatePersistence.ts`.
- Persistent backend data lives in Firestore for quotes, revisions, templates, inventory, inventory logs, activity logs, planner projects, and retailers.
- Access control is UID-based and resolved in `src/config/accessControl.shared.ts`, with retailer access detected from Firestore during auth bootstrap.
- Retailer Workspace V1 is live: retailer users now see scope and discount guidance directly in dashboard, product-line selection, and pricing.
- Quote persistence and revisioning are centralized in `src/services/quoteRepository.ts`.
- Shared runtime/domain contracts live in `src/types/contracts.ts`.
- Shared runtime boundary helpers now live in `src/utils/runtime.ts`.
- CI in `.github/workflows/ci.yml` runs the safety script, clean-repo sanity check, `npm ci`, `npm run test:confidence`, `npm run typecheck`, and `npm run build`.
- Verified on `main`:
  - `npm run typecheck` passes
  - `npm run test:confidence` passes
  - full `vitest run` passes
  - `npm run build` passes

## Repo Topology

### `src/`
Primary active React runtime.

- `src/main.tsx` bootstraps the SPA and wraps `AuthProvider`, `QuoteProvider`, and the toast layer.
- `src/App.tsx` switches views using `state.step` and lazy-loads heavier routes.
- `src/store/` contains auth state, quote state, schema hydration, and localStorage persistence.
- `src/views/` contains the main feature surfaces.
- `src/components/` contains shared UI pieces, organized into `features/` (domain-specific widgets), `layout/` (shell and error boundary), and `modals/` (currently empty).
- `src/services/` contains Firebase/auth/repository/export/activity-log/template/retailer glue.
- `src/features/` contains PDF, Excel, legal-template re-exports, and sketch-export helpers.
- `src/config/` contains access control and built-in legal templates.
- `src/utils/` contains runtime helpers, sketch geometry/layout math, normalization, file-save utilities (`fileUtils.ts`), and input sanitization (`sanitize.ts`).
- `src/data/` contains catalog data and typed catalog lookup helpers.
- `src/types/` contains shared domain and interop contracts (`contracts.ts`) plus global Window augmentations (`global.d.ts`).

### `tests/`
Vitest coverage.

- `npm run test:confidence` runs the focused confidence suite used by CI.
- Full `vitest run` currently passes on `main`.
- Coverage includes access control, quote persistence/schema, calculations, exports, sketch helpers, retailer service, inventory normalization, activity logs, and UI smoke coverage.
- Tests remain JavaScript/JSX by choice; that is outside the completed app-source TypeScript migration scope.

### `scripts/`
Tooling and maintenance support.

- `scripts/verify-git-safety.ps1` enforces tracked-file safety.
- `scripts/backfill-quote-metadata.mjs` backfills quote metadata with Firebase Admin credentials.
- `scripts/clean_black_inventory.mjs` exists but is not central to the main runtime.
- `scripts/build_parasollkostnad.mjs` and the related Python helpers generate parasol cost data.

### `integrations/scrive-proxy/`
Reference or scaffold code.

- Not an active runtime dependency for the main app.
- Present as integration scaffolding only.

### `docs/`
Companion documentation.

- `docs/COPY_EDITING_GUIDE.md` covers encoding conventions, mojibake prevention, and the text-editing verification checklist. Read this before changing any user-facing Swedish copy.

### Root entry/build files

- `index.html` is the only active browser entry point.
- `vite.config.js` builds exclusively around `index.html`.
- `firebase.json` points Firestore rules at `firestore.rules`.
- `roadmap.md` contains the 6-month engineering roadmap with phased goals and cross-cutting dependencies. Read this for strategic context before proposing new features.

### Root-level legacy/dev-only files

The following root files are **not** part of the active runtime and should be ignored during normal development:

- `injector.js`, `injector2.js` — one-off injection scripts.
- `refactor.mjs`, `refactor2.mjs` — past refactoring helpers.
- `tester.js`, `tester2.js`, `test_calc.js`, `test_manual.mjs` — ad-hoc manual test scripts.
- `server.py`, `start_server.bat`, `start_tunnel.py` — local dev server/tunnel utilities.
- `cloudflared.exe` — Cloudflare tunnel binary.
- `_fix_canvas.cjs` — canvas polyfill workaround for test environments.

## Runtime Architecture

### React shell

- `src/main.tsx` wraps the app with `AuthProvider` and `QuoteProvider`.
- `src/App.tsx` renders views by `state.step`, not route paths.
- Numeric steps `1` through `4` represent the quote flow.
- String steps such as `inventory`, `inventory-logs`, `activity-logs`, `planner`, `retailers`, `sketch`, and `history` represent side branches.
- Heavier views are lazy-loaded in `App.tsx`:
  - `SummaryExport`
  - `InventoryManager`
  - `SketchTool`
  - `Planner`
  - `History`
  - `RetailerManager`

### Shared internal modules

- All active runtime logic is inside `src/`.
- Shared contracts in `src/types/contracts.ts` are the source of truth for app-domain types.
- Shared normalization/runtime boundary helpers in `src/utils/runtime.ts` are the first place to look for `unknown` handling, snapshot extraction, and small clone/error helpers.

### Service layers

- `src/services/firebase.ts` exports the installed Firebase SDK bindings used by the app.
- `src/services/authService.ts` wraps React-facing auth behavior.
- `src/services/quoteRepositoryClient.ts` injects the browser Firebase bindings into `src/services/quoteRepository.ts`.
- `src/services/quoteSaveService.ts` decides between quote creation and revision save.

### Direct answers for future agents

- If you change quote calculations, start in `src/services/calculationEngine.ts`.
- If you change save or revision behavior, start in `src/services/quoteRepository.ts`, then check `src/services/quoteSaveService.ts` and `src/services/quoteRepositoryClient.ts`.
- If you change runtime boundary handling, start in `src/utils/runtime.ts`.
- If you change inventory ingest/normalization, start in `src/views/inventoryData.ts`.
- If you change history hydration or reopen behavior, start in `src/views/historyPayload.ts`.
- If you change catalog-safe lookups, start in `src/data/catalogLookup.ts`.

## Main User Flows

### Dashboard

- Entry condition: `state.step === 0`.
- Access gate: authenticated users; cards shown based on `useAuth()` booleans.
- Main files:
  - `src/views/Dashboard.tsx`
  - `src/App.tsx`
- Persistence:
  - no dedicated dashboard document
  - admin dashboard reads recent `activity_logs`
- Behavior notes:
  - retailer users see a dedicated workspace variant instead of the generic quote-only dashboard
  - retailer workspace surfaces enabled product lines, per-line default discounts, and CTA access to new quotes and quote history
  - admin-only cards and the recent activity panel remain hidden from retailer users

### Product Line Selection

- Entry condition: `state.step === 1`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/ProductLineSelection.tsx`
  - `src/store/QuoteContext.tsx`
- Persistence:
  - localStorage via quote state
- Behavior notes:
  - retailer users see the full catalog, but only enabled product lines are selectable
  - disabled retailer lines are shown with explanatory copy instead of being silently filtered out
  - retailer selection is single-line only, and the selected line's configured discount is applied to `globalDiscountPct` when continuing

### Configuration

- Entry condition: `state.step === 2`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/Configuration.tsx`
  - `src/components/features/BuilderConfig.tsx`
  - `src/components/features/BuilderItem.tsx`
  - `src/components/features/GridConfig.tsx`
  - `src/components/features/CustomCosts.tsx`
  - `src/components/features/CustomerInfoForm.tsx`
- Behavior notes:
  - modifies `selectedLines`, `builderItems`, `gridSelections`, and related quote state
  - can branch back into the sketch tool

### Pricing

- Entry condition: `state.step === 3`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/Pricing.tsx`
  - `src/services/calculationEngine.ts`
  - `src/utils/gridAutoScale.ts`
- Behavior notes:
  - quote totals shown later in summary/export are derived from the calculation engine
  - grid auto-scale propagates quantity and discount behavior across grid add-ons
  - retailer users see a dedicated pricing info panel with selected line context and the configured default discount
  - global discount controls and row-level discounts are locked for retailer users
  - `CustomCosts` is still editable for retailer users in the current implementation

### Summary Export

- Entry condition: `state.step === 4`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/SummaryExport.tsx`
  - `src/services/quoteSaveService.ts`
  - `src/services/quoteRepositoryClient.ts`
  - `src/services/quoteRepository.ts`
  - `src/features/pdfExport.ts`
  - `src/features/pdfExportLayout.ts`
  - `src/features/excelExport.ts`
- Persistence:
  - localStorage for in-progress state
  - Firestore for saved quotes and revisions
- Notable dependencies:
  - computes summary with the calculation engine
  - templates and payment options flow through `src/components/features/TermsAndPaymentPanel.tsx`
  - saves trigger activity logging through `src/services/activityLogService.ts`

### Inventory Manager

- Entry condition: `state.step === 'inventory'`.
- Access gate: `canViewEverything`.
- Main files:
  - `src/views/InventoryManager.tsx`
  - `src/views/inventoryData.ts`
  - `src/components/features/InventoryTable.tsx`
  - `src/components/features/ClickitupStockGrid.tsx`
  - `src/components/features/PendingChangesPanel.tsx`
  - `src/components/features/InventoryItemModal.tsx`
  - `src/components/features/StockComparisonModal.tsx`
- Persistence:
  - localStorage mirrors working inventory state
  - Firestore persists `stock/main_inventory`
  - audit entries are written to `inventory_logs`
- Notable dependencies:
  - falls back to `/inventory_db.json` if Firestore load fails
  - uses `xlsx` to import BaHaMa inventory spreadsheets

### Inventory Logs

- Entry condition: `state.step === 'inventory-logs'`.
- Access gate: `canViewEverything`.
- Main files:
  - `src/views/InventoryLogs.tsx`
- Persistence:
  - Firestore collection `inventory_logs`

### Sketch Tool

- Entry condition: `state.step === 'sketch'`.
- Access gate: `canAccessSketch`.
- Main files:
  - `src/views/SketchTool.tsx`
  - `src/utils/sectionCalculator.ts`
  - `src/utils/parasolGeometry.ts`
  - `src/components/features/SketchCanvas.tsx`
  - `src/components/features/SketchConfig.tsx`
  - `src/components/features/SketchBom.tsx`
- Persistence:
  - sketch draft and workspace are stored in quote state, then persisted to localStorage
- Behavior notes:
  - can export generated ClickitUp sections and parasol-derived builder items back into quote state
  - export-to-quote is gated by `canExportSketchToQuote`, effectively admin-only

### Planner

- Entry condition: `state.step === 'planner'`.
- Access gate: `canViewEverything`.
- Main file:
  - `src/views/Planner.tsx`
- Persistence:
  - Firestore root collection `planner_projects`

### Quote History

- Entry condition: `state.step === 'history'`.
- Access gate: `canAccessQuoteHistory`.
- Main files:
  - `src/views/History.tsx`
  - `src/views/historyPayload.ts`
  - `src/services/quoteRepository.ts`
- Behavior notes:
  - can open the latest revision or specific older revisions
  - admin users can browse across owners via collection-group-backed repository reads

### Activity Logs

- Entry condition: `state.step === 'activity-logs'`.
- Access gate: `canViewEverything`.
- Main files:
  - `src/views/ActivityLogs.tsx`
  - `src/services/activityLogService.ts`
  - `src/services/notificationService.ts`
- Persistence:
  - Firestore collection `activity_logs`

### Retailer Manager

- Entry condition: `state.step === 'retailers'`.
- Access gate: `canViewEverything`.
- Main files:
  - `src/views/RetailerManager.tsx`
  - `src/services/retailerService.ts`
  - `src/services/authService.ts`
- Persistence:
  - Firestore collection `retailers`
- Behavior notes:
  - retailers are linked to Firebase Auth via `createRetailerAuthUser()`
  - CRUD operations are logged through `src/services/activityLogService.ts`
  - retailer product-line discounts and enablement live in Firestore

## Authentication And Access Control

### Core React access model

- `src/store/AuthContext.tsx` listens to auth state changes and derives `accessLevel`.
- `src/config/accessControl.shared.ts` is the source of truth for role resolution and step authorization.
- On login, `AuthContext` queries the `retailers` collection by email to detect retailer users.

Roles:

- `guest`
- `full`
- `quote-only`
- `sketch-only`
- `retailer`

Permission booleans exposed by `useAuth()`:

- `canViewEverything`
- `canStartQuote`
- `canAccessSketch`
- `canAccessQuoteHistory`
- `canExportSketchToQuote`

Additional values exposed by `useAuth()`:

- `retailer`
- `isRetailer`
- `login`
- `logout`

### App-level enforcement

- `src/App.tsx` sanitizes step transitions through `getAuthorizedStepForAccess()` in `src/config/accessControl.shared.ts`.
- Full-access-only views are `inventory`, `inventory-logs`, `activity-logs`, `planner`, and `retailers`.
- Quote-flow numeric steps require `canStartQuote`.
- `sketch` requires `canAccessSketch`.
- `history` requires `canAccessQuoteHistory`.

### Operational implication

If you change roles or access expectations:

- update `src/config/accessControl.shared.ts`
- review `src/store/AuthContext.tsx`
- review `src/App.tsx`, `src/components/layout/Header.tsx`, and `src/views/History.tsx`
- if the change involves retailers, also review `src/services/retailerService.ts` and `src/views/RetailerManager.tsx`
- keep `ADMIN_UIDS` synchronized with `firestore.rules`

Current retailer reality:

- retailer users are identified by auth-email match against the `retailers` collection during auth bootstrap
- retailer users have access to the quote flow and quote history
- retailer users do not have access to admin views or the sketch tool
- retailer users currently see locked global/rad-level discount controls, but `CustomCosts` remains editable
- retailer users can still save and export from step 4 in the current implementation

## State Model And Persistence

`src/store/QuoteContext.tsx` is the main state container for the React app.

### Storage

- localStorage key: `offertverktyg_state`
- state schema and initial defaults live in `src/store/quoteStateSchema.ts`
- persistence helpers live in `src/store/quoteStatePersistence.ts`

### Main state domains

- quote flow step and selected product lines
- builder items and grid selections
- custom costs, VAT, discounts, exchange rate, and prior discount baseline
- customer info and PDF/export-related fields
- inventory data and cloud inventory baseline
- sketch draft and sketch metadata
- inventory basket
- active quote ID and version
- quote status and Scrive metadata
- legal-template/payment/signature toggles and validity/payment days
- `hideZeroDiscountReferencesInPdf`

### Reducer and reset behavior

- reducer lives in `src/store/QuoteContext.tsx`
- `HYDRATE_STATE` routes all incoming persisted/history data through `hydrateQuoteState()`
- `RESET_STATE` restores initial defaults from `createInitialQuoteState()`

### Operational implication

Quote-state changes are backward-compatibility-sensitive because the same state shape is used by:

- localStorage persistence
- quote save/revision snapshots
- history-page rehydration
- sketch-to-quote and export flows

## Quote Persistence And Data Model

The authoritative quote repository is `src/services/quoteRepository.ts`.

### Firestore layout

- Quotes: `users/{uid}/quotes/{quoteId}`
- Revisions: `users/{uid}/quotes/{quoteId}/revisions/{revisionId}`
- Templates: `users/{uid}/templates/{templateId}`

### Save flow

1. `src/views/SummaryExport.tsx` computes quote totals.
2. `src/services/quoteSaveService.ts` decides between create and revision save.
3. `src/services/quoteRepositoryClient.ts` injects browser Firebase functions into the repository.
4. `src/services/quoteRepository.ts` persists quote metadata and revision snapshots.

### Metadata stored on quotes

- customer name
- company
- reference
- customer reference
- total amount
- status
- created and updated timestamps
- latest version
- latest revision ID
- saved-by metadata
- Scrive metadata
- `searchText`
- `retailerName`

### Lifecycle status values

Quote statuses:

- `draft`
- `sent`
- `won`
- `lost`
- `archived`

Scrive statuses:

- `not_sent`
- `preparation`
- `pending`
- `closed`
- `rejected`
- `canceled`
- `timedout`
- `failed`

## Templates, Export, And Feature Flags

### Built-in and custom templates

- Built-in legal templates live in `src/config/legalTemplates.shared.ts`.
- Custom templates are stored under `users/{uid}/templates/{templateId}`.
- `src/services/templateService.ts` owns template reads/writes.
- `src/components/features/TermsAndPaymentPanel.tsx` is the main template/payment/signature UI.

### Export modules

- PDF entry: `src/features/pdfExport.ts`
- PDF layout helpers: `src/features/pdfExportLayout.ts`
- Excel entry: `src/features/excelExport.ts`
- Shared export totals/builders: `src/services/exportDataBuilders.ts`

### Feature flags

- Quote lifecycle: `window.FEATURE_QUOTE_LIFECYCLE !== false`
- PDF legal templates: `window.FEATURE_PDF_LEGAL_TEMPLATES !== false`

## Firestore Rules And Security Reality

`firestore.rules` currently allow:

- quote documents for the signed-in owner or admins
- quote revision documents for the signed-in owner or admins
- `stock/{docId}` for admins
- `inventory_logs/{logId}` for admins
- `activity_logs/{logId}` with admin read and signed-in self-authenticated create
- `users/{userId}/templates/{templateId}` for the signed-in owner
- `planner_projects/{projectId}` for admins
- `retailers/{retailerId}` for admins, plus self-read by matching auth email
- admin collection-group reads for `templates`
- admin collection-group reads for `quotes`

### Current mismatches / caution

- Any new feature that writes to a new collection must be reflected in Firestore rules.
- Admin UIDs are hardcoded in both `firestore.rules` and `src/config/accessControl.shared.ts` and must stay synchronized.

## Tooling, Scripts, And CI

### Local commands

- `npm ci`
- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test:confidence`
- `npm run test:run`
- `vitest run`

### PowerShell caveat

If `npm.ps1` is blocked by execution policy, use `cmd /c npm ...` or invoke Node directly.

### Scripts

- `scripts/verify-git-safety.ps1`
- `scripts/backfill-quote-metadata.mjs`
- `scripts/clean_black_inventory.mjs`
- `scripts/build_parasollkostnad.mjs`
- `scripts/build_parasollkostnad_excel.py`
- `scripts/patch_parasollkostnad_current_workbook.py`

### CI

- Workflow: `.github/workflows/ci.yml`
- Runs:
  - tracked-file safety check
  - clean-repo sanity check
  - `npm ci`
  - `npm run test:confidence`
  - `npm run typecheck`
  - `npm run build`

## Known Issues And Repo Traps

- Vite still warns about large chunks in production builds, especially `export-tools`.
- `vite.config.js` manually groups:
  - `export-tools`
  - `firebase`
  - `react-vendor`
- Quote-state schema changes are high-risk because they affect local persistence, saved revisions, and history rehydration together.
- Firestore collection changes must be paired with rule updates.
- Optional post-migration follow-up work remains non-blocking:
  - compiler strictness hardening
  - tests/scripts/tooling TypeScript migration
  - bundle/performance follow-up

## Where To Edit

### Change quote totals or calculation logic

Start with:

- `src/services/calculationEngine.ts`
- `src/utils/gridAutoScale.ts`
- `src/components/features/PricingTable.tsx`
- `src/components/features/GridConfig.tsx`
- `src/components/features/FinalSummaryTable.tsx`
- `src/views/SummaryExport.tsx`
- `src/data/catalog.ts`
- `src/data/catalogLookup.ts`

### Change configuration UI or builder items

Start with:

- `src/views/Configuration.tsx`
- `src/components/features/BuilderConfig.tsx`
- `src/components/features/BuilderItem.tsx`
- `src/components/features/GridConfig.tsx`
- `src/components/features/CustomCosts.tsx`
- `src/components/features/CustomerInfoForm.tsx`
- `src/data/catalog.ts`

### Change quote save or revision behavior

Start with:

- `src/services/quoteRepository.ts`
- `src/services/quoteSaveService.ts`
- `src/services/quoteRepositoryClient.ts`
- `src/views/History.tsx`
- `src/views/historyPayload.ts`
- `src/services/activityLogService.ts`

### Change PDF or Excel export output

Start with:

- `src/features/pdfExport.ts`
- `src/features/pdfExportLayout.ts`
- `src/features/excelExport.ts`
- `src/services/exportDataBuilders.ts`
- `src/views/SummaryExport.tsx`
- `src/components/features/TermsAndPaymentPanel.tsx`

### Change access roles or permissions

Start with:

- `src/config/accessControl.shared.ts`
- `src/App.tsx`
- `src/store/AuthContext.tsx`
- `src/components/layout/Header.tsx`
- `src/views/History.tsx`
- `src/services/retailerService.ts`
- `src/views/RetailerManager.tsx`
- `firestore.rules`

### Change runtime-boundary handling

Start with:

- `src/utils/runtime.ts`
- `src/types/contracts.ts`
- the feature-specific caller you are tightening

### Change legal templates or terms behavior

Start with:

- `src/config/legalTemplates.shared.ts`
- `src/components/features/TermsAndPaymentPanel.tsx`
- `src/services/templateService.ts`
- `src/features/pdfExport.ts`

### Change sketch layout behavior

Start with:

- `src/views/SketchTool.tsx`
- `src/utils/sectionCalculator.ts`
- `src/utils/parasolGeometry.ts`
- `src/components/features/SketchCanvas.tsx`
- `src/components/features/SketchConfig.tsx`
- `src/features/sketchExportState.ts`

### Change inventory sync or ingest behavior

Start with:

- `src/views/InventoryManager.tsx`
- `src/views/inventoryData.ts`
- `src/utils/csvNormalizer.ts`
- `src/views/InventoryLogs.tsx`
- `src/components/features/InventoryTable.tsx`
- `src/components/features/InventoryItemModal.tsx`
- `src/components/features/StockComparisonModal.tsx`
- `src/components/features/PendingChangesPanel.tsx`
- `firestore.rules`

### Change quote history behavior

Start with:

- `src/views/History.tsx`
- `src/views/historyPayload.ts`
- `src/App.tsx`
- `src/components/layout/Header.tsx`
- `src/services/quoteRepository.ts`

### Change login or auth redirect behavior

Start with:

- `src/views/Login.tsx`
- `src/App.tsx`
- `src/store/AuthContext.tsx`
- `src/services/authService.ts`

### Change planner behavior

Start with:

- `src/views/Planner.tsx`
- `src/views/Dashboard.tsx`
- `src/App.tsx`
- `firestore.rules`

### Change error boundary or crash-recovery behavior

Start with:

- `src/components/layout/ErrorBoundary.tsx`
- `src/App.tsx`

### Change retailer management

Start with:

- `src/views/Dashboard.tsx`
- `src/views/ProductLineSelection.tsx`
- `src/views/Pricing.tsx`
- `src/views/RetailerManager.tsx`
- `src/services/retailerService.ts`
- `src/services/authService.ts`
- `src/store/AuthContext.tsx`
- `src/config/accessControl.shared.ts`
- `firestore.rules`

## Recommended First Read Order

If you are new to the repo, read these files in order:

1. `README.md`
2. `src/App.tsx`
3. `src/types/contracts.ts`
4. `src/store/AuthContext.tsx`
5. `src/store/QuoteContext.tsx`
6. `src/store/quoteStateSchema.ts`
7. `src/services/quoteRepository.ts`
8. `src/views/SummaryExport.tsx`
9. `src/config/accessControl.shared.ts`
10. `firestore.rules`
11. `vite.config.js`
12. `docs/COPY_EDITING_GUIDE.md`
13. `roadmap.md`

## Validation Expectations For Future Changes

- Run the narrowest relevant tests first, then expand to broader validation if the change touches shared flows.
- If you touch quote persistence or quote-state schema, test both save behavior and history rehydration.
- If you touch Firestore collections, update rules and access expectations together.
- If you touch strings or docs, run `tests/textEncodingGuard.test.js`.
- If you touch entrypoints or build behavior, check `vite.config.js` chunking and lazy-loaded view boundaries.
- Before push, run `scripts/verify-git-safety.ps1`.
