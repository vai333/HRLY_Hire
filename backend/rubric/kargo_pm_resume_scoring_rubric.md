# Kargo Resume Scoring Rubric — Product Manager & Senior Product Manager

**Audience:** an AI screening agent. **Task:** score one resume at a time, out of 10, against ONE of the two rubrics below (Part B for Product Manager, Part C for Senior Product Manager). Part A applies to both.

**Company context:** Kargo is a Series A (40 people → 70) Mumbai company building software for mid-sized freight forwarders and 3PLs (shipment tracking, documentation, carrier coordination). Roles are in-office, Mumbai, reporting to the founder. Both roles are first-of-their-kind: there is no PM handbook, and the PM function is being built from scratch.

**Provenance:** built from the two Kargo job descriptions and calibrated on 8 past-hire resumes. No performance data was available, so weights follow the JDs. The resumes were used to find what separates profiles.

---

## PART A — Scoring protocol (read first, applies to both rubrics)

### A1. Procedure

1. **Pick the rubric.** Use Part B for "Product Manager" and Part C for "Senior Product Manager". If the role is not stated, ask. Never blend the two.
2. **Extract facts first.** Build a timeline: employer, title, dates, company stage and size, and what the person personally did. Compute total years and **PM-equivalent years**, defined below.
3. **Run the flags in A5.** Flags are reported, not scored.
4. **Score each criterion 0–4** using its anchors. For each, quote the resume evidence you relied on. If you cannot quote evidence, the score is 0.
5. **Compute points:** `points = weight × (level ÷ 4)`. Sum all points, round to 1 decimal.
6. **Apply the caps** in that rubric's cap table. Report both raw and final totals.
7. **Map the final total to a recommendation** using the table in A6.
8. **Output** in the format in A7.

### A2. Evidence ladder

Every claim sits on one rung. A criterion's level can never be higher than what its best evidence supports.

| Rung | Meaning | Example |
|---|---|---|
| E0 | Absent | Nothing relevant on the resume |
| E1 | Keyword or claim only | Skills list says "Roadmapping"; a certification |
| E2 | Activity described, no result | "Worked with engineering on specs" |
| E3 | Specific action by this person plus a measurable result | "Ran 40 interviews, redesigned onboarding, adoption +34%" |
| E4 | E3 plus a decision, trade-off, kill or learning visible | "Killed 2 features on low usage, redirected capacity, 3× weekly use in 30 days" |

### A3. Rules that prevent mis-scoring

- **Score behaviour, not vocabulary.** The same sentence can carry different substance. Several resumes share phrases like "built a case-study programme", "redesigned the workflow over a weekend", "fixed a database indexing issue" or "mentored juniors". Ask four questions each time: *Who decided? What was the scale? Was it adopted? Does it transfer to this criterion?* A sales or marketing programme is not product discovery. A backend performance fix is not a product decision.
- **Title is not evidence.** A "Product Manager" title with no decisions, shipped outcomes or ownership scores low. A non-PM title with clear PM-equivalent work can score up to level 3 on product criteria, and 4 only with explicit what-to-build ownership plus outcomes.
- **"Owned", "led" and "drove" count only with scope and outcome.** "Supported", "assisted" and "part of" cap ownership credit at level 2.
- **Business metrics are not product metrics.** Quota, CAC, pipeline, churn and tickets-closed show execution quality. They score toward Discovery, Domain or cross-functional evidence, never toward "shipped and adopted product", unless the person changed the product.
- **Do not reward credentials on their own.** MBAs, certifications, course badges, college brand and tool lists are E1 at best. They never lift a criterion above level 1 alone.
- **Domain terms in a skills list are E1.** Domain credit requires doing the work: documentation, carrier coordination, port or customs interaction, freight ops, or building software for it.
- **Self-reported praise is low-weight.** Quotes from reviews or testimonials count as E2 unless backed by a described outcome.
- **PM-equivalent years** = years spent deciding *what to build and why*, running discovery, prioritising, and owning launch and outcomes, regardless of title. Count engineering, ops, CS, sales or marketing time at 0 unless the resume shows those decisions.
- **Fairness.** Never use name, gender, age, photo, marital status, religion, caste, nationality or college prestige. Do not penalise career gaps, non-linear paths or career switches by themselves. Judge only evidence of the criteria.
- **No guessing.** If a fact is missing, score it from what is written and list it under `gaps`. Do not assume.

### A4. Success patterns seen in the past hires (use as signals, not as extra points)

