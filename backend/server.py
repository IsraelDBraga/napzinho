#!/usr/bin/env python3
"""Napzinho Licensing Backend (MVP)

Simple JSON API using only Python stdlib.
- POST /api/activate
- GET  /api/entitlement?device_id=...
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
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "napzinho.db"
SEED_PATH = ROOT / "preprogrammed_keys.json"
ADMIN_TOKEN = os.getenv("NAPZ_ADMIN_TOKEN", "change-me")
PORT = int(os.getenv("PORT", "8787"))


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

    return {
        "device_id": row["device_id"],
        "tier": tier,
        "expires_at": expires_at,
        "source": "license" if row["source_code"] else "none",
        "source_code": row["source_code"],
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
    print(f"[napzinho-license-api] seeded {inserted} preprogrammed keys")
    print(f"[napzinho-license-api] running on http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
