# QuoteGenerator Agent Guide

This is the primary project-orientation document for coding agents working in this repository. It describes the current URL-first application architecture and should be preferred over `AGENT_KNOWLEDGE_BASE.md` whenever the two disagree. The older document remains useful as historical context, but parts of it describe the former `state.step`-driven navigation model.

## Verification Context

- Last verified: `2026-07-16`
- Branch: `main`
- HEAD at verification: `c93bf32`
- Verification basis: source inspection of the current working tree plus focused route, access-control, and encoding tests
- Working-tree state: not clean before this file was added; existing user-owned changes included export-language work and a modification to `AGENT_KNOWLEDGE_BASE.md`
- Do not infer that every working-tree behavior belongs to the recorded commit. Recheck `git status`, the current commit, and relevant tests before making release claims.

## Project Snapshot

QuoteGenerator is an internal BRIXX React SPA for quotes, product configuration, pricing, exports, sketching, inventory, planning, retailer management, retailer order requests, product documents, quote history, and activity logging.

Core stack:

- React 19 and React Router 7
- Vite 5 and Tailwind CSS 4
- TypeScript for active application source under `src/`
- Firebase Authentication and Firestore
- Vitest with JavaScript/JSX tests under `tests/`
- jsPDF, SheetJS, Konva, and React Konva for exports and sketching

The browser entry point is `index.html`. `src/main.tsx` mounts `AuthProvider`, then `QuoteProvider`, then `RouterProvider`, with the shared `react-hot-toast` toaster alongside the router.

## Runtime Architecture

### URL-first routing

`src/App.tsx` defines the React Router tree. `src/navigation/routes.ts` is the source of truth for route IDs, paths, route access categories, quote-route mappings, redirect sanitization, and quote draft guards.

The URL determines the rendered screen. Do not add new navigation that depends on setting `QuoteState.step` and expecting `App.tsx` to switch views.

Numeric quote steps remain in quote state for persisted progress and compatibility:

- `1`: product lines
- `2`: configuration
- `3`: pricing
- `4`: summary/export

When a quote route renders, `App.tsx` synchronizes the corresponding numeric value into state. Legacy string step values still exist in shared contracts and access helpers, but side surfaces are rendered by their URLs. Use `src/navigation/useAppNavigation.ts` and route helpers rather than dispatching a side-surface step.

`RouteAccessBoundary` uses `getAuthorizedRouteForAccess()` for authorization. `QuoteDraftBoundary` prevents direct navigation to quote steps whose required draft data is missing. `getAuthorizedStepForAccess()` is a legacy-compatible helper and test surface; it is not the active application route gate.

### Route and access map

| Path | Surface | Allowed access |
| --- | --- | --- |
| `/login` | Login | Public |
| `/` | Dashboard | Authenticated users |
| `/quote/new/product-lines` | Product-line selection | `full`, `quote-only`, `retailer` |
| `/quote/new/configuration` | Quote configuration | `full`, `quote-only`, `retailer`; draft guard applies |
| `/quote/new/pricing` | Pricing | `full`, `quote-only`, `retailer`; draft guard applies |
| `/quote/new/summary` | Summary and export | `full`, `quote-only`, `retailer`; draft guard applies |
| `/quotes` | Quote history | `full`, `quote-only`, `retailer` |
| `/sketch` | Sketch tool | `full`, `sketch-only` |
| `/inventory` | Inventory manager | `full` |
| `/inventory/logs` | Inventory logs | `full` |
| `/activity` | Activity logs | `full` |
| `/planner` | Planner | `full` |
| `/retailers` | Retailer manager | `full` |
| `/retailer-orders` | Admin retailer-order inbox | `full` |
| `/retailer-order-requests` | Retailer order history | `full`, `retailer` |
| `/retailer-documents` | Retailer product documents | `full`, `retailer` |

Navigation visibility is not always identical to direct route authorization. For example, the header exposes retailer order history to retailer users, while the shared route gate also permits `full` access. Check both the navigation UI and `src/navigation/routes.ts` when changing access behavior.

### Authentication and roles

`src/store/AuthContext.tsx` listens to Firebase Auth and resolves these application access levels:

- `guest`
- `full`
- `quote-only`
- `sketch-only`
- `retailer`

Resolution uses `user_roles/{uid}` first for recognized roles, then the hardcoded UID fallback in `src/config/accessControl.shared.ts`, then a retailer lookup by normalized email. An authenticated user who matches no special role becomes `quote-only`. Admin and sketch-only resolution takes precedence over retailer matching; retailer matching takes precedence over the final quote-only default.

