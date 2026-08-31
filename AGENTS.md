# QuoteGenerator Agent Instructions

QuoteGenerator is an internal BRIXX React SPA for quotes, pricing, exports,
sketching, inventory, planning, retailers, order requests, and activity logs.
Active application code is TypeScript under `src/`; tests use Vitest under
`tests/`.

## Working Style

- Build for a small family business. Prefer clear, low-maintenance workflows and
  straightforward code. Add enterprise-scale abstractions, permissions, or
  operational ceremony only when the user explicitly needs them.
- Inspect `git status` before editing. Preserve all unrelated and user-owned
  changes; never assume a dirty file belongs to the current task.
- Read the implementation and focused tests before changing behavior. Treat
  `AGENT_KNOWLEDGE_BASE.md` as historical context when it conflicts with current
  source, tests, or this file.
- Use the URL-first architecture, existing feature seams, and established
  services. Prefer the smallest complete change over a parallel framework.
- Do not report that a build, test suite, typecheck, or rules deployment is
  healthy unless it was verified in the current checkout.

## Architecture

- `src/App.tsx` defines the React Router tree. `src/navigation/routes.ts` owns
  route IDs, paths, access categories, redirects, and quote draft guards.
- The URL determines the rendered screen. Numeric `QuoteState.step` values are
  persisted quote progress and compatibility data, not a screen router. Navigate
  through `src/navigation/useAppNavigation.ts` and route helpers.
- `src/store/AuthContext.tsx` resolves `guest`, `full`, `quote-only`,
  `sketch-only`, and `retailer` access. Route authorization, navigation
  visibility, service queries, and Firestore rules must remain aligned.
- `src/store/QuoteContext.tsx` owns quote state. Defaults and safe hydration live
  in `src/store/quoteStateSchema.ts`; persistence lives in
  `src/store/quoteStatePersistence.ts`.
- Firebase Authentication and Firestore provide the backend. `firestore.rules`
  is the security source of truth; local rule edits have no deployed effect.
  Local development uses the configured remote project unless an emulator is
  explicitly running.
- Shared domain contracts live in `src/types/contracts.ts`. Catalog access goes
  through safe helpers under `src/data/` rather than unchecked lookups.

## Non-negotiable Invariants

### Quote state and navigation

- Pass local-storage data, saved revisions, history reopen data, duplication
  data, and sketch export data through `hydrateQuoteState()`.
- Use `createInitialQuoteState()` for resets. Treat every state-shape change as a
  persisted-data migration and test old or partial payloads.
- Preserve quote draft guards when changing quote routes. Do not restore
  `state.step`-driven rendering for side surfaces.

### Access and retailer scope

- Keep application access checks and `firestore.rules` synchronized. Admin UID
  fallbacks in application code and rules must match.
- Pair Firestore collection or document-shape changes with rules and focused
  rules tests.
- Enforce retailer constraints at every relevant seam: enabled product lines,
  one line per quote, discount caps, allowed PDF themes, quote ownership, order
  ownership, and document visibility.
- Normalize persisted retailer PDF themes against the retailer's allowed set.
- Keep deterministic retailer order-request IDs and resolve the exact saved
  revision for admin inspection or export.

### Commercial data and saving

- `src/services/calculationEngine.ts` owns quote totals. Keep pricing UI, summary,
  export builders, VAT, discounts, and catalog fallbacks consistent with it.
- Call quote persistence through `quoteSave.save()` or `quoteSave.repairCrm()`.
  Quote persistence defines save success; CRM failure is repairable metadata and
  must not create another revision.
- Keep Save Intent handling idempotent. `saveIntentId` is revision-document
  metadata, never quote state.
- Internal margin settings and calculations are admin-only. Never place margin
  data in quote state, revisions, retailer requests, PDFs, Excel files, or other
  customer-facing output.

### UI, exports, and operational behavior

- Keep application theme and PDF theme separate. Customer exports support
  Swedish and English through `src/services/exportLocalization.ts`.
- Use `src/services/notificationService.ts` for toasts, confirmations, and undo
  actions instead of browser-native dialogs or feature-specific systems.
- Switching Simple and Advanced sketch modes can discard drafts; preserve the
  shared confirmation flow. Only `full` users may export a sketch to a quote.
- Inventory uses `stock/main_inventory` and `inventory_logs`. The
  `/inventory_db.json` fallback is not operational unless that asset is present
  or another deployment source has been verified.

## Change Map

| Change | Start here | Check alongside it |
| --- | --- | --- |
| Routes or access | `src/navigation/routes.ts` | `src/App.tsx`, `src/store/AuthContext.tsx`, header, rules, route tests |
| Quote state | `src/store/quoteStateSchema.ts` | context, persistence, history payload, revision tests |
| Totals, VAT, discounts | `src/services/calculationEngine.ts` | pricing, summary, export builders, catalog helpers |
| Save or revisions | `src/services/quoteSaveService.ts` | repository, repository client, history, activity logging |
| PDF or Excel | `src/features/pdfExport.ts` | layout, Excel export, export builders, localization, SummaryExport |
| Retailers | `src/services/retailerService.ts` | manager, product selection, pricing, themes, rules |
| Retailer orders | `src/services/orderRequestService.ts` | SummaryExport, request views, quote PDF service, rules |
| Retailer documents | `src/services/retailerDocumentService.ts` | document views, catalog helpers, rules |
| Margins | `src/services/marginAnalysis.ts` | settings service, admin modal, summary panel, rules |
| Sketching | `src/views/SketchTool.tsx` | relevant editor, geometry utilities, sketch export state |
| Inventory and QR | `src/views/InventoryManager.tsx` | inventory normalization, QR services, labels, rules |
| Quote history | `src/views/History.tsx` | history payload, deep links, repository, route tests |
| Planner | `src/views/Planner.tsx` | planner tests and rules |
| Notifications | `src/services/notificationService.ts` | toaster mount and notification tests |

## Task-triggered References

- Before editing user-facing Swedish copy, read
  `docs/COPY_EDITING_GUIDE.md`; afterward run the encoding guard and UI text smoke
  test.
- For BaHaMa inventory QR work, read `docs/QR_INVENTORY.md` and the focused QR
  tests before changing identifiers, labels, backfill behavior, or rules.
- For quote-save or CRM synchronization changes, read
  `docs/adr/0001-deepen-quote-save-workflow.md`,
  `docs/adr/0002-accept-client-prepared-commercial-snapshots.md`, and, for backfill
  operations, `docs/CRM_BACKFILL_GUIDE.md`.
- Use `roadmap.md` for strategic context, but verify shipped behavior against the
  source and tests.

## Verification

Run the narrowest relevant tests first, then expand according to the change's
blast radius. Check `package.json` for the current script definitions.

- Focused test: `npm run test:run -- tests/<relevant-test>.test.js`
- Confidence suite: `npm run test:confidence`
- Full suite: `npm run test:run`
- Typecheck: `npm run typecheck`
- Production build: `npm run build`
- Firestore rules: `npm run test:firestore`, or the focused quote/QR variant
- Git safety: `./scripts/verify-git-safety.ps1`

For shared state, routing, access, export, or rules changes, run the focused tests
plus typecheck and the appropriate broader suite. If PowerShell blocks `npm.ps1`,
run the command through `cmd /c npm ...`.
