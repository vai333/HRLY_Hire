"""Email drafting (Gemini) and dispatch (Resend).

The model writes against anonymised facts and a `{{first_name}}` placeholder; the real name is
substituted here, so the candidate's identity still never reaches the LLM.
"""
from __future__ import annotations

import html
import re
from typing import Optional

from .config import get_settings
from .schemas import LLMEmailDraft
from .scoring import generate_json

EMAIL_TYPES = ("invite", "hold", "rejection")

_TYPE_RULES = {
    "invite": (
        "An interview invitation. Propose a 30-minute chat with the founder and ask for two or three slots that work "
        "for them over the next week. Reference one or two specific, genuine things from their experience that made "
        "you want to talk. Mention that the role is in-office in Mumbai, reporting to the founder."
    ),
    "hold": (
        "A holding note. Thank them, say the application is still under review alongside others, and that they will "
        "hear back within two weeks. Warm, no promises, no scores."
    ),
    "rejection": (
        "A polite rejection. Thank them sincerely, name one genuine positive from their experience, say clearly but "
        "kindly that you won't be moving forward for this role, and wish them well. No scores, no rubric language, "
        "no list of shortcomings. Under 120 words."
    ),
}


def first_name(full_name: Optional[str]) -> str:
    if not full_name:
        return "there"
    return full_name.split()[0]


def draft_email(email_type: str, evaluation: dict) -> dict:
    s = get_settings()
    if email_type not in EMAIL_TYPES:
        raise ValueError(f"email_type must be one of {EMAIL_TYPES}")
    system = f"""You write candidate emails for {s.founder_name}, {s.founder_title} of {s.company_name}, a Series A
Mumbai company building software for freight forwarders and 3PLs. Voice: direct, human, warm, concise — a founder
writing personally, not HR boilerplate.

Rules:
- Start the body with exactly "Hi {{{{first_name}}}}," — keep that placeholder literally; never invent a name.
- Plain text only, no markdown, no bullet lists. Short paragraphs.
- Separate paragraphs with a blank line. Two to four short paragraphs.
- Never mention scores, rubrics, AI, screening tools, or anything anonymised (tokens in square brackets).
- Do NOT write a sign-off or signature — the system appends it."""
    timeline = "; ".join(f"{t['title']} at {t['employer']} ({t['dates']})" for t in evaluation.get("timeline", [])[:5])
    prompt = f"""Write this email: {_TYPE_RULES[email_type]}

Role applied for: {evaluation['role']}
Their experience (anonymised): {timeline or 'not available'}
Strengths noted by the reviewer: {'; '.join(evaluation.get('top_strengths', [])) or 'n/a'}
Reviewer summary: {' '.join(evaluation.get('summary', []))}"""
    draft, _ = generate_json(system, prompt, LLMEmailDraft)
    body = re.sub(r"\[[A-Z ]+\]", "", draft.body).strip()  # belt-and-braces: strip any leaked tokens
    return {"subject": draft.subject.strip(), "body": format_body(body)}


_CLOSING = re.compile(r"(?:\s*(?:Best|Warm(?:est)?|Kind)?\s*(?:regards|wishes)?|Best|Cheers|Thanks|Thank you|Sincerely|Warmly)[,!]?\s*$", re.I)


def format_body(body: str) -> str:
    """Normalise layout whatever the model returned: greeting line, real paragraphs, one consistent signature."""
    s = get_settings()
    body = body.replace("\r", "").strip()
    # Drop any signature the model wrote anyway (from the founder's name onwards), plus a dangling closing word.
    idx = body.rfind(s.founder_name)
    if idx > len(body) * 0.5:
        body = body[:idx]
    body = _CLOSING.sub("", body.rstrip()).rstrip()
    m = re.match(r"^(Hi [^,\n]{1,60},)\s*", body)
    greeting, rest = (m.group(1), body[m.end():]) if m else ("Hi {{first_name}},", body)
    if "\n\n" not in rest:  # model ignored paragraphs: group sentences into short paragraphs
        lines = [l.strip() for l in rest.split("\n") if l.strip()]
        if len(lines) <= 1:
            sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", rest.strip())
            lines = [" ".join(sentences[i:i + 2]) for i in range(0, len(sentences), 2)]
        rest = "\n\n".join(lines)
    return f"{greeting}\n\n{rest.strip()}\n\nBest,\n{s.founder_name}\n{s.founder_title}, {s.company_name}"


def personalise(body: str, full_name: Optional[str]) -> str:
    return re.sub(r"\{\{\s*first_name\s*\}\}", first_name(full_name), body)


def send_email(to_email: str, subject: str, body: str) -> str:
    """Sends via Resend and returns the Resend message id."""
    import resend

    s = get_settings()
    if not s.resend_api_key:
        raise RuntimeError("RESEND_API_KEY is not set")
    resend.api_key = s.resend_api_key
    paragraphs = "".join(f"<p>{html.escape(p).replace(chr(10), '<br>')}</p>" for p in body.split("\n\n"))
    params = {
        "from": s.email_from,
        "to": [to_email],
        "subject": subject,
        "text": body,
        "html": f'<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#111">{paragraphs}</div>',
    }
    if s.email_reply_to:
        params["reply_to"] = s.email_reply_to
    result = resend.Emails.send(params)
    return result["id"] if isinstance(result, dict) else getattr(result, "id", "")
