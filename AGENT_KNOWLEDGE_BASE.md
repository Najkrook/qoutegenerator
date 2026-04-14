# Agent Knowledge Base

This file exists to help future agents understand the actual `QuoteGenerator` project shape before editing anything substantial.

Last verified: `2026-04-14`

`QuoteGenerator` is a React SPA repository. All active runtime logic lives under `src/`. `README.md` is useful for human onboarding; this file is the deeper agent map.

## Executive Snapshot
- Internal quote, inventory, sketch, planner, retailer management, and activity logging portal for BRIXX.
- Main frontend stack is React 19 + Vite 5 + Tailwind 4 + Firebase Auth/Firestore.
- Runtime architecture is a unified React Single Page Application (SPA).
- In-progress quote state is persisted in localStorage under `offertverktyg_state` through `src/store/QuoteContext.jsx` and `src/store/quoteStatePersistence.js`.
- Persistent backend data lives in Firestore for quotes, revisions, templates, inventory, inventory logs, activity logs, and retailers.
- Access control is UID-based and resolved in `src/config/accessControl.shared.js`.
- Quote persistence and revisioning are centralized in `src/services/quoteRepository.js`.
- Current fast-confidence workflow centers on `npm run test:confidence` plus `npm run build`.
- A normal full-suite `npm run test:run` was not re-verified in this sandbox because plain `vitest run` still hit a local `spawn EPERM`.
- CI exists in `.github/workflows/ci.yml` and now runs explicit install, fast-confidence tests, and build steps.
- Planner uses the root `planner_projects` collection, and `firestore.rules` currently allow admin read/write access to it.

## Repo Topology

### `src/`
Primary active React runtime.

- `src/main.jsx` bootstraps the app.
- `src/App.jsx` switches views using `state.step`.
- `src/store/` contains `AuthProvider` and `QuoteProvider`.
- `src/views/` contains the main React feature surfaces.
- `src/components/` contains the React UI pieces.
- `src/services/` contains React-facing Firebase/auth/template/save/retailer/activity-log glue.
- `src/features/` contains export modules (PDF, Excel, sketch export state).
- `src/config/` contains shared access control and legal template definitions.
- `src/utils/` contains sketch geometry, grid auto-scale, and client helpers.
- `src/data/` contains catalog data.



### `tests/`
Vitest coverage.

- Covers calculations, repository behavior, export builders, PDF behavior, quote save flow, text encoding guardrails, retailer service, activity log service, grid auto-scale, quote state schema, and UI smoke coverage.
- `npm run test:confidence` runs 10 targeted test files; `npm run test:run` runs the full suite.
- Test coverage exists, but the full-suite baseline is not guaranteed green.

### `scripts/`
Tooling and maintenance support.

- `scripts/verify-git-safety.ps1` enforces tracked-file safety.
- `scripts/backfill-quote-metadata.mjs` backfills quote metadata with Firebase Admin credentials.
- `scripts/clean_black_inventory.mjs` exists but is not central to the main runtime.
- `scripts/build_parasollkostnad.mjs` and related Python scripts generate parasol cost data.

### `integrations/scrive-proxy/`
Reference or scaffold code.

- Not an active runtime dependency for the main app.
- Present as integration scaffolding only.

### `styles/`
Support for root HTML pages and older DOM-driven surfaces.

- `styles/` has been removed as it was only relevant to legacy HTML entry points.

### Root HTML files
- `index.html` is the only active entry point, serving the React Single Page Application.
- Older legacy entry points (`index_legacy.html`, `login.html`, `history.html`, `inventory-logs.html`) have been removed.

## Active Entry Points and Build Inputs
`vite.config.js` defines a single robust build around `index.html`.

Operational notes:

- `vite.config.js` builds exclusively `index.html`.
- Export-related dependencies are loaded through npm/Vite modules rather than CDN script tags.

## Runtime Architecture
The codebase completes the migration to a modern, separated React architecture.

### React shell
- `src/main.jsx` wraps the app with `AuthProvider` and `QuoteProvider`.
- `src/App.jsx` renders views by `state.step`, not React Router.
- Numeric steps `1` through `4` represent the quote flow.
- String steps such as `inventory`, `sketch`, `planner`, `history`, `activity-logs`, `inventory-logs`, and `retailers` represent side branches.