The shared capabilities are `canViewEverything`, `canStartQuote`, `canAccessSketch`, `canAccessQuoteHistory`, and `canExportSketchToQuote`. Admin UID lists in application code and `firestore.rules` must stay synchronized.

## Repository Map

- `src/App.tsx`: router tree, auth shell, route guards, quote-route synchronization, and page adapters.
- `src/navigation/`: paths, route access, redirect/draft guards, URL helpers, deep links, and navigation hooks.
- `src/store/`: auth context, quote reducer/context, state schema hydration, and local-storage persistence.
- `src/views/`: page-level feature surfaces.
- `src/components/features/`: quote controls, inventory UI, margin UI, export language UI, and Simple/Advanced sketch editors.
- `src/components/layout/`: shared header and error boundary.
- `src/services/`: Firebase adapters, repositories, calculations, exports, activity logging, notifications, retailer workflows, and margin analysis/settings.
- `src/features/`: PDF, Excel, legal-template, and sketch-export entry modules.
- `src/config/`: access control, legal templates, and PDF theme definitions.
- `src/data/`: product catalog data and safe catalog lookup helpers.
- `src/utils/`: runtime boundaries, sanitization, file saving, normalization, VAT, grid scaling, and sketch geometry.
- `src/types/contracts.ts`: shared runtime and domain contracts.
- `tests/`: Vitest unit, service, route, state, and UI coverage.
- `scripts/`: repository safety, quote metadata backfill, role migration, and black-inventory cleanup.
- `docs/COPY_EDITING_GUIDE.md`: required guidance before editing user-facing Swedish copy.
- `roadmap.md`: strategic context and shipped/future roadmap status.

Do not assume absent paths mentioned by older documentation exist. In particular, this repository currently has no `src/components/modals/`, no parasol data-build scripts under `scripts/`, and no `cloudflared.exe`.

## State and Persistence

### Quote state

`src/store/QuoteContext.tsx` owns the quote reducer. Defaults and boundary-safe hydration live in `src/store/quoteStateSchema.ts`; persistence helpers live in `src/store/quoteStatePersistence.ts`.

- Local-storage key: `offertverktyg_state`
- Current schema version: `3`
- `HYDRATE_STATE` must pass incoming local-storage or saved-revision data through `hydrateQuoteState()`.
- `RESET_STATE` must use `createInitialQuoteState()`.

Important state domains include selected product lines, builder/grid configuration, customer details, prices and discounts, VAT, custom costs, inventory working data, sketch drafts, active quote/version metadata, lifecycle status, legal/payment settings, `pdfThemeId`, `exportLanguage`, and `hideZeroDiscountReferencesInPdf`.

Simple sketch state and `advancedSketchDraft` are both persisted as quote state. State-shape changes are backward-compatibility-sensitive because the same payload crosses local storage, saved quote revisions, history reopening, duplication, sketch export, and customer export flows.

### Firestore map

| Path | Purpose | Rules summary | Main owner |
| --- | --- | --- | --- |
| `user_roles/{uid}` | Application roles | User reads own role; admins write allowed roles | Auth/access control |
| `users/{uid}/quotes/{quoteId}` | Quote metadata | Owner or admin CRUD | `src/services/quoteRepository.ts` |
| `users/{uid}/quotes/{quoteId}/revisions/{revisionId}` | Immutable-style saved quote versions | Owner or admin CRUD by rules | `src/services/quoteRepository.ts` |
| `quote_counters/{dateKey}` | Sequential daily quote-number allocation | Signed-in read/create/update | `src/services/quoteRepository.ts` |
| `users/{uid}/templates/{templateId}` | Custom legal templates | Owner read/create/delete; admin collection-group read | `src/services/templateService.ts` |
| `stock/main_inventory` | Shared inventory document | Admin read/write | `src/views/InventoryManager.tsx` |
| `inventory_logs/{logId}` | Inventory audit trail | Admin read/write | Inventory manager/log views |
| `activity_logs/{logId}` | Cross-feature activity records | Admin read; signed-in validated self-create | `src/services/activityLogService.ts` |
| `planner_projects/{projectId}` | Planner projects | Admin read/write | `src/views/Planner.tsx` |
| `retailers/{retailerId}` | Retailer profile, product lines, discounts, PDF themes | Admin read/write; matching authenticated email may read own record | `src/services/retailerService.ts` |
| `order_requests/{requestId}` | Retailer order requests | Validated self-create/read; admin read/update | `src/services/orderRequestService.ts` |
| `retailer_line_documents/{lineId}` | Product-line PDF links | Signed-in read; admin write | `src/services/retailerDocumentService.ts` |
| `app_settings/quote_margins` | Internal list-price margin settings | Admin read/write | `src/services/marginSettingsService.ts` |

