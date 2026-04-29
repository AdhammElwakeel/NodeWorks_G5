from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import random

from ..database import (
    create_session, load_session, update_session,
    complete_session, add_question_to_session,
)
from ..openrouter_client import generate_question, generate_followup, grade_answer
from ..config import NUM_SKILLS, FOLLOW_UPS_PER_SKILL, DIFFICULTY, VERIFICATION_THRESHOLD

router = APIRouter(prefix="/api/interview", tags=["interview"])

# ── Pydantic Models ────────────────────────────────────────────────────────────

class StartInterviewRequest(BaseModel):
    candidate_id: Optional[str] = None
    num_skills: int = NUM_SKILLS
    cv_data: Optional[dict] = None  # Passed directly from the frontend


class AnswerRequest(BaseModel):
    session_id: str
    answer: str


class ViolationRequest(BaseModel):
    session_id: str
    violation_type: str  # "tab_switch" | "paste_attempt"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _questions_for_skill(session: dict, skill: str) -> list[dict]:
    """Return all question records for a given skill."""
    return [q for q in session.get("questions", []) if q["skill_name"] == skill]


def _total_questions(session: dict) -> int:
    """Total expected questions = num_skills × (1 main + FOLLOW_UPS_PER_SKILL follow-ups)."""
    n = len(session["skills_to_test"])
    return n * (1 + FOLLOW_UPS_PER_SKILL)


def _build_cv_context(cv_data: dict, skill: str) -> str:
    parts: list[str] = []

    for proj in cv_data.get("projects", []):
        techs = proj.get("technologies", [])
        if skill in techs:
            parts.append(f"Project '{proj['name']}' used: {', '.join(techs)}")

    for exp in cv_data.get("experience", []):
        parts.append(f"Role: {exp.get('role', '?')} at {exp.get('company', '?')} ({exp.get('years', 'N/A')})")

    for cert in cv_data.get("certifications", []):
        if skill in cert.get("technologies", []) or not cert.get("technologies"):
            parts.append(f"Certification: {cert['name']}")

    return "\n".join(parts) if parts else f"Candidate lists {skill} as a skill."


async def _build_next_question(session: dict) -> dict | None:
    """
    Decide whether to ask a follow-up on the current skill or move to the next skill.
    Return the question dict to send to the frontend, or None if interview is over.
    """
    skills = session["skills_to_test"]
    questions = session.get("questions", [])

    # Figure out the current skill
    skill_index = 0
    for idx, skill in enumerate(skills):
        skill_qs = [q for q in questions if q["skill_name"] == skill]
        answered = [q for q in skill_qs if q.get("user_answer")]
        # Each skill expects 1 main + FOLLOW_UPS_PER_SKILL follow-ups
        if len(answered) < 1 + FOLLOW_UPS_PER_SKILL:
            skill_index = idx
            break
    else:
        return None  # All skills completed

    skill = skills[skill_index]
    cv_data = session.get("cv_data", {})
    cv_context = _build_cv_context(cv_data, skill)
    skill_qs = [q for q in questions if q["skill_name"] == skill]
    answered = [q for q in skill_qs if q.get("user_answer")]

    # Count what we have
    main_asked = any(not q.get("is_followup") for q in skill_qs)
    followups_answered = sum(1 for q in answered if q.get("is_followup"))

    if not main_asked:
        # Generate the MAIN question
        prev_texts = [q["question_text"] for q in skill_qs]
        q_data = generate_question(skill, cv_context, prev_texts, DIFFICULTY)
        record = {
            "skill_name": skill,
            "question_text": q_data.get("question_text", f"Tell me about your experience with {skill}."),
            "focus_concept": q_data.get("focus_concept", skill),
            "is_followup": False,
            "followup_number": 0,
            "user_answer": None,
            "score": None,
            "feedback": None,
            "cheating_flag": False,
        }
        add_question_to_session(session["session_id"], record)
        return {
            "question_text": record["question_text"],
            "focus_concept": record["focus_concept"],
            "skill_name": skill,
            "is_followup": False,
            "followup_number": 0,
            "question_number": len(questions) + 1,
            "total_questions": _total_questions(session),
        }
    elif followups_answered < FOLLOW_UPS_PER_SKILL:
        # Generate a FOLLOW-UP
        followup_num = followups_answered + 1
        # Find the most recent answered question to follow up on
        last_answered = next(
            (q for q in reversed(answered)), answered[-1] if answered else skill_qs[0]
        )
        main_q = next((q for q in skill_qs if not q.get("is_followup")), skill_qs[0])
        q_data = generate_followup(
            skill,
            main_q["question_text"],
            last_answered.get("user_answer", ""),
            followup_num,
            DIFFICULTY,
        )
        record = {
            "skill_name": skill,
            "question_text": q_data.get("question_text", f"Can you elaborate on your use of {skill}?"),
            "focus_concept": q_data.get("focus_concept", f"{skill} follow-up"),
            "is_followup": True,
            "followup_number": followup_num,
            "user_answer": None,
            "score": None,
            "feedback": None,
            "cheating_flag": False,
        }
        add_question_to_session(session["session_id"], record)
        return {
            "question_text": record["question_text"],
            "focus_concept": record["focus_concept"],
            "skill_name": skill,
            "is_followup": True,
            "followup_number": followup_num,
            "question_number": len(questions) + 1,
            "total_questions": _total_questions(session),
        }
    else:
        # This skill is done — move to next by recursing
        return await _build_next_question(session)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/start")