### Shared internal modules
- All internal module dependencies are contained within `src/` (e.g., `src/features/` and `src/services/`).

### Service layers
- The application relies on `src/services/firebase.js` using the installed Firebase package.
- `src/services/authService.js` is the React auth wrapper and acts as the sole authentication mechanism for the dashboard and quote routes.

### Direct answers for future agents
- If you change quote calculations, start in `src/services/calculationEngine.js`.
- If you change save or revision behavior, start in `src/services/quoteRepository.js`, then check `src/services/quoteSaveService.js` and `src/services/quoteRepositoryClient.js`.
- This project uses a state-driven view-switching architecture inside the single React SPA. `src/App.jsx` dynamically renders `Login`, `Quote History`, `Inventory Logs`, `Activity Logs`, and `Retailer Manager` alongside other dashboard/quote flows.

## Main User Flows

### Dashboard
- Entry condition: `state.step === 0`.
- Access gate: authenticated users; cards shown based on `useAuth()` booleans.
- Main files:
  - `src/views/Dashboard.jsx`
  - `src/App.jsx`
- Persistence:
  - No dedicated Firestore object for the dashboard itself.
  - Admin dashboard fetches recent `activity_logs` (not `inventory_logs`).
- Notable dependencies:
  - `src/services/firebase.js`
  - `src/services/activityLogService.js`
  - access booleans from `src/store/AuthContext.jsx`

### Product Line Selection
- Entry condition: `state.step === 1`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/ProductLineSelection.jsx`
  - `src/store/QuoteContext.jsx`
- Persistence:
  - localStorage via `QuoteContext`.
- Notable dependencies:
  - selected product lines feed later config/pricing/export steps.

### Configuration
- Entry condition: `state.step === 2`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/Configuration.jsx`
- Persistence:
  - localStorage via `QuoteContext`.
- Notable dependencies:
  - can branch back into the sketch tool.
  - modifies `selectedLines`, `builderItems`, `gridSelections`, and related state.

### Pricing
- Entry condition: `state.step === 3`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/Pricing.jsx`
  - `src/services/calculationEngine.js`
  - `src/utils/gridAutoScale.js`
- Persistence:
  - localStorage via `QuoteContext`.
- Notable dependencies:
  - quote totals shown later in summary/export are derived from the calculation engine.
  - grid auto-scale logic propagates discount and quantity changes across addons and custom items.

### Summary Export
- Entry condition: `state.step === 4`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/SummaryExport.jsx`
  - `src/services/quoteSaveService.js`
  - `src/services/quoteRepositoryClient.js`
  - `src/services/quoteRepository.js`
  - `src/features/pdfExport.js`
  - `src/features/pdfExportLayout.js`
  - `src/features/excelExport.js`
- Persistence:
  - localStorage for in-progress state.
  - Firestore for saved quotes and revisions.
- Notable dependencies:
  - computes summary with the calculation engine.
  - templates and payment options come from `TermsAndPaymentPanel.jsx`.
  - PDF preview is regenerated client-side as state changes.
  - saves trigger activity logging via `activityLogService.js`.

### Inventory Manager
- Entry condition: `state.step === 'inventory'`.
- Access gate: `canViewEverything`.
- Main files:
  - `src/views/InventoryManager.jsx`
  - `src/components/features/InventoryTable.jsx`
  - `src/components/features/ClickitupStockGrid.jsx`
  - `src/components/features/PendingChangesPanel.jsx`
- Persistence:
  - localStorage mirrors working inventory state.
  - Firestore persists `stock/main_inventory` and audit logs in `inventory_logs`.
- Notable dependencies:
  - falls back to `/inventory_db.json` if Firestore load fails.
  - uses `xlsx` to import Bahama inventory spreadsheets.

### Sketch Tool
- Entry condition: `state.step === 'sketch'`.
- Access gate: `canAccessSketch`.
- Main files:
  - `src/views/SketchTool.jsx`
  - `src/utils/sectionCalculator.js`
  - `src/utils/parasolGeometry.js`
  - `src/components/features/SketchCanvas.jsx`
  - `src/components/features/SketchConfig.jsx`
  - `src/components/features/SketchBom.jsx`
