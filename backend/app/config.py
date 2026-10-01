"""Runtime settings, read from environment variables (Vercel project env or a local .env)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent

# Local dev only — on Vercel these files don't exist and env vars come from the dashboard.
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BACKEND_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        # Optional, tried in order when the primary model is overloaded (503/429). Empty = primary model only.
        self.gemini_fallback_models = [
            m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "").split(",") if m.strip()
        ]

        # strict = rubric read literally; lenient = benefit of the doubt on borderline/transferable evidence.
        self.scoring_mode = os.getenv("SCORING_MODE", "lenient").strip().lower()

        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.storage_bucket = os.getenv("SUPABASE_BUCKET", "cvs")

        self.resend_api_key = os.getenv("RESEND_API_KEY", "")
        self.email_from = os.getenv("EMAIL_FROM", "Kargo Hiring <onboarding@resend.dev>")
        self.email_reply_to = os.getenv("EMAIL_REPLY_TO", "")

        self.company_name = os.getenv("COMPANY_NAME", "Kargo")
        self.founder_name = os.getenv("FOUNDER_NAME", "Arjun Mehta")
        self.founder_title = os.getenv("FOUNDER_TITLE", "Founder & CEO")

        # Shared passcode protecting the deployed dashboard. Empty = open (local dev only).
        self.app_passcode = os.getenv("APP_PASSCODE", "")

        self.rubric_path = Path(
            os.getenv("RUBRIC_PATH", str(BACKEND_DIR / "rubric" / "kargo_pm_resume_scoring_rubric.md"))
        )
        self.cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

        # Vercel serverless request bodies are capped at 4.5 MB.
        self.max_upload_bytes = int(os.getenv("MAX_UPLOAD_BYTES", str(4 * 1024 * 1024)))


@lru_cache
def get_settings() -> Settings:
    return Settings()
