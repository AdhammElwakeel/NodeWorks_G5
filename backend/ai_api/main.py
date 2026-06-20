"""AI/KBS + CV Analysis API service.

This service owns Neo4j writes for the knowledge graph and exposes CV analysis.
The Next.js app keeps MongoDB as the source of truth and calls these endpoints
only when the user manually syncs a freelancer profile or project.
"""

import asyncio
from itertools import permutations
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import random
import re
import sys
import threading
from typing import Any
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError
from openai import OpenAI
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# Runtime Configuration And External Module Loading
# -----------------------------------------------------------------------------

ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=ROOT_DIR / ".env")
load_dotenv(dotenv_path=ROOT_DIR / "frontend" / ".env")
RECOMMENDATION_MIN_SCORE = float(os.getenv("RECOMMENDATION_MIN_SCORE", "55"))
INDIVIDUAL_RECOMMENDATION_MIN_SCORE = float(os.getenv("INDIVIDUAL_RECOMMENDATION_MIN_SCORE", "0"))

CV_ANALYZER_DIR = ROOT_DIR / "MergedCVAnalyzer-with-KBS"
RECOMMENDER_DIR = ROOT_DIR / "Recommender-System"
for import_dir in (CV_ANALYZER_DIR, RECOMMENDER_DIR):
    sys.path.insert(0, str(import_dir))

from cv_analysis_module import process_cv
from cv_analysis_module.config import MODEL_NAME, OPENCODE_GO_API_KEY, OPENCODE_GO_BASE_URL, TECH_ROLES

try:
    from role_matcher import RoleMatcher
except Exception:
    RoleMatcher = None


# -----------------------------------------------------------------------------
# API Request/Response Models
# -----------------------------------------------------------------------------

class FreelancerIngestRequest(BaseModel):
    userId: str
    email: str | None = None
    name: str | None = None
    profile: dict[str, Any] = Field(default_factory=dict)


class ProjectIngestRequest(BaseModel):
    projectId: str
    clientId: str
    title: str
    description: str
    budget: float | None = None
    skills: list[str] = Field(default_factory=list)
    domainKeywords: list[str] = Field(default_factory=list)
    requiredRoles: list[str] = Field(default_factory=list)
    status: str | None = None
    timeline: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None


class FreelancerJobRecommendationRequest(BaseModel):
    userId: str
    limit: int = 10
    excludeProjectIds: list[str] = Field(default_factory=list)


class ProjectFreelancerRecommendationRequest(BaseModel):
    projectId: str
    limit: int = 10
    excludeUserIds: list[str] = Field(default_factory=list)


class ProjectTeamRecommendationRequest(BaseModel):
    projectId: str
    limit: int = 3
    maxTeamSize: int = 4
    excludeUserIds: list[str] = Field(default_factory=list)


class ProjectSkillSuggestionRequest(BaseModel):
    title: str
    description: str
    skills: list[str] = Field(default_factory=list)


class ProjectSkillSuggestionResponse(BaseModel):
    skills: list[str]
    domainKeywords: list[str] = Field(default_factory=list)
    requiredRoles: list[str] = Field(default_factory=list)
    projectKeywords: list[str] = Field(default_factory=list)


class StartInterviewRequest(BaseModel):
    candidate_id: str | None = None
    num_skills: int = 3
    cv_data: dict[str, Any] = Field(default_factory=dict)


class AnswerInterviewRequest(BaseModel):
    session_id: str
    answer: str
    demo_result: str | None = None


class InterviewViolationRequest(BaseModel):
    session_id: str
    violation_type: str
    reason: str | None = None


# -----------------------------------------------------------------------------
# Interview Configuration And Shared State
# -----------------------------------------------------------------------------

INTERVIEW_NUM_SKILLS = int(os.getenv("INTERVIEW_NUM_SKILLS", "3"))
INTERVIEW_FOLLOW_UPS_PER_SKILL = int(os.getenv("INTERVIEW_FOLLOW_UPS_PER_SKILL", "3"))
INTERVIEW_DIFFICULTY = os.getenv("INTERVIEW_DIFFICULTY", "easy")
INTERVIEW_VERIFICATION_THRESHOLD = float(os.getenv("INTERVIEW_VERIFICATION_THRESHOLD", "65"))
INTERVIEW_STRONG_SKILL_THRESHOLD = 65
INTERVIEW_PENALTY_PER_VIOLATION = 5
INTERVIEW_PENALTY_PER_CHEAT_FLAG = 10
INTERVIEW_PENALTY_CAP = 30
INTERVIEW_MAX_VIOLATIONS = 6
INTERVIEW_DATA_DIR = Path(__file__).parent / "data" / "interviews"
_interview_locks: dict[str, threading.Lock] = {}
_interview_locks_lock = threading.Lock()


# -----------------------------------------------------------------------------
# General Data Cleaning And LLM Utilities
# -----------------------------------------------------------------------------

def _clean_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _clean_string_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []

    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = _clean_string(value)
        if not text:
            continue
        key = text.lower()
        if key not in seen:
            seen.add(key)
            cleaned.append(text)
    return cleaned


def _opencode_base_url() -> str:
    return (OPENCODE_GO_BASE_URL or "").rstrip("/").removesuffix("/chat/completions")


def _project_skill_model_id() -> str:
    model = os.getenv("PROJECT_SKILL_SUGGESTION_MODEL") or MODEL_NAME
    return model.removeprefix("opencode-go/")


def _extract_json_object(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return {}
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}


def suggest_project_requirements_with_llm(payload: ProjectSkillSuggestionRequest) -> dict[str, list[str]]:
    title = _clean_string(payload.title)
    description = _clean_string(payload.description)
    existing_skills = _clean_string_list(payload.skills)

    if not title or not description:
        raise ValueError("Project title and description are required")
    if not OPENCODE_GO_API_KEY or not OPENCODE_GO_BASE_URL:
        raise RuntimeError("Missing Opencode Go configuration")

    model_id = _project_skill_model_id()
    if model_id in {"missing-model", "missing-api-key"}:
        raise RuntimeError("Missing PROJECT_SKILL_SUGGESTION_MODEL or CV_ANALYSIS_MODEL")

    existing_lower = {skill.lower() for skill in existing_skills}
    client = OpenAI(
        base_url=_opencode_base_url(),
        api_key=OPENCODE_GO_API_KEY,
        timeout=60,
    )

    prompt = {
        "project_title": title,
        "project_description": description,
        "already_selected_skills": existing_skills,
    }
    response = client.chat.completions.create(
        model=model_id,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a senior technical recruiter for a freelancer marketplace. "
                    "Infer structured project requirements from the title and description. "
                    "Return strict JSON only with this shape: "
                    "{\"skills\":[\"Skill\"],\"domainKeywords\":[\"Domain\"],\"requiredRoles\":[\"Role\"]}. "
                    "Suggest 4 to 10 concise, normalized technical skill names, 1 to 5 technical domain/problem-space keywords, "
                    "and 1 to 3 technical/product/design roles. Domain keywords are industries/problem spaces such as "
                    "Medical Imaging, Recommendation Systems, Knowledge Graphs, E-commerce, Education Technology, Cybersecurity. "
                    "Do not put tools or frameworks in domainKeywords. Do not invent content, marketing, or non-technical roles. "
                    "Exclude skills already selected by the client. "
                    "Do not include explanations."
                ),
            },
            {"role": "user", "content": json.dumps(prompt)},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    content = response.choices[0].message.content or "{}"
    data = _extract_json_object(content)
    suggestions = _clean_string_list(data.get("skills"))[:10]
    domains = _clean_string_list(data.get("domainKeywords") or data.get("domains"))[:5]
    roles = _clean_string_list(data.get("requiredRoles") or data.get("roles"))[:3]
    skills = [skill for skill in suggestions if skill.lower() not in existing_lower]

    return {
        "skills": skills,
        "domainKeywords": domains,
        "requiredRoles": roles,
        "projectKeywords": _clean_string_list(skills + domains),
    }


def suggest_project_skills_with_llm(payload: ProjectSkillSuggestionRequest) -> list[str]:
    return suggest_project_requirements_with_llm(payload)["skills"]


# -----------------------------------------------------------------------------
# AI Interview Session Storage And Locking
# -----------------------------------------------------------------------------

def _interview_model_id() -> str:
    model = os.getenv("INTERVIEW_MODEL") or MODEL_NAME
    return model.removeprefix("opencode-go/")


def _interview_lock(session_id: str) -> threading.Lock:
    with _interview_locks_lock:
        lock = _interview_locks.get(session_id)
        if lock is None:
            lock = threading.Lock()
            _interview_locks[session_id] = lock
        return lock


def _interview_session_path(session_id: str) -> Path:
    return INTERVIEW_DATA_DIR / f"session_{session_id}.json"


def _save_interview_session(session: dict[str, Any]) -> None:
    INTERVIEW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    session_id = str(session["session_id"])
    path = _interview_session_path(session_id)
    tmp_path = path.with_suffix(".json.tmp")
    lock = _interview_lock(session_id)
    with lock:
        tmp_path.write_text(json.dumps(session, indent=2), encoding="utf-8")
        tmp_path.replace(path)


def _load_interview_session(session_id: str) -> dict[str, Any] | None:
    path = _interview_session_path(session_id)
    lock = _interview_lock(session_id)
    with lock:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))


def _update_interview_session(session_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    path = _interview_session_path(session_id)
    lock = _interview_lock(session_id)
    with lock:
        if not path.exists():
            return None
        session = json.loads(path.read_text(encoding="utf-8"))
        session.update(updates)
        tmp_path = path.with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps(session, indent=2), encoding="utf-8")
        tmp_path.replace(path)
        return session


# -----------------------------------------------------------------------------
# AI Interview Question Generation And Grading
# -----------------------------------------------------------------------------

def _create_interview_session(candidate_id: str, skills_to_test: list[str], cv_data: dict[str, Any]) -> dict[str, Any]:
    session = {
        "session_id": uuid.uuid4().hex[:10],
        "candidate_id": candidate_id,
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "skills_to_test": skills_to_test,
        "questions": [],
        "violations": 0,
        "violation_types": [],
        "cv_data": cv_data,
    }
    _save_interview_session(session)
    return session


def _add_interview_question(session_id: str, question: dict[str, Any]) -> None:
    session = _load_interview_session(session_id)
    if not session:
        return
    session.setdefault("questions", []).append(question)
    _save_interview_session(session)