- Persistence:
  - sketch draft and workspace are stored in `QuoteContext`, then persisted to localStorage.
- Notable dependencies:
  - can export generated ClickitUp sections and parasol-derived builder items back into quote state.
  - export-to-quote is effectively admin-only through `canExportSketchToQuote`.

### Planner
- Entry condition: `state.step === 'planner'`.
- Access gate: `canViewEverything`.
- Main files:
  - `src/views/Planner.jsx`
  - `src/App.jsx`
  - `src/views/Dashboard.jsx`
- Persistence:
  - Firestore root collection `planner_projects` (not per-user).
- Notable dependencies:
  - live in the UI with matching admin-only Firestore rules.

### Activity Logs
- Entry condition: `state.step === 'activity-logs'`.
- Access gate: `canViewEverything`.
- Main files:
  - `src/views/ActivityLogs.jsx`
  - `src/services/activityLogService.js`
  - `src/services/notificationService.js`
- Persistence:
  - Firestore collection `activity_logs`.
- Notable dependencies:
  - client-side filtering and cursor-based paging over Firestore batches.
  - activity events are written by quote save, sketch export, and retailer CRUD operations.

### Retailer Manager
- Entry condition: `state.step === 'retailers'`.
- Access gate: `canViewEverything`.
- Main files:
  - `src/views/RetailerManager.jsx`
  - `src/services/retailerService.js`
  - `src/services/authService.js`
- Persistence:
  - Firestore collection `retailers`.
- Notable dependencies:
  - retailers are linked to Firebase Auth users via `createRetailerAuthUser()`, which uses a secondary Firebase app to avoid signing out the current admin.
  - each retailer has per-product-line enable/disable and discount configuration.
  - CRUD operations are logged via `activityLogService.js`.
  - on login, `AuthContext.jsx` queries the `retailers` collection to detect retailer users and set the `retailer` access level.

## Authentication and Access Control

### Core React access model
- `src/store/AuthContext.jsx` listens to auth state changes and derives `accessLevel`.
- `src/config/accessControl.shared.js` is the source of truth for role resolution.
- On login, `AuthContext` also queries the `retailers` Firestore collection to detect retailer users.

Roles:
- `guest`
- `full`
- `quote-only`
- `sketch-only`
- `retailer` — linked to a document in the `retailers` collection by email

Permission booleans exposed by `useAuth()`:
- `canViewEverything`
- `canStartQuote`
- `canAccessSketch`
- `canAccessQuoteHistory`
- `canExportSketchToQuote`

Additional values exposed by `useAuth()`:
- `retailer` — the retailer document if the user is a retailer, else `null`
- `isRetailer` — boolean shortcut for `accessLevel === 'retailer'`
- `login`, `logout` — auth functions

### App-level enforcement
- `src/App.jsx` sanitizes step transitions through `getAuthorizedStepForAccess()` in `src/config/accessControl.shared.js`.
- Full-access-only views are `inventory`, `inventory-logs`, `activity-logs`, `planner`, and `retailers`.
- Quote-flow numeric steps require `canStartQuote` (granted to `full`, `quote-only`, and `retailer`).
- `sketch` requires `canAccessSketch`.
- `history` is allowed for `full`, `quote-only`, and `retailer`.

### Operational implication
If you change roles or access expectations:
- update `src/config/accessControl.shared.js`
- review `src/store/AuthContext.jsx`
- review `src/App.jsx`, `src/components/layout/Header.jsx`, and `src/views/History.jsx`
- if the change involves retailers, also review `src/services/retailerService.js` and `src/views/RetailerManager.jsx`

## State Model and Persistence
`src/store/QuoteContext.jsx` is the main state container for the React app.

### Storage
- localStorage key: `offertverktyg_state`
- state is loaded from localStorage on boot
- state is written back on every change

### Main state domains
- quote flow step and selected product lines
- builder items and grid selections (including `customItems` and `customAddonsByCategory` per line)
- custom costs, VAT, discounts, exchange rate, previous global discount
- customer info (including `extraNotes` for PDF export)
- inventory data and cloud inventory baseline
- sketch draft and sketch metadata
- inventory basket
- active quote ID and version
- quote status
- terms, template selection, payment box, signature block, validity/payment days
- `hideZeroDiscountReferencesInPdf`
- Scrive-related metadata