`firestore.rules` is the security source of truth. Local rules edits do not affect the configured Firebase project until deployed, and local development uses the configured remote project unless emulators are explicitly added.

## Feature Architecture and Invariants

### Quote calculations, save, and history

`src/services/calculationEngine.ts` computes quote totals. `src/services/quoteSaveService.ts` decides between creating a quote and saving a revision. `src/services/quoteRepositoryClient.ts` supplies browser Firebase bindings to `src/services/quoteRepository.ts`.

History supports latest and specific revision opening, lifecycle status changes, deep links, link copying, quote duplication as a new draft, and deletion with revisions. Reopening and duplication must pass saved state through `src/views/historyPayload.ts` and schema hydration.

### Exports, localization, and themes

- PDF entry: `src/features/pdfExport.ts`
- PDF layout: `src/features/pdfExportLayout.ts`
- Excel entry: `src/features/excelExport.ts`
- Shared export rows/totals: `src/services/exportDataBuilders.ts`
- Export labels and language normalization: `src/services/exportLocalization.ts`
- PDF theme definitions: `src/config/pdfThemes.ts`
- Export controls and preview: `src/views/SummaryExport.tsx`

`exportLanguage` supports Swedish and English customer-facing output. `pdfThemeId` selects the offer theme. Retailers always have the default PDF theme and may receive additional allowed themes through their retailer profile; do not trust a persisted unauthorized retailer theme without normalizing it against the allowed set.

The application UI theme is separate from the PDF theme. `src/components/ThemeToggle.tsx` persists `portal-dark` or `brixx-light` under `quote-generator-theme`; `src/index.css` defines the corresponding CSS variables.

### Internal margin visibility

`src/services/marginSettingsService.ts` loads and saves the configured list-price margins for BaHaMa, ClickitUp, and Fiesta. `src/services/marginAnalysis.ts` derives internal cost, gross profit, actual margin, and review codes. Admins manage settings through `src/components/features/AdminSettingsModal.tsx` and see `src/components/features/MarginSummaryPanel.tsx` in Pricing and Summary/Export.

Margin data is internal-only. It must not be added to quote state, saved quote revisions, retailer order requests, retailer history, PDFs, Excel files, or other customer/retailer-facing surfaces. Preserve admin-only rendering and Firestore access.

### Retailer workspace

Retailer profiles control enabled product lines, per-line maximum discounts, and additional PDF themes. Retailers see only enabled lines, select one line per quote, and may adjust global and row discounts only up to the configured line limit.

Retailer users can save/export quotes, submit one deterministic order request per saved quote version, view their request history, and view documents for enabled product lines. Admins manage retailers, product documents, and order-request statuses. Order requests snapshot commercial/customer metadata but resolve the exact saved revision when an admin exports or inspects quote details.

Preserve product-line filtering, discount clamping, PDF-theme filtering, deterministic request IDs, and owner-based request reads in UI, service, and rules changes.

### Sketching

`src/views/SketchTool.tsx` switches between `src/components/features/SimpleSketch/SimpleSketchEditor.tsx` and `src/components/features/AdvancedSketch/AdvancedSketchEditor.tsx`. Switching modes can discard the other mode's draft and therefore uses the shared confirmation service.

Simple-sketch geometry and export logic use `src/utils/sectionCalculator.ts`, `src/utils/parasolGeometry.ts`, and `src/features/sketchExportState.ts`. Only full-access users may export sketch results into a quote; sketch-only users may use the sketch surface without quote export.

### Inventory

Inventory uses Firestore `stock/main_inventory`, logs to `inventory_logs`, and keeps working inventory data in quote persistence. Spreadsheet import uses SheetJS and normalization helpers in `src/views/inventoryData.ts` and `src/utils/csvNormalizer.ts`.

The application attempts to fetch `/inventory_db.json` when the Firestore inventory load fails. The repository currently does not contain `public/inventory_db.json`, so do not describe the fallback as operational unless the asset is restored or another deployment source is verified.

### Planner and notifications

The planner provides week summaries, project details, assignees, completion state, and delayed deletion with undo. Its persistence is direct Firestore access in `src/views/Planner.tsx`.

`src/services/notificationService.ts` is the shared application API for success/error/info/warning/loading toasts, actionable undo toasts, and accessible confirmations. Prefer it over direct `alert()`, native `confirm()`, or feature-specific notification implementations.

