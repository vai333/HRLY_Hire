from backend.app.cv_parser import contact_mismatch_note, redact
from backend.app.rubric import PM, SPM, load_rubrics
from backend.app.schemas import LLMCriterion, LLMEvaluation, LLMFlags
from backend.app.scoring import email_type_for, finalize, recommendation_for

CV = """ROHAN DESAI | Mumbai | rohan.desai@gmail.com | +91 98200 12345
Flat 12, Sea View Apartments, Andheri West, Mumbai 400058
linkedin.com/in/rohandesai
Date of Birth: 12/03/1994
Gender: Male

Experience
Software Engineer, FreightCo (Series A, 60 people) — Jan 2020 – Present
- Migrated carrier tracking data from legacy system to Postgres, cutting sync errors 40%
- Rohan built a customs document checklist adopted by 3 ops teams
Customs Executive, Shah CHA Services — 2017 – 2019
- Filed 30+ bills of entry weekly at JNPT

Education
B.E. Computer Engineering, Veermata Jijabai Technological Institute, 2017
MBA, Indian Institute of Management Ahmedabad, 2022
Certificate, IIT Bombay
"""


def test_redaction_strips_pii_and_keeps_work():
    r = redact(CV)
    t = r.text
    assert r.name == "Rohan Desai"
    assert r.email == "rohan.desai@gmail.com"
    assert r.city == "Mumbai"
    for leaked in ["Rohan", "Desai", "gmail", "98200", "400058", "Sea View", "1994", "Male",
                   "Jijabai", "Indian Institute", "Ahmedabad", "IIT Bombay", "linkedin"]:
        assert leaked.lower() not in t.lower(), leaked
    for kept in ["FreightCo", "sync errors 40%", "bills of entry", "JNPT", "B.E. Computer Engineering", "MBA"]:
        assert kept in t, kept
    assert t.startswith("Candidate location (city only, system-extracted): Mumbai")
    assert r.report["institutions"] >= 3


def test_contact_mismatch():
    assert contact_mismatch_note("Rohan Desai", "rohan.desai@gmail.com") is None
    assert contact_mismatch_note("Rohan Desai", "xyz123@gmail.com") is not None


def test_rubric_parsed_from_markdown():
    rubs = load_rubrics()
    assert [c.id for c in rubs[PM].criteria] == [f"C{i}" for i in range(1, 8)]
    assert [c.id for c in rubs[SPM].criteria] == [f"C{i}" for i in range(1, 9)]
    assert rubs[PM].criteria[0].weight == 2.0
    assert "PART B" in rubs[PM].rubric_text and "PART C" not in rubs[PM].rubric_text
    assert "PART C" in rubs[SPM].rubric_text and "PART D" in rubs[SPM].rubric_text


def _llm(levels, rung="E3", quote="Filed 30+ bills of entry weekly at JNPT"):
    return LLMEvaluation(
        timeline=[], total_years=7, pm_equivalent_years=0, top_strengths=[], gaps=[],
        interview_probes=["a", "b", "c", "d"], summary=["x", "y", "z"],
        flags=LLMFlags(location="Mumbai-based", band="Below band", credibility="None", career_switch="Yes: engineering"),
        criteria=[LLMCriterion(id=f"C{i+1}", level=l, evidence_quotes=[quote] if l else [], evidence_rung=rung if l else "E0",
                               rationale="r") for i, l in enumerate(levels)],
    )


def test_pm_math_and_c1_cap():
    text = redact(CV).text
    ev = finalize(PM, _llm([1, 3, 3, 4, 3, 2, 1]), text, "Rohan Desai")
    # 2*.25 + 1.5*.75 + 2*.75 + 1.5*1 + 1.5*.75 + 1*.5 + .5*.25 = 6.375 → 6.4
    assert ev["raw_total"] == 6.4
    assert ev["final_total"] == 5.0
    assert ev["recommendation"] == "Hold"
    assert len(ev["interview_probes"]) == 3
    assert all(q["verified"] for c in ev["criteria"] for q in c["quote_checks"])


