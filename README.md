# QuoteGenerator

## What This Repo Is
QuoteGenerator is an internal quote, sketch, and inventory application for BRIXX.

The primary UI is a React + Vite app under `src/`, but the current runtime is still hybrid:

- `src/` contains the main SPA entrypoint, views, context providers, and client-facing services.
- Shared root-level modules under `features/`, `services/`, and `config/` are still part of the active app.
- `login.html`, `history.html`, and `inventory-logs.html` remain active entrypoints.
- `index_legacy.html` and the older root app shell are the true legacy/reference layer.

This repository should not be treated as a fully isolated `src/`-only app yet.

## Quick Start
### Prerequisites
- Node.js 20+ (LTS recommended)
- npm 10+

### Run locally
From `QuoteGenerator/`, run:

```powershell
cd .\QuoteGenerator
npm install
npm run dev
```

If PowerShell execution policy blocks `npm.ps1`, use `cmd /c npm ...` instead:

```powershell
cd .\QuoteGenerator
cmd /c npm install
cmd /c npm run dev
```

Default Vite dev URL:
- `http://localhost:5173` unless Vite selects a different port

## Firebase Setup
The Firebase web app client config is currently checked into `src/services/firebase.js`.

- This client-side config is not the same thing as Firebase Admin credentials.
- Admin or service-account credentials are only required for admin scripts such as `scripts/backfill-quote-metadata.mjs`.
- Do not commit secrets or private credential files.

## Available Scripts
From `QuoteGenerator/`:

- `npm run dev`: Start the local Vite dev server.
- `npm run build`: Create a production build in `dist/`.
- `npm run preview`: Preview the production build locally.
- `npm run test`: Run Vitest in interactive mode.
- `npm run test:watch`: Run Vitest in watch mode.
- `npm run test:run`: Run Vitest once with the basic reporter.

## Environment & Secrets
Do not commit secrets or local-only credentials.

Common sensitive/local files include:
- `.env`
- `.env.*`
- `*.env`
- `API_keys.env`
- `credentials.json`
- `token.json`
- `token.pickle`

Before pushing, run:

```powershell
git status
git ls-files
powershell -ExecutionPolicy Bypass -File .\scripts\verify-git-safety.ps1
```

## Project Structure
Current active directories:

- `src/`: React app entrypoint, views, contexts, client-side services, utilities, and catalog data.
- `features/`: Shared export and legacy-interoperability modules still used by the React app.
- `services/`: Shared domain and data modules used by current app code and tests.
- `config/`: Shared access-control and template configuration.
- `tests/`: Vitest coverage for calculations, repositories, exports, and UI text.
- `scripts/`: Maintenance and safety scripts.
- `integrations/scrive-proxy/`: Disabled/reference Scrive integration scaffold.

The active application still pulls code from both `src/` and selected root-level modules.

## Core Workflow
The quote flow uses state-driven navigation rather than URL routing:

1. Dashboard
2. Product Line Selection
3. Configuration
4. Pricing
5. Summary Export

Other active paths:

- Inventory management is an admin-only branch from the dashboard.
- Sketch mode is a separate branch from the dashboard.
- Quote history and inventory logs are accessed through dedicated HTML pages and header links, not the main stepper.

## Useful Local Checks
Useful local validation commands:

```powershell
npm run test:run
npm run build
```

Note:
- Vite may warn about large chunk sizes during build. Treat that as informational unless a release decision depends on it.

## Security and Git Safety
Baseline team practice:

1. Never commit secrets or local runtime files.
2. Prefer branch and PR-based changes into `main`.
3. Run the safety script before push:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-git-safety.ps1
```

## Access Roles
Access control is maintained in `config/accessControl.shared.js` using Firebase Auth UID allowlists.

- `full`: admin-level access, including inventory management and inventory logs.
- `quote-only`: quote flow plus quote history.
- `sketch-only`: dashboard plus the sketch tool only.
- `guest`: not signed in / no UID.

Role precedence:

1. No UID -> `guest`
2. UID in `ADMIN_UIDS` -> `full`
3. UID in `SKETCH_ONLY_UIDS` -> `sketch-only`
4. Otherwise -> `quote-only`

Notes:
- `sketch-only` users cannot enter the quote flow.
- `quote-only` users can access `Mina Offerter`.
- Keep UID allowlists minimal and review them when access changes.

## Firestore Rules and Deploy Notes
The checked-in `firestore.rules` file currently allows:

- `/users/{uid}/quotes/{quoteId}` for the signed-in owner
- `/users/{uid}/quotes/{quoteId}/revisions/{revisionId}` for the signed-in owner
- `/users/{uid}/templates/{templateId}` for the signed-in owner
- `/stock/{docId}` for admins
- `/inventory_logs/{logId}` for admins
- admin read access to `templates` through collection-group queries
- all other document paths denied

Before deploy:

1. If admin UIDs change, keep `firestore.rules` and `config/accessControl.shared.js` synchronized.
2. Deploy rules through Firebase Console or Firebase CLI.

## Quote Lifecycle and Backfill
Quote lifecycle is enabled by default.

- You can disable it locally with `window.FEATURE_QUOTE_LIFECYCLE = false` before app scripts run.
- Optional metadata backfill script:

```powershell
node .\scripts\backfill-quote-metadata.mjs
```

The backfill script requires Firebase Admin credentials via `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Scrive Notes
Scrive support is currently reference-only:

- Scrive UI/actions are disabled.
- Existing Scrive metadata fields are retained for backward compatibility.
- `integrations/scrive-proxy/` remains a reference scaffold rather than an active runtime dependency.

## Legacy and Reference Notes
Actual legacy/reference assets:

- `index_legacy.html`
- older root shell files such as `app.js` and `data.js`
- `server.py`
- `start_server.bat`
- `start_tunnel.py`

Still-active shared code:

- `features/`
- `services/`
- `config/`

Use `npm run dev` for normal development unless you are intentionally debugging the older shell.

## Branch and Contribution Flow
Typical workflow:

```powershell
git checkout main
git pull
git checkout -b docs/readme-sync
# make changes
npm run test:run
npm run build
git add .
git commit -m "Sync QuoteGenerator README with current repo"
git push -u origin docs/readme-sync
```

Then open a PR to `main`.
