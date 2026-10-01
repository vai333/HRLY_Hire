"""Thin Supabase data layer. Uses the service-role key server-side only; RLS stays on with no public policies."""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import List, Optional

from .config import get_settings


@lru_cache
def sb():
    from supabase import create_client

    s = get_settings()
    if not (s.supabase_url and s.supabase_service_key):
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    return create_client(s.supabase_url, s.supabase_service_key)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------- candidates

def insert_candidate(row: dict) -> dict:
    return sb().table("candidates").insert(row).execute().data[0]


def update_candidate(cid: str, fields: dict) -> None:
    sb().table("candidates").update({**fields, "updated_at": now()}).eq("id", cid).execute()


def get_candidate(cid: str) -> Optional[dict]:
    rows = sb().table("candidates").select("*").eq("id", cid).limit(1).execute().data
    return rows[0] if rows else None


def find_candidate(email: str, role: str) -> Optional[dict]:
    pattern = email.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")  # literal, case-insensitive match
    rows = sb().table("candidates").select("id").ilike("email", pattern).eq("applied_role", role).limit(1).execute().data
    return rows[0] if rows else None


def list_candidates() -> List[dict]:
    return (
        sb().table("candidates")
        .select("id,name,applied_role,source,status,error,created_at,cv_filename,"
                "evaluations(role,final_total,raw_total,recommendation),emails(status,email_type,sent_at)")
        .order("created_at", desc=True)
        .execute()
        .data
    )


def delete_candidate(cid: str) -> None:
    cand = get_candidate(cid)
    if cand and cand.get("cv_path"):
        try:
            sb().storage.from_(get_settings().storage_bucket).remove([cand["cv_path"]])
        except Exception:  # noqa: BLE001 — row deletion matters more than the orphaned file
            pass
    sb().table("candidates").delete().eq("id", cid).execute()


# ---------------------------------------------------------------- evaluations

def upsert_evaluation(cid: str, role: str, ev: dict) -> None:
    sb().table("evaluations").upsert({
        "candidate_id": cid,
        "role": role,
        "raw_total": ev["raw_total"],
        "final_total": ev["final_total"],
        "recommendation": ev["recommendation"],
        "json_data": ev,
        "updated_at": now(),
    }, on_conflict="candidate_id,role").execute()


def get_evaluations(cid: str) -> dict:
    rows = sb().table("evaluations").select("role,json_data").eq("candidate_id", cid).execute().data
    return {r["role"]: r["json_data"] for r in rows}


# ---------------------------------------------------------------- emails

def upsert_email(cid: str, fields: dict) -> None:
    sb().table("emails").upsert({"candidate_id": cid, **fields, "updated_at": now()}, on_conflict="candidate_id").execute()


def update_email(cid: str, fields: dict) -> None:
    """Partial update of an existing draft (an upsert would hit NOT NULL columns on the insert path)."""
    sb().table("emails").update({**fields, "updated_at": now()}).eq("candidate_id", cid).execute()


def get_email(cid: str) -> Optional[dict]:
    rows = sb().table("emails").select("*").eq("candidate_id", cid).limit(1).execute().data
    return rows[0] if rows else None


# ---------------------------------------------------------------- storage

def upload_cv(path: str, data: bytes, content_type: str) -> None:
    sb().storage.from_(get_settings().storage_bucket).upload(
        path, data, {"content-type": content_type, "upsert": "true"}
    )


def cv_signed_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return None
    try:
        res = sb().storage.from_(get_settings().storage_bucket).create_signed_url(path, 3600)
    except Exception:  # noqa: BLE001
        return None
    if isinstance(res, dict):
        return res.get("signedURL") or res.get("signedUrl")
    return getattr(res, "signed_url", None)
