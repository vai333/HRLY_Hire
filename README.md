# HRLY — Innovative hiring

AI hiring for **Kargo** (founder: Arjun Mehta). One site: the home page (`/`) lets you pick a portal.

| Portal | URL | Who |
|---|---|---|
| **Applicant portal** | `/apply` | Public. Applicants pick PM or Senior PM and upload a resume. HRLY reads their name, email and phone from it; anything it can't find (or gets wrong) the applicant fills in before submitting. Applicants never see scores. |
| **Admin portal** | `/admin` | Open by default; set `APP_PASSCODE` to require a passcode. Ranked queue, dual PM/SPM scores, evidence, interview brief and the drafted email with one-click send. The founder can also upload CVs directly here. |

When an application comes in, HRLY:

1. **Extracts** the CV text (PDF via `pdfplumber`, DOCX via `python-docx`).
2. **Shields PII**: name, email, phone, links, street address, college names and protected attributes (DOB, gender, marital status, religion, caste, nationality) are stripped **before** anything reaches the AI. Contact details are kept in the DB for the email only.
3. **Scores against both rubrics** (PM Part B and SPM Part C) in parallel with Gemini (temperature 0, `response_schema`). The rubric is read from [`backend/rubric/kargo_pm_resume_scoring_rubric.md`](backend/rubric/kargo_pm_resume_scoring_rubric.md). Criteria, names and weights are parsed from its tables.
4. **Does the rubric arithmetic itself**: Gemini returns levels, quotes and evidence rungs. HRLY then computes `points = weight × level ÷ 4`, the raw total, the caps and the recommendation band. It also enforces two guardrails (no quote means level 0; E1 evidence caps the level at 1) and checks that every quote really appears in the CV.
5. **Drafts the brief + email**: an invite if the score is 6.5 or more (proposing a 30-minute chat), a hold note for 5.0–6.4, and a polite rejection below 5.0. The email is written against a `{{first_name}}` placeholder, so the name still never reaches the AI.
6. **Sends via Resend** only when the founder clicks *Send via Resend* and then *Confirm send*.

```
hrly/
├── api/index.py              Vercel Python function entry (wraps the FastAPI app)
├── backend/app/
│   ├── main.py               FastAPI routes (/api/*)
│   ├── cv_parser.py          text extraction + PII shield
│   ├── rubric.py             rubric markdown → per-role instructions + criteria
│   ├── scoring.py            Gemini calls + deterministic points/caps/bands
│   ├── emailer.py            email drafting (Gemini) + Resend dispatch
│   └── db.py                 Supabase tables + private storage bucket
├── backend/tests/            pytest: PII shield, rubric parsing, caps, guardrails
├── frontend/                 React (Vite) + Tailwind 3-pane dashboard
├── supabase/schema.sql       tables, RLS, 'cvs' bucket
├── requirements.txt          Python deps (Vercel installs these)
└── vercel.json               build + function + rewrites
```

## 1. Supabase

1. Create a project. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql). This creates `candidates`, `evaluations` and `emails`, plus a private `cvs` bucket.
2. In **Project Settings → API**, copy the Project URL and the **service_role** key. The service_role key is only used server-side and is never sent to the browser.

## 2. Keys

| Var | Where |
|---|---|
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | default `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODELS` | comma list tried in order when the primary is overloaded (503) — default empty (primary model only, so every candidate is scored by the same model). The model that actually scored is shown under each scorecard. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | step 1 — the **secret** key (`sb_secret_…` or legacy `service_role`), not the publishable key |
| `SCORING_MODE` | `lenient` (default) gives benefit of the doubt on borderline and transferable evidence — e.g. a pricing redesign or GTM launch counts as partial product work. `strict` reads the rubric literally. Quotes-required, credential and cap rules apply in both. Rescore to apply a change to existing candidates. |
| `RESEND_API_KEY` | https://resend.com/api-keys |
| `EMAIL_FROM` | e.g. `Arjun at Kargo <hiring@yourdomain.com>`. The default `onboarding@resend.dev` only delivers to your own Resend account email, so verify a domain in Resend before sending to candidates. |
| `EMAIL_REPLY_TO` | optional |
| `APP_PASSCODE` | optional. Leave empty for an open admin portal; set it to make `/admin` ask for a passcode. |
| `COMPANY_NAME`, `FOUNDER_NAME`, `FOUNDER_TITLE` | email sign-off |

## 3. Run locally

```bash
cp .env.example .env   # fill in the keys
```

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
```

```bash
.venv/bin/uvicorn backend.app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 and choose a portal (or go straight to `/apply` or `/admin`). Vite proxies `/api` to port 8000.

Tests:

```bash
.venv/bin/python -m pytest -q backend/tests
```

## 4. Deploy to Vercel

1. Push `hrly/` to a GitHub repo and import it in Vercel. **Root Directory** = the folder that contains `vercel.json`.
2. Add the env vars from step 2 under **Settings → Environment Variables** (`APP_PASSCODE` only if you want the admin portal locked).
3. Deploy. `vercel.json` handles the rest:
   - builds `frontend/` and serves `frontend/dist`
   - turns `api/index.py` into a Python function, with `backend/**` (including the rubric) bundled in
   - rewrites `/api/*` to the function. Everything else falls back to the SPA.

Vercel limits to know about:
- **Request body 4.5 MB**, so uploads are capped at 4 MB.
- **Duration**: one upload = 3 Gemini calls (PM ∥ SPM, then the email), ~20–30 s, longer if a model is overloaded and HRLY falls back. `maxDuration` is 300 s, which needs **Fluid compute** (on by default for new Vercel projects; check Settings → Functions). Without it Hobby caps at 60 s. A timed-out candidate is saved as *Failed*; **Rescore** retries.
- The filesystem is read-only, so CVs are parsed in memory and stored in Supabase Storage.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/health` | config status (no auth) |
| GET | `/api/apply/config` | **public** — company + roles |
| POST | `/api/apply/preview` | **public** — multipart `file` → detected name/email/phone + which are missing (no AI call) |
| POST | `/api/apply` | **public** — multipart `file`, `role`, `name`, `email`, `phone`, `consent`: saves and scores the application. Duplicate email+role is rejected; light per-IP throttle; honeypot field |
| GET | `/api/config` | company, sender, rubric criteria |
| GET | `/api/candidates` | queue with dual scores |
| POST | `/api/candidates` | multipart `file` + `role` (PM/SPM): runs the whole pipeline |
| GET | `/api/candidates/{id}` | candidate, both evaluations, email, signed CV URL |
| POST | `/api/candidates/{id}/rescore` | re-run scoring + draft |
| PATCH / DELETE | `/api/candidates/{id}` | edit name/email/role, or delete |
| POST | `/api/candidates/{id}/email/regenerate` | `{email_type: invite\|hold\|rejection}` |
| PATCH | `/api/candidates/{id}/email` | edit to/subject/body |
| POST | `/api/candidates/{id}/email/send` | send via Resend |

All other routes need the `X-HRLY-Passcode` header when `APP_PASSCODE` is set.

## Known limits

- The applicant portal is public and each application costs 3 Gemini requests. The per-IP throttle is per serverless instance, so it slows abuse rather than stopping it — watch your Gemini quota once the link is shared.

- Scanned (image-only) PDFs have no text layer and are rejected. OCR is not included.
- Name detection is heuristic: it reads the top of the CV or a `Name:` label. Click **What the AI saw** on any candidate to audit the redacted text.
- Quotes marked *not found verbatim* need a human check before you trust that criterion.