### Reducer and reset behavior
- The reducer lives in `src/store/QuoteContext.jsx`.
- `RESET_STATE` restores initial defaults.
- PDF-related defaults are normalized through helper functions in the same file.

### History-page rehydration flow
- `src/views/History.jsx` loads quote revisions from Firestore through `quoteRepository`.
- Opening a saved quote dispatches `HYDRATE_STATE` in the SPA and returns the user to quote step `1`.
- Quote-history hydration therefore shares the same schema and reducer path as normal in-app state restores.

### Operational implication
The React app, history page, and some older flows depend on the same serialized state shape. Schema changes to quote state should be treated as cross-cutting and backward-compatibility-sensitive.

## Quote Persistence and Data Model
The authoritative quote repository is `src/services/quoteRepository.js`.

### Firestore layout
- Quotes: `users/{uid}/quotes/{quoteId}`
- Revisions: `users/{uid}/quotes/{quoteId}/revisions/{revisionId}`

### Save flow
1. `src/views/SummaryExport.jsx` computes quote totals.
2. `src/services/quoteSaveService.js` decides between create and revision save.
3. `src/services/quoteRepositoryClient.js` injects React-side Firestore functions into the repository.
4. `src/services/quoteRepository.js` persists quote metadata and revision snapshots.

### Metadata stored on quotes
- customer name
- company
- reference
- total amount
- status
- created and updated timestamps
- latest version
- latest revision ID
- saved-by metadata
- Scrive metadata
- `searchText` for filtering
- `retailerName` (if saved by a retailer user)

### Revision behavior
- Each revision stores a full state snapshot plus summary data.
- If transactions are unavailable, the repository falls back to a non-transactional save path.
- `src/views/History.jsx` can open the latest revision or fetch older revisions.

### Lifecycle status values
Quote statuses in `src/services/quoteRepository.js`:
- `draft`
- `sent`
- `won`
- `lost`
- `archived`

Scrive statuses in `src/services/quoteRepository.js`:
- `not_sent`
- `preparation`
- `pending`
- `closed`
- `rejected`
- `canceled`
- `timedout`
- `failed`

### Admin quote browsing
- Admins can browse all users' quotes via `collectionGroup` queries using `getAllUsersQuotes()` in `src/services/quoteRepository.js`.
- `src/views/History.jsx` supports a user-selection dropdown for admins to switch between their own quotes and other users' quotes.
- Firestore rules include a `/{path=**}/quotes/{quoteId}` admin read rule to support this.

## Templates, PDF Terms, and Feature Flags

### Built-in and custom templates
- Built-in legal templates live in `src/config/legalTemplates.shared.js`.
- Custom templates are stored under `users/{uid}/templates/{templateId}`.
- Admins can fetch all templates using `collectionGroup` reads via `src/services/templateService.js`.

### Main UI
- `src/components/features/TermsAndPaymentPanel.jsx` is the central UI for:
  - selecting a built-in template
  - loading custom templates
  - saving templates
  - deleting templates
  - toggling payment box and signature block
  - editing terms text

### Feature flags
- Quote lifecycle: `window.FEATURE_QUOTE_LIFECYCLE !== false`
- PDF legal templates: `window.FEATURE_PDF_LEGAL_TEMPLATES !== false`

### Cross-cutting caveat
Legal-template behavior affects both modern and older export paths. Template or PDF-terms changes should be treated as cross-cutting, not isolated to one React component.

## Inventory, Logs, Sketch, and Planner

### Inventory
- Main React UI: `src/views/InventoryManager.jsx`
- Main inventory document: `stock/main_inventory`
- Audit log collection: `inventory_logs`
- Local fallback: `/inventory_db.json`
- Spreadsheet import uses the `xlsx` dependency

Behavior notes:
- Inventory state is staged locally before commit.
- Commit writes both inventory and generated audit logs in a batch.
- The dashboard reads recent `activity_logs` for admins (via `activityLogService.js`).

### Inventory Logs Page
- Main React UI: `src/views/InventoryLogs.jsx`
- Access: full-access only
- Behavior: client-side filtering and paging over Firestore batches

