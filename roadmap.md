# QuoteGenerator Roadmap

This roadmap focuses on improving reliability, internal usability, and sales workflow quality in the current React SPA. It is intended as a 6-month engineering roadmap built around strengthening existing workflows, addressing high-friction gaps, and making a small number of deliberate platform investments where they materially improve day-to-day usability.

## Objectives
- Remove visible encoding issues from core user-facing flows.
- Make retailer and admin workflows feel intentional rather than permission-gated leftovers.
- Connect quote, planner, and history flows into a more operational system.
- Improve export quality, admin visibility, and user feedback without changing the app's overall architecture.
- Reduce repetitive quote setup and make navigation, discovery, and edit-time safety better across the app.

## Guiding Principles
- Fix trust-breaking UX defects before adding polish.
- Prefer improvements that strengthen existing flows over new standalone subsystems.
- Keep the current SPA/state-step architecture unless a roadmap item truly requires deeper structural change.
- Pair UX work with validation coverage where business-critical flows are touched.

## Phase 1: Foundations

### [x] 1. Mojibake / Encoding Cleanup
Audit and fix corrupted Swedish text in the core views and services first, starting with the highest-traffic quote and admin surfaces. Normalize file encodings, tighten text-handling guardrails in the main quote/admin flows, and expand text-integrity coverage where the current tests are too narrow. Add a lightweight verification checklist for future copy changes so encoding regressions are harder to reintroduce during routine edits.

Success signals:
- No visible mojibake remains in dashboard, planner, inventory, sketch, or summary/save paths.
- Text-related regressions become easier to catch before merge.

### [x] 2. Error Boundaries and Runtime Safety
Add a top-level React error boundary around the main content area in `App.jsx` so that unhandled errors in any view produce a recoverable fallback UI rather than a white screen crash. Users currently have no recovery path short of manually clearing localStorage. The fallback should offer a "reset and return to dashboard" action. This is a small investment that prevents the worst possible UX failure across every view in the app.

Success signals:
- Runtime errors in any view never produce an unrecoverable white screen.
- Users can self-recover from unexpected state without external help.

### [x] 3. Dead Code and Dev Artifact Removal
Remove leftover development artifacts that pose real operational risk. The Planner view currently includes a live "Generera Test-data" button that writes dummy records to the production Firestore database, plus a commented-out old delete handler. These should be cleaned up before any Phase 2 workflow work touches the Planner.

Success signals:
- No dev-only UI controls exist in production views.
- No commented-out dead code remains in actively maintained files.

### [x] 4. Notifications Consistency
Status: The app now uses a shared notification service for toast, loading, action, and confirm flows across the main quote, export, inventory, sketch, history, log, template, and planner surfaces.

Toast, warning, and confirm behavior has been standardized behind a shared app API with `react-hot-toast` as the toast renderer and the existing custom confirm dialog as the confirm standard. The app no longer relies on mixed `alert(...)`, native `confirm(...)`, direct `react-hot-toast` usage in the main flows, or a separate Planner-only undo banner pattern.

Success signals:
- Similar actions produce similar feedback across the app.
- Failure states are understandable without reading the console.

## Phase 2: Workflow Upgrades

### [x] 1. Incremental TypeScript Migration
Status: App-source TypeScript migration for `src/` is complete, including shared contracts, state, views, and service-layer code.

The original incremental migration goal has been achieved for the active runtime. Remaining TypeScript follow-up work is now optional hardening rather than foundational migration work, and is better framed as compiler strictness improvements plus selective migration of tests, scripts, or tooling where it provides clear value without disrupting delivery.

Success signals:
- Critical shared shapes have typed coverage before more workflow work lands on top of them.
- Common contract mistakes are caught earlier in local development.

### [~] 2. Retailer Workspace
Status: Retailer Workspace V1 is now live. The current delivery includes a retailer-specific dashboard/workspace, visible enabled/disabled product lines with explanation, retailer discount preview during product-line selection, retailer-specific pricing guidance with lock copy in the pricing step, and an app-first retailer order-request workflow from summary/export into an admin inbox.

Turn retailer access from a hidden role variant into a clearer dedicated workspace experience. The current V1 now covers the core "understand my scope" path and the first retailer-to-admin handoff path, but the initiative remains active until retailer workflows feel fully intentional across the whole quote flow. Keep retailer management and admin controls aligned with the same model so the admin-facing configuration stays easy to reason about.

Shipped in the current V1:
- Retailer-specific dashboard/workspace and guarded quote-history access.
- Visible product-line scope and retailer discount guidance in selection and pricing.
- Retailer-specific draft reset protection on "Starta Ny Offert".
- In-app order request submission from `SummaryExport` for saved quote versions.
- Admin recent-order-request visibility on the dashboard.
- Admin inbox/detail workflow at `/retailer-orders` with status handling and a compact derived product overview from the submitted quote revision.

Remaining follow-up work includes: continued review of retailer-specific edge cases; an explicit product decision on whether `CustomCosts`, save/export behavior, or other pricing-adjacent actions should be further restricted for retailer users; and a later decision on whether retailer order requests should also gain history, notification, or email-backed follow-up.

Success signals:
- Retailer users can now see their discount and product scope without guessing.
- Restricted product lines are now visibly explained instead of silently absent.
- Retailer users can now hand off a saved quote into a clear admin workflow without needing a side-channel.
- Remaining retailer-specific edge cases and permission inconsistencies continue to trend down as the follow-up work lands.

