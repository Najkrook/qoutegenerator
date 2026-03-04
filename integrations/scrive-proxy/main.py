import base64
import json
import os
import time
import uuid
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote

import requests
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore


SCRIVE_API_BASE = os.getenv("SCRIVE_API_BASE", "https://scrive.com/api/v2").rstrip("/")
SCRIVE_API_TOKEN = os.getenv("SCRIVE_API_TOKEN", "").strip()
SCRIVE_API_SECRET = os.getenv("SCRIVE_API_SECRET", "").strip()
SCRIVE_ACCESS_TOKEN = os.getenv("SCRIVE_ACCESS_TOKEN", "").strip()
SCRIVE_ACCESS_SECRET = os.getenv("SCRIVE_ACCESS_SECRET", "").strip()
SCRIVE_CALLBACK_TOKEN = os.getenv("SCRIVE_CALLBACK_TOKEN", "").strip()
SCRIVE_PUBLIC_BASE_URL = os.getenv("SCRIVE_PUBLIC_BASE_URL", "").strip().rstrip("/")
SCRIVE_ALLOWED_ORIGINS = os.getenv("SCRIVE_ALLOWED_ORIGINS", "*").strip()
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "").strip() or None


def _require_env(name: str, value: str) -> None:
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")


if not firebase_admin._apps:
    firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID} if FIREBASE_PROJECT_ID else None)

DB = firestore.client()

app = FastAPI(title="QuoteGenerator Scrive Proxy", version="1.0.0")

