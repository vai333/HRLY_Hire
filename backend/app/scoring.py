"""Rubric scoring: Gemini supplies levels + evidence; this module does the rubric arithmetic.

Flow per role: anonymised CV + rubric text → Gemini (temperature 0, JSON schema) → guardrails
(no quote ⇒ level 0, credential-only ⇒ max level 1, quote verification) → points → caps → band.
"""
from __future__ import annotations

import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Dict, List, Optional, Tuple

from .config import get_settings
from .rubric import PM, ROLES, SPM, RoleRubric, load_rubrics
from .schemas import LLMEvaluation

# Rubric caps (Part B3 and the Senior PM caps table). Each: (condition on levels, cap, label).
CapRule = Tuple[Callable[[Dict[str, int]], bool], float, str]
CAP_RULES: Dict[str, List[CapRule]] = {
    PM: [
        (lambda L: L["C1"] <= 1, 5.0, "C1 ≤ 1 (no evidence of product decisions) → final ≤ 5.0"),
        (lambda L: L["C3"] <= 1 and L["C4"] <= 1, 4.5, "C3 ≤ 1 and C4 ≤ 1 (no discovery and no domain) → final ≤ 4.5"),
    ],
    SPM: [
        (lambda L: L["C1"] <= 1, 5.0, "C1 ≤ 1 → final ≤ 5.0"),
        (lambda L: L["C1"] == 2, 6.5, "C1 = 2 → final ≤ 6.5"),
        (lambda L: L["C2"] <= 1 and L["C4"] <= 1, 5.5, "C2 ≤ 1 and C4 ≤ 1 → final ≤ 5.5"),
    ],
}

BANDS = [(8.0, "Strong advance"), (6.5, "Advance with probes"), (5.0, "Hold"), (0.0, "Decline")]


def recommendation_for(total: float) -> str:
    for floor, label in BANDS:
        if total >= floor:
            return label
    return "Decline"


def email_type_for(total: float) -> str:
    if total >= 6.5:
        return "invite"
    if total < 5.0:
        return "rejection"
    return "hold"


# ---------------------------------------------------------------- Gemini

log = logging.getLogger("hrly.gemini")
GEMINI_ROUNDS = 3
_exhausted_until: Dict[str, float] = {}  # model → time to try again after a daily-quota 429

_client_lock = threading.Lock()
_client_instance = None


def _client():
    """Process-wide Gemini client. Locked because PM and SPM scoring call this concurrently on first use:
    a racing duplicate would be garbage-collected mid-request, and genai.Client.__del__ closes its connection."""
    global _client_instance
    with _client_lock:
        if _client_instance is None:
            from google import genai

            key = get_settings().gemini_api_key
            if not key:
                raise RuntimeError("GEMINI_API_KEY is not set")
            _client_instance = genai.Client(api_key=key)
        return _client_instance


def generate_json(system: str, prompt: str, schema):
    """One structured Gemini call at temperature 0, falling back through models. Returns (parsed, model_used)."""
    from google.genai import types

    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=0.0,
        response_mime_type="application/json",
        response_schema=schema,
    )
    s = get_settings()
    all_models = list(dict.fromkeys([s.gemini_model, *s.gemini_fallback_models]))
    models = [m for m in all_models if _exhausted_until.get(m, 0) < time.time()] or all_models
    last_err: Optional[Exception] = None
    # Gemini overloads (503/429) come in bursts, so cycle through every model, then back off and go round again.
    for round_no in range(GEMINI_ROUNDS):
        for model in list(models):
            try:
                client = _client()
                resp = client.models.generate_content(model=model, contents=prompt, config=config)
                parsed = resp.parsed if resp.parsed is not None else schema.model_validate_json(resp.text)
                if round_no or model != models[0]:
                    log.info("Gemini %s succeeded on %s (round %d)", schema.__name__, model, round_no + 1)
                return parsed, model
            except Exception as e:  # noqa: BLE001
                last_err = e
                log.warning("Gemini %s failed on %s (round %d): %s", schema.__name__, model, round_no + 1, str(e)[:200])
                if re.search(r"\b(400|401|403|404|INVALID_ARGUMENT|PERMISSION_DENIED|NOT_FOUND)\b", str(e)):
                    models.remove(model)  # not transient (bad key, retired model): don't try it again
                elif "PerDay" in str(e):
                    models.remove(model)  # daily quota used up: retrying within this request can't help
                    _exhausted_until[model] = time.time() + 3600
        if not models:
            break
        if round_no + 1 < GEMINI_ROUNDS:
            time.sleep(3 * (round_no + 1))
    raise RuntimeError(f"Gemini call failed: {last_err}")


