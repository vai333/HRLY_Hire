"""Pydantic models.

`LLM*` models are passed to Gemini as `response_schema`, so the model is forced to return exactly this
shape. They deliberately leave out points, totals, caps and the recommendation: those are arithmetic on
the rubric and are computed deterministically in `scoring.py`, which then assembles the full Part A7 JSON.
(No default values here — Gemini's schema support rejects them.)
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class LLMTimelineEntry(BaseModel):
    employer: str
    title: str
    dates: str = Field(description="As written on the resume, e.g. 'Jan 2020 – Mar 2023'")
    stage_size: str = Field(description="Company stage and size if stated or clearly implied, else 'unknown'")
    pm_equivalent: bool = Field(description="True only if this stint shows deciding what to build and why (Part A3)")


class LLMFlags(BaseModel):
    location: str = Field(description="'Mumbai-based', 'Willing to relocate' or 'Unclear', plus a short note")
    band: str = Field(description="'Below band', 'In band' or 'Above band' with PM-equivalent years and the target band")
    credibility: str = Field(description="'None' or 'Human review: <reason>'")
    career_switch: str = Field(description="'No' or 'Yes: from <function>'")


class LLMCriterion(BaseModel):
    id: str = Field(description="Criterion id, e.g. C1")
    level: int = Field(description="Integer 0-4 from the criterion anchors")
    evidence_quotes: List[str] = Field(description="Verbatim excerpts copied from the resume, each under 30 words. Empty if none.")
    evidence_rung: str = Field(description="One of E0, E1, E2, E3, E4 (Part A2)")
    rationale: str = Field(description="One sentence")


class LLMEvaluation(BaseModel):
    timeline: List[LLMTimelineEntry]
    total_years: float
    pm_equivalent_years: float
    flags: LLMFlags
    criteria: List[LLMCriterion]
    top_strengths: List[str]
    gaps: List[str]
    interview_probes: List[str] = Field(description="Exactly 3 specific questions aimed at the lowest-scoring weighted criteria")
    summary: List[str] = Field(description="Exactly 3 short plain-English lines")


class LLMEmailDraft(BaseModel):
    subject: str
    body: str = Field(description="Plain text. Must start with 'Hi {{first_name}},'")


# ---------------------------------------------------------------- API request bodies

class EmailUpdate(BaseModel):
    to_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None


class RegenerateEmail(BaseModel):
    email_type: str  # invite | hold | rejection