async def start_interview(request: StartInterviewRequest):
    """Start a new interview session."""
    cv_data: dict = request.cv_data or {}

    # Pick skills from CV data
    all_skills: list[str] = cv_data.get("all_skills", []) or cv_data.get("skills", [])
    if not all_skills:
        all_skills = ["Communication", "Problem Solving", "Technical Knowledge", "System Design", "Code Quality"]

    num = min(request.num_skills, len(all_skills))
    skills_to_test = random.sample(all_skills, num) if num > 0 else all_skills[:5]

    candidate_id = request.candidate_id or cv_data.get("name", "Candidate")
    session = create_session(str(candidate_id), skills_to_test, cv_data)

    # Generate first question
    first_question = await _build_next_question(session)

    return {
        "session_id": session["session_id"],
        "candidate_name": cv_data.get("name"),
        "skills_to_test": skills_to_test,
        "total_questions": _total_questions(session),
        "questions_per_skill": 1 + FOLLOW_UPS_PER_SKILL,
        "first_question": first_question,
    }


@router.post("/submit-answer")
async def submit_answer(request: AnswerRequest):
    """Submit an answer and get the next question or final results."""
    session = load_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Interview already completed")

    questions = session.get("questions", [])

    # Find the last unanswered question
    current_q = next((q for q in reversed(questions) if q.get("user_answer") is None), None)
    if not current_q:
        raise HTTPException(status_code=400, detail="No pending question found")

    # Grade the answer
    grade = grade_answer(
        question_asked=current_q["question_text"],
        user_answer=request.answer,
        skill_name=current_q["skill_name"],
        is_followup=current_q.get("is_followup", False),
    )

    # Update the question record in-place
    current_q["user_answer"] = request.answer
    current_q["score"] = grade.get("score", 5)
    current_q["feedback"] = grade.get("feedback", "")
    current_q["cheating_flag"] = grade.get("cheating_flag", False)
    update_session(request.session_id, {"questions": questions})

    # Re-load to get fresh state
    session = load_session(request.session_id)
    answered_count = sum(1 for q in session["questions"] if q.get("user_answer"))

    # Check if interview is fully complete
    if answered_count >= _total_questions(session):
        complete_session(request.session_id)
        session = load_session(request.session_id)
        return {
            "status": "completed",
            "next_question": None,
            "questions_answered": answered_count,
            "total_questions": _total_questions(session),
            "report": _generate_report(session),
        }

    # Generate the next question
    next_q = await _build_next_question(session)
    return {
        "status": "in_progress",
        "next_question": next_q,
        "questions_answered": answered_count,
        "total_questions": _total_questions(session),
        "report": None,
    }


@router.post("/report-violation")
async def report_violation(request: ViolationRequest):
    session = load_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    violations = session.get("violations", 0) + 1
    update_session(request.session_id, {"violations": violations})
    return {"violations": violations, "warning": violations >= 3}


@router.get("/{session_id}/status")
async def get_session_status(session_id: str):
    session = load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    answered = sum(1 for q in session["questions"] if q.get("user_answer"))
    return {
        "session_id": session["session_id"],
        "status": session["status"],
        "skills_to_test": session["skills_to_test"],
        "questions_answered": answered,
        "total_questions": _total_questions(session),
        "violations": session.get("violations", 0),
    }


@router.get("/{session_id}/report")
async def get_report(session_id: str):
    session = load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "completed":
        raise HTTPException(status_code=400, detail="Interview not yet completed")
    return _generate_report(session)


# ── Report Generator ───────────────────────────────────────────────────────────

def _generate_report(session: dict) -> dict:
    questions = session.get("questions", [])
    if not questions:
        return {
            "session_id": session["session_id"],
            "candidate_id": session["candidate_id"],
            "overall_score": 0,
            "is_verified": False,
            "skill_scores": [],
            "total_questions": 0,
            "cheating_detected": False,
        }

    skill_map: dict[str, list[float]] = {}
    cheating_detected = False

    for q in questions:
        if q.get("user_answer") is None:
            continue
        skill = q.get("skill_name", "Unknown")
        score = q.get("score", 0) or 0
        skill_map.setdefault(skill, []).append(float(score))
        if q.get("cheating_flag"):
            cheating_detected = True

    skill_scores = []
    all_scores: list[float] = []
    for skill, scores in skill_map.items():
        avg = sum(scores) / len(scores) if scores else 0
        pct = round(avg * 10, 1)
        skill_scores.append({"skill": skill, "score": pct, "questions_asked": len(scores)})
        all_scores.extend(scores)

    overall = round((sum(all_scores) / len(all_scores) * 10) if all_scores else 0, 1)
    is_verified = overall >= VERIFICATION_THRESHOLD and not cheating_detected

    return {
        "session_id": session["session_id"],
        "candidate_id": session["candidate_id"],
        "overall_score": overall,
        "is_verified": is_verified,
        "skill_scores": skill_scores,
        "total_questions": len(questions),
        "cheating_detected": cheating_detected,
    }
