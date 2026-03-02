# QuoteGenerator

Local quote/inventory tool for BRIXX.

## 1) First-time GitHub publish (private repo)

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

## 3) Connect repository in Codex UI

In Codex:

1. `Select repository` -> `Configure Repositories on GitHub`
2. Authorize Codex app
3. Choose `Only select repositories`
4. Select this private repository
5. Refresh repository list

Then create environment with:

- Startup command: `python server.py`
- App URL: `http://localhost:8000/index.html`

## 4) Daily workflow

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