def _complete_interview_session(session_id: str) -> dict[str, Any] | None:
    return _update_interview_session(
        session_id,
        {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )


def _call_interview_llm(
    messages: list[dict[str, str]], temperature: float = 0.4
) -> dict[str, Any]:
    if not OPENCODE_GO_API_KEY or not OPENCODE_GO_BASE_URL:
        raise RuntimeError("Missing interview LLM configuration")

    try:
        client = OpenAI(
            base_url=_opencode_base_url(),
            api_key=OPENCODE_GO_API_KEY,
            timeout=60,
        )
        response = client.chat.completions.create(
            model=_interview_model_id(),
            messages=messages,
            response_format={"type": "json_object"},
            temperature=temperature,
        )
        content = response.choices[0].message.content or "{}"
        data = _extract_json_object(content)
        if not data:
            raise RuntimeError("Interview LLM returned empty or invalid JSON")
        return data
    except Exception as exc:
        raise RuntimeError(f"Interview LLM request failed: {exc}") from exc


def _cv_collection(cv_data: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = cv_data.get(key)
    return value if isinstance(value, list) else []


def _interview_cv_context(cv_data: dict[str, Any], skill: str) -> str:
    parts: list[str] = []
    headline = _clean_string(cv_data.get("headline") or cv_data.get("bestRole") or cv_data.get("best_role"))
    if headline:
        parts.append(f"Headline/role: {headline}")

    for project in _cv_collection(cv_data, "projects")[:6]:
        techs = _clean_string_list(project.get("technologies"))
        name = _clean_string(project.get("name")) or "CV project"
        if not techs or skill.lower() in {tech.lower() for tech in techs}:
            parts.append(f"Project '{name}' used: {', '.join(techs) if techs else skill}")

    for experience in _cv_collection(cv_data, "experience")[:5]:
        role = _clean_string(experience.get("role")) or "Role"
        company = _clean_string(experience.get("company")) or "company"
        years = _clean_string(experience.get("years")) or "duration not specified"
        parts.append(f"Experience: {role} at {company} ({years})")

    for cert in _cv_collection(cv_data, "certifications")[:4]:
        name = _clean_string(cert.get("name"))
        if name:
            parts.append(f"Certification: {name}")

    return "\n".join(parts[:10]) if parts else f"Candidate lists {skill} as a skill."


def _generate_interview_question(
    skill: str, cv_context: str, previous_questions: list[str]
) -> dict[str, Any]:
    data = _call_interview_llm(
        [
            {
                "role": "system",
                "content": (
                    "You are a senior technical interviewer for a freelancer marketplace. "
                    "Ask practical, scenario-based questions tied to the candidate CV. "
                    "Return strict JSON only."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "skill": skill,
                        "difficulty": INTERVIEW_DIFFICULTY,
                        "cv_context": cv_context,
                        "previous_questions": previous_questions,
                        "requirements": [
                            "Generate one concise interview question.",
                            "Avoid definitions and repeated questions.",
                            "Make it answerable in 2 to 4 paragraphs.",
                        ],
                        "json_shape": {"question_text": "...", "focus_concept": "..."},
                    }
                ),
            },
        ],
    )
    if not _clean_string(data.get("question_text")) or not _clean_string(data.get("focus_concept")):
        raise RuntimeError("Interview LLM response missing question_text or focus_concept")
    return data


def _generate_interview_followup(
    skill: str, main_question: str, candidate_answer: str, followup_number: int
) -> dict[str, Any]:
    data = _call_interview_llm(
        [
            {
                "role": "system",
                "content": (
                    "You are a senior technical interviewer. Ask one focused follow-up "
                    "that probes the candidate's previous answer. Return strict JSON only."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "skill": skill,
                        "difficulty": INTERVIEW_DIFFICULTY,
                        "main_question": main_question,
                        "candidate_answer": candidate_answer,
                        "followup_number": followup_number,
                        "json_shape": {"question_text": "...", "focus_concept": "..."},
                    }
                ),
            },
        ],
    )
    if not _clean_string(data.get("question_text")) or not _clean_string(data.get("focus_concept")):
        raise RuntimeError("Interview LLM response missing follow-up question_text or focus_concept")
    return data


def _grade_interview_answer(
    question_text: str, answer: str, skill: str, is_followup: bool
) -> dict[str, Any]:
    grade = _call_interview_llm(
        [
            {
                "role": "system",
                "content": (
                    "You are a strict but fair technical interview grader. Score from 0 to 10. "
                    "Return strict JSON only."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "skill": skill,
                        "question_type": "follow_up" if is_followup else "main",
                        "question": question_text,
                        "answer": answer,
                        "rubric": {
                            "technical_accuracy": "30%",
                            "depth_specificity": "30%",
                            "practical_experience": "25%",
                            "clarity": "15%",
                        },
                        "cheating_flag_rules": [
                            "Textbook-only answer with no personal detail",
                            "Irrelevant answer",
                            "Suspicious copy-paste style",
                        ],
                        "json_shape": {
                            "score": 0,
                            "feedback": "2-3 sentence feedback",
                            "cheating_flag": False,
                        },
                    }
                ),
            },
        ],
        temperature=0.2,
    )
    english = _call_interview_llm(
        [
            {
                "role": "system",
                "content": "Assess written English quality from 0 to 10. Return strict JSON only.",
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "answer": answer,
                        "json_shape": {"score": 0, "feedback": "short English feedback"},
                    }
                ),
            },
        ],
        temperature=0.2,
    )
    if grade.get("score") is None or not _clean_string(grade.get("feedback")):
        raise RuntimeError("Interview grading response missing score or feedback")
    if english.get("score") is None or not _clean_string(english.get("feedback")):
        raise RuntimeError("English grading response missing score or feedback")
    grade["english_score"] = english["score"]
    grade["english_feedback"] = english["feedback"]
    return grade


def _demo_interview_grade(result: str) -> dict[str, Any]:
    if result == "right":
        return {
            "score": 10,
            "feedback": "Demo skip: marked as correct.",
            "cheating_flag": False,
            "english_score": 9,
            "english_feedback": "Demo skip: strong English.",
        }
    if result == "wrong":
        return {
            "score": 2,
            "feedback": "Demo skip: marked as incorrect.",
            "cheating_flag": False,
            "english_score": 4,
            "english_feedback": "Demo skip: weak English.",
        }
    raise ValueError("demo_result must be 'right' or 'wrong'")


def _interview_total_questions(session: dict[str, Any]) -> int:
    return len(session.get("skills_to_test", [])) * (1 + INTERVIEW_FOLLOW_UPS_PER_SKILL)


def _interview_question_response(
    session: dict[str, Any], record: dict[str, Any], question_number: int
) -> dict[str, Any]:
    return {
        "question_text": record["question_text"],
        "focus_concept": record["focus_concept"],
        "skill_name": record["skill_name"],
        "is_followup": record["is_followup"],
        "followup_number": record["followup_number"],
        "question_number": question_number,
        "total_questions": _interview_total_questions(session),
    }


def _build_next_interview_question(session: dict[str, Any]) -> dict[str, Any] | None:
    skills = session.get("skills_to_test", [])
    questions = session.get("questions", [])

    for skill in skills:
        skill_questions = [q for q in questions if q.get("skill_name") == skill]
        answered = [q for q in skill_questions if q.get("user_answer")]
        if len(answered) >= 1 + INTERVIEW_FOLLOW_UPS_PER_SKILL:
            continue

        if not any(not q.get("is_followup") for q in skill_questions):
            q_data = _generate_interview_question(
                skill,
                _interview_cv_context(session.get("cv_data", {}), skill),
                [q.get("question_text", "") for q in skill_questions],
            )
            record = {
                "skill_name": skill,
                "question_text": _clean_string(q_data.get("question_text")),
                "focus_concept": _clean_string(q_data.get("focus_concept")),
                "is_followup": False,
                "followup_number": 0,
                "user_answer": None,
                "score": None,
                "feedback": None,
                "cheating_flag": False,
                "english_score": None,
                "english_feedback": None,
            }
            _add_interview_question(session["session_id"], record)
            return _interview_question_response(session, record, len(questions) + 1)

        followups_answered = sum(1 for q in answered if q.get("is_followup"))
        if followups_answered < INTERVIEW_FOLLOW_UPS_PER_SKILL:
            followup_number = followups_answered + 1
            main_question = next((q for q in skill_questions if not q.get("is_followup")), skill_questions[0])
            last_answered = answered[-1] if answered else main_question
            q_data = _generate_interview_followup(
                skill,
                main_question.get("question_text", ""),
                last_answered.get("user_answer", ""),
                followup_number,
            )
            record = {
                "skill_name": skill,
                "question_text": _clean_string(q_data.get("question_text")),
                "focus_concept": _clean_string(q_data.get("focus_concept")),
                "is_followup": True,
                "followup_number": followup_number,
                "user_answer": None,
                "score": None,
                "feedback": None,
                "cheating_flag": False,
                "english_score": None,
                "english_feedback": None,
            }
            _add_interview_question(session["session_id"], record)
            return _interview_question_response(session, record, len(questions) + 1)

    return None


def _score_as_float(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(10, score))


def _interview_badge_tier(score: float) -> str | None:
    if score >= 85:
        return "gold"
    if score >= 70:
        return "silver"
    if score >= 65:
        return "bronze"
    return None


def _generate_interview_report(session: dict[str, Any]) -> dict[str, Any]:
    questions = session.get("questions", [])
    violations = int(session.get("violations", 0) or 0)
    skill_map: dict[str, list[float]] = {}
    english_scores: list[float] = []
    cheat_flag_count = 0

    for question in questions:
        if not question.get("user_answer"):
            continue
        skill = _clean_string(question.get("skill_name")) or "Unknown"
        skill_map.setdefault(skill, []).append(_score_as_float(question.get("score")))
        if question.get("english_score") is not None:
            english_scores.append(_score_as_float(question.get("english_score")))
        if question.get("cheating_flag"):
            cheat_flag_count += 1

    skill_scores: list[dict[str, Any]] = []
    all_scores: list[float] = []
    for skill, scores in skill_map.items():
        avg = sum(scores) / len(scores) if scores else 0
        pct = round(avg * 10, 1)
        skill_scores.append({"skill": skill, "score": pct, "questions_asked": len(scores)})
        all_scores.extend(scores)

    raw_score = round((sum(all_scores) / len(all_scores) * 10) if all_scores else 0, 1)
    violation_penalty = violations * INTERVIEW_PENALTY_PER_VIOLATION
    cheat_penalty = cheat_flag_count * INTERVIEW_PENALTY_PER_CHEAT_FLAG
    total_penalty = min(violation_penalty + cheat_penalty, INTERVIEW_PENALTY_CAP)
    overall_score = max(0, round(raw_score - total_penalty, 1))
    cheating_detected = cheat_flag_count > 0

    return {
        "session_id": session["session_id"],
        "candidate_id": session["candidate_id"],
        "overall_score": overall_score,
        "raw_score": raw_score,
        "is_verified": overall_score >= INTERVIEW_VERIFICATION_THRESHOLD and not cheating_detected,
        "skill_scores": skill_scores,
        "total_questions": len([q for q in questions if q.get("user_answer")]),
        "cheating_detected": cheating_detected,
        "violations": violations,
        "violation_types": session.get("violation_types", []),
        "violation_reasons": session.get("violation_reasons", []),
        "english_score": round((sum(english_scores) / len(english_scores) * 10) if english_scores else 0, 1),
        "penalty": total_penalty,
        "penalty_breakdown": {
            "violations": violation_penalty,
            "cheat_flags": cheat_penalty,
            "total": total_penalty,
        },
        "strong_skills": [item["skill"] for item in skill_scores if item["score"] >= INTERVIEW_STRONG_SKILL_THRESHOLD],
        "badge_tier": _interview_badge_tier(overall_score),
        "completed_at": session.get("completed_at"),
    }