allowed_origins = ["*"] if SCRIVE_ALLOWED_ORIGINS == "*" else [o.strip() for o in SCRIVE_ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SendRequest(BaseModel):
    quoteId: str = Field(min_length=1)
    revisionVersion: int = 1
    signerName: str = Field(default="Kund")
    signerEmail: str = Field(min_length=3)
    quoteTitle: str = Field(default="Offert")
    fileName: str = Field(default="offert.pdf")
    pdfBase64: str = Field(min_length=1)


class SyncRequest(BaseModel):
    quoteId: str = Field(min_length=1)


def _oauth_header() -> str:
    _require_env("SCRIVE_API_TOKEN", SCRIVE_API_TOKEN)
    _require_env("SCRIVE_API_SECRET", SCRIVE_API_SECRET)
    _require_env("SCRIVE_ACCESS_TOKEN", SCRIVE_ACCESS_TOKEN)
    _require_env("SCRIVE_ACCESS_SECRET", SCRIVE_ACCESS_SECRET)
    signature = f"{quote(SCRIVE_API_SECRET, safe='')}%26{quote(SCRIVE_ACCESS_SECRET, safe='')}"
    oauth_params = {
        "oauth_consumer_key": SCRIVE_API_TOKEN,
        "oauth_token": SCRIVE_ACCESS_TOKEN,
        "oauth_signature_method": "PLAINTEXT",
        "oauth_signature": signature,
        "oauth_timestamp": str(int(time.time())),
        "oauth_nonce": uuid.uuid4().hex,
        "oauth_version": "1.0",
    }
    joined = ", ".join([f'{key}="{value}"' for key, value in oauth_params.items()])
    return f"OAuth {joined}"


def _scrive_request(method: str, path: str, **kwargs: Any) -> requests.Response:
    headers = kwargs.pop("headers", {}) or {}
    headers["Authorization"] = _oauth_header()
    url = f"{SCRIVE_API_BASE}{path}"
    response = requests.request(method=method, url=url, headers=headers, timeout=30, **kwargs)
    return response


def _extract_document_id(payload: Dict[str, Any]) -> Optional[str]:
    for key in ("document_id", "id", "documentId"):
        if payload.get(key):
            return str(payload[key])
    return None


def _normalize_scrive_status(raw_status: Optional[str]) -> str:
    normalized = str(raw_status or "").strip().lower()
    if normalized == "document_error":
        return "failed"
    valid = {"preparation", "pending", "closed", "rejected", "canceled", "timedout", "failed", "not_sent"}
    if normalized in valid:
        return normalized
    return "pending"


def _verify_user(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.replace("Bearer ", "", 1).strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Token missing uid")
    return str(uid)


def _quote_ref(uid: str, quote_id: str):
    return DB.collection("users").document(uid).collection("quotes").document(quote_id)


def _get_quote(uid: str, quote_id: str) -> Tuple[Dict[str, Any], Any]:
    ref = _quote_ref(uid, quote_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Quote not found")
    data = snap.to_dict() or {}
    return data, ref


def _build_callback_url() -> str:
    _require_env("SCRIVE_PUBLIC_BASE_URL", SCRIVE_PUBLIC_BASE_URL)
    _require_env("SCRIVE_CALLBACK_TOKEN", SCRIVE_CALLBACK_TOKEN)
    return f"{SCRIVE_PUBLIC_BASE_URL}/api/scrive/callback?token={SCRIVE_CALLBACK_TOKEN}"


def _map_callback_payload_to_status(payload: Dict[str, Any], signed_and_sealed: bool) -> str:
    raw_status = payload.get("status") or payload.get("document_status")
    status = _normalize_scrive_status(raw_status)
    if signed_and_sealed:
        return "closed"
    return status


def _extract_tags(document_json: Dict[str, Any]) -> Dict[str, str]:
    tags = document_json.get("tags", {})
    if isinstance(tags, dict):
        return {str(k): str(v) for k, v in tags.items()}
    if isinstance(tags, list):
        mapped: Dict[str, str] = {}
        for item in tags:
            if isinstance(item, dict) and "name" in item:
                mapped[str(item.get("name"))] = str(item.get("value", ""))
        return mapped
    return {}


def _upsert_scrive_metadata(uid: str, quote_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    _, ref = _get_quote(uid, quote_id)
    patch["updatedAtMs"] = int(time.time() * 1000)
    ref.set(patch, merge=True)
    refreshed = ref.get().to_dict() or {}
    return refreshed


@app.get("/healthz")
def healthz() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/scrive/send")
def send_to_scrive(payload: SendRequest, authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    uid = _verify_user(authorization)
    quote, _ = _get_quote(uid, payload.quoteId)

    try:
        pdf_bytes = base64.b64decode(payload.pdfBase64, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid PDF payload: {exc}") from exc
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="PDF payload is empty")

    files = {
        "file": (payload.fileName or "offert.pdf", pdf_bytes, "application/pdf")
    }
    create_res = _scrive_request("POST", "/documents/new", files=files, data={"title": payload.quoteTitle})
    if not create_res.ok:
        raise HTTPException(status_code=502, detail=f"Scrive create failed: {create_res.text[:300]}")
    create_json = create_res.json() if create_res.text else {}
    document_id = _extract_document_id(create_json)
    if not document_id:
        raise HTTPException(status_code=502, detail="Scrive did not return document_id")

    update_payload = {
        "title": payload.quoteTitle,
        "api_callback_url": _build_callback_url(),
        "parties": json.dumps([
            {
                "is_signatory": True,
                "fields": [
                    {"type": "name", "value": payload.signerName},
                    {"type": "email", "value": payload.signerEmail}
                ]
            }
        ]),
        "tags": json.dumps([
            {"name": "qg_quote_id", "value": payload.quoteId},
            {"name": "qg_user_id", "value": uid},
            {"name": "qg_revision", "value": str(payload.revisionVersion)}
        ])
    }
    update_res = _scrive_request("POST", f"/documents/{document_id}/update", data=update_payload)
    if not update_res.ok:
        raise HTTPException(status_code=502, detail=f"Scrive update failed: {update_res.text[:300]}")

    start_res = _scrive_request("POST", f"/documents/{document_id}/start", params={"strict_validations": "true"})
    if not start_res.ok:
        raise HTTPException(status_code=502, detail=f"Scrive start failed: {start_res.text[:300]}")

    now_ms = int(time.time() * 1000)
    metadata = _upsert_scrive_metadata(
        uid,
        payload.quoteId,
        {
            "scriveEnabled": True,
            "scriveStatus": "pending",
            "scriveDocumentId": document_id,
            "scriveSignerName": payload.signerName or quote.get("customerName") or "",
            "scriveSignerEmail": payload.signerEmail,
            "scriveLastError": None,
            "scriveSentAtMs": now_ms,
            "scriveLastEventAtMs": now_ms
        }
    )
    return {
        "quoteId": payload.quoteId,
        "scriveDocumentId": document_id,
        "scriveStatus": metadata.get("scriveStatus", "pending"),
        "sentAtMs": metadata.get("scriveSentAtMs", now_ms),
        "scriveSignerName": metadata.get("scriveSignerName", ""),
        "scriveSignerEmail": metadata.get("scriveSignerEmail", "")
    }


@app.post("/api/scrive/sync")
def sync_scrive(payload: SyncRequest, authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    uid = _verify_user(authorization)
    quote, _ = _get_quote(uid, payload.quoteId)
    document_id = str(quote.get("scriveDocumentId") or "").strip()
    if not document_id:
        return {
            "quoteId": payload.quoteId,
            "scriveEnabled": bool(quote.get("scriveEnabled")),
            "scriveStatus": quote.get("scriveStatus") or "not_sent",
            "scriveDocumentId": None
        }

    fetch_res = _scrive_request("GET", f"/documents/{document_id}/get")
    if not fetch_res.ok:
        raise HTTPException(status_code=502, detail=f"Scrive sync failed: {fetch_res.text[:300]}")
    fetch_json = fetch_res.json() if fetch_res.text else {}
    normalized_status = _normalize_scrive_status(fetch_json.get("status"))
    now_ms = int(time.time() * 1000)
    patch: Dict[str, Any] = {
        "scriveStatus": normalized_status,
        "scriveLastError": None,
        "scriveLastEventAtMs": now_ms
    }
    if normalized_status == "closed" and not quote.get("scriveCompletedAtMs"):
        patch["scriveCompletedAtMs"] = now_ms

    metadata = _upsert_scrive_metadata(uid, payload.quoteId, patch)
    return {
        "quoteId": payload.quoteId,
        "scriveEnabled": bool(metadata.get("scriveEnabled")),
        "scriveStatus": metadata.get("scriveStatus") or "pending",
        "scriveDocumentId": metadata.get("scriveDocumentId"),
        "scriveSignerName": metadata.get("scriveSignerName", ""),
        "scriveSignerEmail": metadata.get("scriveSignerEmail", ""),
        "scriveLastError": metadata.get("scriveLastError"),
        "scriveSentAtMs": metadata.get("scriveSentAtMs"),
        "scriveLastEventAtMs": metadata.get("scriveLastEventAtMs"),
        "scriveCompletedAtMs": metadata.get("scriveCompletedAtMs")
    }


@app.post("/api/scrive/callback")
async def scrive_callback(request: Request) -> Dict[str, Any]:
    token = request.query_params.get("token", "")
    _require_env("SCRIVE_CALLBACK_TOKEN", SCRIVE_CALLBACK_TOKEN)
    if token != SCRIVE_CALLBACK_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid callback token")

    payload: Dict[str, Any] = {}
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
    else:
        form = await request.form()
        payload = {k: v for k, v in form.items()}

    document_id = str(payload.get("document_id") or "").strip()
    signed_and_sealed = str(payload.get("document_signed_and_sealed") or "").lower() in {"1", "true", "yes"}

    document_json_raw = payload.get("document_json")
    document_json: Dict[str, Any] = {}
    if isinstance(document_json_raw, str) and document_json_raw.strip():
        try:
            document_json = json.loads(document_json_raw)
        except Exception:  # noqa: BLE001
            document_json = {}
    elif isinstance(document_json_raw, dict):
        document_json = document_json_raw

    tags = _extract_tags(document_json)
    quote_id = tags.get("qg_quote_id", "")
    uid = tags.get("qg_user_id", "")

    if (not quote_id or not uid) and document_id:
        matches = DB.collection_group("quotes").where("scriveDocumentId", "==", document_id).limit(1).stream()
        first = next(matches, None)
        if first is not None:
            quote_id = first.id
            parent = first.reference.parent.parent
            uid = parent.id if parent else ""

    if not quote_id or not uid:
        return {"ok": True, "ignored": True, "reason": "missing quote mapping"}

    existing, _ = _get_quote(uid, quote_id)
    status = _map_callback_payload_to_status(document_json, signed_and_sealed)
    now_ms = int(time.time() * 1000)

    patch: Dict[str, Any] = {
        "scriveStatus": status,
        "scriveLastError": None,
        "scriveLastEventAtMs": now_ms
    }
    if document_id:
        patch["scriveDocumentId"] = document_id
    if signed_and_sealed or status == "closed":
        patch["scriveCompletedAtMs"] = existing.get("scriveCompletedAtMs") or now_ms

    _upsert_scrive_metadata(uid, quote_id, patch)
    return {"ok": True}
