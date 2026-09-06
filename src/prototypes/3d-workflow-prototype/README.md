# 3D workflow prototype — ticket 07

Throwaway UI experiment on `codex/prototype-3d-workflow`, pending explicit user approval.
Question: how should users review their current Simple Sketch in read-only 3D, understand problems, export PNG and return?

Run `npm run dev`. In the authenticated application: Simple Sketch → Visa 3D-prototyp.
Standalone fixture, with no authentication, persistence or backend data:
`/src/prototypes/3d-workflow-prototype/index.html`.

- A / `?workflow=review`: persistent review sidebar, stacked on mobile.
- B / `?workflow=presentation`: larger scene with a compact bottom review drawer.
- The existing ticket-06 visual direction is reused; these are workflow alternatives, not new scene-design proposals.
- The app commits the current sketch snapshot before navigating in the same tab. Back returns to the original sketch URL, including return/CRM context. Direct entry falls back to the sketch route.
- Camera fit/reset/top view, orbit/zoom, technical style, focusable warnings, loading/failure/retry and PNG export are interactive.
- PNG is 2560 × 1440 with the current camera framing, project label and prototype/disclosure footer, without commercial data. Missing entities block export. The most recent PNG can be previewed in the panel.
- Review scenarios are explicitly simulated; they do not alter the sketch. A missing model uses the already-simplified proxy, not a real network asset-loading test.

## Boundaries

`plan.ts` is a temporary adapter around the current section solver, **not** the final VisualizationPlanV1 implementation. It does not mutate the supplied sketch. Models are procedural proxies, not the approved production GLB. Product heights remain proxy assumptions. Nonrectangular/unknown parasols use footprints. Collision and boundary diagnostics are partial and not a construction validation.

No deployment, Firestore write, pricing change or production-readiness claim is included. Persisted camera state is intentionally absent. Production asset/performance validation remains ticket 08.

## Verification (2026-09-06)

- Focused routing, sketch workspace, encoding and Swedish UI tests: 68 passing.
- Confidence suite: 195 passing; typecheck and production build passing.
- Browser fixture: desktop and 390 × 844 mobile, PNG creation with decoded 2560 × 1440 dimensions, omitted-entity export blocking and fatal-state retry checked.
- Authenticated end-to-end operation with a real user account and production assets has not been verified. Routing round-trip is covered by the application routing test.

Verdict remains pending: choose A or B and approve/change the workflow before resolving ticket 07.