- **Baseline pattern (present in all 8 resumes):** the person spotted a gap, built a reusable artifact or process (tracker, dashboard, SOP, checklist, template, programme), and others adopted it. Because every resume shows it, it **does not discriminate**. Treat it as a hygiene signal inside "0→1 / building without structure". Do not let it carry a score alone.
- **Discriminating patterns, which the weights below reflect:**
  1. Direct ownership of *what gets built* with adoption data (not just execution).
  2. Killing or pivoting work on evidence, and saying why.
  3. Sustained, direct customer or user contact that changed a decision.
  4. Lived, hands-on logistics or freight operations exposure ("in the rooms where the work happens").
  5. Integration, data-layer or carrier/port-system work with consequences (Senior PM).
  6. Acting decisively under disruption and documenting it (outage post-mortems, vendor changes, lost-deal reviews).

### A5. Flags (report only, do not score)

- `location`: Mumbai-based, willing to relocate, or unclear. In-office is mandatory. Relocation is acceptable. "Unclear" means confirm at screen. Never reject on this alone.
- `band`: PM-equivalent years below or above the target band for the role (see B/C criterion on band fit).
- `credibility`: unexplained overlapping dates, inflated titles, metrics with no baseline, or contact details that do not match the name. Mark "human review". Do not auto-penalise.
- `career_switch`: the resume is from a non-product function. Score by evidence, as in A3.

### A6. Recommendation bands

| Final total | Recommendation |
|---|---|
| 8.0 – 10.0 | **Strong advance:** fast-track to interview |
| 6.5 – 7.9 | **Advance with probes:** interview, targeting the weakest criteria |
| 5.0 – 6.4 | **Hold:** only if the pipeline is thin; needs a clear reason |
| 0 – 4.9 | **Decline** |

### A7. Output format

Return valid JSON, then a 3-line plain-English summary.

```json
{
  "role": "Product Manager | Senior Product Manager",
  "candidate": "<name as written>",
  "timeline": [{"employer": "", "title": "", "dates": "", "stage_size": "", "pm_equivalent": true}],
  "total_years": 0.0,
  "pm_equivalent_years": 0.0,
  "flags": {"location": "", "band": "", "credibility": "", "career_switch": ""},
  "criteria": [
    {"id": "C1", "name": "", "weight": 0.0, "level": 0, "points": 0.0,
     "evidence_quotes": ["..."], "evidence_rung": "E0-E4", "rationale": "one sentence"}
  ],
  "raw_total": 0.0,
  "caps_applied": ["..."],
  "final_total": 0.0,
  "recommendation": "",
  "top_strengths": ["", ""],
  "gaps": ["", ""],
  "interview_probes": ["3 specific questions aimed at the lowest-scoring weighted criteria"]
}
```

---

## PART B — Rubric: Product Manager (target 2–4 yrs; first PM on the core platform)

**What this role needs:** someone who can discover what ops teams at freight forwarders actually need, decide what to build with engineering, ship in short cycles, kill what doesn't work, and build the PM rhythms from nothing. Six-month success: two features customers use unprompted, a clear top-3 build list, engineering knowing the next three sprints, and time spent in real freight operations.

### B1. Criteria and weights (sum = 10.0)

| ID | Criterion | Weight |
|---|---|---|
| C1 | Product ownership: deciding what gets built and why | 2.0 |
| C2 | Shipping, killing and learning in short cycles | 1.5 |
| C3 | Customer discovery depth | 2.0 |
| C4 | Ground-level operations / freight-logistics fluency | 1.5 |
| C5 | Building without structure (0→1) | 1.5 |
| C6 | Engineering partnership and prioritisation | 1.0 |
| C7 | Experience-band fit (2–4 yrs PM-equivalent) | 0.5 |

### B2. Anchors (levels 1 and 3 sit between the written anchors)

**C1 Product ownership (2.0)**
- 0 — No evidence of product decisions.
- 2 — Supports or contributes to what is built (specs, requirements, inputs), or owns features as a non-PM with an outcome.
- 4 — Primary owner of a product area or module: roadmap, prioritisation, launch and outcome, with named results.

**C2 Shipping, killing, learning (1.5)**
- 0 — No shipped product work.
- 2 — Shipped things, with activity but weak or no outcome data.
- 4 — Shipped several things with adoption or impact numbers **and** killed or pivoted something on evidence, with the learning stated. Short cycles are visible. (Level 3 = shipped with outcomes but nothing killed.)

**C3 Customer discovery (2.0)**
- 0 — No customer or user contact.
- 2 — Regular customer contact (calls, QBRs, ops-team collaboration) but not structured discovery that fed decisions.
- 4 — Sustained structured discovery (interviews, observation, ticket mining) **and** hands-on time with users where they work, **and** a named insight that changed what was built. (Level 3 = structured discovery with a named decision, but remote only or not in the field.)

