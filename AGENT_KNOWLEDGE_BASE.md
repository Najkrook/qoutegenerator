# Agent Knowledge Base

This file exists to help future agents understand the actual `QuoteGenerator` project shape before editing anything substantial.

Last verified: `2026-03-10`

`QuoteGenerator` is a React SPA repository. All active runtime logic lives under `src/`. `README.md` is useful for human onboarding; this file is the deeper agent map.

## Executive Snapshot
- Internal quote, inventory, sketch, and planner portal for BRIXX.
- Main frontend stack is React 19 + Vite 5 + Tailwind 4 + Firebase Auth/Firestore.
- Runtime architecture is a unified React Single Page Application (SPA).
- In-progress quote state is persisted in localStorage under `offertverktyg_state`.
- Persistent backend data lives in Firestore for quotes, revisions, templates, inventory, and inventory logs.
- Access control is UID-based and resolved in `src/config/accessControl.shared.js`.
- Quote persistence and revisioning are centralized in `src/services/quoteRepository.js`.
- The repo is not fully healthy: `npm run test:run` currently fails in `tests/exportDataBuilders.test.js`.
- CI exists in `.github/workflows/ci.yml` and runs the same failing test command.
- The new Planner UI writes to `users/{uid}/planner_projects`, but current `firestore.rules` do not allow that collection.

## Repo Topology

### `src/`
Primary active React runtime.

- `src/main.jsx` bootstraps the app.
- `src/App.jsx` switches views using `state.step`.
- `src/store/` contains `AuthProvider` and `QuoteProvider`.
- `src/views/` contains the main React feature surfaces.
- `src/components/` contains the React UI pieces.
- `src/services/` contains React-facing Firebase/auth/template/save glue.
- `src/utils/` contains sketch geometry and client helpers.
- `src/data/` contains catalog data.



### `tests/`
Vitest coverage.

- Covers calculations, repository behavior, export builders, PDF behavior, quote save flow, text encoding guardrails, and some UI smoke coverage.
- Test coverage exists, but the baseline is not fully green.

### `scripts/`
Tooling and maintenance support.

- `scripts/verify-git-safety.ps1` enforces tracked-file safety.
- `scripts/backfill-quote-metadata.mjs` backfills quote metadata with Firebase Admin credentials.
- `scripts/clean_black_inventory.mjs` exists but is not central to the main runtime.

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
- `index.html` also loads CDN dependencies for export paths such as jsPDF, `xlsx`, and `html2canvas`.

## Runtime Architecture
The codebase completes the migration to a modern, separated React architecture.

### React shell
- `src/main.jsx` wraps the app with `AuthProvider` and `QuoteProvider`.
- `src/App.jsx` renders views by `state.step`, not React Router.
- Numeric steps `1` through `4` represent the quote flow.
- String steps such as `inventory`, `sketch`, and `planner` represent side branches.

### Shared internal modules
- All internal module dependencies are contained within `src/` (e.g., `src/features/` and `src/services/`).

### Service layers
- The application relies on `src/services/firebase.js` using the installed Firebase package.
- `src/services/authService.js` is the React auth wrapper and acts as the sole authentication mechanism for the dashboard and quote routes.

### Direct answers for future agents
- If you change quote calculations, start in `src/services/calculationEngine.js`.
- If you change save or revision behavior, start in `src/services/quoteRepository.js`, then check `src/services/quoteSaveService.js` and `src/services/quoteRepositoryClient.js`.
- This project uses a state-driven view-switching architecture inside the single React SPA. `src/App.jsx` dynamically renders `Login`, `Quote History`, and `Inventory Logs` alongside other dashboard/quote flows.

## Main User Flows

### Dashboard
- Entry condition: `state.step === 0`.
- Access gate: authenticated users; cards shown based on `useAuth()` booleans.
- Main files:
  - `src/views/Dashboard.jsx`
  - `src/App.jsx`
- Persistence:
  - No dedicated Firestore object for the dashboard itself.
  - Admin dashboard fetches recent `inventory_logs`.
- Notable dependencies:
  - `src/services/firebase.js`
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
  - root `services/calculationEngine.js`
- Persistence:
  - localStorage via `QuoteContext`.
- Notable dependencies:
  - quote totals shown later in summary/export are derived from root calculation logic.

### Summary Export
- Entry condition: `state.step === 4`.
- Access gate: `canStartQuote`.
- Main files:
  - `src/views/SummaryExport.jsx`
  - `src/services/quoteSaveService.js`
  - `src/services/quoteRepositoryClient.js`
  - root `services/quoteRepository.js`
  - root `features/pdfExport.js`
  - root `features/excelExport.js`
- Persistence:
  - localStorage for in-progress state.
  - Firestore for saved quotes and revisions.
- Notable dependencies:
  - computes summary with root calculation engine.
  - templates and payment options come from `TermsAndPaymentPanel.jsx`.
  - PDF preview is regenerated client-side as state changes.

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
  - Firestore collection `users/{uid}/planner_projects`.
- Notable dependencies:
  - live in the UI now.
  - backend rules do not currently permit this collection.

## Authentication and Access Control