def _system_instruction(rub: RoleRubric) -> str:
    crit_lines = "\n".join(f"- {c.id} {c.name} (weight {c.weight})" for c in rub.criteria)
    lenient = get_settings().scoring_mode == "lenient"
    stance = "Apply the rubric below with the LENIENT stance described at the end of these instructions." if lenient else "Follow the rubric below exactly."
    return f"""You are HRLY's resume screening agent for Kargo. {stance}

{rub.rubric_text}

---

## OPERATING INSTRUCTIONS (override anything above that conflicts)

- The role for this evaluation is: **{rub.label}**. Use only the {rub.label} rubric. Never blend rubrics.
- The resume is anonymised. Identifiers were replaced with tokens such as [CANDIDATE], [EMAIL], [PHONE],
  [LINK], [ADDRESS], [INSTITUTION] and [PERSONAL DETAIL REMOVED]. Do not guess them and never let them affect a score.
- Return exactly one `criteria` entry per criterion, in this order:
{crit_lines}
- `level` is an integer 0-4 from that criterion's anchors. `evidence_quotes` must be copied verbatim from the
  resume (no paraphrase, no ellipses inside a quote). If you cannot quote evidence, set level 0, rung E0 and no quotes.
- Do NOT compute points, totals, caps or the recommendation. The system computes them from your levels.
- `interview_probes`: exactly 3, aimed at the lowest-scoring weighted criteria, adapted from the Part D templates to
  this resume's specifics.
- `summary`: exactly 3 plain-English lines a founder can read in 10 seconds.
- Missing facts go in `gaps`. Do not assume.{_leniency_block() if lenient else ""}"""


def _leniency_block() -> str:
    return """

## SCORING STANCE: LENIENT — this overrides your default strictness
Kargo is hiring for a first-of-its-kind role and wants to see promising, non-traditional profiles. So:
1. "Product" is broader than software. A pricing model, a service offering, a go-to-market launch for a new
   product, an internal tool, a process or programme the person designed and rolled out all count as product work.
2. Level 0 is ONLY for criteria with no related evidence at all. If there is related evidence, start at 1.
3. Transferable evidence with an outcome earns level 2 (A3 allows a non-PM title to reach level 3):
   - C1 ownership: led a redesign, launch or roll-out and owned its result.
   - C2 shipping/learning: launched something and reported its impact.
   - C3 discovery: sustained customer, client or ops-team contact that shaped a decision.
   - C5 0→1: started something new without an existing playbook.
   - C6 prioritisation: coordinated cross-functional delivery, sequencing or trade-offs (even if not with engineers).
4. When evidence fits two adjacent levels, choose the higher one.
5. PM-equivalent years: count time where the person shaped what got built or launched, at half weight.
6. Read imperfect formatting charitably (broken columns, merged lines).
Hard rules that still apply: every non-zero level needs a verbatim quote, and credentials or skills-list
keywords alone never go above level 1."""


def _score_prompt(cv_text: str) -> str:
    return f"Score this anonymised resume.\n\n<resume>\n{cv_text}\n</resume>"


# ---------------------------------------------------------------- deterministic finalisation

def _norm(s: str) -> str:
    s = s.lower().replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"[–—−]", "-", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip(" .,;:\"'…")


def _quote_found(quote: str, cv_norm: str) -> bool:
    q = _norm(quote)
    if not q:
        return False
    if q in cv_norm:
        return True
    # Tolerate the model stitching fragments with "..." — every fragment must appear.
    frags = [f.strip(" .,;:") for f in re.split(r"\.{3}|…", q) if len(f.strip()) > 8]
    return bool(frags) and all(f in cv_norm for f in frags)