**C4 Operations / freight-logistics fluency (1.5)**
- 0 — No logistics or operations-heavy exposure.
- 1 — Domain words only (E1), or exposure only through customers.
- 2 — Adjacent ops-heavy domain (e-commerce fulfilment, last-mile, field operations) or software integrated with logistics providers.
- 3 — Worked in logistics or supply-chain operations, or built or sold logistics software, with concrete specifics.
- 4 — Hands-on in freight forwarding, 3PL, port, customs or carrier operations (documentation, carrier coordination, exception handling), with specifics that show they know what actually breaks.

**C5 Building without structure (1.5)**
- 0 — Only maintained existing systems in a mature structure.
- 2 — Created artifacts or processes inside an established team (templates, checklists, dashboards) that were adopted.
- 4 — Sole or first in function at a small or early company, created the working rhythm from scratch, and the practice persisted. Self-initiated builds show a decision, not just effort.

**C6 Engineering partnership and prioritisation (1.0)**
- 0 — No evidence.
- 2 — Writes requirements or works with engineers, but prioritisation logic is not shown (includes engineers translating field needs into specs).
- 4 — Shows how work was sequenced with engineering, forward visibility on roadmap or sprints, trade-offs made, and the shared outcome.

**C7 Band fit (0.5)**
- 0 — 0 PM-equivalent years, or more than 8.
- 1 — Under 1 year, or 6–8 years.
- 2 — 1–2 years, or 5–6 years.
- 3 — 2–4 years but little in a 0→1 setting.
- 4 — 2–4 years PM-equivalent, including relevant work in a 0→1 or early-stage setting.

### B3. Caps (apply after summing)

| Condition | Cap |
|---|---|
| C1 ≤ 1 (no evidence of product decisions) | Final total ≤ 5.0 |
| C3 ≤ 1 **and** C4 ≤ 1 (no discovery and no domain) | Final total ≤ 4.5 |

### B4. Calibration (past-hire resumes; expected final score ±0.5)

| Resume | Expected | Why |
|---|---|---|
| Lavanya Iyer (PM, port & logistics SaaS; ex-3PL planner) | ≈ 9.3 | Sole PM, killed features on data, discovery with forwarders, domain-native |
| Vikram Nair (PM, HR tech SaaS) | ≈ 6.6 | Strong PM craft and discovery; zero domain; structured Series B setting |
| Rohan Desai (engineer, ex-CHA ops) | ≈ 6.5 | Best domain fit and product-like builds; no PM role or years |
| Meghna Tiwari (customer success, ex-freight docs) | ≈ 4.5 | Domain-native, close to customers; no product ownership |
| Sunita Krishnamurthy (ops consultant) | ≈ 4.5 | Domain-native, self-directed; no product or engineering link |
| Aditya Shetty (enterprise sales, ports/SaaS) | ≈ 3.3 | Domain proximity and buyer insight; no product work |
| Preetham Rao (backend engineer, e-commerce) | ≈ 2.5 | Strong engineering, 3PL integrations; no product or customer evidence |
| Rahul Bose (marketing) | ≈ 2.0 | Good 0→1 programme building; no product, no domain |

If your score for any of these differs by more than 1.0, re-check your evidence rungs before proceeding.

---

## PART C — Rubric: Senior Product Manager (target 5–8 yrs; owns integration and data layer; most senior PM)

**What this role needs:** someone who owns the harder platform decisions (carrier systems, port portals, ERP and freight-management integrations, data quality and reliability), makes calls in ambiguity without a committee, understands operations-heavy industries at ground level, and sets the standard for how the PM function works. Six-month success: an integration roadmap that engineering, sales and the founder trust and that doesn't churn; one integration that opened a segment or unblocked a deal; a clear build-versus-configure-versus-avoid point of view; visible PM standards.

### Senior PM — Criteria and weights (sum = 10.0)

| ID | Criterion | Weight |
|---|---|---|
| C1 | Ownership of a product area without senior cover | 2.0 |
| C2 | Platform / integration / data-layer experience | 2.0 |
| C3 | Judgment in ambiguity (build vs configure vs avoid) | 1.5 |
| C4 | Operations-heavy domain fluency (logistics, supply chain) | 1.5 |
| C5 | Early-stage operating and building PM practice | 1.0 |
| C6 | Cross-functional leadership and roadmap trust | 1.0 |
| C7 | Reliability, data quality and incident ownership | 0.5 |
| C8 | Experience band and trajectory (5–8 yrs PM-equivalent) | 0.5 |

### Senior PM — Anchors (levels 1 and 3 sit between the written anchors)

