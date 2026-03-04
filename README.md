# QuoteGenerator

## What This Repo Is
QuoteGenerator is an internal quote and inventory application for BRIXX.

The active application in `main` is a React + Vite SPA with Firebase integration (Auth + Firestore). Legacy files are still present for reference, but they are not the default development path.

## Quick Start (Recommended: React + Vite)
### Prerequisites
- Node.js 20+ (LTS recommended)
- npm 10+

### Run locally
```powershell
cd C:\Users\rooki\Documents\Antigravity\QuoteGenerator
npm install
npm run dev
```

Default Vite dev URL:
- `http://localhost:5173` (unless overridden by local config/port conflict)

Firebase note:
- The app expects valid Firebase project configuration in the codebase/runtime environment.
- Never commit secrets or private credential files.

## Available Scripts
From the repository root:

- `npm run dev`: Start local Vite dev server.
- `npm run build`: Create production build in `dist/`.
- `npm run preview`: Preview production build locally.
- `npm run test`: Run Vitest in interactive mode.
- `npm run test:watch`: Run Vitest in watch mode.
- `npm run test:run`: Run Vitest once (basic reporter).

## Environment & Secrets
Do not commit secrets or local-only credentials.

Common sensitive/local files include:
- `.env`, `.env.*`, `*.env`
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

## Project Structure (Current App)
Main runtime code lives under `src/`:

- `src/views/`: Step-level application views.
- `src/components/`: Reusable UI building blocks.
- `src/store/`: Global app state/context (`AuthContext`, `QuoteContext`).
- `src/services/`: Firebase and domain service integrations.
- `src/utils/`: Shared helpers and calculation logic.
- `src/data/`: Catalog and static data.
- `src/config/`: Shared UI/config utilities.

Legacy files also exist in repository root (see Legacy section), but are not the primary app path.

## Core Workflow
The app uses state-driven navigation (not URL routing) and follows this quote flow:

1. Dashboard
2. Product Line Selection
3. Configuration
4. Pricing
5. Summary Export

## Testing and Build
Recommended validation before opening or merging a PR:

```powershell
npm run test:run
npm run build
```

Note:
- Vite may warn about large chunk sizes during build. This is informational unless your release policy says otherwise.

## Security and Git Safety
Baseline team policy:

1. Never commit secrets or local runtime files.
2. Use PR-based changes into `main` (avoid direct pushes to `main`).
3. Run the safety script before push:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-git-safety.ps1
```

## Firestore Rules and Deploy Notes
This repository includes `firestore.rules` with the intended baseline:

- Users can only access their own quotes: `/users/{uid}/quotes/*`
- Users can only access their own quote revisions: `/users/{uid}/quotes/*/revisions/*`
- Inventory and inventory logs are admin-only: `/stock/*`, `/inventory_logs/*`
- All other document paths are denied

Before deploy:

1. Replace `UID_ADMIN_1..3` values in `firestore.rules` with real Firebase Auth UIDs.
2. Deploy rules via Firebase Console or Firebase CLI.

Quote lifecycle notes:
- Lifecycle is enabled by default.
- You can disable locally with `window.FEATURE_QUOTE_LIFECYCLE = false` (set before app scripts run).
- Optional metadata backfill script:

```powershell
node .\scripts\backfill-quote-metadata.mjs
```

Requires Firebase Admin credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`).

Scrive integration notes:
- Scrive UI/actions are currently disabled.
- Existing Scrive metadata fields are retained for backward compatibility.
- `integrations/scrive-proxy/` remains as reference scaffold.

## Legacy/Reference Notes (Non-default)
These are kept for reference, fallback, or historical context. They are not the default development workflow.

- `server.py` and `start_server.bat`: legacy local server tooling.
- `index_legacy.html`: legacy UI entrypoint retained for rollback/reference.
- Some legacy modules under root `features/`/`services/` still exist alongside modern `src/` implementation.

Use React + Vite (`npm run dev`) unless you are explicitly debugging legacy behavior.

## Branch and Contribution Flow
Typical workflow:

```powershell
git checkout main
git pull
git checkout -b fix/<short-name>
# make changes
npm run test:run
npm run build
git add .
git commit -m "Describe change"
git push -u origin fix/<short-name>
```

Then open a PR to `main` in GitHub.
