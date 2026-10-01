"""Loads the Kargo rubric markdown and turns it into per-role system instructions + criteria tables.

The markdown file is the single source of truth: criteria IDs, names and weights are parsed
from the Part B / Part C tables, and the prose of Parts A, B/C and D is passed to the model verbatim.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Tuple

from .config import get_settings

PM = "PM"
SPM = "SPM"
ROLES = (PM, SPM)
ROLE_LABEL = {PM: "Product Manager", SPM: "Senior Product Manager"}

_CRITERION_ROW = re.compile(r"^\|\s*(C\d+)\s*\|\s*([^|]+?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*$", re.M)


@dataclass(frozen=True)
class Criterion:
    id: str
    name: str
    weight: float


@dataclass(frozen=True)
class RoleRubric:
    role: str
    label: str
    criteria: Tuple[Criterion, ...]
    rubric_text: str  # Header + Part A + role part + Part D, verbatim from the file


def _split_parts(text: str) -> Dict[str, str]:
    markers = list(re.finditer(r"^## PART ([A-D])\b.*$", text, re.M))
    if len(markers) < 4:
        raise ValueError("Rubric file must contain '## PART A' through '## PART D' headings")
    parts = {"header": text[: markers[0].start()].strip()}
    for i, m in enumerate(markers):
        end = markers[i + 1].start() if i + 1 < len(markers) else len(text)
        parts[m.group(1)] = text[m.start():end].strip().rstrip("-").strip()
    return parts


def _parse_criteria(part_text: str) -> Tuple[Criterion, ...]:
    criteria = tuple(Criterion(m.group(1), m.group(2).strip(), float(m.group(3))) for m in _CRITERION_ROW.finditer(part_text))
    if not criteria:
        raise ValueError("No criteria table found in rubric part")
    total = sum(c.weight for c in criteria)
    if abs(total - 10.0) > 0.01:
        raise ValueError(f"Rubric weights must sum to 10.0, got {total}")
    return criteria


@lru_cache
def load_rubrics() -> Dict[str, RoleRubric]:
    text = get_settings().rubric_path.read_text(encoding="utf-8")
    parts = _split_parts(text)
    out = {}
    for role, letter in ((PM, "B"), (SPM, "C")):
        body = "\n\n---\n\n".join([parts["header"], parts["A"], parts[letter], parts["D"]])
        out[role] = RoleRubric(role, ROLE_LABEL[role], _parse_criteria(parts[letter]), body)
    return out