# -----------------------------------------------------------------------------
# CV, Role, Skill, And Knowledge Matching Helpers
# -----------------------------------------------------------------------------

def _cv_value(cv_analysis: dict[str, Any], camel_key: str, snake_key: str) -> Any:
    return cv_analysis.get(camel_key, cv_analysis.get(snake_key))


def _normalise_text(value: str) -> str:
    return value.strip().lower()


def _normalise_skill_set(values: Any) -> set[str]:
    return {_normalise_text(value) for value in _clean_string_list(values)}


KNOWLEDGE_ALIASES: dict[str, str] = {
    "reactjs": "react",
    "react.js": "react",
    "nextjs": "next.js",
    "next.js": "next.js",
    "nodejs": "node.js",
    "node.js": "node.js",
    "vuejs": "vue",
    "vue.js": "vue",
    "tailwindcss": "tailwind",
    "tailwind css": "tailwind",
    "postgres": "postgresql",
    "postgre sql": "postgresql",
    "rest apis": "rest api",
    "apis": "api",
    "llms": "llm",
    "large language models": "llm",
    "large language model": "llm",
    "genai": "generative ai",
    "gen ai": "generative ai",
    "huggingface": "hugging face",
    "scikit learn": "scikit-learn",
    "sklearn": "scikit-learn",
    "tensorflow": "tensorflow",
    "tf": "tensorflow",
    "pytorch": "pytorch",
    "opencv": "opencv",
    "open cv": "opencv",
    "ci cd": "ci/cd",
}


def _compact_knowledge_text(value: str) -> str:
    return re.sub(r"[^a-z0-9+#]+", "", value.strip().lower())


def _knowledge_terms(value: str) -> set[str]:
    text = _normalise_text(value)
    compact = _compact_knowledge_text(text)
    terms = {text, compact}
    alias = KNOWLEDGE_ALIASES.get(text) or KNOWLEDGE_ALIASES.get(compact)
    if alias:
        terms.add(alias)
        terms.add(_compact_knowledge_text(alias))
    return {term for term in terms if term}


def _knowledge_term_map(values: Any) -> dict[str, str]:
    terms: dict[str, str] = {}
    for value in _clean_string_list(values):
        for term in _knowledge_terms(value):
            terms.setdefault(term, value)
    return terms


def _keyword_matches_skill(keyword: str, skill_terms: dict[str, str]) -> bool:
    keyword_terms = _knowledge_terms(keyword)
    if keyword_terms & set(skill_terms):
        return True

    compact_keywords = {_compact_knowledge_text(term) for term in keyword_terms}
    for keyword_key in compact_keywords:
        if len(keyword_key) < 4:
            continue
        for skill_key in skill_terms:
            compact_skill = _compact_knowledge_text(skill_key)
            if len(compact_skill) < 4:
                continue
            if keyword_key in compact_skill or compact_skill in keyword_key:
                return True
    return False


def _normalise_role_rankings(values: Any) -> list[dict[str, Any]]:
    if not isinstance(values, list):
        return []

    rankings: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in values:
        if not isinstance(item, dict):
            continue
        role = _clean_string(item.get("role"))
        if not role:
            continue
        key = role.lower()
        if key in seen:
            continue
        seen.add(key)
        try:
            score = float(item.get("score") or 0)
        except (TypeError, ValueError):
            score = 0.0
        rankings.append(
            {
                "role": role,
                "score": score,
                "matched_skills": _clean_string_list(
                    item.get("matchedSkills") or item.get("matched_skills")
                ),
                "missing_skills": _clean_string_list(
                    item.get("missingSkills") or item.get("missing_skills")
                ),
            }
        )

    rankings.sort(key=lambda item: item["score"], reverse=True)
    return rankings


_role_matcher: Any | None = None


def _resolve_requested_role(role: str) -> str:
    if not role:
        return role

    for known_role in TECH_ROLES:
        if _normalise_text(known_role) == _normalise_text(role):
            return known_role

    global _role_matcher
    if RoleMatcher is not None:
        try:
            if _role_matcher is None:
                _role_matcher = RoleMatcher(TECH_ROLES)
            return _role_matcher.match_all([role])[0]
        except Exception:
            pass

    role_words = set(re.findall(r"[a-z0-9]+", role.lower()))
    best_role = role
    best_overlap = 0
    for known_role in TECH_ROLES:
        known_words = set(re.findall(r"[a-z0-9]+", known_role.lower()))
        overlap = len(role_words & known_words)
        if overlap > best_overlap:
            best_role = known_role
            best_overlap = overlap
    return best_role


def _role_score_details_for_candidate(candidate: dict[str, Any], requested_role: str) -> dict[str, Any]:
    rankings = candidate.get("roleRankings") or []
    if _normalise_text(requested_role) == "technical freelancer":
        if rankings:
            best = max(rankings, key=lambda ranking: float(ranking.get("score") or 0))
            score = float(best.get("score") or 0)
            matched_role = _clean_string(best.get("role"))
            return {
                "score": round(score, 2),
                "requestedRole": requested_role,
                "matchedRole": matched_role,
                "roleGroup": "Technical Freelancer",
                "compatibleRoles": [matched_role] if matched_role else [],
                "roleScoresConsidered": [
                    {"role": matched_role, "score": round(score, 2)}
                ] if matched_role else [],
            }
        score = float(candidate.get("bestRoleScore") or 0)
        return {
            "score": round(score, 2),
            "requestedRole": requested_role,
            "matchedRole": candidate.get("bestRole"),
            "roleGroup": "Technical Freelancer",
            "compatibleRoles": [candidate.get("bestRole")] if candidate.get("bestRole") else [],
            "roleScoresConsidered": [],
        }

    compatible_roles, role_group, requested = _compatible_roles_for_request(requested_role)
    ranking_by_role = {
        _normalise_text(str(ranking.get("role", ""))): ranking
        for ranking in rankings
    }
    considered: list[dict[str, Any]] = []
    for role in compatible_roles:
        ranking = ranking_by_role.get(_normalise_text(role))
        if not ranking:
            considered.append({"role": role, "score": 0.0})
            continue
        considered.append({"role": role, "score": round(float(ranking.get("score") or 0), 2)})

    if considered:
        best = max(considered, key=lambda item: item["score"])
        return {
            "score": best["score"],
            "requestedRole": requested,
            "matchedRole": best["role"],
            "roleGroup": role_group,
            "compatibleRoles": compatible_roles,
            "roleScoresConsidered": sorted(considered, key=lambda item: item["score"], reverse=True)[:10],
        }

    resolved_role = _resolve_requested_role(requested_role)
    target = _normalise_text(resolved_role)
    for ranking in rankings:
        if _normalise_text(str(ranking.get("role", ""))) == target:
            score = float(ranking.get("score") or 0)
            return {
                "score": round(score, 2),
                "requestedRole": requested_role,
                "matchedRole": str(ranking.get("role", "")),
                "roleGroup": role_group,
                "compatibleRoles": [resolved_role],
                "roleScoresConsidered": [{"role": str(ranking.get("role", "")), "score": round(score, 2)}],
            }

    best_role = _clean_string(candidate.get("bestRole"))
    if best_role and _normalise_text(best_role) == target:
        score = float(candidate.get("bestRoleScore") or 0)
        return {
            "score": round(score, 2),
            "requestedRole": requested_role,
            "matchedRole": best_role,
            "roleGroup": role_group,
            "compatibleRoles": [resolved_role],
            "roleScoresConsidered": [{"role": best_role, "score": round(score, 2)}],
        }

    requested_words = set(re.findall(r"[a-z0-9]+", requested_role.lower()))
    resolved_words = set(re.findall(r"[a-z0-9]+", resolved_role.lower()))
    best_partial = 0.0
    best_partial_role: str | None = None
    for ranking in rankings:
        ranking_role = _clean_string(ranking.get("role")) or ""
        ranking_words = set(re.findall(r"[a-z0-9]+", ranking_role.lower()))
        overlap = len((requested_words | resolved_words) & ranking_words)
        if overlap == 0:
            continue
        multiplier = min(0.9, 0.5 + (overlap * 0.15))
        partial_score = float(ranking.get("score") or 0) * multiplier
        if partial_score > best_partial:
            best_partial = partial_score
            best_partial_role = ranking_role

    if best_partial > 0:
        return {
            "score": round(best_partial, 2),
            "requestedRole": requested_role,
            "matchedRole": best_partial_role,
            "roleGroup": role_group,
            "compatibleRoles": [resolved_role],
            "roleScoresConsidered": [{"role": best_partial_role, "score": round(best_partial, 2)}],
        }

    return {
        "score": 0.0,
        "requestedRole": requested_role,
        "matchedRole": None,
        "roleGroup": role_group,
        "compatibleRoles": compatible_roles or ([resolved_role] if resolved_role else []),
        "roleScoresConsidered": considered,
    }


def _role_score_for_candidate(candidate: dict[str, Any], requested_role: str) -> float:
    return float(_role_score_details_for_candidate(candidate, requested_role)["score"])


def _keyword_matches_domain(keyword: str, domain_terms: dict[str, str]) -> bool:
    keyword_terms = _knowledge_terms(keyword)
    if keyword_terms & set(domain_terms):
        return True

    compact_keywords = {_compact_knowledge_text(term) for term in keyword_terms}
    for keyword_key in compact_keywords:
        if len(keyword_key) < 4:
            continue
        for domain_key in domain_terms:
            compact_domain = _compact_knowledge_text(domain_key)
            if len(compact_domain) < 4:
                continue
            if keyword_key in compact_domain or compact_domain in keyword_key:
                return True
    return False


def _knowledge_score_for_member(member: dict[str, Any], keywords: list[str]) -> float:
    skills = _knowledge_term_map((member.get("skills") or []) + (member.get("matchedSkills") or []))
    domains = _knowledge_term_map(member.get("domainKnowledge"))
    score = 0.0

    for keyword in keywords:
        if _keyword_matches_skill(keyword, skills):
            score += 1.0
        elif _keyword_matches_domain(keyword, domains):
            score += 0.5
    return score


def _knowledge_match_details(member: dict[str, Any], keywords: list[str]) -> dict[str, Any]:
    """Same scoring behavior as f87245 recommendar.py, with UI/debug evidence."""
    skills = _knowledge_term_map((member.get("skills") or []) + (member.get("matchedSkills") or []))
    domains = _knowledge_term_map(member.get("domainKnowledge"))
    cleaned_keywords = _clean_string_list(keywords)
    matched_skills: list[str] = []
    matched_domains: list[str] = []
    score = 0.0

    for keyword in cleaned_keywords:
        if _keyword_matches_skill(keyword, skills):
            score += 1.0
            matched_skills.append(keyword)
            continue

        if _keyword_matches_domain(keyword, domains):
            score += 0.5
            matched_domains.append(keyword)

    return {
        "score": round(score, 2),
        "keywords": cleaned_keywords,
        "matchedSkillKeywords": matched_skills,
        "matchedDomainKeywords": matched_domains,
    }