### Core React access model
- `src/store/AuthContext.jsx` listens to auth state changes and derives `accessLevel`.
- `config/accessControl.shared.js` is the source of truth for role resolution.

Roles:
- `guest`
- `full`
- `quote-only`
- `sketch-only`

Permission booleans exposed by `useAuth()`:
- `canViewEverything`
- `canStartQuote`
- `canAccessSketch`
- `canAccessQuoteHistory`
- `canExportSketchToQuote`

### App-level enforcement
- `src/App.jsx` redirects unauthenticated users to `login.html`.
- `src/App.jsx` also blocks unauthorized step transitions:
  - `inventory` requires `canViewEverything`
  - quote-flow numeric steps require `canStartQuote`
  - `sketch` requires `canAccessSketch`
  - `planner` is only rendered for `canViewEverything`

### Root-page enforcement
- `login.html`, `history.js`, and `inventoryLogs.js` use root `services/authService.js`.
- `inventoryLogs.js` requires full access.
- `history.js` uses quote-history access logic.

### Important mismatch
- `history.html` still contains an inline `requireFullAccess({ redirectTo: 'index.html' })` check.
- `history.js` itself expects quote-history access, which should allow `full` and `quote-only`.
- Future agents should treat quote-history access as inconsistent until this mismatch is resolved.

### Operational implication
If you change roles or access expectations:
- update `config/accessControl.shared.js`
- review `src/store/AuthContext.jsx`
- review root auth consumers in `services/authService.js`, `history.html`, `history.js`, and `inventoryLogs.js`

## State Model and Persistence
`src/store/QuoteContext.jsx` is the main state container for the React app.

### Storage
- localStorage key: `offertverktyg_state`
- state is loaded from localStorage on boot
- state is written back on every change

### Main state domains
- quote flow step and selected product lines
- builder items and grid selections
- custom costs, VAT, discounts, exchange rate
- customer info
- inventory data and cloud inventory baseline
- sketch draft and sketch metadata
- inventory basket
- active quote ID and version
- quote status
- terms, template selection, payment box, signature block, validity/payment days
- Scrive-related metadata

### Reducer and reset behavior
- The reducer lives in `src/store/QuoteContext.jsx`.
- `RESET_STATE` restores initial defaults.
- PDF-related defaults are normalized through helper functions in the same file.

### History-page rehydration flow
- `history.js` loads a quote revision from Firestore.
- It writes the revision state back into `offertverktyg_state`.
- It then redirects the browser to `index.html`.

### Operational implication
The React app, history page, and some older flows depend on the same serialized state shape. Schema changes to quote state should be treated as cross-cutting and backward-compatibility-sensitive.

## Quote Persistence and Data Model
The authoritative quote repository is root `services/quoteRepository.js`.

### Firestore layout
- Quotes: `users/{uid}/quotes/{quoteId}`
- Revisions: `users/{uid}/quotes/{quoteId}/revisions/{revisionId}`

### Save flow
1. `src/views/SummaryExport.jsx` computes quote totals.
2. `src/services/quoteSaveService.js` decides between create and revision save.
3. `src/services/quoteRepositoryClient.js` injects React-side Firestore functions into the root repository.
4. `services/quoteRepository.js` persists quote metadata and revision snapshots.

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

### Revision behavior
- Each revision stores a full state snapshot plus summary data.
- If transactions are unavailable, the repository falls back to a non-transactional save path.
- `history.js` can open the latest revision or fetch older revisions.

### Lifecycle status values
Quote statuses in `services/quoteRepository.js`:
- `draft`
- `sent`
- `won`
- `lost`
- `archived`

Scrive statuses in `services/quoteRepository.js`:
- `not_sent`
- `preparation`
- `pending`
- `closed`
- `rejected`
- `canceled`
- `timedout`
- `failed`

## Templates, PDF Terms, and Feature Flags

### Built-in and custom templates
- Built-in legal templates live in `config/legalTemplates.shared.js`.
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
- The dashboard also reads recent `inventory_logs` for admins.

### Inventory Logs Page
- Entrypoint: `inventory-logs.html`
- Main script: `inventoryLogs.js`
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
- Collection path: `users/{uid}/planner_projects`
- UI access gate: admin-only branch from the dashboard
- Status: live in the UI, but backend rules do not currently authorize the collection

## Firestore Rules and Security Reality
`firestore.rules` currently allow:

- quote documents under `users/{uid}/quotes/{quoteId}` for the signed-in owner
- quote revisions under `users/{uid}/quotes/{quoteId}/revisions/{revisionId}` for the signed-in owner
- template documents under `users/{uid}/templates/{templateId}` for the signed-in owner
- `stock/{docId}` for admins
- `inventory_logs/{logId}` for admins
- admin reads of `templates` through collection-group queries
- deny-all fallback for everything else

### Current mismatches / caution
- `planner_projects` is not allowed by current `firestore.rules`, even though `src/views/Planner.jsx` writes there.
- Any new feature that writes to a new collection must be reflected in Firestore rules.
- Admin UIDs are hardcoded in both `firestore.rules` and `config/accessControl.shared.js` and must stay synchronized.

