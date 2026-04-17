#!/usr/bin/env python3
"""Napzinho Licensing Backend (MVP)

Simple JSON API using only Python stdlib.
- POST /api/activate
- GET  /api/entitlement?device_id=...
- POST /api/purchase/validate
- POST /api/admin/seed
"""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "napzinho.db"
SEED_PATH = ROOT / "preprogrammed_keys.json"
ADMIN_TOKEN = os.getenv("NAPZ_ADMIN_TOKEN", "change-me")
PORT = int(os.getenv("PORT", "8787"))
PURCHASE_VALIDATION_MODE = os.getenv("NAPZ_PURCHASE_VALIDATION_MODE", "disabled").strip().lower()
GOOGLE_PLAY_PACKAGE_NAME = os.getenv("GOOGLE_PLAY_PACKAGE_NAME", "").strip()
GOOGLE_PLAY_ACCESS_TOKEN = os.getenv("GOOGLE_PLAY_ACCESS_TOKEN", "").strip()
APPLE_SHARED_SECRET = os.getenv("APPLE_SHARED_SECRET", "").strip()
APPLE_JWS_VERIFY_URL = os.getenv("APPLE_JWS_VERIFY_URL", "").strip()
WIFE_LIFETIME_KEY = os.getenv("NAPZ_WIFE_LIFETIME_KEY", "").strip()


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS licenses (
                code TEXT PRIMARY KEY,
                tier TEXT NOT NULL CHECK(tier IN ('premium','lifetime')),
                expires_at TEXT NULL,
                max_activations INTEGER NOT NULL DEFAULT 1,
                activations INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                note TEXT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS redemptions (
                code TEXT NOT NULL,
                device_id TEXT NOT NULL,
                redeemed_at TEXT NOT NULL,
                PRIMARY KEY(code, device_id),
                FOREIGN KEY(code) REFERENCES licenses(code)
            );

            CREATE TABLE IF NOT EXISTS device_entitlements (
                device_id TEXT PRIMARY KEY,
                tier TEXT NOT NULL CHECK(tier IN ('free','premium','lifetime')),
                expires_at TEXT NULL,
                source_code TEXT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS store_purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL CHECK(platform IN ('google_play','apple_app_store')),
                product_id TEXT NOT NULL,
                purchase_token TEXT NULL,
                receipt_data TEXT NULL,
                jws TEXT NULL,
                transaction_id TEXT NULL,
                device_id TEXT NOT NULL,
                tier TEXT NOT NULL CHECK(tier IN ('premium','lifetime')),
                expires_at TEXT NULL,
                raw_payload TEXT NOT NULL,
                raw_validation TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )


def seed_preprogrammed_keys() -> int:
    if not SEED_PATH.exists():
        return 0
    data = json.loads(SEED_PATH.read_text())
    inserted = 0
    now = utcnow_iso()
    with get_conn() as conn:
        for key in data.get("keys", []):
            conn.execute(
                """
                INSERT INTO licenses(code, tier, expires_at, max_activations, activations, active, note, created_at, updated_at)
                VALUES(?, ?, ?, ?, 0, ?, ?, ?, ?)
                ON CONFLICT(code) DO NOTHING
                """,
                (
                    key["code"].strip(),
                    key.get("tier", "premium"),
                    key.get("expires_at"),
                    int(key.get("max_activations", 1)),
                    1 if key.get("active", True) else 0,
                    key.get("note"),
                    now,
                    now,
                ),
            )
            if conn.total_changes:
                inserted += 1
    return inserted


def seed_wife_lifetime_key() -> int:
    key = WIFE_LIFETIME_KEY
    if not key:
        return 0
    now = utcnow_iso()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO licenses(code, tier, expires_at, max_activations, activations, active, note, created_at, updated_at)
            VALUES(?, 'lifetime', NULL, 5, 0, 1, ?, ?, ?)
            ON CONFLICT(code) DO NOTHING
            """,
            (
                key,
                "Chave vitalícia pré-programada (esposa)",
                now,
                now,
            ),
        )
        if conn.total_changes:
            return 1
    return 0


def upsert_entitlement(conn: sqlite3.Connection, device_id: str, tier: str, expires_at: str | None, source_code: str | None) -> None:
    now = utcnow_iso()
    conn.execute(
        """
        INSERT INTO device_entitlements(device_id, tier, expires_at, source_code, updated_at)
        VALUES(?, ?, ?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET
            tier=excluded.tier,
            expires_at=excluded.expires_at,
            source_code=excluded.source_code,
            updated_at=excluded.updated_at
        """,
        (device_id, tier, expires_at, source_code, now),
    )


def get_entitlement(device_id: str) -> dict[str, Any]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT device_id, tier, expires_at, source_code, updated_at FROM device_entitlements WHERE device_id=?",
            (device_id,),
        ).fetchone()

    if not row:
        return {"device_id": device_id, "tier": "free", "source": "none"}

    tier = row["tier"]
    expires_at = row["expires_at"]
    if tier == "premium" and expires_at:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if exp <= datetime.now(timezone.utc):
            return {"device_id": device_id, "tier": "free", "source": "expired"}

    source_code = row["source_code"]
    source = "none"
    if source_code:
        source = "store" if str(source_code).startswith("store:") else "license"

    return {
        "device_id": row["device_id"],
        "tier": tier,
        "expires_at": expires_at,
        "source": source,
        "source_code": source_code,
        "updated_at": row["updated_at"],
    }


def activate_code(code: str, device_id: str) -> tuple[int, dict[str, Any]]:
    code = code.strip()
    if not code:
        return 400, {"error": "Código vazio"}
    if not device_id.strip():
        return 400, {"error": "device_id obrigatório"}

    with get_conn() as conn:
        lic = conn.execute("SELECT * FROM licenses WHERE code=?", (code,)).fetchone()
        if not lic:
            return 404, {"error": "Chave não encontrada"}
        if int(lic["active"]) != 1:
            return 403, {"error": "Chave desativada"}

        expires_at = lic["expires_at"]
        if expires_at:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp <= datetime.now(timezone.utc):
                return 403, {"error": "Chave expirada"}

        existing = conn.execute(
            "SELECT 1 FROM redemptions WHERE code=? AND device_id=?",
            (code, device_id),
        ).fetchone()

        if not existing and lic["activations"] >= lic["max_activations"]:
            return 403, {"error": "Limite de ativações atingido"}

        if not existing:
            conn.execute(
                "INSERT INTO redemptions(code, device_id, redeemed_at) VALUES(?, ?, ?)",
                (code, device_id, utcnow_iso()),
            )
            conn.execute(
                "UPDATE licenses SET activations=activations+1, updated_at=? WHERE code=?",
                (utcnow_iso(), code),
            )

        upsert_entitlement(conn, device_id, lic["tier"], expires_at, code)

        return 200, {
            "ok": True,
            "device_id": device_id,
            "tier": lic["tier"],
            "expires_at": expires_at,
            "source_code": code,
        }


def list_licenses() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT code, tier, expires_at, max_activations, activations, active, note, created_at, updated_at
            FROM licenses
            ORDER BY created_at DESC
            """
        ).fetchall()
    return [
        {
            "code": r["code"],
            "tier": r["tier"],
            "expires_at": r["expires_at"],
            "max_activations": r["max_activations"],
            "activations": r["activations"],
            "active": bool(r["active"]),
            "note": r["note"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


def deactivate_license(code: str) -> tuple[int, dict[str, Any]]:
    code = code.strip()
    if not code:
        return 400, {"error": "code obrigatório"}
    with get_conn() as conn:
        row = conn.execute("SELECT code FROM licenses WHERE code=?", (code,)).fetchone()
        if not row:
            return 404, {"error": "chave não encontrada"}
        conn.execute("UPDATE licenses SET active=0, updated_at=? WHERE code=?", (utcnow_iso(), code))
    return 200, {"ok": True, "code": code, "active": False}


def _http_json(url: str, method: str = "GET", headers: dict[str, str] | None = None, body: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
    payload = None
    req_headers = headers or {}
    if body is not None:
        payload = json.dumps(body).encode("utf-8")
        req_headers = {**req_headers, "Content-Type": "application/json"}
    req = Request(url=url, data=payload, method=method, headers=req_headers)
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            return resp.status, data
    except HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return e.code, parsed
    except URLError as e:
        return 503, {"error": f"network_error: {e}"}


def _to_iso_from_ms(ms: str | int | None) -> str | None:
    if ms is None:
        return None
    try:
        v = int(ms)
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(v / 1000, tz=timezone.utc).isoformat()


def validate_google_play(payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    token = str(payload.get("purchase_token", "")).strip()
    product_id = str(payload.get("product_id", "")).strip()
    subscription_id = str(payload.get("subscription_id", "")).strip()
    package_name = str(payload.get("package_name", "")).strip() or GOOGLE_PLAY_PACKAGE_NAME

    if not token:
        return 400, {"error": "purchase_token obrigatório para Google Play"}

    if PURCHASE_VALIDATION_MODE == "mock":
        expires_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        if token.startswith("mock_lifetime_"):
            return 200, {"ok": True, "tier": "lifetime", "expires_at": None, "product_id": product_id or subscription_id, "platform": "google_play", "validation_mode": "mock"}
        if token.startswith("mock_premium_"):
            plus_days = int(payload.get("mock_days", 30))
            exp = datetime.now(timezone.utc).timestamp() + (plus_days * 86400)
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).isoformat()
            return 200, {"ok": True, "tier": "premium", "expires_at": expires_at, "product_id": product_id or subscription_id, "platform": "google_play", "validation_mode": "mock"}
        return 403, {"error": "mock token inválido"}

    if PURCHASE_VALIDATION_MODE != "live":
        return 501, {"error": "purchase validation desabilitada (defina NAPZ_PURCHASE_VALIDATION_MODE=live|mock)"}
    if not GOOGLE_PLAY_ACCESS_TOKEN:
        return 500, {"error": "GOOGLE_PLAY_ACCESS_TOKEN ausente"}
    if not package_name:
        return 400, {"error": "package_name obrigatório para Google Play"}

    headers = {"Authorization": f"Bearer {GOOGLE_PLAY_ACCESS_TOKEN}"}

    if subscription_id:
        url = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{quote(package_name)}/purchases/subscriptionsv2/tokens/{quote(token)}"
        status, data = _http_json(url, headers=headers)
        if status != 200:
            return 403, {"error": "falha ao validar subscription token na Google", "google_status": status, "google_body": data}
        line_items = data.get("lineItems") or []
        latest_exp = None
        for item in line_items:
            exp = item.get("expiryTime")
            if exp and (latest_exp is None or exp > latest_exp):
                latest_exp = exp
        if not latest_exp:
            return 403, {"error": "subscription sem expiryTime válido", "google_body": data}
        return 200, {"ok": True, "tier": "premium", "expires_at": latest_exp, "product_id": subscription_id, "platform": "google_play", "validation_mode": "live", "google_body": data}

    if not product_id:
        return 400, {"error": "product_id obrigatório quando subscription_id não for informado"}

    url = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{quote(package_name)}/purchases/products/{quote(product_id)}/tokens/{quote(token)}"
    status, data = _http_json(url, headers=headers)
    if status != 200:
        return 403, {"error": "falha ao validar product token na Google", "google_status": status, "google_body": data}
    purchase_state = int(data.get("purchaseState", 1))
    if purchase_state != 0:
        return 403, {"error": "compra não está no estado PURCHASED", "google_body": data}
    return 200, {"ok": True, "tier": "lifetime", "expires_at": None, "product_id": product_id, "platform": "google_play", "validation_mode": "live", "google_body": data}


def validate_apple_store(payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    receipt_data = str(payload.get("receipt_data", "")).strip()
    signed_jws = str(payload.get("signed_transaction_info", "")).strip()
    product_id = str(payload.get("product_id", "")).strip()

    if PURCHASE_VALIDATION_MODE == "mock":
        if signed_jws.startswith("mock_lifetime_") or receipt_data.startswith("mock_lifetime_"):
            return 200, {"ok": True, "tier": "lifetime", "expires_at": None, "product_id": product_id, "platform": "apple_app_store", "validation_mode": "mock"}
        if signed_jws.startswith("mock_premium_") or receipt_data.startswith("mock_premium_"):
            plus_days = int(payload.get("mock_days", 30))
            exp = datetime.now(timezone.utc).timestamp() + (plus_days * 86400)
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc).isoformat()
            return 200, {"ok": True, "tier": "premium", "expires_at": expires_at, "product_id": product_id, "platform": "apple_app_store", "validation_mode": "mock"}
        return 403, {"error": "mock receipt/JWS inválido"}

    if PURCHASE_VALIDATION_MODE != "live":
        return 501, {"error": "purchase validation desabilitada (defina NAPZ_PURCHASE_VALIDATION_MODE=live|mock)"}

    if signed_jws:
        if not APPLE_JWS_VERIFY_URL:
            return 500, {"error": "APPLE_JWS_VERIFY_URL ausente para validar signed_transaction_info"}
        status, data = _http_json(
            APPLE_JWS_VERIFY_URL,
            method="POST",
            body={"signed_transaction_info": signed_jws, "product_id": product_id},
        )
        if status != 200 or not data.get("ok"):
            return 403, {"error": "falha ao validar JWS da Apple", "apple_status": status, "apple_body": data}
        tier = str(data.get("tier", "premium"))
        expires_at = data.get("expires_at")
        return 200, {"ok": True, "tier": tier, "expires_at": expires_at, "product_id": product_id, "platform": "apple_app_store", "validation_mode": "live", "apple_body": data}

    if not receipt_data:
        return 400, {"error": "receipt_data ou signed_transaction_info obrigatório para Apple"}

    body = {"receipt-data": receipt_data, "exclude-old-transactions": True}
    if APPLE_SHARED_SECRET:
        body["password"] = APPLE_SHARED_SECRET
    status, data = _http_json("https://buy.itunes.apple.com/verifyReceipt", method="POST", body=body)
    if status == 200 and int(data.get("status", -1)) == 21007:
        status, data = _http_json("https://sandbox.itunes.apple.com/verifyReceipt", method="POST", body=body)
    if status != 200 or int(data.get("status", -1)) != 0:
        return 403, {"error": "falha ao validar receipt na Apple", "apple_status": status, "apple_body": data}

    latest_receipt = data.get("latest_receipt_info") or []
    in_app = data.get("receipt", {}).get("in_app", [])
    rows = latest_receipt if latest_receipt else in_app
    if not rows:
        return 403, {"error": "receipt sem transações válidas", "apple_body": data}

    latest_exp_ms = None
    latest_product = product_id or ""
    for row in rows:
        exp_ms = row.get("expires_date_ms")
        pid = row.get("product_id")
        if pid and not latest_product:
            latest_product = pid
        if exp_ms and (latest_exp_ms is None or int(exp_ms) > int(latest_exp_ms)):
            latest_exp_ms = exp_ms

    if latest_exp_ms is None:
        return 200, {"ok": True, "tier": "lifetime", "expires_at": None, "product_id": latest_product, "platform": "apple_app_store", "validation_mode": "live", "apple_body": data}

    expires_at = _to_iso_from_ms(latest_exp_ms)
    if not expires_at:
        return 403, {"error": "expires_date_ms inválido no receipt", "apple_body": data}
    if datetime.fromisoformat(expires_at) <= datetime.now(timezone.utc):
        return 403, {"error": "assinatura Apple expirada", "apple_body": data}

    return 200, {"ok": True, "tier": "premium", "expires_at": expires_at, "product_id": latest_product, "platform": "apple_app_store", "validation_mode": "live", "apple_body": data}


def store_purchase(payload: dict[str, Any], validation: dict[str, Any], platform: str, device_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO store_purchases(platform, product_id, purchase_token, receipt_data, jws, transaction_id, device_id, tier, expires_at, raw_payload, raw_validation, created_at)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                platform,
                str(validation.get("product_id", "")).strip(),
                str(payload.get("purchase_token", "")).strip() or None,
                str(payload.get("receipt_data", "")).strip() or None,
                str(payload.get("signed_transaction_info", "")).strip() or None,
                str(payload.get("transaction_id", "")).strip() or None,
                device_id,
                str(validation.get("tier", "premium")),
                validation.get("expires_at"),
                json.dumps(payload, ensure_ascii=False),
                json.dumps(validation, ensure_ascii=False),
                utcnow_iso(),
            ),
        )


def validate_store_purchase(payload: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    platform = str(payload.get("platform", "")).strip()
    device_id = str(payload.get("device_id", "")).strip()
    if not platform:
        return 400, {"error": "platform obrigatório (google_play|apple_app_store)"}
    if platform not in {"google_play", "apple_app_store"}:
        return 400, {"error": "platform inválido"}
    if not device_id:
        return 400, {"error": "device_id obrigatório"}

    if platform == "google_play":
        status, validation = validate_google_play(payload)
    else:
        status, validation = validate_apple_store(payload)
    if status != 200:
        return status, validation

    tier = str(validation.get("tier", "premium"))
    expires_at = validation.get("expires_at")
    product_id = str(validation.get("product_id", "")).strip()
    source_code = f"store:{platform}:{product_id or 'unknown'}"

    with get_conn() as conn:
        upsert_entitlement(conn, device_id, tier, expires_at, source_code)
    store_purchase(payload, validation, platform, device_id)

    return 200, {
        "ok": True,
        "device_id": device_id,
        "tier": tier,
        "expires_at": expires_at,
        "source": "store",
        "platform": platform,
        "product_id": product_id,
        "validation_mode": validation.get("validation_mode", PURCHASE_VALIDATION_MODE),
    }


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return {}

    def _is_admin(self) -> bool:
        return self.headers.get("X-Admin-Token", "") == ADMIN_TOKEN

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send_json(200, {"ok": True})

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(200, {"ok": True, "service": "napzinho-license-api"})
            return

        if parsed.path == "/api/entitlement":
            qs = parse_qs(parsed.query)
            device_id = (qs.get("device_id") or [""])[0].strip()
            if not device_id:
                self._send_json(400, {"error": "device_id obrigatório"})
                return
            self._send_json(200, get_entitlement(device_id))
            return

        if parsed.path == "/api/admin/licenses":
            if not self._is_admin():
                self._send_json(401, {"error": "não autorizado"})
                return
            self._send_json(200, {"items": list_licenses()})
            return

        self._send_json(404, {"error": "rota não encontrada"})

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        data = self._read_json()

        if parsed.path == "/api/activate":
            status, payload = activate_code(data.get("code", ""), data.get("device_id", ""))
            self._send_json(status, payload)
            return

        if parsed.path == "/api/purchase/validate":
            status, payload = validate_store_purchase(data)
            self._send_json(status, payload)
            return

        if parsed.path == "/api/admin/seed":
            if not self._is_admin():
                self._send_json(401, {"error": "não autorizado"})
                return

            code = str(data.get("code", "")).strip()
            tier = data.get("tier", "premium")
            expires_at = data.get("expires_at")
            max_activations = int(data.get("max_activations", 1))
            note = data.get("note")
            if not code:
                self._send_json(400, {"error": "code obrigatório"})
                return
            if tier not in {"premium", "lifetime"}:
                self._send_json(400, {"error": "tier inválido"})
                return

            now = utcnow_iso()
            with get_conn() as conn:
                conn.execute(
                    """
                    INSERT INTO licenses(code, tier, expires_at, max_activations, activations, active, note, created_at, updated_at)
                    VALUES(?, ?, ?, ?, 0, 1, ?, ?, ?)
                    ON CONFLICT(code) DO UPDATE SET
                        tier=excluded.tier,
                        expires_at=excluded.expires_at,
                        max_activations=excluded.max_activations,
                        active=1,
                        note=excluded.note,
                        updated_at=excluded.updated_at
                    """,
                    (code, tier, expires_at, max_activations, note, now, now),
                )
            self._send_json(200, {"ok": True, "code": code, "tier": tier, "max_activations": max_activations})
            return

        if parsed.path == "/api/admin/deactivate":
            if not self._is_admin():
                self._send_json(401, {"error": "não autorizado"})
                return
            status, payload = deactivate_license(str(data.get("code", "")))
            self._send_json(status, payload)
            return

        self._send_json(404, {"error": "rota não encontrada"})


if __name__ == "__main__":
    init_db()
    inserted = seed_preprogrammed_keys()
    wife_seeded = seed_wife_lifetime_key()
    print(f"[napzinho-license-api] seeded {inserted} preprogrammed keys")
    if WIFE_LIFETIME_KEY:
        print(f"[napzinho-license-api] wife lifetime key seeded: {wife_seeded}")
    print(f"[napzinho-license-api] running on http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
