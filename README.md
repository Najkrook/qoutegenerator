# QuoteGenerator

Local quote/inventory tool for BRIXX.

## 1) First-time GitHub publish

Create an empty private repository on GitHub first (no README, no .gitignore, no license), then run:

```powershell
cd C:\Users\rooki\Documents\Antigravity\QuoteGenerator
git remote add origin https://github.com/<your-user>/<repo-name>.git
git push -u origin main
```

If `origin` already exists:

```powershell
git remote set-url origin https://github.com/<your-user>/<repo-name>.git
git push -u origin main
```

## 2) Verify sensitive-file safety before push

Run:

```powershell
git status
git ls-files
powershell -ExecutionPolicy Bypass -File .\scripts\verify-git-safety.ps1
```

The script fails if common secret files are tracked.

## 3) Security baseline (public repo)

1. Never commit secrets or local-only runtime files.
2. All changes must go through PRs into `main` (no direct pushes).
3. Run the safety script before every push:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-git-safety.ps1
```

## 4) Connect repository in Codex UI

In Codex:

1. `Select repository` -> `Configure Repositories on GitHub`
2. Authorize Codex app
3. Choose `Only select repositories`
4. Select this repository
5. Refresh repository list

Then create environment with:

- Startup command: `python server.py`
- App URL: `http://localhost:8000/index.html`

## 5) Daily workflow

```powershell
git checkout main
git pull
git checkout -b fix/<short-name>
# make changes
git add .
git commit -m "Describe change"
git push -u origin fix/<short-name>
```

Open a PR to `main` from GitHub.

## 6) Firestore security rules

This repository includes [`firestore.rules`](firestore.rules) with the intended baseline:

- Users can only access their own quotes: `/users/{uid}/quotes/*`
- Users can only access their own quote revisions: `/users/{uid}/quotes/*/revisions/*`
- Inventory and inventory logs are admin-only: `/stock/*`, `/inventory_logs/*`
- All other document paths are denied

Before deploy:

1. Replace `UID_ADMIN_1..3` in `firestore.rules` with your real Firebase Auth UIDs.
2. Deploy rules from Firebase console or Firebase CLI.

## 7) Quote lifecycle rollout notes

- Lifecycle is enabled by default. You can disable it locally by setting:
  - `window.FEATURE_QUOTE_LIFECYCLE = false` (before app scripts run)
- Legacy quote docs are still readable.
- Optional metadata backfill script:

```powershell
node .\scripts\backfill-quote-metadata.mjs
```

Requires Firebase Admin credentials (`GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`).

## 8) Scrive integration (feature-flagged)

- Frontend flag defaults to off. Enable only when proxy is deployed:
  - `window.FEATURE_SCRIVE = true`
  - `window.SCRIVE_PROXY_BASE_URL = "https://<cloud-run-url>"`
- Scrive proxy service is in `integrations/scrive-proxy/`.
- Configure Scrive/API secrets in Cloud Run env/Secret Manager.
- Scrive metadata is stored on quote metadata docs (`/users/{uid}/quotes/{quoteId}`).