def _pairwise_synergy_score(members: list[dict[str, Any]]) -> int:
    skill_sets = [
        _normalise_skill_set(member.get("skills")) | _normalise_skill_set(member.get("matchedSkills"))
        for member in members
    ]
    total = 0
    for left_index, left_skills in enumerate(skill_sets):
        for right_skills in skill_sets[left_index + 1 :]:
            total += len(left_skills & right_skills)
    return total


def _team_key_for_roles(member_ids: tuple[str, ...], requested_roles: list[str]) -> tuple[tuple[str, tuple[str, ...]], ...]:
    role_to_members: dict[str, list[str]] = {}
    for index, member_id in enumerate(member_ids):
        role_to_members.setdefault(_normalise_text(requested_roles[index]), []).append(member_id)
    return tuple(
        (role, tuple(sorted(ids)))
        for role, ids in sorted(role_to_members.items())
    )


# -----------------------------------------------------------------------------
# Role Taxonomy, Aliases, And Project Role Derivation
# -----------------------------------------------------------------------------

ROLE_GROUPS: dict[str, list[str]] = {
    "Frontend Developer": [
        "React Frontend Developer",
        "Vue Frontend Developer",
        "Angular Frontend Developer",
        "MERN Stack Developer",
        "Python Full-Stack Developer",
        "UI/UX Designer",
    ],
    "Backend Developer": [
        "Django Backend Engineer",
        "FastAPI Backend Engineer",
        "Node.js Backend Engineer",
        "Spring Boot Backend Engineer",
        "Go Backend Engineer",
        "MERN Stack Developer",
        "Python Full-Stack Developer",
    ],
    "Full-Stack Developer": [
        "MERN Stack Developer",
        "Python Full-Stack Developer",
        "React Frontend Developer",
        "Node.js Backend Engineer",
        "Django Backend Engineer",
        "FastAPI Backend Engineer",
    ],
    "AI Engineer": [
        "Data Scientist",
        "Computer Vision Engineer",
        "NLP Engineer",
        "MLOps Engineer",
        "Generative AI Engineer (Text/LLM)",
        "Generative AI Engineer (Vision)",
        "Generative AI Engineer (Audio/Speech)",
        "AI Agent Engineer",
        "Multi-Agent Systems Engineer",
        "AI/ML Researcher",
        "Computer Vision Researcher",
        "NLP Researcher",
    ],
    "Data Engineer": ["Data Engineer", "Data Scientist", "MLOps Engineer"],
    "Mobile Developer": ["iOS Developer", "Android Developer", "React Native Developer", "Flutter Developer"],
    "DevOps Engineer": ["DevOps Engineer", "Cloud Architect (AWS)", "MLOps Engineer"],
    "Security Engineer": ["Cybersecurity Engineer", "DevOps Engineer", "Cloud Architect (AWS)"],
    "Product Designer": ["UI/UX Designer"],
}


ROLE_ALIASES: dict[str, str] = {
    "frontend engineer": "Frontend Developer",
    "frontend developer": "Frontend Developer",
    "front end developer": "Frontend Developer",
    "backend engineer": "Backend Developer",
    "backend developer": "Backend Developer",
    "back end developer": "Backend Developer",
    "full stack developer": "Full-Stack Developer",
    "fullstack developer": "Full-Stack Developer",
    "machine learning engineer": "AI Engineer",
    "ml engineer": "AI Engineer",
    "artificial intelligence engineer": "AI Engineer",
    "ai developer": "AI Engineer",
    "data scientist": "AI Engineer",
    "cloud engineer": "DevOps Engineer",
    "security engineer": "Security Engineer",
    "product designer": "Product Designer",
    "ux designer": "Product Designer",
    "ui designer": "Product Designer",
}


def _available_roles(role_names: list[str]) -> list[str]:
    return [role for role in role_names if role in TECH_ROLES]


def _role_group_name(role: str) -> str | None:
    normalized = _normalise_text(role)
    for alias, group in ROLE_ALIASES.items():
        if _normalise_text(alias) == normalized:
            return group
    for group_name, roles in ROLE_GROUPS.items():
        if _normalise_text(group_name) == normalized:
            return group_name
        if any(_normalise_text(item) == normalized for item in roles):
            return group_name
    return None


def _compatible_roles_for_request(role: str) -> tuple[list[str], str | None, str]:
    requested = _clean_string(role) or "Technical Freelancer"
    if _normalise_text(requested) == "technical freelancer":
        return [], None, requested

    group_name = _role_group_name(requested)
    if group_name:
        roles = _available_roles(ROLE_GROUPS.get(group_name, []))
        if roles:
            return roles, group_name, requested

    for known_role in TECH_ROLES:
        if _normalise_text(known_role) == _normalise_text(requested):
            return [known_role], None, requested

    resolved_role = _resolve_requested_role(requested)
    group_name = _role_group_name(resolved_role)
    if group_name:
        roles = _available_roles(ROLE_GROUPS.get(group_name, []))
        if roles:
            return roles, group_name, requested
    if resolved_role in TECH_ROLES:
        return [resolved_role], None, requested

    return [], None, requested


ROLE_KEYWORDS = [
    {
        "role": "Frontend Developer",
        "keywords": [
            "react",
            "next.js",
            "nextjs",
            "vue",
            "angular",
            "javascript",
            "typescript",
            "html",
            "css",
            "tailwind",
            "frontend",
            "ui",
        ],
    },
    {
        "role": "Backend Developer",
        "keywords": [
            "node",
            "express",
            "django",
            "flask",
            "fastapi",
            "spring",
            "api",
            "backend",
            "server",
            "postgres",
            "mongodb",
            "sql",
        ],
    },
    {
        "role": "AI Engineer",
        "keywords": [
            "ai",
            "machine learning",
            "deep learning",
            "nlp",
            "computer vision",
            "tensorflow",
            "pytorch",
            "scikit-learn",
            "gemini",
            "llm",
        ],
    },
    {
        "role": "Data Engineer",
        "keywords": [
            "data",
            "etl",
            "pipeline",
            "spark",
            "pandas",
            "numpy",
            "warehouse",
            "analytics",
            "dashboard",
        ],
    },
    {
        "role": "Mobile Developer",
        "keywords": ["mobile", "flutter", "react native", "ios", "android", "swift", "kotlin"],
    },
    {
        "role": "DevOps Engineer",
        "keywords": ["docker", "kubernetes", "aws", "azure", "gcp", "ci/cd", "devops", "deployment"],
    },
    {
        "role": "UI/UX Designer",
        "keywords": ["ux", "ui", "figma", "wireframe", "prototype", "design", "user experience"],
    },
    {
        "role": "QA Engineer",
        "keywords": ["qa", "test", "testing", "automation", "quality", "cypress", "playwright", "selenium"],
    },
]


def _derive_project_roles(
    title: str | None, description: str | None, skills: list[str], required_roles: list[str] | None = None
) -> tuple[list[dict[str, Any]], int]:
    """Derive project roles from existing app fields instead of proposal PDFs."""
    skill_text = " ".join(skills).lower()
    corpus = f"{title or ''} {description or ''} {skill_text}".lower()
    derived_roles: list[dict[str, Any]] = []

    for role in _clean_string_list(required_roles or []):
        compatible_roles, group_name, _ = _compatible_roles_for_request(role)
        derived_roles.append(
            {
                "name": group_name or (compatible_roles[0] if compatible_roles else role),
                "count": 1,
                "matchedKeywords": [role],
            }
        )

    for role_definition in ROLE_KEYWORDS:
        matched_keywords = [
            keyword
            for keyword in role_definition["keywords"]
            if re.search(rf"(?<![a-z0-9]){re.escape(keyword.lower())}(?![a-z0-9])", corpus)
        ]
        if not matched_keywords:
            continue

        if any(_normalise_text(role["name"]) == _normalise_text(role_definition["role"]) for role in derived_roles):
            continue

        count = 2 if len(matched_keywords) >= 5 else 1
        derived_roles.append(
            {
                "name": role_definition["role"],
                "count": count,
                "matchedKeywords": matched_keywords,
            }
        )

    if not derived_roles and skills:
        derived_roles.append(
            {
                "name": "Technical Freelancer",
                "count": max(1, min(3, round(len(skills) / 4) or 1)),
                "matchedKeywords": skills[:6],
            }
        )

    team_size = sum(role["count"] for role in derived_roles) or 1
    return derived_roles, team_size


def _shared_entity_names(member: dict[str, Any]) -> set[str]:
    return set(member.get("affinityEntities") or [])


# -----------------------------------------------------------------------------
# Neo4j Knowledge Graph Sync And Recommendation Service
# -----------------------------------------------------------------------------