**C1 Ownership without senior cover (2.0)**
- 0 — No product ownership evidence.
- 2 — Owns features or a module within a structured team, or owns a technical area as an engineer or lead without explicit what-to-build ownership.
- 4 — Sole or top decision-maker for a product area with scope, consequences and results named, with no senior PM making the calls above them. (Level 3 = owns an area independently but at small scale or short duration.)

**C2 Platform / integration / data layer (2.0)**
- 0 — None.
- 1 — Awareness only, or integration as a user of someone else's decisions.
- 2 — Adjacent exposure: migrations, vendor management, or integrations as a non-owner.
- 3 — Owned an integration or API area with outcomes (partner/carrier integrations, API docs, integration timelines).
- 4 — Owned the integration or data layer where decisions had multi-year consequences (vendor migration, data quality, system-of-record choices), with outcomes in complex existing technical environments.

**C3 Judgment in ambiguity (1.5)**
- 0 — No decisions shown.
- 2 — Makes decisions, but they are technical or procedural, or consensus-based, with no visible trade-off.
- 4 — Clear examples of hard calls: chose between options, accepted costs, killed or declined something, lived with the consequence and said what was learned.

**C4 Operations-heavy domain fluency (1.5)** — same anchors as Part B C4.

**C5 Early-stage operating and building PM practice (1.0)**
- 0 — Only mature or large organisations, no rule-making.
- 2 — Built processes inside an established team.
- 4 — First or most senior in function at an early-stage company; defined practices, decision frameworks or standards that others adopted.

**C6 Cross-functional leadership and roadmap trust (1.0)**
- 0 — None.
- 2 — Works with other functions; trust and alignment are not evidenced.
- 4 — Aligned engineering, sales and customer operations around a roadmap or decision, with evidence the alignment held (stability, trust, outcomes).

**C7 Reliability, data quality, incident ownership (0.5)**
- 0 — None.
- 2 — Participates in incident response or quality work.
- 4 — Owned reliability or data-quality standards, or incidents, to closure with numbers (uptime, incident reduction, post-mortems and follow-ups).

**C8 Band and trajectory (0.5)**
- 0 — 0 PM-equivalent years, or no progression.
- 1 — Under 3 years PM-equivalent, even with strong adjacent seniority.
- 2 — 3–4 years, or more than 10.
- 3 — 4–5 years, or 8–10.
- 4 — 5–8 years PM-equivalent with rising scope.

### Senior PM — Caps (apply after summing)

| Condition | Cap |
|---|---|
| C1 ≤ 1 | Final total ≤ 5.0 |
| C1 = 2 | Final total ≤ 6.5 |
| C2 ≤ 1 **and** C4 ≤ 1 | Final total ≤ 5.5 |

### Senior PM — Calibration (past-hire resumes; expected final score ±0.5)

| Resume | Expected | Why |
|---|---|---|
| Lavanya Iyer | ≈ 7.6 | Sole PM over carrier-integration and freight-visibility areas; under the years band; domain-native |
| Rohan Desai | ≈ 6.5 (raw ≈ 7.1, capped) | Owned integration/data migration and reliability in freight tech; no PM-equivalent ownership |
| Sunita Krishnamurthy | ≈ 4.5–5.0 | Domain-native and self-directed; process, not product or platform |
| Meghna Tiwari | ≈ 4.1 | Domain-native; no product or integration ownership |
| Vikram Nair | ≈ 4.0 | Solid PM craft; no integration or domain; structured environment; just under band |
| Preetham Rao | ≈ 3.9 | Strong integration and reliability engineering; no product ownership |
| Aditya Shetty | ≈ 3.0 | Domain proximity; no product or platform work |
| Rahul Bose | ≈ 1.6 | Programme-building only |

If your score for any of these differs by more than 1.0, re-check your evidence rungs before proceeding.

---

## PART D — Interview probes to attach when the evidence is thin

Generate 3 per candidate, targeted at the lowest-scoring weighted criteria. Templates:

- **Ownership / judgment:** "Tell me about a product decision you made that you'd reverse today. What did you know then, and what did it cost?"
- **Kill discipline:** "Describe something you shipped and then killed. What data told you, and who disagreed?"
- **Discovery:** "What did you learn from a customer that contradicted what they told you they wanted? What did you change?"
- **Domain:** "Walk me through a freight forwarder's morning: what breaks, and what slows the team down?"
- **Integration (Senior PM):** "A carrier integration will take 3 months and unblock one deal. How do you decide whether to build, configure, or say no?"
- **0→1:** "You are the only PM and there is no process. What do you set up in the first 30 days, and what do you deliberately leave alone?"
