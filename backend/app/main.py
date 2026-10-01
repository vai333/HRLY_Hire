"""HRLY API — FastAPI app. Served by uvicorn locally and as a Vercel Python function in production.

Pipeline (matches the Case 2 components map):
  upload CV + role → extract + strip PII → score PM & SPM (Gemini) → brief + email draft (Gemini)
  → founder reviews → Resend sends only when the founder clicks Send.
"""
from __future__ import annotations

import hmac
import logging
import re
import time
import uuid
from collections import defaultdict
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .config import get_settings
from .cv_parser import SUPPORTED_EXTENSIONS, contact_mismatch_note, detect_contact, extract_text, redact
from .emailer import EMAIL_TYPES, draft_email, personalise, send_email
from .rubric import ROLE_LABEL, ROLES, load_rubrics
from .schemas import EmailUpdate, RegenerateEmail
from .scoring import email_type_for, score_both

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("hrly")

app = FastAPI(title="HRLY API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}


def require_passcode(x_hrly_passcode: Optional[str] = Header(default=None)) -> None:
    expected = get_settings().app_passcode
    if expected and not hmac.compare_digest(x_hrly_passcode or "", expected):
        raise HTTPException(401, "Invalid passcode")


auth = [Depends(require_passcode)]


# ---------------------------------------------------------------- helpers

def _detail(cid: str) -> dict:
    cand = db.get_candidate(cid)
    if not cand:
        raise HTTPException(404, "Candidate not found")
    return {
        "candidate": cand,
        "evaluations": db.get_evaluations(cid),
        "email": db.get_email(cid),
        "cv_url": db.cv_signed_url(cand.get("cv_path")),
    }


def _draft_for(cand: dict, evaluation: dict, email_type: str) -> dict:
    draft = draft_email(email_type, evaluation)
    return {
        "email_type": email_type,
        "to_email": cand.get("email") or "",
        "subject": draft["subject"],
        "draft_body": personalise(draft["body"], cand.get("name")),
        "status": "draft",
        "error": None,
        "resend_id": None,
        "sent_at": None,
    }


def _run_pipeline(cand: dict) -> None:
    """Score both rubrics, store evaluations, draft the email. Marks the candidate failed on error."""
    cid = cand["id"]
    try:
        db.update_candidate(cid, {"status": "processing", "error": None})
        note = contact_mismatch_note(cand.get("name"), cand.get("email"))
        evals = score_both(cand["redacted_text"], cand.get("name"), note)
        for role, ev in evals.items():
            db.upsert_evaluation(cid, role, ev)
        applied = evals[cand["applied_role"]]
        db.upsert_email(cid, _draft_for(cand, applied, email_type_for(applied["final_total"])))
        db.update_candidate(cid, {"status": "ready"})
    except Exception as e:  # noqa: BLE001 — persist the failure so the founder can retry from the UI
        log.exception("Pipeline failed for candidate %s", cid)
        msg = str(e)
        if re.search(r"503|UNAVAILABLE|high demand|429|RESOURCE_EXHAUSTED", msg):
            msg = ("Gemini quota used up for today on every model (free tier: 20 requests/model/day)."
                   if "PerDay" in msg else
                   "Gemini is overloaded right now (all models busy after retries). Wait a minute, then click Rescore.")
        db.update_candidate(cid, {"status": "failed", "error": msg[:500]})
        raise HTTPException(502, msg) from e


# ---------------------------------------------------------------- routes

@app.get("/api/health")
def health():
    s = get_settings()
    return {
        "ok": True,
        "model": s.gemini_model,
        "rubric_criteria": {r: [c.id for c in rub.criteria] for r, rub in load_rubrics().items()},
        "configured": {
            "gemini": bool(s.gemini_api_key),
            "supabase": bool(s.supabase_url and s.supabase_service_key),
            "resend": bool(s.resend_api_key),
            "passcode": bool(s.app_passcode),
        },
    }


@app.get("/api/config", dependencies=auth)
def app_config():
    s = get_settings()
    return {
        "company": s.company_name,
        "founder": s.founder_name,
        "email_from": s.email_from,
        "roles": [{"code": r, "label": ROLE_LABEL[r]} for r in ROLES],
        "rubrics": {
            r: [{"id": c.id, "name": c.name, "weight": c.weight} for c in rub.criteria]
            for r, rub in load_rubrics().items()
        },
    }


@app.get("/api/candidates", dependencies=auth)
def list_candidates():
    return db.list_candidates()


@app.get("/api/candidates/{cid}", dependencies=auth)
def get_candidate(cid: str):
    return _detail(cid)


def _read_upload(file: UploadFile):
    """Validate an uploaded CV and return (filename, ext, bytes, text)."""
    s = get_settings()
    filename = file.filename or "cv"
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in SUPPORTED_EXTENSIONS - {"txt"}:
        raise HTTPException(400, "Please upload a PDF or DOCX file")
    data = file.file.read()
    if len(data) > s.max_upload_bytes:
        raise HTTPException(413, f"File is larger than {s.max_upload_bytes // (1024 * 1024)} MB")
    try:
        text = extract_text(filename, data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"Could not read the file: {e}") from e
    if len(text) < 200:
        raise HTTPException(422, "We couldn't read any text from this file — is it a scanned image? Please upload a text-based PDF or DOCX.")
    return filename, ext, data, text


def _ingest(file: UploadFile, role: str, source: str, name: Optional[str] = None,
            email: Optional[str] = None, phone: Optional[str] = None) -> dict:
    """Store the CV + candidate row (contact details kept, PII stripped from the AI copy)."""
    role = role.upper()
    if role not in ROLES:
        raise HTTPException(400, "role must be PM or SPM")
    filename, ext, data, text = _read_upload(file)
    shield = redact(text, name=name, email=email, phone=phone)
    cid = str(uuid.uuid4())
    safe_name = re.sub(r"[^\w.-]+", "_", filename)[-80:]
    cv_path = f"{cid}/{safe_name}"
    db.upload_cv(cv_path, data, CONTENT_TYPES[ext])
    return db.insert_candidate({
        "id": cid,
        "name": shield.name or safe_name.rsplit(".", 1)[0].replace("_", " "),
        "email": shield.email,
        "phone": shield.phone,
        "city": shield.city,
        "applied_role": role,
        "source": source,
        "status": "processing",
        "cv_path": cv_path,
        "cv_filename": filename,
        "redacted_text": shield.text,
        "pii_report": shield.report,
    })


@app.post("/api/candidates", dependencies=auth)
def upload_candidate(file: UploadFile = File(...), role: str = Form(...)):
    """Admin upload: the founder adds a CV directly."""
    cand = _ingest(file, role, source="admin")
    _run_pipeline(cand)
    return _detail(cand["id"])


# ---------------------------------------------------------------- public applicant portal (no passcode)

EMAIL_OK = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
_recent: Dict[str, List[float]] = defaultdict(list)


def _rate_limit(request: Request, limit: int = 5, window: int = 3600) -> None:
    """Best-effort per-IP throttle (per serverless instance) so the public form can't drain the Gemini quota."""
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    now = time.time()
    _recent[ip] = [t for t in _recent[ip] if now - t < window]
    if len(_recent[ip]) >= limit:
        raise HTTPException(429, "Too many applications from this network. Please try again later.")
    _recent[ip].append(now)


@app.get("/api/apply/config")
def apply_config():
    s = get_settings()
    return {"company": s.company_name, "roles": [{"code": r, "label": ROLE_LABEL[r]} for r in ROLES]}


@app.post("/api/apply/preview")
def apply_preview(file: UploadFile = File(...)):
    """Read the CV and return the contact details we could find, so the form can ask for the rest."""
    _, _, _, text = _read_upload(file)
    found = detect_contact(text)
    return {"detected": found, "missing": [k for k, v in found.items() if not v]}


@app.post("/api/apply")
def apply(request: Request, file: UploadFile = File(...), role: str = Form(...), name: str = Form(...),
          email: str = Form(...), phone: str = Form(...), consent: str = Form(...), website: str = Form("")):
    if website:  # honeypot field, invisible to humans
        return {"ok": True}
    name, email, phone = name.strip(), email.strip().lower(), phone.strip()
    errors = {}
    if len(name) < 2:
        errors["name"] = "Please enter your full name"
    if not EMAIL_OK.match(email):
        errors["email"] = "Please enter a valid email address"
    if len(re.sub(r"\D", "", phone)) < 10:
        errors["phone"] = "Please enter a phone number with at least 10 digits"
    if consent.lower() not in {"true", "1", "yes", "on"}:
        errors["consent"] = "Please confirm consent to continue"
    if errors:
        raise HTTPException(422, {"message": "Please fix the highlighted fields", "fields": errors})
    if role.upper() in ROLES and db.find_candidate(email, role.upper()):
        raise HTTPException(409, "You've already applied for this role with this email. We'll be in touch.")
    _rate_limit(request)

    cand = _ingest(file, role, source="portal", name=name, email=email, phone=phone)
    try:
        _run_pipeline(cand)
    except HTTPException:
        pass  # the application is saved either way; the founder can Rescore from the admin portal
    return {"ok": True, "role": ROLE_LABEL[cand["applied_role"]], "name": name.split()[0]}


@app.post("/api/candidates/{cid}/rescore", dependencies=auth)
def rescore(cid: str):
    cand = db.get_candidate(cid)
    if not cand:
        raise HTTPException(404, "Candidate not found")
    _run_pipeline(cand)
    return _detail(cid)


@app.patch("/api/candidates/{cid}", dependencies=auth)
def update_candidate(cid: str, body: dict):
    allowed = {k: v for k, v in body.items() if k in {"name", "email", "phone", "applied_role"}}
    if "applied_role" in allowed and allowed["applied_role"] not in ROLES:
        raise HTTPException(400, "applied_role must be PM or SPM")
    if allowed:
        db.update_candidate(cid, allowed)
    return _detail(cid)


@app.delete("/api/candidates/{cid}", dependencies=auth)
def delete_candidate(cid: str):
    db.delete_candidate(cid)
    return {"ok": True}


@app.post("/api/candidates/{cid}/email/regenerate", dependencies=auth)
def regenerate_email(cid: str, body: RegenerateEmail):
    if body.email_type not in EMAIL_TYPES:
        raise HTTPException(400, f"email_type must be one of {EMAIL_TYPES}")
    cand = db.get_candidate(cid)
    if not cand:
        raise HTTPException(404, "Candidate not found")
    evaluation = db.get_evaluations(cid).get(cand["applied_role"])
    if not evaluation:
        raise HTTPException(409, "Candidate has not been scored yet")
    existing = db.get_email(cid) or {}
    fields = _draft_for(cand, evaluation, body.email_type)
    if existing.get("to_email"):
        fields["to_email"] = existing["to_email"]
    db.upsert_email(cid, fields)
    return _detail(cid)


@app.patch("/api/candidates/{cid}/email", dependencies=auth)
def edit_email(cid: str, body: EmailUpdate):
    existing = db.get_email(cid)
    if not existing:
        raise HTTPException(404, "No email draft for this candidate")
    if existing["status"] == "sent":
        raise HTTPException(409, "This email has already been sent")
    fields = {}
    if body.to_email is not None:
        fields["to_email"] = body.to_email.strip()
    if body.subject is not None:
        fields["subject"] = body.subject
    if body.body is not None:
        fields["draft_body"] = body.body
    if fields:
        db.update_email(cid, fields)
    return _detail(cid)


@app.post("/api/candidates/{cid}/email/send", dependencies=auth)
def send(cid: str):
    email = db.get_email(cid)
    if not email:
        raise HTTPException(404, "No email draft for this candidate")
    if email["status"] == "sent":
        raise HTTPException(409, "Already sent")
    to = (email.get("to_email") or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", to):
        raise HTTPException(400, "Add a valid recipient email address first")
    try:
        resend_id = send_email(to, email["subject"], email["draft_body"])
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        owner = re.search(r"own email address \(([^)]+)\)", msg)
        if owner:
            msg = (f"Resend is in test mode: with the onboarding@resend.dev sender it only delivers to {owner.group(1)} "
                   "(your Resend account). To email candidates, verify a domain at resend.com/domains and set EMAIL_FROM to it.")
        db.update_email(cid, {"status": "failed", "error": msg[:500]})
        raise HTTPException(502, msg) from e
    db.update_email(cid, {"status": "sent", "resend_id": resend_id, "sent_at": db.now(), "error": None})
    db.update_candidate(cid, {"status": "emailed"})
    return _detail(cid)
