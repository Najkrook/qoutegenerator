# Scrive Proxy (Cloud Run)

Backend service for QuoteGenerator Scrive integration.

## Endpoints

- `POST /api/scrive/send`  
  Authenticated with Firebase ID token. Creates/updates/starts Scrive document and writes Scrive metadata to quote.
- `POST /api/scrive/sync`  
  Authenticated with Firebase ID token. Refreshes Scrive status for existing document.
- `POST /api/scrive/callback?token=...`  
  Called by Scrive. Updates quote Scrive status idempotently.
- `GET /healthz`

## Required env vars

- `SCRIVE_API_BASE` (example `https://scrive.com/api/v2`)
- `SCRIVE_API_TOKEN`
- `SCRIVE_API_SECRET`
- `SCRIVE_ACCESS_TOKEN`
- `SCRIVE_ACCESS_SECRET`
- `SCRIVE_CALLBACK_TOKEN`
- `SCRIVE_PUBLIC_BASE_URL` (public HTTPS base for callback URL)
- `FIREBASE_PROJECT_ID` (optional if inferred by runtime credentials)
- `SCRIVE_ALLOWED_ORIGINS` (comma-separated or `*`)

## Local run

```powershell
cd integrations\scrive-proxy
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080 --env-file .env
```

## Cloud Run deploy example

```powershell
cd integrations\scrive-proxy
gcloud run deploy qg-scrive-proxy `
  --source . `
  --region europe-north1 `
  --allow-unauthenticated `
  --set-env-vars SCRIVE_API_BASE=https://scrive.com/api/v2,FIREBASE_PROJECT_ID=<project-id>,SCRIVE_PUBLIC_BASE_URL=<https-url>,SCRIVE_ALLOWED_ORIGINS=<https://your-app-origin>
```

Set the remaining secrets (`SCRIVE_*`) via Secret Manager or Cloud Run secret mounts.

## Frontend wiring

Set in page bootstrap (before loading app/history modules):

```html
<script>
  window.FEATURE_SCRIVE = true;
  window.SCRIVE_PROXY_BASE_URL = "https://<your-cloud-run-url>";
</script>
```