### Sketch Tool
- Main React UI: `src/views/SketchTool.jsx`
- Layout math: `src/utils/sectionCalculator.js`
- Parasol logic: `src/utils/parasolGeometry.js`
- Export behavior: generated sections and parasol-derived builder rows are pushed back into quote state
- Export permission: gated by `canExportSketchToQuote`, effectively admin-only

### Planner
- Main React UI: `src/views/Planner.jsx`
- Collection path: `planner_projects`
- UI access gate: admin-only branch from the dashboard
- Status: live in the UI with matching admin-only Firestore rules

## Firestore Rules and Security Reality
`firestore.rules` currently allow:

- quote documents under `users/{uid}/quotes/{quoteId}` for the signed-in owner **or admin**
- quote revisions under `users/{uid}/quotes/{quoteId}/revisions/{revisionId}` for the signed-in owner **or admin**
- template documents under `users/{uid}/templates/{templateId}` for the signed-in owner
- `stock/{docId}` for admins
- `inventory_logs/{logId}` for admins
- `activity_logs/{logId}` — admin read; any signed-in user can create (with schema validation on required fields)
- `planner_projects/{projectId}` for admins
- `retailers/{retailerId}` — admin read/write; signed-in users can read their own retailer document (matched by email)
- admin reads of `templates` through collection-group queries
- admin reads of `quotes` through collection-group queries (for admin quote browsing)
- deny-all fallback for everything else

### Current mismatches / caution
- Any new feature that writes to a new collection must be reflected in Firestore rules.
- Admin UIDs are hardcoded in both `firestore.rules` and `src/config/accessControl.shared.js` and must stay synchronized.

## Tooling, Scripts, and CI

### Local commands
- `npm ci`
- `npm run dev`
- `npm run build`
- `npm run test:confidence`
- `npm run test:run`

### PowerShell caveat
If `npm.ps1` is blocked by execution policy, use:

- `cmd /c npm ci`
- `cmd /c npm run dev`
- `cmd /c npm run test:confidence`
- `cmd /c npm run test:run`

### Scripts
- `scripts/verify-git-safety.ps1`
  - fails if blocked sensitive or local-only files are tracked
- `scripts/backfill-quote-metadata.mjs`
  - backfills legacy quote metadata
  - requires Firebase Admin credentials
- `scripts/clean_black_inventory.mjs`
  - present, but not central to the app runtime
- `scripts/build_parasollkostnad.mjs`
  - generates parasol cost data
- `scripts/build_parasollkostnad_excel.py` and `scripts/patch_parasollkostnad_current_workbook.py`
  - Python helpers for parasol cost Excel files

### CI
- Workflow: `.github/workflows/ci.yml`
- Runs:
  - tracked-file safety check
  - clean-repo sanity check
  - `npm ci`
  - `npm run test:confidence`
  - `npm run build`

CI is explicit and matches the recommended local confidence workflow.

### Build output
- `dist/` exists in the repo right now.
- Treat `dist/` as build output, not source-of-truth implementation.

## Known Issues and Repo Traps
- Full-suite status is not re-verified in this pass: focused sketch/export tests and `vite build` passed, but a normal `vitest run` hit sandbox `spawn EPERM`.
- Previous `exportDataBuilders.test.js` drift notes require fresh confirmation before action; do not assume that exact test failure is still current without rerunning the full suite outside this sandbox.
- CI implication: use `.github/workflows/ci.yml` and the local `test:confidence` + `build` pair as the default verification baseline.
- Encoding or mojibake risk: some files visibly contain corrupted Swedish text or symbols.
- Known mojibake examples include:
  - `src/config/legalTemplates.shared.js`
  - `src/views/Dashboard.jsx`
  - `src/views/Planner.jsx`
  - `src/views/InventoryManager.jsx`
  - `src/views/SketchTool.jsx`
  - `src/services/quoteSaveService.js`
- `tests/textEncodingGuard.test.js` exists, but it does not catch every visibly broken encoding pattern in the repo.
- Lazy-load trap: large view imports and export modules affect the code-splitting strategy, not just local component behavior.

## Where To Edit