## Tooling, Scripts, and CI

### Local commands
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run test:run`

### PowerShell caveat
If `npm.ps1` is blocked by execution policy, use:

- `cmd /c npm install`
- `cmd /c npm run dev`
- `cmd /c npm run test:run`

### Scripts
- `scripts/verify-git-safety.ps1`
  - fails if blocked sensitive or local-only files are tracked
- `scripts/backfill-quote-metadata.mjs`
  - backfills legacy quote metadata
  - requires Firebase Admin credentials
- `scripts/clean_black_inventory.mjs`
  - present, but not central to the app runtime

### CI
- Workflow: `.github/workflows/ci.yml`
- Runs:
  - tracked-file safety check
  - clean-repo sanity check
  - `npm install --no-package-lock`
  - `npm run test:run`

CI is real and currently depends on a test command that is not fully passing.

### Build output
- `dist/` exists in the repo right now.
- Treat `dist/` as build output, not source-of-truth implementation.

## Known Issues and Repo Traps
- Hybrid architecture trap: modern React code still depends on root `features/` and `services/`.
- Planner/rules mismatch: `src/views/Planner.jsx` writes to `users/{uid}/planner_projects`, but `firestore.rules` deny that path.
- Quote-history access mismatch: `AuthContext` and `history.js` imply `quote-only` users should have history access, but `history.html` still has an inline full-access precheck.
- Test suite not fully green: `npm run test:run` currently fails in `tests/exportDataBuilders.test.js`.
- Export builder contract drift: `buildPdfTableData(...)` in `services/exportDataBuilders.js` currently expects an array, while `tests/exportDataBuilders.test.js` calls it with `(state, summary, formatSek)`.
- CI implication: `.github/workflows/ci.yml` runs the same failing `npm run test:run` command.
- Duplicate service layers: both `src/services/firebase.js` and root `services/firebase.js` exist, and both `src/services/authService.js` and root `services/authService.js` exist.
- Firebase version skew risk: the React layer uses the installed Firebase package, while root pages use CDN Firebase modules from `10.9.0`.
- Encoding or mojibake risk: some files visibly contain corrupted Swedish text or symbols.
- Known mojibake examples include:
  - `config/legalTemplates.shared.js`
  - `src/views/Dashboard.jsx`
  - `src/views/Planner.jsx`
  - `src/views/InventoryManager.jsx`
  - `src/views/SketchTool.jsx`
  - `src/services/quoteSaveService.js`
- `tests/textEncodingGuard.test.js` exists, but it does not catch every visibly broken encoding pattern in the repo.
- Multi-page build trap: changes can affect separate pages such as `login.html`, `history.html`, `inventory-logs.html`, and `index_legacy.html`, not just `index.html`.

## Where To Edit

### Change quote totals or calculation logic
Start with:
- `services/calculationEngine.js`
- `src/components/features/PricingTable.jsx`
- `src/components/features/FinalSummaryTable.jsx`
- `src/views/SummaryExport.jsx`

### Change quote save or revision behavior
Start with:
- `services/quoteRepository.js`
- `src/services/quoteSaveService.js`
- `src/services/quoteRepositoryClient.js`
- `history.js`

### Change PDF or Excel export output
Start with:
- `features/pdfExport.js`
- `features/excelExport.js`
- `services/exportDataBuilders.js`
- `src/views/SummaryExport.jsx`
- `src/components/features/TermsAndPaymentPanel.jsx`

### Change access roles or permissions
Start with:
- `config/accessControl.shared.js`
- `src/store/AuthContext.jsx`
- `services/authService.js`
- `src/App.jsx`
- `history.html`
- `history.js`
- `inventoryLogs.js`

### Change legal templates or terms behavior
Start with:
- `config/legalTemplates.shared.js`
- `src/components/features/TermsAndPaymentPanel.jsx`
- `src/services/templateService.js`
- `features/pdfExport.js`

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
- `inventoryLogs.js`
- `firestore.rules`

### Change quote history page behavior
Start with:
- `history.html`
- `history.js`
- `services/quoteRepository.js`
- `services/authService.js`

### Change login or auth redirect behavior
Start with:
- `login.html`
- `src/App.jsx`
- `src/store/AuthContext.jsx`
- `src/services/authService.js`
- `services/authService.js`

### Change Firestore permissions
Start with:
- `firestore.rules`
- `config/accessControl.shared.js`
- any feature-specific writer such as `src/views/Planner.jsx` or `src/views/InventoryManager.jsx`

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
5. `services/quoteRepository.js`
6. `src/views/SummaryExport.jsx`
7. `firestore.rules`
8. `config/accessControl.shared.js`
9. `vite.config.js`

## Validation Expectations for Future Changes
- Run relevant tests, but do not assume the baseline is green.
- If you touch quote persistence, inspect both React and root-page consumers.
- If you touch Firestore collections, update rules and access expectations together.
- If you touch strings or Swedish copy, manually watch for encoding corruption.
- If you touch entrypoints or build behavior, check `vite.config.js` multi-page inputs.
- Before push, run `scripts/verify-git-safety.ps1`.