### 3. Quote Duplication
Add a first-class way to duplicate an existing quote into a new draft so users can reuse similar customer configurations without starting from scratch. The initial workflow should live in History, where a `Duplicera` action clones a quote's saved state into a new draft quote with a new ID and fresh save lineage. This should preserve the original quote as history while making the duplicate immediately editable as a separate working copy.

Success signals:
- Users can create a variation of an existing quote without manual re-entry.
- Reuse of prior quotes becomes a normal workflow rather than a workaround.

### 4. Quote History Hub
Evolve quote history from a simple saved-quote list into a more operational review surface. Improve admin browsing across users and retailer-originated quotes, and add better filtering and context around revisions, ownership, and recent activity. Prioritize common workflows such as finding a quote, inspecting context, reopening it safely, and continuing work without re-discovery.

Success signals:
- Admins can quickly find relevant quotes across owners.
- Reopened work has enough context to resume safely.

### 5. Planner Links
Connect planner items to quotes, customers, and retailers where that linkage adds operational value. The goal is not a heavy project-management subsystem, but a lightweight reference model that helps planner records point back to real commercial work. Keep planner permissions and admin scope aligned with the current access model while reducing manual context-switching between planner and quote history.

Success signals:
- Planner entries can point back to the commercial work they represent.
- Less manual context-switching is needed between planner and quote history.

### 6. Global Search
Add a unified search entry point for admins so quotes, retailers, and activity-related records are easier to find from one place instead of requiring per-view navigation first. Build on the existing quote `searchText` pattern and extend search indexing or normalized search fields where needed rather than inventing a separate disconnected search model. The goal is faster discovery from the dashboard and less time spent switching views just to locate the right record.

Success signals:
- Admins can find common records from a single search surface.
- Cross-view record lookup becomes faster than the current per-screen search flow.

## Phase 3: Commercial Polish

### [x] 1. Proper URL Routing
Status: React Router-based URL routing is now in place for login, dashboard, quote steps, history, sketch, and admin surfaces.

The core routing migration has landed and the app no longer relies solely on internal step switching for view navigation. Browser navigation, deep linking, guarded route access, and quote-step URLs are now part of the runtime model. Any remaining routing work should be treated as follow-up polish around specific workflows rather than as a still-pending platform migration.

Success signals:
- Browser navigation works as users expect across major app views.
- Deep links and refresh behavior become stable and shareable.

### 2. Export Polish
Improve PDF and Excel output clarity, consistency, and perceived professionalism using the existing export architecture. Refine template and presentation quality, and improve how customer notes, legal terms, summary content, and optional sections appear in exports. Preserve the current save/export workflow while making outputs easier to send externally without manual cleanup.

Success signals:
- Exports need less manual cleanup before sending.
- Internal users trust the default output quality more often.

### 3. Dashboard Analytics
Add at-a-glance operational visibility to the admin dashboard. The data already exists in Firestore - surface it as summary cards and simple charts covering quote pipeline by status (draft/sent/won/lost), total SEK in pipeline, quotes created this week/month, and retailer activity. The goal is to make the dashboard useful for daily decision-making rather than just a navigation hub.

Note: a lightweight admin recent-order-requests panel is already live. This item now refers to broader pipeline and trend visibility beyond that operational inbox-style summary.

Success signals:
- Admins can see pipeline health without opening individual quotes.
- Trends in quote activity and retailer usage are visible at a glance.

## Cross-Cutting Dependencies
- Text cleanup should happen before export polish so branded and customer-facing output improves on a clean baseline.
- Retailer, history, and planner follow-up work should continue to use the shared notification model so new flows do not reintroduce special-case messaging patterns.
- Quote duplication should land alongside the history-hub work so cloning and reopen flows share the same metadata and draft-creation rules.
- Quote history and planner linking should share identifiers and reference conventions rather than inventing separate linking schemes.
- Routing follow-up for quote duplication, global search, and history improvements should stay coordinated so navigation patterns are not redesigned twice.
- Type hardening should continue alongside quote-state-heavy workflow work to reduce regression risk, even though the main app-source TypeScript migration is complete.
- Admin UID centralization (moving hardcoded UIDs in `firestore.rules` and `accessControl.shared.js` to a Firestore-based role model or shared constant) should be resolved before Phase 2 work adds more admin-gated features, to prevent synchronization drift.
- Any future retailer email or notification phase should build on the existing `order_requests` workflow rather than replace it with a separate submission path.
- Validation should be updated whenever quote state, export rendering, or business-critical admin flows are changed.

## Success Metrics
- Visible encoding issues are reduced to zero in prioritized app areas.
- Retailer support questions around access and quote setup decrease.
- Admin quote retrieval and continuation become faster and less error-prone.
- Planner usage becomes more connected to real quote and customer work.
- Export-related manual cleanup and confusion decrease.
- Quote reuse through duplication becomes materially faster than manual re-entry.
- Navigation and record discovery become more predictable through routing and global search.

## Out of Scope for This Roadmap
- Full SPA-to-MPA migration or multi-app split.
- Access-control backend redesign or Firebase custom-claims migration.
- Major data-model rewrite for quotes or planner.
- Full Scrive/e-signature rollout.
- Full repo-wide TypeScript conversion of every remaining file, including tests/scripts/tooling.

## Assumptions
- Target file is `QuoteGenerator/roadmap.md`.
- Audience is the engineering team.
- Horizon is 6 months.
- This is an execution-oriented roadmap, not a PRD or implementation spec.
- The roadmap stays aligned with the current Firebase-backed model while allowing targeted structural follow-up such as routing polish and TypeScript hardening where it materially reduces risk.