def test_spm_c1_equals_2_cap():
    ev = finalize(SPM, _llm([2, 4, 3, 4, 3, 3, 4, 1]), redact(CV).text, None)
    assert ev["raw_total"] > 6.5 and ev["final_total"] == 6.5
    assert ev["recommendation"] == "Advance with probes"


def test_guardrails_no_quote_and_e1():
    llm = _llm([4, 0, 0, 3, 0, 0, 0], rung="E1")
    llm.criteria[0].evidence_quotes = []
    ev = finalize(PM, llm, redact(CV).text, None)
    assert ev["criteria"][0]["level"] == 0          # no quote → 0
    assert ev["criteria"][3]["level"] == 1          # E1 → max 1
    assert ev["final_total"] <= 4.5                 # C3 ≤1 and C4 ≤1 cap


def test_unverified_quote_flagged():
    ev = finalize(PM, _llm([2, 0, 0, 0, 0, 0, 0], quote="Led a team of 400 at Google"), redact(CV).text, None)
    assert ev["unverified_quotes"] == 1


def test_bands_and_email_types():
    assert recommendation_for(8.0) == "Strong advance"
    assert recommendation_for(6.5) == "Advance with probes"
    assert recommendation_for(5.0) == "Hold"
    assert recommendation_for(4.9) == "Decline"
    assert (email_type_for(6.5), email_type_for(5.5), email_type_for(4.9)) == ("invite", "hold", "rejection")


def test_confirmed_contact_details_are_redacted():
    cv = "Profile\nProduct person at FreightCo.\nReach me: v.t.work@outlook.com or 98200-12345\n" + "Shipped tracking. " * 20
    r = redact(cv, name="Vaibhav Tiwari", email="v.t.work@outlook.com", phone="+91 98200 12345")
    assert "outlook" not in r.text and "98200" not in r.text and "12345" not in r.text
    assert r.name == "Vaibhav Tiwari" and r.email == "v.t.work@outlook.com"


def test_detect_contact_reports_missing():
    from backend.app.cv_parser import detect_contact
    d = detect_contact("Experienced PM\nWorked at FreightCo on tracking")
    assert d == {"name": None, "email": None, "phone": None}
    d = detect_contact(CV)
    assert d["name"] == "Rohan Desai" and d["email"] == "rohan.desai@gmail.com" and d["phone"]


def test_apply_validation_and_honeypot():
    from fastapi.testclient import TestClient
    from backend.app.main import app
    c = TestClient(app)
    files = {"file": ("cv.docx", b"x", "application/octet-stream")}
    assert c.post("/api/apply", data={"role": "PM", "name": "A", "email": "a@b.co", "phone": "1", "consent": "true",
                                      "website": "spam"}, files=files).json() == {"ok": True}
    r = c.post("/api/apply", data={"role": "PM", "name": "A", "email": "bad", "phone": "12", "consent": "false"}, files=files)
    assert r.status_code == 422 and set(r.json()["detail"]["fields"]) == {"name", "email", "phone", "consent"}


def test_email_body_is_reformatted():
    from backend.app.emailer import format_body
    out = format_body("Hi {{first_name}}, One. Two. Three. Best, Arjun Mehta Founder & CEO, Kargo")
    assert out.startswith("Hi {{first_name}},\n\nOne. Two.\n\nThree.")
    assert out.endswith("Best,\nArjun Mehta\nFounder & CEO, Kargo") and out.count("Arjun Mehta") == 1


def test_resume_name_redacted_even_if_form_name_differs():
    r = redact("Rohan Mehta\nStrategy lead\n" + "Led pricing redesign. " * 20, name="Rohan Meheta")
    assert "mehta" not in r.text.lower() and "rohan" not in r.text.lower() and r.name == "Rohan Meheta"