def finalize(role: str, llm: LLMEvaluation, cv_text: str, candidate_name: Optional[str], extra_credibility: Optional[str] = None,
             model: Optional[str] = None) -> dict:
    rub = load_rubrics()[role]
    cv_norm = _norm(cv_text)
    by_id = {c.id.strip().upper(): c for c in llm.criteria}

    criteria, levels = [], {}
    for crit in rub.criteria:
        c = by_id.get(crit.id)
        adjustments: List[str] = []
        if c is None:
            level, quotes, rung, rationale = 0, [], "E0", "Model returned no assessment for this criterion."
            adjustments.append("Missing from model output → scored 0")
        else:
            level = max(0, min(4, int(c.level)))
            quotes = [q.strip() for q in c.evidence_quotes if q and q.strip()]
            m = re.search(r"E\s*([0-4])", c.evidence_rung or "", re.I)
            rung = f"E{m.group(1)}" if m else "E0"
            rationale = c.rationale
        if level > 0 and (not quotes or rung == "E0"):
            adjustments.append(f"No quotable evidence → level {level} set to 0 (rubric A1.4)")
            level = 0
        if level > 1 and rung == "E1":
            adjustments.append(f"Keyword/credential-only evidence (E1) → level {level} capped at 1 (rubric A3)")
            level = 1
        checks = [{"quote": q, "verified": _quote_found(q, cv_norm)} for q in quotes]
        levels[crit.id] = level
        criteria.append({
            "id": crit.id,
            "name": crit.name,
            "weight": crit.weight,
            "level": level,
            "points": round(crit.weight * level / 4, 2),
            "evidence_quotes": quotes,
            "evidence_rung": rung,
            "rationale": rationale,
            "quote_checks": checks,
            "adjustments": adjustments,
        })

    raw_total = round(sum(c["weight"] * c["level"] / 4 for c in criteria), 1)
    triggered = [(cap, label) for cond, cap, label in CAP_RULES[role] if cond(levels)]
    final_total = round(min([raw_total] + [cap for cap, _ in triggered]), 1)
    caps_applied = [label + ("" if cap < raw_total else " (not binding)") for cap, label in triggered]

    flags = llm.flags.model_dump()
    if extra_credibility:
        flags["credibility"] = f"{flags['credibility']} · {extra_credibility}"

    probes = [p for p in llm.interview_probes if p.strip()][:3]
    return {
        # --- Part A7 output format ---
        "role": rub.label,
        "candidate": candidate_name or "Unknown",
        "timeline": [t.model_dump() for t in llm.timeline],
        "total_years": round(float(llm.total_years), 1),
        "pm_equivalent_years": round(float(llm.pm_equivalent_years), 1),
        "flags": flags,
        "criteria": criteria,
        "raw_total": raw_total,
        "caps_applied": caps_applied,
        "final_total": final_total,
        "recommendation": recommendation_for(final_total),
        "top_strengths": llm.top_strengths,
        "gaps": llm.gaps,
        "interview_probes": probes,
        # --- HRLY extras ---
        "summary": llm.summary[:3],
        "role_code": role,
        "model": model or get_settings().gemini_model,
        "scoring_mode": get_settings().scoring_mode,
        "unverified_quotes": sum(1 for c in criteria for q in c["quote_checks"] if not q["verified"]),
    }


def score_role(role: str, cv_text: str, candidate_name: Optional[str], extra_credibility: Optional[str] = None) -> dict:
    rub = load_rubrics()[role]
    llm, model = generate_json(_system_instruction(rub), _score_prompt(cv_text), LLMEvaluation)
    return finalize(role, llm, cv_text, candidate_name, extra_credibility, model)


def score_both(cv_text: str, candidate_name: Optional[str], extra_credibility: Optional[str] = None) -> Dict[str, dict]:
    """Dual scoring: PM and SPM in parallel so the whole pipeline fits a serverless time limit."""
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {r: pool.submit(score_role, r, cv_text, candidate_name, extra_credibility) for r in ROLES}
        return {r: f.result() for r, f in futures.items()}