## Where to Edit

| Change | Start here | Also inspect |
| --- | --- | --- |
| Totals, discounts, VAT | `src/services/calculationEngine.ts` | Pricing tables, summary, export builders, catalog lookups |
| Quote state or hydration | `src/store/quoteStateSchema.ts` | Quote context, persistence, history payload, revision tests |
| Save/revision behavior | `src/services/quoteRepository.ts` | Save service, repository client, history, activity logging |
| Routes or access | `src/navigation/routes.ts` | App router, auth context, header, shared access control, rules |
| PDF/Excel output | `src/features/pdfExport.ts` | PDF layout, Excel export, export builders, localization, SummaryExport |
| Legal templates/payment terms | `src/config/legalTemplates.shared.ts` | Terms panel, template service, PDF export |
| Internal margins | `src/services/marginAnalysis.ts` | Margin settings service, admin modal, summary panel, rules |
| Retailer profiles/discounts/themes | `src/services/retailerService.ts` | Retailer manager, product-line selection, Pricing, SummaryExport |
| Retailer order requests | `src/services/orderRequestService.ts` | SummaryExport, both request views, quote PDF service, rules |
| Retailer documents | `src/services/retailerDocumentService.ts` | Retailer manager/documents view, catalog lookup, rules |
| Simple/Advanced sketch behavior | `src/views/SketchTool.tsx` | The relevant editor directory, geometry utilities, sketch export state |
| Inventory ingest/sync | `src/views/InventoryManager.tsx` | Inventory data normalization, inventory components, logs, rules |
| Quote history/deep links | `src/views/History.tsx` | History payload, quote links, repository, route tests |
| Planner | `src/views/Planner.tsx` | Planner tests and rules |
| Toasts/confirms/undo | `src/services/notificationService.ts` | Toaster mount in main and notification tests |
| User-facing Swedish copy | The owning component | `docs/COPY_EDITING_GUIDE.md` and the encoding guard |

## Operational Rules for Agents

1. Preserve unrelated working-tree changes. Inspect `git status` before editing and never assume a dirty file belongs to the current task.
2. Use URL navigation helpers for screens. Do not revive side-surface rendering through `state.step`.
3. Treat quote-state changes as persisted-data migrations. Validate local-storage hydration, saved revisions, history reopen, and duplication.
4. Pair Firestore collection or document-shape changes with rule and test review.
5. Keep application access, route access, navigation visibility, service queries, and Firestore rules aligned.
6. Keep internal margins out of saved/customer/retailer output.
7. Enforce retailer scope at every relevant boundary: enabled lines, discount caps, allowed PDF themes, quote ownership, and document visibility.
8. Read `docs/COPY_EDITING_GUIDE.md` before editing Swedish text and run the encoding guard afterward.
9. Avoid claiming the full suite, typecheck, build, or deployed rules are healthy unless they were run or verified in the current checkout.

## Validation Guide

Use the narrowest relevant tests first, then expand for shared changes.

Common commands:

- `npm ci`
- `npm run dev`
- `npm run test:confidence`
- `npm run test:run`
- `npm run typecheck`
- `npm run build`
- `./scripts/verify-git-safety.ps1`

Focused areas:

- Routing/access: `tests/routes.test.js`, `tests/appRouting.test.jsx`, `tests/accessControl.shared.test.js`, `tests/AuthContext.test.jsx`
- Quote state/persistence: `tests/quoteStateSchema.test.js`, `tests/quoteStatePersistence.test.js`, `tests/historyPayload.test.js`, `tests/quoteRepository.test.js`
- Exports/localization: `tests/exportDataBuilders.test.js`, `tests/pdfExport.test.js`, `tests/exportLocalization.test.js`, `tests/exportLanguageSelector.test.jsx`
- Margins: `tests/marginSettingsService.test.js`, `tests/marginAnalysis.test.js`, `tests/marginVisibility.test.jsx`
- Retailers: retailer workspace, service, order-request, document, and pricing-discount tests under `tests/`
- Sketch: section calculation, parasol geometry, sketch config/export, and advanced-sketch tests under `tests/`
- Inventory: inventory data, normalization, manager, modal, and option tests under `tests/`
- Planner: planner week-summary, assignee, delete-undo, and modal tests under `tests/`
- User-facing text: `tests/textEncodingGuard.test.js` and `tests/uiTextSmoke.test.jsx`

On Windows, if PowerShell blocks `npm.ps1`, invoke npm through `cmd /c npm ...`.