### Change quote totals or calculation logic
Start with:
- `src/services/calculationEngine.js`
- `src/utils/gridAutoScale.js`
- `src/components/features/PricingTable.jsx`
- `src/components/features/GridConfig.jsx`
- `src/components/features/FinalSummaryTable.jsx`
- `src/views/SummaryExport.jsx`
- `src/data/catalog.js`

### Change quote save or revision behavior
Start with:
- `src/services/quoteRepository.js`
- `src/services/quoteSaveService.js`
- `src/services/quoteRepositoryClient.js`
- `src/views/History.jsx`
- `src/services/activityLogService.js`

### Change PDF or Excel export output
Start with:
- `src/features/pdfExport.js`
- `src/features/pdfExportLayout.js`
- `src/features/excelExport.js`
- `src/services/exportDataBuilders.js`
- `src/views/SummaryExport.jsx`
- `src/components/features/TermsAndPaymentPanel.jsx`

### Change access roles or permissions
Start with:
- `src/config/accessControl.shared.js`
- `src/App.jsx`
- `src/store/AuthContext.jsx`
- `src/components/layout/Header.jsx`
- `src/views/History.jsx`
- `src/services/retailerService.js`
- `src/views/RetailerManager.jsx`

### Change legal templates or terms behavior
Start with:
- `src/config/legalTemplates.shared.js`
- `src/components/features/TermsAndPaymentPanel.jsx`
- `src/services/templateService.js`
- `src/features/pdfExport.js`

### Change sketch layout behavior
Start with:
- `src/views/SketchTool.jsx`
- `src/utils/sectionCalculator.js`
- `src/utils/parasolGeometry.js`
- `src/components/features/SketchCanvas.jsx`
- `src/components/features/SketchConfig.jsx`

### Change inventory sync or audit logs
Start with:
- `src/views/InventoryManager.jsx`
- `src/views/Dashboard.jsx`
- `src/views/InventoryLogs.jsx`
- `firestore.rules`

### Change quote history page behavior
Start with:
- `src/views/History.jsx`
- `src/App.jsx`
- `src/components/layout/Header.jsx`
- `src/services/quoteRepository.js`

### Change login or auth redirect behavior
Start with:
- `src/views/Login.jsx`
- `src/App.jsx`
- `src/store/AuthContext.jsx`
- `src/services/authService.js`

### Change Firestore permissions
Start with:
- `firestore.rules`
- `src/config/accessControl.shared.js`
- any feature-specific writer such as `src/views/Planner.jsx`, `src/views/InventoryManager.jsx`, or `src/views/RetailerManager.jsx`

### Change planner behavior
Start with:
- `src/views/Planner.jsx`
- `src/views/Dashboard.jsx`
- `src/App.jsx`
- `firestore.rules`

## Recommended First Read Order
If you are new to the repo, read these files in order:

1. `README.md`
2. `src/App.jsx`
3. `src/store/AuthContext.jsx`
4. `src/store/QuoteContext.jsx`
5. `src/store/quoteStateSchema.js`
6. `src/services/quoteRepository.js`
7. `src/views/SummaryExport.jsx`
8. `firestore.rules`
9. `src/config/accessControl.shared.js`
10. `vite.config.js`

### Change activity logging behavior
Start with:
- `src/services/activityLogService.js`
- `src/views/ActivityLogs.jsx`
- `src/views/Dashboard.jsx`
- `firestore.rules`

### Change retailer management
Start with:
- `src/views/RetailerManager.jsx`
- `src/services/retailerService.js`
- `src/services/authService.js`
- `src/store/AuthContext.jsx`
- `src/config/accessControl.shared.js`
- `firestore.rules`

### Change grid behavior (ClickitUp items/addons)
Start with:
- `src/components/features/GridConfig.jsx`
- `src/utils/gridAutoScale.js`
- `src/services/calculationEngine.js`
- `src/data/catalog.js`
- `src/store/quoteStateSchema.js`

## Validation Expectations for Future Changes
- Run relevant tests, but do not assume the baseline is green.
- If you touch quote persistence, inspect both React and root-page consumers.
- If you touch Firestore collections, update rules and access expectations together.
- If you touch strings or Swedish copy, manually watch for encoding corruption.
- If you touch entrypoints or build behavior, check `vite.config.js` chunking and lazy-loaded view boundaries.
- Before push, run `scripts/verify-git-safety.ps1`.