class KnowledgeGraphService:
    def __init__(self) -> None:
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self) -> None:
        self.driver.close()

    def check_connection(self) -> dict[str, Any]:
        with self.driver.session() as session:
            result = session.run("RETURN 1 AS ok").single()
        return {"connected": result is not None and result["ok"] == 1}

    def ensure_constraints(self) -> None:
        queries = [
            "CREATE CONSTRAINT freelancer_user_id IF NOT EXISTS FOR (f:Freelancer) REQUIRE f.userId IS UNIQUE",
            "CREATE CONSTRAINT client_user_id IF NOT EXISTS FOR (c:Client) REQUIRE c.userId IS UNIQUE",
            "CREATE CONSTRAINT client_project_id IF NOT EXISTS FOR (p:ClientProject) REQUIRE p.projectId IS UNIQUE",
            "CREATE CONSTRAINT project_project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.projectId IS UNIQUE",
            "CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE",
            "CREATE CONSTRAINT domain_name IF NOT EXISTS FOR (d:Domain) REQUIRE d.name IS UNIQUE",
            "CREATE CONSTRAINT role_name IF NOT EXISTS FOR (r:Role) REQUIRE r.name IS UNIQUE",
        ]
        with self.driver.session() as session:
            for query in queries:
                session.run(query).consume()

    # Public sync entrypoints called by the Next.js API layer.

    def ingest_freelancer(self, payload: FreelancerIngestRequest) -> dict[str, Any]:
        profile = payload.profile or {}
        cv_analysis = profile.get("cvAnalysis") or {}

        app_skills = _clean_string_list(profile.get("skills"))
        cv_skills = _clean_string_list(_cv_value(cv_analysis, "allSkills", "all_skills"))
        skills = _clean_string_list(app_skills + cv_skills)
        role_rankings = _normalise_role_rankings(
            _cv_value(cv_analysis, "roleRankings", "role_rankings")
        )
        best_role = _clean_string(_cv_value(cv_analysis, "bestRole", "best_role"))
        best_score = _cv_value(cv_analysis, "bestScore", "best_score")
        if not best_role and role_rankings:
            best_role = role_rankings[0]["role"]
            best_score = role_rankings[0]["score"]

        data = {
            "user_id": payload.userId,
            "email": _clean_string(payload.email) or _clean_string(_cv_value(cv_analysis, "email", "email")),
            "name": _clean_string(payload.name) or _clean_string(_cv_value(cv_analysis, "name", "name")),
            "headline": _clean_string(profile.get("headline")),
            "country": _clean_string(profile.get("country")),
            "experience_level": _clean_string(profile.get("experienceLevel")),
            "years_of_experience": _clean_string(
                _cv_value(cv_analysis, "yearsOfExperience", "years_of_experience")
            ),
            "about": _clean_string(profile.get("about")),
            "hourly_rate": profile.get("hourlyRate"),
            "availability": _clean_string(profile.get("availability")),
            "skills": skills,
            "domain_knowledge": _clean_string_list(
                _cv_value(cv_analysis, "domainKnowledge", "domain_knowledge")
            ),
            "experience": cv_analysis.get("experience") or [],
            "education": cv_analysis.get("education") or [],
            "projects": cv_analysis.get("projects") or [],
            "best_role": best_role,
            "best_score": best_score,
            "role_rankings": role_rankings,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }
        self.ensure_constraints()
        with self.driver.session() as session:
            session.execute_write(self._write_freelancer, data)

        return {
            "status": "synced",
            "entityType": "freelancer",
            "entityId": payload.userId,
            "skillsCount": len(data["skills"]),
            "domainsCount": len(data["domain_knowledge"]),
            "roleRankingsCount": len(data["role_rankings"]),
            "experienceCount": len(data["experience"]),
            "educationCount": len(data["education"]),
            "projectsCount": len(data["projects"]),
        }

    def ingest_project(self, payload: ProjectIngestRequest) -> dict[str, Any]:
        skills = _clean_string_list(payload.skills)
        domain_keywords = _clean_string_list(payload.domainKeywords)
        required_roles = _clean_string_list(payload.requiredRoles)
        data = {
            "project_id": payload.projectId,
            "client_id": payload.clientId,
            "title": _clean_string(payload.title),
            "description": _clean_string(payload.description),
            "budget": payload.budget,
            "skills": skills,
            "domain_keywords": domain_keywords,
            "required_roles": required_roles,
            "status": _clean_string(payload.status),
            "timeline": _clean_string(payload.timeline),
            "created_at": _clean_string(payload.createdAt),
            "updated_at": _clean_string(payload.updatedAt),
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

        derived_roles, team_size = _derive_project_roles(
            data["title"], data["description"], skills, required_roles
        )
        data["derived_roles"] = derived_roles
        data["team_size"] = team_size

        self.ensure_constraints()
        with self.driver.session() as session:
            session.execute_write(self._write_project, data)

        return {
            "status": "synced",
            "entityType": "project",
            "entityId": payload.projectId,
            "skillsCount": len(skills),
            "domainsCount": len(domain_keywords),
            "roles": derived_roles,
            "teamSize": team_size,
        }

    # Public recommendation entrypoints used by client/freelancer dashboards.

    def recommend_jobs(self, payload: FreelancerJobRecommendationRequest) -> dict[str, Any]:
        with self.driver.session() as session:
            records = session.execute_read(
                self._read_job_recommendations,
                payload.userId,
                payload.excludeProjectIds,
                max(1, min(payload.limit, 50)),
            )

        return {
            "status": "ok",
            "recommendations": records,
        }

    def recommend_freelancers(
        self, payload: ProjectFreelancerRecommendationRequest
    ) -> dict[str, Any]:
        with self.driver.session() as session:
            records = session.execute_read(
                self._read_freelancer_recommendations,
                payload.projectId,
                payload.excludeUserIds,
                max(1, min(payload.limit, 50)),
            )

        return {
            "status": "ok",
            "recommendations": records,
        }

    def recommend_teams(self, payload: ProjectTeamRecommendationRequest) -> dict[str, Any]:
        with self.driver.session() as session:
            graph_data = session.execute_read(
                self._read_team_candidates,
                payload.projectId,
                payload.excludeUserIds,
            )

        required_skills = graph_data["requiredSkills"]
        candidates = graph_data["candidates"]
        max_team_size = max(1, min(payload.maxTeamSize, 8))
        limit = max(1, min(payload.limit, 10))
        teams = self._build_role_knowledge_teams(
            required_skills,
            graph_data["requiredRoles"],
            graph_data["projectKeywords"],
            candidates,
            max_team_size,
            limit,
        )

        return {
            "status": "ok",
            "requiredSkills": required_skills,
            "requiredDomains": graph_data["requiredDomains"],
            "requiredRoles": graph_data["requiredRoles"],
            "recommendations": teams,
        }

    # Neo4j write transactions for rebuilding graph state from MongoDB records.

    @staticmethod
    def _write_freelancer(tx: Any, data: dict[str, Any]) -> None:
        tx.run(
            """
            MERGE (f:Freelancer {userId: $user_id})
            SET f.email = $email,
                f.name = $name,
                f.headline = $headline,
                f.country = $country,
                f.experienceLevel = $experience_level,
                f.yearsOfExperience = $years_of_experience,
                f.about = $about,
                f.hourlyRate = $hourly_rate,
                f.availability = $availability,
                f.syncedAt = $synced_at
            """,
            **data,
        ).consume()

        tx.run(
            """
            MATCH (f:Freelancer {userId: $user_id})
            OPTIONAL MATCH (f)-[r:HAS_SKILL|HAS_DOMAIN|WORKED_AT|STUDIED_AT|CREATED_CV_PROJECT|MATCHES_ROLE]->()
            DELETE r
            """,
            user_id=data["user_id"],
        ).consume()
        tx.run(
            """
            MATCH (f:Freelancer {userId: $user_id})
            OPTIONAL MATCH ()-[r:SKILL_OWNED_BY|DOMAIN_OF|EMPLOYED|ALUMNI_OF|DEVELOPED_BY|SUITABLE_CANDIDATE]->(f)
            DELETE r
            """,
            user_id=data["user_id"],
        ).consume()

        for skill in data["skills"]:
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (s:Skill {name: $skill})
                MERGE (f)-[:HAS_SKILL]->(s)
                MERGE (s)-[:SKILL_OWNED_BY]->(f)
                """,
                user_id=data["user_id"],
                skill=skill,
            ).consume()

        for domain in data["domain_knowledge"]:
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (d:Domain {name: $domain})
                MERGE (f)-[:HAS_DOMAIN]->(d)
                MERGE (d)-[:DOMAIN_OF]->(f)
                """,
                user_id=data["user_id"],
                domain=domain,
            ).consume()

        for exp in data["experience"]:
            company = _clean_string(exp.get("company")) if isinstance(exp, dict) else None
            if not company:
                continue
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (c:Company {name: $company})
                MERGE (f)-[worked:WORKED_AT]->(c)
                SET worked.role = $role,
                    worked.duration = $duration
                MERGE (c)-[employed:EMPLOYED]->(f)
                SET employed.asRole = $role,
                    employed.duration = $duration
                """,
                user_id=data["user_id"],
                company=company,
                role=_clean_string(exp.get("role")) if isinstance(exp, dict) else None,
                duration=_clean_string(exp.get("years")) if isinstance(exp, dict) else None,
            ).consume()

        for edu in data["education"]:
            institution = _clean_string(edu.get("institution")) if isinstance(edu, dict) else None
            if not institution:
                continue
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (i:Institution {name: $institution})
                MERGE (f)-[studied:STUDIED_AT]->(i)
                SET studied.degree = $degree
                MERGE (i)-[alumni:ALUMNI_OF]->(f)
                SET alumni.degree = $degree
                """,
                user_id=data["user_id"],
                institution=institution,
                degree=_clean_string(edu.get("degree")) if isinstance(edu, dict) else None,
            ).consume()

        for project in data["projects"]:
            project_name = _clean_string(project.get("name")) if isinstance(project, dict) else None
            if not project_name:
                continue
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (p:CvProject {name: $project_name})
                MERGE (f)-[:CREATED_CV_PROJECT]->(p)
                MERGE (p)-[:DEVELOPED_BY]->(f)
                """,
                user_id=data["user_id"],
                project_name=project_name,
            ).consume()
            for technology in _clean_string_list(project.get("technologies")):
                tx.run(
                    """
                    MATCH (p:CvProject {name: $project_name})
                    MERGE (s:Skill {name: $technology})
                    MERGE (p)-[:USED_TECH]->(s)
                    MERGE (s)-[:USED_IN]->(p)
                    """,
                    project_name=project_name,
                    technology=technology,
                ).consume()

        role_rankings = data["role_rankings"] or []
        if not role_rankings and data["best_role"]:
            role_rankings = [
                {
                    "role": data["best_role"],
                    "score": data["best_score"] or 0,
                    "matched_skills": [],
                    "missing_skills": [],
                }
            ]

        for ranking in role_rankings:
            if not ranking["role"] or ranking["score"] <= 0:
                continue
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (r:Role {name: $role})
                MERGE (f)-[matches:MATCHES_ROLE]->(r)
                SET matches.score = $score,
                    matches.matchedSkills = $matched_skills,
                    matches.missingSkills = $missing_skills
                MERGE (r)-[candidate:SUITABLE_CANDIDATE]->(f)
                SET candidate.score = $score,
                    candidate.matchedSkills = $matched_skills,
                    candidate.missingSkills = $missing_skills
                """,
                user_id=data["user_id"],
                role=ranking["role"],
                score=ranking["score"],
                matched_skills=ranking["matched_skills"],
                missing_skills=ranking["missing_skills"],
            ).consume()

    @staticmethod
    def _write_project(tx: Any, data: dict[str, Any]) -> None:
        tx.run(
            """
            MERGE (c:Client {userId: $client_id})
            MERGE (p:ClientProject {projectId: $project_id})
            SET p:Project,
                p.title = $title,
                p.name = $title,
                p.description = $description,
                p.summary = $description,
                p.budget = $budget,
                p.status = $status,
                p.timeline = $timeline,
                p.team_size = $team_size,
                p.createdAt = $created_at,
                p.updatedAt = $updated_at,
                p.clientId = $client_id,
                p.syncedAt = $synced_at
            MERGE (c)-[:POSTED]->(p)
            MERGE (c)-[:POSTED_PROJECT]->(p)
            """,
            **data,
        ).consume()

        tx.run(
            """
            MATCH (p:ClientProject {projectId: $project_id})
            OPTIONAL MATCH (p)-[r:REQUIRES_SKILL|REQUIRES_DOMAIN]->()
            DELETE r
            """,
            project_id=data["project_id"],
        ).consume()
        tx.run(
            """
            MATCH (p:ClientProject {projectId: $project_id})
            OPTIONAL MATCH ()-[r:REQUIRED_BY]->(p)
            DELETE r
            """,
            project_id=data["project_id"],
        ).consume()
        tx.run(
            """
            MATCH (p:ClientProject {projectId: $project_id})
            OPTIONAL MATCH (p)-[r:REQUIRES_ROLE]->()
            DELETE r
            """,
            project_id=data["project_id"],
        ).consume()

        for skill in data["skills"]:
            tx.run(
                """
                MATCH (p:ClientProject {projectId: $project_id})
                MERGE (s:Skill {name: $skill})
                MERGE (p)-[:REQUIRES_SKILL]->(s)
                MERGE (s)-[:REQUIRED_BY]->(p)
                """,
                project_id=data["project_id"],
                skill=skill,
            ).consume()

        for domain in data["domain_keywords"]:
            tx.run(
                """
                MATCH (p:ClientProject {projectId: $project_id})
                MERGE (d:Domain {name: $domain})
                MERGE (p)-[:REQUIRES_DOMAIN]->(d)
                """,
                project_id=data["project_id"],
                domain=domain,
            ).consume()

        for role in data["derived_roles"]:
            tx.run(
                """
                MATCH (p:ClientProject {projectId: $project_id})
                MERGE (r:Role {name: $role_name})
                MERGE (p)-[requires:REQUIRES_ROLE]->(r)
                SET requires.count = $count,
                    requires.matchedKeywords = $matched_keywords
                """,
                project_id=data["project_id"],
                role_name=role["name"],
                count=role["count"],
                matched_keywords=role["matchedKeywords"],
            ).consume()

    # Neo4j read transactions for individual recommendation candidates.

    @staticmethod
    def _read_job_recommendations(
        tx: Any, user_id: str, exclude_project_ids: list[str], limit: int
    ) -> list[dict[str, Any]]:
        result = tx.run(
            """
            MATCH (f:Freelancer {userId: $user_id})
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(skill:Skill)
            WITH f, collect(DISTINCT skill.name) AS freelancerSkills
            OPTIONAL MATCH (f)-[:HAS_DOMAIN]->(domain:Domain)
            WITH f, freelancerSkills, collect(DISTINCT domain.name) AS domainKnowledge
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            WITH f,
                 freelancerSkills,
                 domainKnowledge,
                 [ranking IN collect(DISTINCT CASE
                   WHEN role IS NULL THEN null
                   ELSE {role: role.name, score: roleMatch.score}
                 END) WHERE ranking IS NOT NULL] AS roleRankings
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND coalesce(p.status, 'open') = 'open'
              AND NOT p.projectId IN $exclude_project_ids
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH f, freelancerSkills, domainKnowledge, roleRankings, p, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (p)-[:REQUIRES_DOMAIN]->(requiredDomain:Domain)
            WITH f, freelancerSkills, domainKnowledge, roleRankings, p, requiredSkills, collect(DISTINCT requiredDomain.name) AS requiredDomains
            OPTIONAL MATCH (p)-[:REQUIRES_ROLE]->(requiredRole:Role)
            WITH f, freelancerSkills, domainKnowledge, roleRankings, p, requiredSkills, requiredDomains, collect(DISTINCT requiredRole.name) AS requiredRoles
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            WITH f,
                 freelancerSkills,
                 domainKnowledge,
                 roleRankings,
                 p,
                 requiredSkills,
                 requiredDomains,
                 requiredRoles,
                 [detail IN collect(DISTINCT {company: company.name, role: worked.role, duration: worked.duration}) WHERE detail.company IS NOT NULL] AS experienceDetails
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT]->(cvProject:CvProject)-[:USED_TECH]->(projectSkill:Skill)
            WITH f,
                 freelancerSkills,
                 domainKnowledge,
                 roleRankings,
                 p,
                 requiredSkills,
                 requiredDomains,
                 requiredRoles,
                 experienceDetails,
                 collect(DISTINCT projectSkill.name) AS cvProjectSkills,
                 [detail IN collect(DISTINCT {project: cvProject.name, technology: projectSkill.name}) WHERE detail.technology IS NOT NULL] AS projectEvidenceDetails
            RETURN p.projectId AS projectId,
                   p.title AS title,
                   p.description AS description,
                   freelancerSkills AS freelancerSkills,
                   domainKnowledge AS domainKnowledge,
                   roleRankings AS roleRankings,
                   requiredSkills AS requiredSkills,
                   requiredDomains AS requiredDomains,
                   [skill IN requiredSkills WHERE skill IN freelancerSkills] AS matchedSkills,
                   [skill IN requiredSkills WHERE NOT skill IN freelancerSkills] AS missingSkills,
                   requiredRoles AS requiredRoles,
                   [skill IN requiredSkills WHERE skill IN cvProjectSkills] AS projectEvidenceSkills,
                   projectEvidenceDetails AS projectEvidenceDetails,
                   experienceDetails AS experienceDetails
            """,
            user_id=user_id,
            exclude_project_ids=exclude_project_ids,
        )
        recommendations: list[dict[str, Any]] = []
        for record in result:
            item = dict(record)
            role_rankings = _normalise_role_rankings(item.get("roleRankings"))
            candidate = {
                "skills": item.get("freelancerSkills") or [],
                "matchedSkills": item.get("matchedSkills") or [],
                "domainKnowledge": item.get("domainKnowledge") or [],
                "roleRankings": role_rankings,
                "bestRole": role_rankings[0]["role"] if role_rankings else None,
                "bestRoleScore": role_rankings[0]["score"] if role_rankings else None,
            }
            required_roles = _clean_string_list(item.get("requiredRoles"))
            if required_roles:
                role_details = [_role_score_details_for_candidate(candidate, role) for role in required_roles]
                best_role_detail = max(role_details, key=lambda detail: detail["score"]) if role_details else None
            else:
                best_role_detail = _role_score_details_for_candidate(candidate, "Technical Freelancer")
                role_details = [best_role_detail]
            technical_score = float(best_role_detail["score"] if best_role_detail else 0.0)

            required_domains = _clean_string_list(item.get("requiredDomains") or [])
            keywords = _clean_string_list((item.get("requiredSkills") or []) + required_domains)
            knowledge_details = _knowledge_match_details(candidate, keywords)
            knowledge_score = knowledge_details["score"]
            final_score = round(technical_score + knowledge_score, 4)
            if final_score < INDIVIDUAL_RECOMMENDATION_MIN_SCORE:
                continue

            required_skills = item.get("requiredSkills") or []
            matched_skills = item.get("matchedSkills") or []
            project_evidence_skills = item.get("projectEvidenceSkills") or []
            skill_score = round((len(matched_skills) / len(required_skills)) * 100, 1) if required_skills else 100.0
            recommendations.append(
                {
                    "projectId": item.get("projectId"),
                    "score": final_score,
                    "technicalScore": round(technical_score, 2),
                    "knowledgeScore": round(knowledge_score, 2),
                    "matchedSkills": matched_skills,
                    "missingSkills": item.get("missingSkills") or [],
                    "requiredSkills": required_skills,
                    "requiredDomains": required_domains,
                    "bestRole": candidate["bestRole"],
                    "bestRoleScore": candidate["bestRoleScore"],
                    "scoreBreakdown": {
                        "technicalScore": round(technical_score, 2),
                        "roleScore": round(technical_score, 2),
                        "knowledgeScore": round(knowledge_score, 2),
                        "skillScore": skill_score,
                    },
                    "roleMatch": best_role_detail,
                    "roleMatches": role_details,
                    "evidence": {
                        "requiredRoles": required_roles,
                        "requiredDomains": required_domains,
                        "matchedRole": [best_role_detail.get("matchedRole")] if best_role_detail and best_role_detail.get("matchedRole") else [],
                        "roleGroup": [best_role_detail.get("roleGroup")] if best_role_detail and best_role_detail.get("roleGroup") else [],
                        "projectEvidenceSkills": project_evidence_skills,
                        "domainKnowledge": candidate["domainKnowledge"],
                        "knowledgeKeywords": knowledge_details["keywords"],
                        "matchedKnowledgeSkills": knowledge_details["matchedSkillKeywords"],
                        "matchedKnowledgeDomains": knowledge_details["matchedDomainKeywords"],
                    },
                    "projectEvidenceDetails": item.get("projectEvidenceDetails") or [],
                    "experienceDetails": item.get("experienceDetails") or [],
                    "relevantExperienceDetails": [],
                    "reason": (
                        f"Tech role score {round(technical_score, 2)} + knowledge "
                        f"{round(knowledge_score, 2)} = final score {final_score}."
                    ),
                }
            )

        recommendations.sort(key=lambda item: (item["score"], item["technicalScore"], item["knowledgeScore"]), reverse=True)
        return recommendations[:limit]

    @staticmethod
    def _read_freelancer_recommendations(
        tx: Any, project_id: str, exclude_user_ids: list[str], limit: int
    ) -> list[dict[str, Any]]:
        result = tx.run(
            """
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND p.projectId = $project_id
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH p, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (p)-[:REQUIRES_DOMAIN]->(requiredDomain:Domain)
            WITH p, requiredSkills, collect(DISTINCT requiredDomain.name) AS requiredDomains
            OPTIONAL MATCH (p)-[:REQUIRES_ROLE]->(requiredRole:Role)
            WITH p, requiredSkills, requiredDomains, collect(DISTINCT requiredRole.name) AS requiredRoles
            MATCH (f:Freelancer)
            WHERE NOT f.userId IN $exclude_user_ids
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(skill:Skill)
            WITH p, requiredSkills, requiredDomains, requiredRoles, f, collect(DISTINCT skill.name) AS freelancerSkills
            OPTIONAL MATCH (f)-[:HAS_DOMAIN]->(domain:Domain)
            WITH p, requiredSkills, requiredDomains, requiredRoles, f, freelancerSkills, collect(DISTINCT domain.name) AS domainKnowledge
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            WITH p,
                 requiredSkills,
                 requiredDomains,
                 requiredRoles,
                 f,
                 freelancerSkills,
                 domainKnowledge,
                 [ranking IN collect(DISTINCT CASE
                   WHEN role IS NULL THEN null
                   ELSE {role: role.name, score: roleMatch.score}
                 END) WHERE ranking IS NOT NULL] AS roleRankings
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            WITH p,
                 requiredSkills,
                 requiredDomains,
                 requiredRoles,
                 f,
                 freelancerSkills,
                 domainKnowledge,
                 roleRankings,
                 [detail IN collect(DISTINCT {company: company.name, role: worked.role, duration: worked.duration}) WHERE detail.company IS NOT NULL] AS experienceDetails
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT]->(cvProject:CvProject)-[:USED_TECH]->(projectSkill:Skill)
            WITH p,
                 requiredSkills,
                 requiredDomains,
                 requiredRoles,
                 f,
                 freelancerSkills,
                 domainKnowledge,
                 roleRankings,
                 experienceDetails,
                 collect(DISTINCT projectSkill.name) AS cvProjectSkills,
                 [detail IN collect(DISTINCT {project: cvProject.name, technology: projectSkill.name}) WHERE detail.technology IS NOT NULL] AS projectEvidenceDetails
            RETURN f.userId AS userId,
                   p.title AS title,
                   p.description AS description,
                   freelancerSkills AS freelancerSkills,
                   domainKnowledge AS domainKnowledge,
                   roleRankings AS roleRankings,
                   requiredSkills AS requiredSkills,
                   requiredDomains AS requiredDomains,
                   [skill IN requiredSkills WHERE skill IN freelancerSkills] AS matchedSkills,
                   [skill IN requiredSkills WHERE NOT skill IN freelancerSkills] AS missingSkills,
                   requiredRoles AS requiredRoles,
                   [skill IN requiredSkills WHERE skill IN cvProjectSkills] AS projectEvidenceSkills,
                   projectEvidenceDetails AS projectEvidenceDetails,
                   experienceDetails AS experienceDetails
            """,
            project_id=project_id,
            exclude_user_ids=exclude_user_ids,
        )
        recommendations: list[dict[str, Any]] = []
        for record in result:
            item = dict(record)
            role_rankings = _normalise_role_rankings(item.get("roleRankings"))
            candidate = {
                "skills": item.get("freelancerSkills") or [],
                "matchedSkills": item.get("matchedSkills") or [],
                "domainKnowledge": item.get("domainKnowledge") or [],
                "roleRankings": role_rankings,
                "bestRole": role_rankings[0]["role"] if role_rankings else None,
                "bestRoleScore": role_rankings[0]["score"] if role_rankings else None,
            }
            required_roles = _clean_string_list(item.get("requiredRoles"))
            if required_roles:
                role_details = [_role_score_details_for_candidate(candidate, role) for role in required_roles]
                best_role_detail = max(role_details, key=lambda detail: detail["score"]) if role_details else None
            else:
                best_role_detail = _role_score_details_for_candidate(candidate, "Technical Freelancer")
                role_details = [best_role_detail]
            technical_score = float(best_role_detail["score"] if best_role_detail else 0.0)

            required_domains = _clean_string_list(item.get("requiredDomains") or [])
            keywords = _clean_string_list((item.get("requiredSkills") or []) + required_domains)
            knowledge_details = _knowledge_match_details(candidate, keywords)
            knowledge_score = knowledge_details["score"]
            final_score = round(technical_score + knowledge_score, 4)
            if final_score < INDIVIDUAL_RECOMMENDATION_MIN_SCORE:
                continue

            required_skills = item.get("requiredSkills") or []
            matched_skills = item.get("matchedSkills") or []
            project_evidence_skills = item.get("projectEvidenceSkills") or []
            skill_score = round((len(matched_skills) / len(required_skills)) * 100, 1) if required_skills else 100.0
            recommendations.append(
                {
                    "userId": item.get("userId"),
                    "score": final_score,
                    "technicalScore": round(technical_score, 2),
                    "knowledgeScore": round(knowledge_score, 2),
                    "matchedSkills": matched_skills,
                    "missingSkills": item.get("missingSkills") or [],
                    "requiredSkills": required_skills,
                    "requiredDomains": required_domains,
                    "bestRole": candidate["bestRole"],
                    "bestRoleScore": candidate["bestRoleScore"],
                    "scoreBreakdown": {
                        "technicalScore": round(technical_score, 2),
                        "roleScore": round(technical_score, 2),
                        "knowledgeScore": round(knowledge_score, 2),
                        "skillScore": skill_score,
                    },
                    "roleMatch": best_role_detail,
                    "roleMatches": role_details,
                    "evidence": {
                        "requiredRoles": required_roles,
                        "requiredDomains": required_domains,
                        "matchedRole": [best_role_detail.get("matchedRole")] if best_role_detail and best_role_detail.get("matchedRole") else [],
                        "roleGroup": [best_role_detail.get("roleGroup")] if best_role_detail and best_role_detail.get("roleGroup") else [],
                        "projectEvidenceSkills": project_evidence_skills,
                        "domainKnowledge": candidate["domainKnowledge"],
                        "knowledgeKeywords": knowledge_details["keywords"],
                        "matchedKnowledgeSkills": knowledge_details["matchedSkillKeywords"],
                        "matchedKnowledgeDomains": knowledge_details["matchedDomainKeywords"],
                    },
                    "projectEvidenceDetails": item.get("projectEvidenceDetails") or [],
                    "experienceDetails": item.get("experienceDetails") or [],
                    "relevantExperienceDetails": [],
                    "reason": (
                        f"Tech role score {round(technical_score, 2)} + knowledge "
                        f"{round(knowledge_score, 2)} = final score {final_score}."
                    ),
                }
            )

        recommendations.sort(key=lambda item: (item["score"], item["technicalScore"], item["knowledgeScore"]), reverse=True)
        return recommendations[:limit]

    # Neo4j read transactions for team recommendation candidates.

    @staticmethod
    def _read_team_candidates(
        tx: Any, project_id: str, exclude_user_ids: list[str]
    ) -> dict[str, Any]:
        project_result = tx.run(
            """
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND p.projectId = $project_id
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH p, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (p)-[:REQUIRES_DOMAIN]->(requiredDomain:Domain)
            WITH p, requiredSkills, collect(DISTINCT requiredDomain.name) AS requiredDomains
            OPTIONAL MATCH (p)-[roleRequirement:REQUIRES_ROLE]->(role:Role)
            WITH p,
                 requiredSkills,
                 requiredDomains,
                 collect(DISTINCT CASE
                   WHEN role IS NULL THEN null
                   ELSE {name: role.name, count: roleRequirement.count}
                 END) AS requiredRoles
            RETURN p.title AS title,
                   p.description AS description,
                   requiredSkills,
                   requiredDomains,
                   [role IN requiredRoles WHERE role IS NOT NULL] AS requiredRoles
            """,
            project_id=project_id,
        ).single()
        required_skills = project_result["requiredSkills"] if project_result else []
        required_domains = project_result["requiredDomains"] if project_result else []
        required_roles = project_result["requiredRoles"] if project_result else []
        project_keywords = _clean_string_list(required_skills + required_domains)

        candidates_result = tx.run(
            """
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND p.projectId = $project_id
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH p, collect(DISTINCT required.name) AS requiredSkills
            MATCH (f:Freelancer)
            WHERE NOT f.userId IN $exclude_user_ids
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(skill:Skill)
            WITH f, requiredSkills, collect(DISTINCT skill.name) AS allSkills
            OPTIONAL MATCH (f)-[:HAS_DOMAIN]->(domain:Domain)
            WITH f,
                 requiredSkills,
                 allSkills,
                 collect(DISTINCT domain.name) AS domainKnowledge
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            WITH f,
                 requiredSkills,
                 allSkills,
                 domainKnowledge,
                 collect(DISTINCT CASE
                   WHEN role IS NULL THEN null
                   ELSE {role: role.name, score: roleMatch.score}
                 END) AS roleRankings
            OPTIONAL MATCH (f)-[]-(shared)
            WITH f, requiredSkills, allSkills, domainKnowledge, roleRankings, shared
            WHERE shared IS NULL
               OR shared:Skill
               OR shared:Domain
               OR shared:Institution
               OR shared:Company
               OR shared:CvProject
               OR shared:Project
               OR shared:Role
            WITH f,
                 requiredSkills,
                 allSkills,
                 domainKnowledge,
                 roleRankings,
                  collect(DISTINCT CASE
                    WHEN shared IS NULL THEN null
                    ELSE labels(shared)[0] + ':' + coalesce(shared.name, shared.title, shared.projectId, shared.userId)
                  END) AS affinityEntities
            RETURN f.userId AS userId,
                   allSkills AS skills,
                   [skill IN allSkills WHERE skill IN requiredSkills] AS matchedSkills,
                   domainKnowledge AS domainKnowledge,
                   [ranking IN roleRankings WHERE ranking IS NOT NULL] AS roleRankings,
                   [entity IN affinityEntities WHERE entity IS NOT NULL] AS affinityEntities
            ORDER BY size([skill IN allSkills WHERE skill IN requiredSkills]) DESC, f.syncedAt DESC
            """,
            project_id=project_id,
            exclude_user_ids=exclude_user_ids,
        )

        return {
            "requiredSkills": required_skills,
            "requiredDomains": required_domains,
            "requiredRoles": required_roles,
            "projectKeywords": project_keywords,
            "candidates": [dict(record) for record in candidates_result],
        }

    # In-memory team assembly and final team scoring.

    @staticmethod
    def _build_role_knowledge_teams(
        required_skills: list[str],
        required_roles: list[dict[str, Any]],
        project_keywords: list[str],
        candidates: list[dict[str, Any]],
        max_team_size: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        if not candidates:
            return []

        requested_roles: list[str] = []
        for role in required_roles:
            count = int(role.get("count") or 1)
            requested_roles.extend([role.get("name") or "Technical Freelancer"] * max(1, count))

        if not requested_roles:
            requested_roles = ["Technical Freelancer"] * min(max_team_size, len(candidates))

        requested_roles = requested_roles[: max(1, min(max_team_size, 5, len(candidates)))]
        required_set = set(required_skills)
        keywords = _clean_string_list(project_keywords or required_skills)

        for candidate in candidates:
            rankings = candidate.get("roleRankings") or []
            rankings.sort(key=lambda item: item.get("score") or 0, reverse=True)
            candidate["bestRole"] = rankings[0]["role"] if rankings else None
            candidate["bestRoleScore"] = rankings[0]["score"] if rankings else None

        seed_pool = sorted(
            candidates,
            key=lambda candidate: (
                len(set(candidate.get("matchedSkills", []))),
                _knowledge_score_for_member(candidate, keywords),
                candidate.get("bestRoleScore") or 0,
            ),
            reverse=True,
        )[:20]

        best_team_by_members: dict[tuple[str, ...], dict[str, Any]] = {}

        for member_perm in permutations(seed_pool, len(requested_roles)):
            member_ids = tuple(member["userId"] for member in member_perm)
            if len(set(member_ids)) != len(member_ids):
                continue

            team_key = tuple(sorted(member_ids))

            covered = set().union(
                *(set(member.get("matchedSkills", [])) & required_set for member in member_perm)
            ) if required_set else set()
            missing = [skill for skill in required_skills if skill not in covered]
            coverage_score = round((len(covered) / len(required_set)) * 100, 1) if required_set else 100.0
            role_details = [
                _role_score_details_for_candidate(member, requested_roles[index])
                for index, member in enumerate(member_perm)
            ]
            role_scores = [float(detail["score"]) for detail in role_details]
            technical_score = round(sum(role_scores), 2)
            knowledge_details = [_knowledge_match_details(member, keywords) for member in member_perm]
            knowledge_score = round(sum(detail["score"] for detail in knowledge_details), 2)
            skill_synergy_score = _pairwise_synergy_score(list(member_perm))

            shared_synergy_entities: set[str] = set()
            for index, member in enumerate(member_perm):
                member_entities = _shared_entity_names(member)
                for other in member_perm[index + 1 :]:
                    shared_synergy_entities.update(member_entities & _shared_entity_names(other))

            synergy_score = skill_synergy_score + len(shared_synergy_entities)
            final_score = round(technical_score + (synergy_score * 0.1) + knowledge_score, 4)
            team = {
                "score": final_score,
                "finalScore": final_score,
                "technicalScore": technical_score,
                "knowledgeScore": knowledge_score,
                "synergyScore": synergy_score,
                "coverageScore": coverage_score,
                "coveredSkills": [skill for skill in required_skills if skill in covered],
                "missingSkills": missing,
                "sharedEntities": sorted(shared_synergy_entities),
                "knowledgeKeywords": keywords,
                "matchedKnowledgeSkills": sorted(
                    {skill for detail in knowledge_details for skill in detail["matchedSkillKeywords"]}
                ),
                "matchedKnowledgeDomains": sorted(
                    {domain for detail in knowledge_details for domain in detail["matchedDomainKeywords"]}
                ),
                "reason": (
                    f"Tech role score {technical_score} + synergy {synergy_score} * 0.1 + "
                    f"knowledge {knowledge_score} = final score {final_score}"
                ),
                "members": [
                    {
                        "userId": member["userId"],
                        "requestedRole": requested_roles[index],
                        "coveredSkills": [
                            skill for skill in required_skills if skill in set(member.get("matchedSkills", []))
                        ],
                        "bestRole": member.get("bestRole"),
                        "bestRoleScore": member.get("bestRoleScore"),
                        "roleScore": role_scores[index],
                        "roleMatch": role_details[index],
                        "matchedRole": role_details[index].get("matchedRole"),
                        "roleGroup": role_details[index].get("roleGroup"),
                        "domainKnowledge": member.get("domainKnowledge") or [],
                    }
                    for index, member in enumerate(member_perm)
                ],
            }

            existing_team = best_team_by_members.get(team_key)
            if existing_team is None or (
                team["finalScore"], team["technicalScore"], team["coverageScore"]
            ) > (
                existing_team["finalScore"], existing_team["technicalScore"], existing_team["coverageScore"]
            ):
                best_team_by_members[team_key] = team

            if len(best_team_by_members) >= limit * 20:
                break

        teams = list(best_team_by_members.values())
        teams.sort(
            key=lambda team: (
                team["finalScore"],
                team["coverageScore"],
                team["synergyScore"],
            ),
            reverse=True,
        )
        return teams[:limit]


# -----------------------------------------------------------------------------
# FastAPI App Setup
# -----------------------------------------------------------------------------

app = FastAPI(
    title="AI KBS + CV Analysis API",
    description="Manual Knowledge-Based System sync endpoints backed by Neo4j, plus CV analysis.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

kg = KnowledgeGraphService()


@app.on_event("shutdown")
def shutdown() -> None:
    kg.close()


# -----------------------------------------------------------------------------
# CV Analysis Endpoint
# -----------------------------------------------------------------------------

@app.post("/api/analyze-cv")
async def analyze_cv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted. Please upload a .pdf file.",
        )

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    result = await asyncio.to_thread(process_cv, pdf_bytes)

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return JSONResponse(content=result)


# -----------------------------------------------------------------------------
# AI Interview Endpoints
# -----------------------------------------------------------------------------

@app.post("/api/interview/start")
async def start_interview(payload: StartInterviewRequest) -> dict[str, Any]:
    cv_data = payload.cv_data or {}
    all_skills = _clean_string_list(
        cv_data.get("all_skills")
        or cv_data.get("allSkills")
        or cv_data.get("skills")
        or []
    )
    if not all_skills:
        raise HTTPException(status_code=400, detail="Interview requires extracted CV/profile skills")

    requested_skills = payload.num_skills if payload.num_skills > 0 else INTERVIEW_NUM_SKILLS
    num_skills = min(max(1, requested_skills), len(all_skills))
    skills_to_test = random.sample(all_skills, num_skills)
    candidate_id = _clean_string(payload.candidate_id) or _clean_string(cv_data.get("email")) or _clean_string(cv_data.get("name"))
    if not candidate_id:
        raise HTTPException(status_code=400, detail="Interview requires a candidate identifier")
    session = _create_interview_session(candidate_id, skills_to_test, cv_data)
    try:
        first_question = await asyncio.to_thread(_build_next_interview_question, session)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return {
        "session_id": session["session_id"],
        "candidate_name": cv_data.get("name"),
        "skills_to_test": skills_to_test,
        "total_questions": _interview_total_questions(session),
        "questions_per_skill": 1 + INTERVIEW_FOLLOW_UPS_PER_SKILL,
        "first_question": first_question,
    }


@app.post("/api/interview/submit-answer")
async def submit_interview_answer(payload: AnswerInterviewRequest) -> dict[str, Any]:
    answer = _clean_string(payload.answer)
    if not answer:
        raise HTTPException(status_code=400, detail="Answer is required")

    session = _load_interview_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.get("status") != "in_progress":
        raise HTTPException(status_code=400, detail="Interview already completed")

    questions = session.get("questions", [])
    current_question = next((q for q in reversed(questions) if q.get("user_answer") is None), None)
    if not current_question:
        raise HTTPException(status_code=400, detail="No pending interview question found")

    try:
        if payload.demo_result in {"right", "wrong"}:
            grade = _demo_interview_grade(payload.demo_result)
        elif payload.demo_result:
            raise ValueError("demo_result must be 'right' or 'wrong'")
        else:
            grade = await asyncio.to_thread(
                _grade_interview_answer,
                current_question.get("question_text", ""),
                answer,
                current_question.get("skill_name", "Unknown"),
                bool(current_question.get("is_followup")),
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    current_question["user_answer"] = answer
    current_question["score"] = _score_as_float(grade.get("score"))
    current_question["feedback"] = _clean_string(grade.get("feedback"))
    current_question["cheating_flag"] = bool(grade.get("cheating_flag"))
    current_question["english_score"] = _score_as_float(grade.get("english_score"))
    current_question["english_feedback"] = _clean_string(grade.get("english_feedback"))
    _update_interview_session(payload.session_id, {"questions": questions})

    session = _load_interview_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    answered_count = sum(1 for q in session.get("questions", []) if q.get("user_answer"))
    if answered_count >= _interview_total_questions(session):
        session = _complete_interview_session(payload.session_id) or session
        report = _generate_interview_report(session)
        return {
            "status": "completed",
            "next_question": None,
            "questions_answered": answered_count,
            "total_questions": _interview_total_questions(session),
            "report": report,
        }

    try:
        next_question = await asyncio.to_thread(_build_next_interview_question, session)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "status": "in_progress",
        "next_question": next_question,
        "questions_answered": answered_count,
        "total_questions": _interview_total_questions(session),
        "report": None,
    }


@app.post("/api/interview/report-violation")
async def report_interview_violation(payload: InterviewViolationRequest) -> dict[str, Any]:
    session = _load_interview_session(payload.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.get("status") != "in_progress":
        report = _generate_interview_report(session)
        return {
            "violations": session.get("violations", 0),
            "warning": True,
            "closed": True,
            "reason": "Interview is already closed.",
            "report": report,
        }

    violations = int(session.get("violations", 0) or 0) + 1
    violation_types = session.get("violation_types", [])
    violation_reasons = session.get("violation_reasons", [])
    violation_type = _clean_string(payload.violation_type) or "unknown"
    reason = _clean_string(payload.reason) or violation_type.replace("_", " ")
    violation_types.append(violation_type)
    violation_reasons.append(
        {
            "type": violation_type,
            "reason": reason,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    if violations >= INTERVIEW_MAX_VIOLATIONS:
        session.update(
            {
                "violations": violations,
                "violation_types": violation_types,
                "violation_reasons": violation_reasons,
                "status": "closed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "closed_reason": "Maximum proctoring violations reached.",
            }
        )
        _save_interview_session(session)
        report = _generate_interview_report(session)
        return {
            "violations": violations,
            "warning": True,
            "closed": True,
            "reason": "Maximum proctoring violations reached.",
            "report": report,
        }

    _update_interview_session(
        payload.session_id,
        {
            "violations": violations,
            "violation_types": violation_types,
            "violation_reasons": violation_reasons,
        },
    )
    return {
        "violations": violations,
        "warning": violations >= 3,
        "closed": False,
        "reason": reason,
        "remaining": INTERVIEW_MAX_VIOLATIONS - violations,
    }


@app.get("/api/interview/{session_id}/status")
async def get_interview_status(session_id: str) -> dict[str, Any]:
    session = _load_interview_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    return {
        "session_id": session["session_id"],
        "status": session["status"],
        "skills_to_test": session.get("skills_to_test", []),
        "questions_answered": sum(1 for q in session.get("questions", []) if q.get("user_answer")),
        "total_questions": _interview_total_questions(session),
        "violations": session.get("violations", 0),
    }


@app.get("/api/interview/{session_id}/report")
async def get_interview_report(session_id: str) -> dict[str, Any]:
    session = _load_interview_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.get("status") not in {"completed", "closed"}:
        raise HTTPException(status_code=400, detail="Interview is not completed yet")
    return _generate_interview_report(session)


# -----------------------------------------------------------------------------
# Health And Project Requirement Extraction Endpoints
# -----------------------------------------------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-kbs"}


@app.post("/projects/suggest-skills", response_model=ProjectSkillSuggestionResponse)
async def suggest_project_skills(payload: ProjectSkillSuggestionRequest) -> dict[str, list[str]]:
    try:
        requirements = await asyncio.to_thread(suggest_project_requirements_with_llm, payload)
        return requirements
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Project skill suggestion failed: {exc}") from exc


# -----------------------------------------------------------------------------
# KBS Health And Graph Sync Endpoints
# -----------------------------------------------------------------------------

@app.get("/kbs/health")
def kbs_health() -> dict[str, Any]:
    try:
        return {"status": "ok", "service": "neo4j", **kg.check_connection()}
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j unavailable: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j unavailable: {exc}") from exc


@app.post("/kbs/freelancers/ingest")
def ingest_freelancer(payload: FreelancerIngestRequest) -> dict[str, Any]:
    try:
        return kg.ingest_freelancer(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j sync failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j sync failed: {exc}") from exc


@app.post("/kbs/projects/ingest")
def ingest_project(payload: ProjectIngestRequest) -> dict[str, Any]:
    try:
        return kg.ingest_project(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j sync failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j sync failed: {exc}") from exc


# -----------------------------------------------------------------------------
# Recommendation Endpoints
# -----------------------------------------------------------------------------

@app.post("/recommendations/jobs")
def recommend_jobs(payload: FreelancerJobRecommendationRequest) -> dict[str, Any]:
    try:
        return kg.recommend_jobs(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j recommendation failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j recommendation failed: {exc}") from exc


@app.post("/recommendations/freelancers")
def recommend_freelancers(payload: ProjectFreelancerRecommendationRequest) -> dict[str, Any]:
    try:
        return kg.recommend_freelancers(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j recommendation failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j recommendation failed: {exc}") from exc


@app.post("/recommendations/teams")
def recommend_teams(payload: ProjectTeamRecommendationRequest) -> dict[str, Any]:
    try:
        return kg.recommend_teams(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j team formation failed: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j team formation failed: {exc}") from exc
