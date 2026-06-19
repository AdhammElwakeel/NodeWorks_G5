"""AI/KBS + CV Analysis API service.

This service owns Neo4j writes for the knowledge graph and exposes CV analysis.
The Next.js app keeps MongoDB as the source of truth and calls these endpoints
only when the user manually syncs a freelancer profile or project.
"""

import asyncio
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


ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=ROOT_DIR / ".env")
load_dotenv(dotenv_path=ROOT_DIR / "frontend" / ".env")
RECOMMENDATION_MIN_SCORE = float(os.getenv("RECOMMENDATION_MIN_SCORE", "55"))

sys.path.insert(0, str(Path(__file__).parent.parent / "MergedCVAnalyzer-with-KBS"))
from cv_analysis_module import process_cv
from cv_analysis_module.config import MODEL_NAME, OPENCODE_GO_API_KEY, OPENCODE_GO_BASE_URL


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


def suggest_project_skills_with_llm(payload: ProjectSkillSuggestionRequest) -> list[str]:
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
                    "Infer the concrete skills a client should require from a freelancer based on "
                    "the project title and description. Return strict JSON only with this shape: "
                    "{\"skills\":[\"Skill\"]}. Suggest 4 to 10 concise, normalized skill names. "
                    "Exclude skills already selected by the client. Do not include explanations."
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

    return [skill for skill in suggestions if skill.lower() not in existing_lower]


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


def _cv_value(cv_analysis: dict[str, Any], camel_key: str, snake_key: str) -> Any:
    return cv_analysis.get(camel_key, cv_analysis.get(snake_key))


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
    title: str | None, description: str | None, skills: list[str]
) -> tuple[list[dict[str, Any]], int]:
    """Derive project roles from existing app fields instead of proposal PDFs."""
    skill_text = " ".join(skills).lower()
    corpus = f"{title or ''} {description or ''} {skill_text}".lower()
    derived_roles: list[dict[str, Any]] = []

    for role_definition in ROLE_KEYWORDS:
        matched_keywords = [
            keyword
            for keyword in role_definition["keywords"]
            if re.search(rf"(?<![a-z0-9]){re.escape(keyword.lower())}(?![a-z0-9])", corpus)
        ]
        if not matched_keywords:
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


def _lower_set(values: list[str]) -> set[str]:
    return {value.lower() for value in values if isinstance(value, str)}


def _skill_match_score(candidate_skills: list[str], required_skills: list[str]) -> float:
    if not required_skills:
        return 100.0
    matched = len(_lower_set(candidate_skills) & _lower_set(required_skills))
    return round((matched / len(_lower_set(required_skills))) * 100, 1)


def _matched_skills(candidate_skills: list[str], required_skills: list[str]) -> list[str]:
    candidate_lower = _lower_set(candidate_skills)
    return [skill for skill in required_skills if skill.lower() in candidate_lower]


def _missing_skills(candidate_skills: list[str], required_skills: list[str]) -> list[str]:
    candidate_lower = _lower_set(candidate_skills)
    return [skill for skill in required_skills if skill.lower() not in candidate_lower]


def _best_role_match(candidate: dict[str, Any], required_roles: list[dict[str, Any]]) -> tuple[str | None, float]:
    role_matches = candidate.get("roleMatches") or []
    if not role_matches:
        return None, 0.0

    normalized_required = [
        str(role.get("name", "")).lower()
        for role in required_roles
        if role.get("name")
    ]

    best_name = None
    best_score = 0.0
    for role in role_matches:
        role_name = role.get("name")
        role_score = float(role.get("score") or 0)
        if normalized_required:
            role_lower = str(role_name or "").lower()
            if not any(req in role_lower or role_lower in req for req in normalized_required):
                role_score = 0.0
        if role_score >= best_score:
            best_name = role_name
            best_score = role_score

    return best_name, round(best_score, 1)


def _project_evidence(candidate: dict[str, Any], required_skills: list[str]) -> tuple[float, list[str], list[dict[str, Any]]]:
    required_lower = _lower_set(required_skills)
    evidence_skills: set[str] = set()
    evidence_details: list[dict[str, Any]] = []

    for project in candidate.get("projects", []):
        technologies = _clean_string_list(project.get("technologies"))
        overlap = [skill for skill in technologies if skill.lower() in required_lower]
        if not overlap:
            continue
        evidence_skills.update(overlap)
        evidence_details.extend(
            {"project": project.get("name"), "technology": skill}
            for skill in overlap
        )

    if not required_skills:
        return 0.0, [], []

    evidence_score = round((len(_lower_set(list(evidence_skills))) / len(required_lower)) * 100, 1)
    return evidence_score, sorted(evidence_skills), evidence_details


def _experience_score(candidate: dict[str, Any], required_roles: list[dict[str, Any]]) -> tuple[float, list[dict[str, Any]]]:
    experiences = candidate.get("experience") or []
    required_role_names = [
        str(role.get("name", "")).lower()
        for role in required_roles
        if role.get("name")
    ]
    relevant = [
        exp
        for exp in experiences
        if exp.get("role")
        and any(req in str(exp["role"]).lower() or str(exp["role"]).lower() in req for req in required_role_names)
    ]

    if relevant:
        return 100.0, relevant
    if len(experiences) >= 2:
        return 80.0, []
    if len(experiences) == 1:
        return 60.0, []
    if candidate.get("yearsOfExperience"):
        return 35.0, []
    return 0.0, []


def _recommender_style_score(
    candidate: dict[str, Any],
    required_skills: list[str],
    required_roles: list[dict[str, Any]],
) -> dict[str, Any]:
    skills = candidate.get("skills") or []
    skill_score = _skill_match_score(skills, required_skills)
    best_role, role_score = _best_role_match(candidate, required_roles)
    project_score, evidence_skills, project_details = _project_evidence(candidate, required_skills)
    experience_score, relevant_experience = _experience_score(candidate, required_roles)

    # Ported from backend/Recommender-System/recommender.py, adapted to the live graph:
    # required skills dominate, role/CV score is next, and CV project evidence is the bonus.
    score = round((skill_score * 0.50) + (role_score * 0.30) + (project_score * 0.20), 1)

    return {
        "score": score,
        "matchedSkills": _matched_skills(skills, required_skills),
        "missingSkills": _missing_skills(skills, required_skills),
        "requiredSkills": required_skills,
        "bestRole": best_role,
        "bestRoleScore": role_score,
        "scoreBreakdown": {
            "skillScore": skill_score,
            "experienceScore": experience_score,
            "projectEvidenceScore": project_score,
            "roleScore": role_score,
        },
        "evidence": {
            "requiredRoles": [role.get("name") for role in required_roles if role.get("name")],
            "projectEvidenceSkills": evidence_skills,
        },
        "experienceDetails": candidate.get("experience") or [],
        "relevantExperienceDetails": relevant_experience,
        "projectEvidenceDetails": project_details,
        "reason": (
            "Recommended by recommender.py scoring: "
            f"{len(_matched_skills(skills, required_skills))} required skills matched, "
            f"role score {role_score}, CV project evidence {project_score}%."
        ),
    }


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
            "CREATE CONSTRAINT role_name IF NOT EXISTS FOR (r:Role) REQUIRE r.name IS UNIQUE",
        ]
        with self.driver.session() as session:
            for query in queries:
                session.run(query).consume()

    def ingest_freelancer(self, payload: FreelancerIngestRequest) -> dict[str, Any]:
        profile = payload.profile or {}
        cv_analysis = profile.get("cvAnalysis") or {}

        app_skills = _clean_string_list(profile.get("skills"))
        cv_skills = _clean_string_list(_cv_value(cv_analysis, "allSkills", "all_skills"))
        skills = _clean_string_list(app_skills + cv_skills)

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
            "experience": cv_analysis.get("experience") or [],
            "education": cv_analysis.get("education") or [],
            "projects": cv_analysis.get("projects") or [],
            "best_role": _clean_string(_cv_value(cv_analysis, "bestRole", "best_role")),
            "best_score": _cv_value(cv_analysis, "bestScore", "best_score"),
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
            "experienceCount": len(data["experience"]),
            "educationCount": len(data["education"]),
            "projectsCount": len(data["projects"]),
        }

    def ingest_project(self, payload: ProjectIngestRequest) -> dict[str, Any]:
        skills = _clean_string_list(payload.skills)
        data = {
            "project_id": payload.projectId,
            "client_id": payload.clientId,
            "title": _clean_string(payload.title),
            "description": _clean_string(payload.description),
            "budget": payload.budget,
            "skills": skills,
            "status": _clean_string(payload.status),
            "timeline": _clean_string(payload.timeline),
            "created_at": _clean_string(payload.createdAt),
            "updated_at": _clean_string(payload.updatedAt),
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }

        derived_roles, team_size = _derive_project_roles(
            data["title"], data["description"], skills
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
            "roles": derived_roles,
            "teamSize": team_size,
        }

    def recommend_jobs(self, payload: FreelancerJobRecommendationRequest) -> dict[str, Any]:
        with self.driver.session() as session:
            freelancer = session.execute_read(self._read_freelancer_profile, payload.userId)
            projects = session.execute_read(self._read_open_project_profiles, payload.excludeProjectIds)

        if not freelancer:
            records = []
        else:
            records = []
            for project in projects:
                score_info = _recommender_style_score(
                    freelancer,
                    project["requiredSkills"],
                    project["requiredRoles"],
                )
                records.append({"projectId": project["projectId"], **score_info})

            records.sort(
                key=lambda item: (
                    item["score"],
                    item["scoreBreakdown"]["skillScore"],
                    item["scoreBreakdown"]["projectEvidenceScore"],
                ),
                reverse=True,
            )
            records = records[: max(1, min(payload.limit, 50))]

        return {
            "status": "ok",
            "recommendations": records,
        }

    def recommend_freelancers(
        self, payload: ProjectFreelancerRecommendationRequest
    ) -> dict[str, Any]:
        with self.driver.session() as session:
            project = session.execute_read(self._read_project_profile, payload.projectId)
            candidates = session.execute_read(self._read_freelancer_profiles, payload.excludeUserIds)

        if not project:
            records = []
        else:
            records = []
            for candidate in candidates:
                score_info = _recommender_style_score(
                    candidate,
                    project["requiredSkills"],
                    project["requiredRoles"],
                )
                records.append({"userId": candidate["userId"], **score_info})

            records.sort(
                key=lambda item: (
                    item["score"],
                    item["scoreBreakdown"]["skillScore"],
                    item["scoreBreakdown"]["projectEvidenceScore"],
                ),
                reverse=True,
            )
            records = records[: max(1, min(payload.limit, 50))]

        return {
            "status": "ok",
            "recommendations": records,
        }

    def recommend_teams(self, payload: ProjectTeamRecommendationRequest) -> dict[str, Any]:
        with self.driver.session() as session:
            project = session.execute_read(self._read_project_profile, payload.projectId)
            candidates = session.execute_read(self._read_freelancer_profiles, payload.excludeUserIds)

        required_skills = project["requiredSkills"] if project else []
        required_roles = project["requiredRoles"] if project else []
        max_team_size = max(1, min(payload.maxTeamSize, 8))
        limit = max(1, min(payload.limit, 10))
        teams = self._build_recommender_style_teams(
            required_skills,
            required_roles,
            candidates,
            max_team_size,
            limit,
        )

        return {
            "status": "ok",
            "requiredSkills": required_skills,
            "requiredRoles": required_roles,
            "recommendations": teams,
        }

    @staticmethod
    def _read_project_profile(tx: Any, project_id: str) -> dict[str, Any] | None:
        project = tx.run(
            """
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND p.projectId = $project_id
            RETURN p.projectId AS projectId
            """,
            project_id=project_id,
        ).single()
        if not project:
            return None

        skills = tx.run(
            """
            MATCH (p)-[:REQUIRES_SKILL]->(s:Skill)
            WHERE (p:ClientProject OR p:Project)
              AND p.projectId = $project_id
            RETURN collect(DISTINCT s.name) AS skills
            """,
            project_id=project_id,
        ).single()
        roles = tx.run(
            """
            MATCH (p)-[requires:REQUIRES_ROLE]->(r:Role)
            WHERE (p:ClientProject OR p:Project)
              AND p.projectId = $project_id
            RETURN collect(DISTINCT {name: r.name, count: requires.count}) AS roles
            """,
            project_id=project_id,
        ).single()

        return {
            "projectId": project["projectId"],
            "requiredSkills": skills["skills"] if skills else [],
            "requiredRoles": roles["roles"] if roles else [],
        }

    @staticmethod
    def _read_open_project_profiles(tx: Any, exclude_project_ids: list[str]) -> list[dict[str, Any]]:
        rows = tx.run(
            """
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND coalesce(p.status, 'open') = 'open'
              AND NOT p.projectId IN $exclude_project_ids
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(s:Skill)
            OPTIONAL MATCH (p)-[requires:REQUIRES_ROLE]->(r:Role)
            RETURN p.projectId AS projectId,
                   collect(DISTINCT s.name) AS requiredSkills,
                   collect(DISTINCT CASE
                     WHEN r IS NULL THEN null
                     ELSE {name: r.name, count: requires.count}
                   END) AS requiredRoles,
                   p.syncedAt AS syncedAt
            ORDER BY p.syncedAt DESC
            """,
            exclude_project_ids=exclude_project_ids,
        )
        projects = []
        for row in rows:
            projects.append(
                {
                    "projectId": row["projectId"],
                    "requiredSkills": [skill for skill in row["requiredSkills"] if skill],
                    "requiredRoles": [role for role in row["requiredRoles"] if role],
                    "syncedAt": row["syncedAt"],
                }
            )
        return projects

    @staticmethod
    def _read_freelancer_profile(tx: Any, user_id: str) -> dict[str, Any] | None:
        profiles = KnowledgeGraphService._read_freelancer_profiles(tx, [], [user_id])
        return profiles[0] if profiles else None

    @staticmethod
    def _read_freelancer_profiles(
        tx: Any, exclude_user_ids: list[str], only_user_ids: list[str] | None = None
    ) -> list[dict[str, Any]]:
        rows = tx.run(
            """
            MATCH (f:Freelancer)
            WHERE NOT f.userId IN $exclude_user_ids
              AND ($only_user_ids IS NULL OR f.userId IN $only_user_ids)
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(skill:Skill)
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT]->(project:CvProject)
            OPTIONAL MATCH (project)-[:USED_TECH]->(technology:Skill)
            OPTIONAL MATCH (f)--(shared)
            WHERE shared IS NULL
               OR shared:Skill
               OR shared:Institution
               OR shared:Company
               OR shared:CvProject
               OR shared:Project
               OR shared:Role
            RETURN f.userId AS userId,
                   f.yearsOfExperience AS yearsOfExperience,
                   collect(DISTINCT skill.name) AS skills,
                   collect(DISTINCT CASE
                     WHEN company IS NULL THEN null
                     ELSE {company: company.name, role: worked.role, duration: worked.duration}
                   END) AS experience,
                   collect(DISTINCT CASE
                     WHEN role IS NULL THEN null
                     ELSE {name: role.name, score: roleMatch.score}
                   END) AS roleMatches,
                   collect(DISTINCT CASE
                     WHEN project IS NULL THEN null
                     ELSE {name: project.name, technology: technology.name}
                   END) AS projectRows,
                   collect(DISTINCT CASE
                     WHEN shared IS NULL THEN null
                     ELSE labels(shared)[0] + ':' + coalesce(shared.name, shared.title, shared.projectId, shared.userId)
                   END) AS affinityEntities
            """,
            exclude_user_ids=exclude_user_ids,
            only_user_ids=only_user_ids,
        )

        profiles = []
        for row in rows:
            project_map: dict[str, set[str]] = {}
            for project_row in row["projectRows"]:
                if not project_row or not project_row.get("name"):
                    continue
                project_map.setdefault(project_row["name"], set())
                if project_row.get("technology"):
                    project_map[project_row["name"]].add(project_row["technology"])

            profiles.append(
                {
                    "userId": row["userId"],
                    "yearsOfExperience": row["yearsOfExperience"],
                    "skills": [skill for skill in row["skills"] if skill],
                    "experience": [item for item in row["experience"] if item],
                    "roleMatches": [item for item in row["roleMatches"] if item],
                    "projects": [
                        {"name": name, "technologies": sorted(technologies)}
                        for name, technologies in project_map.items()
                    ],
                    "affinityEntities": [entity for entity in row["affinityEntities"] if entity],
                }
            )
        return profiles

    @staticmethod
    def _build_recommender_style_teams(
        required_skills: list[str],
        required_roles: list[dict[str, Any]],
        candidates: list[dict[str, Any]],
        max_team_size: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        if not required_skills or not candidates:
            return []

        required_lower = _lower_set(required_skills)
        scored_candidates = sorted(
            [
                {
                    "candidate": candidate,
                    "scoreInfo": _recommender_style_score(candidate, required_skills, required_roles),
                }
                for candidate in candidates
            ],
            key=lambda item: item["scoreInfo"]["score"],
            reverse=True,
        )

        teams: list[dict[str, Any]] = []
        seen_team_keys: set[tuple[str, ...]] = set()

        for seed in scored_candidates[: max(limit * 3, limit)]:
            selected = [seed]
            covered = _lower_set(seed["scoreInfo"]["matchedSkills"]) & required_lower

            while len(selected) < max_team_size and covered != required_lower:
                selected_ids = {item["candidate"]["userId"] for item in selected}
                remaining = [
                    item
                    for item in scored_candidates
                    if item["candidate"]["userId"] not in selected_ids
                ]
                if not remaining:
                    break

                best_candidate = max(
                    remaining,
                    key=lambda item: (
                        len((_lower_set(item["scoreInfo"]["matchedSkills"]) & required_lower) - covered),
                        item["scoreInfo"]["score"],
                    ),
                )
                new_skills = (_lower_set(best_candidate["scoreInfo"]["matchedSkills"]) & required_lower) - covered
                if not new_skills:
                    break

                selected.append(best_candidate)
                covered.update(new_skills)

            team_key = tuple(sorted(item["candidate"]["userId"] for item in selected))
            if team_key in seen_team_keys:
                continue
            seen_team_keys.add(team_key)

            covered_skills = [skill for skill in required_skills if skill.lower() in covered]
            missing_skills = [skill for skill in required_skills if skill.lower() not in covered]
            coverage_score = round((len(covered) / len(required_lower)) * 100, 1)
            role_names = {
                item["scoreInfo"]["bestRole"]
                for item in selected
                if item["scoreInfo"].get("bestRole")
            }
            role_diversity_bonus = min(len(role_names) * 5, 20)

            shared_synergy_entities: set[str] = set()
            for index, item in enumerate(selected):
                entities = _shared_entity_names(item["candidate"])
                for other in selected[index + 1 :]:
                    shared_synergy_entities.update(entities & _shared_entity_names(other["candidate"]))

            collaboration_bonus = min(len(shared_synergy_entities), 15)
            avg_individual = sum(item["scoreInfo"]["score"] for item in selected) / len(selected)
            final_score = round(
                0.70 * coverage_score
                + 0.15 * role_diversity_bonus
                + 0.15 * collaboration_bonus
                + 0.10 * avg_individual,
                1,
            )
            technical_score = round(avg_individual, 1)

            teams.append(
                {
                    "score": final_score,
                    "finalScore": final_score,
                    "technicalScore": technical_score,
                    "synergyScore": collaboration_bonus,
                    "coverageScore": coverage_score,
                    "coveredSkills": covered_skills,
                    "missingSkills": missing_skills,
                    "sharedEntities": sorted(shared_synergy_entities),
                    "reason": (
                        f"Recommender.py team score: {coverage_score}% skill coverage, "
                        f"+{role_diversity_bonus} role diversity, +{collaboration_bonus} graph synergy."
                    ),
                    "members": [
                        {
                            "userId": item["candidate"]["userId"],
                            "coveredSkills": item["scoreInfo"]["matchedSkills"],
                            "bestRole": item["scoreInfo"]["bestRole"],
                            "bestRoleScore": item["scoreInfo"]["bestRoleScore"],
                        }
                        for item in selected
                    ],
                }
            )

        teams.sort(
            key=lambda team: (
                team["finalScore"],
                team["coverageScore"],
                team["technicalScore"],
                -len(team["members"]),
            ),
            reverse=True,
        )
        return teams[:limit]

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
            OPTIONAL MATCH (f)-[r:HAS_SKILL|WORKED_AT|STUDIED_AT|CREATED_CV_PROJECT|MATCHES_ROLE]->()
            DELETE r
            """,
            user_id=data["user_id"],
        ).consume()
        tx.run(
            """
            MATCH (f:Freelancer {userId: $user_id})
            OPTIONAL MATCH ()-[r:SKILL_OWNED_BY|EMPLOYED|ALUMNI_OF|DEVELOPED_BY|SUITABLE_CANDIDATE]->(f)
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

        if data["best_role"]:
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (r:Role {name: $role})
                MERGE (f)-[matches:MATCHES_ROLE]->(r)
                SET matches.score = $score
                MERGE (r)-[candidate:SUITABLE_CANDIDATE]->(f)
                SET candidate.score = $score
                """,
                user_id=data["user_id"],
                role=data["best_role"],
                score=data["best_score"],
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
            OPTIONAL MATCH (p)-[r:REQUIRES_SKILL]->()
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

    @staticmethod
    def _read_job_recommendations(
        tx: Any, user_id: str, exclude_project_ids: list[str], limit: int
    ) -> list[dict[str, Any]]:
        result = tx.run(
            """
            MATCH (f:Freelancer {userId: $user_id})
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND coalesce(p.status, 'open') = 'open'
              AND NOT p.projectId IN $exclude_project_ids
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH f, p, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(matched:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f,
                 p,
                 requiredSkills,
                 collect(DISTINCT matched.name) AS matchedSkills
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT]->(cvProject:CvProject)-[:USED_TECH]->(projectSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f,
                 p,
                 requiredSkills,
                 matchedSkills,
                 collect(DISTINCT projectSkill.name) AS projectEvidenceSkills,
                 [detail IN collect(DISTINCT {project: cvProject.name, technology: projectSkill.name}) WHERE detail.technology IS NOT NULL] AS projectEvidenceDetails
            OPTIONAL MATCH (p)-[:REQUIRES_ROLE]->(requiredRole:Role)
            WITH f,
                 p,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 collect(DISTINCT requiredRole.name) AS requiredRoles
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 CASE
                   WHEN role IS NULL THEN 0.0
                   WHEN size(requiredRoles) = 0 THEN coalesce(roleMatch.score, 0) * 0.5
                   WHEN any(roleName IN requiredRoles WHERE toLower(role.name) CONTAINS toLower(roleName) OR toLower(roleName) CONTAINS toLower(role.name)) THEN coalesce(roleMatch.score, 70)
                   ELSE 0.0
                 END AS roleScore
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 [detail IN collect(DISTINCT {company: company.name, role: worked.role, duration: worked.duration}) WHERE detail.company IS NOT NULL] AS experienceDetails
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 [skill IN requiredSkills WHERE NOT skill IN matchedSkills] AS missingSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 [detail IN experienceDetails WHERE detail.role IS NOT NULL AND any(roleName IN requiredRoles WHERE toLower(detail.role) CONTAINS toLower(roleName) OR toLower(roleName) CONTAINS toLower(detail.role))] AS relevantExperienceDetails,
                 [skill IN requiredSkills WHERE skill IN projectEvidenceSkills] AS evidenceSkills
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 missingSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 relevantExperienceDetails,
                 evidenceSkills,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(matchedSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS skillScore,
                 CASE
                   WHEN size(relevantExperienceDetails) > 0 THEN 100.0
                   WHEN size(experienceDetails) >= 2 THEN 80.0
                   WHEN size(experienceDetails) = 1 THEN 60.0
                   WHEN f.yearsOfExperience IS NOT NULL THEN 35.0
                   ELSE 0.0
                 END AS experienceScore,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(evidenceSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS projectEvidenceScore
            WITH p,
                 requiredSkills,
                 matchedSkills,
                 missingSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 relevantExperienceDetails,
                 skillScore,
                 experienceScore,
                 projectEvidenceScore,
                 round((skillScore * 0.4 + experienceScore * 0.3 + projectEvidenceScore * 0.2 + roleScore * 0.1) * 10) / 10 AS score
            WHERE score >= $min_score
            RETURN p.projectId AS projectId,
                   score AS score,
                   matchedSkills AS matchedSkills,
                   missingSkills AS missingSkills,
                   requiredSkills AS requiredSkills,
                   role.name AS bestRole,
                   roleMatch.score AS bestRoleScore,
                   {
                     skillScore: skillScore,
                     experienceScore: experienceScore,
                     projectEvidenceScore: projectEvidenceScore,
                     roleScore: round(roleScore * 10) / 10
                   } AS scoreBreakdown,
                   {
                     requiredRoles: requiredRoles,
                     projectEvidenceSkills: projectEvidenceSkills
                   } AS evidence,
                   projectEvidenceDetails AS projectEvidenceDetails,
                   experienceDetails AS experienceDetails,
                   relevantExperienceDetails AS relevantExperienceDetails,
                   'Recommended from graph evidence: ' + toString(size(matchedSkills)) + ' required skills matched, ' + toString(size(experienceDetails)) + ' past experience records, ' + toString(size(projectEvidenceSkills)) + ' CV project skill evidence.' AS reason
            ORDER BY score DESC, skillScore DESC, experienceScore DESC, projectEvidenceScore DESC, p.syncedAt DESC
            LIMIT $limit
            """,
            user_id=user_id,
            exclude_project_ids=exclude_project_ids,
            limit=limit,
            min_score=RECOMMENDATION_MIN_SCORE,
        )
        return [dict(record) for record in result]

    @staticmethod
    def _read_freelancer_recommendations(
        tx: Any, project_id: str, exclude_user_ids: list[str], limit: int
    ) -> list[dict[str, Any]]:
        result = tx.run(
            """
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND p.projectId = $project_id
            MATCH (f:Freelancer)
            WHERE NOT f.userId IN $exclude_user_ids
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH p, f, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(matched:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH p,
                 f,
                 requiredSkills,
                 collect(DISTINCT matched.name) AS matchedSkills
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT]->(cvProject:CvProject)-[:USED_TECH]->(projectSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 collect(DISTINCT projectSkill.name) AS projectEvidenceSkills,
                 [detail IN collect(DISTINCT {project: cvProject.name, technology: projectSkill.name}) WHERE detail.technology IS NOT NULL] AS projectEvidenceDetails
            OPTIONAL MATCH (p)-[:REQUIRES_ROLE]->(requiredRole:Role)
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 collect(DISTINCT requiredRole.name) AS requiredRoles
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 CASE
                   WHEN role IS NULL THEN 0.0
                   WHEN size(requiredRoles) = 0 THEN coalesce(roleMatch.score, 0) * 0.5
                   WHEN any(roleName IN requiredRoles WHERE toLower(role.name) CONTAINS toLower(roleName) OR toLower(roleName) CONTAINS toLower(role.name)) THEN coalesce(roleMatch.score, 70)
                   ELSE 0.0
                 END AS roleScore
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 [detail IN collect(DISTINCT {company: company.name, role: worked.role, duration: worked.duration}) WHERE detail.company IS NOT NULL] AS experienceDetails
            WITH f,
                 requiredSkills,
                 matchedSkills,
                 [skill IN requiredSkills WHERE NOT skill IN matchedSkills] AS missingSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 [detail IN experienceDetails WHERE detail.role IS NOT NULL AND any(roleName IN requiredRoles WHERE toLower(detail.role) CONTAINS toLower(roleName) OR toLower(roleName) CONTAINS toLower(detail.role))] AS relevantExperienceDetails,
                 [skill IN requiredSkills WHERE skill IN projectEvidenceSkills] AS evidenceSkills
            WITH f,
                 requiredSkills,
                 matchedSkills,
                 missingSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 relevantExperienceDetails,
                 evidenceSkills,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(matchedSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS skillScore,
                 CASE
                   WHEN size(relevantExperienceDetails) > 0 THEN 100.0
                   WHEN size(experienceDetails) >= 2 THEN 80.0
                   WHEN size(experienceDetails) = 1 THEN 60.0
                   WHEN f.yearsOfExperience IS NOT NULL THEN 35.0
                   ELSE 0.0
                 END AS experienceScore,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(evidenceSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS projectEvidenceScore
            WITH f,
                 requiredSkills,
                 matchedSkills,
                 missingSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 relevantExperienceDetails,
                 skillScore,
                 experienceScore,
                 projectEvidenceScore,
                 round((skillScore * 0.4 + experienceScore * 0.3 + projectEvidenceScore * 0.2 + roleScore * 0.1) * 10) / 10 AS score
            WHERE score >= $min_score
            RETURN f.userId AS userId,
                   score AS score,
                   matchedSkills AS matchedSkills,
                   missingSkills AS missingSkills,
                   requiredSkills AS requiredSkills,
                   role.name AS bestRole,
                   roleMatch.score AS bestRoleScore,
                   {
                     skillScore: skillScore,
                     experienceScore: experienceScore,
                     projectEvidenceScore: projectEvidenceScore,
                     roleScore: round(roleScore * 10) / 10
                   } AS scoreBreakdown,
                   {
                     requiredRoles: requiredRoles,
                     projectEvidenceSkills: projectEvidenceSkills
                   } AS evidence,
                   projectEvidenceDetails AS projectEvidenceDetails,
                   experienceDetails AS experienceDetails,
                   relevantExperienceDetails AS relevantExperienceDetails,
                   'Recommended from graph evidence: ' + toString(size(matchedSkills)) + ' required skills matched, ' + toString(size(experienceDetails)) + ' past experience records, ' + toString(size(projectEvidenceSkills)) + ' CV project skill evidence.' AS reason
            ORDER BY score DESC, skillScore DESC, experienceScore DESC, projectEvidenceScore DESC, f.syncedAt DESC
            LIMIT $limit
            """,
            project_id=project_id,
            exclude_user_ids=exclude_user_ids,
            limit=limit,
            min_score=RECOMMENDATION_MIN_SCORE,
        )
        return [dict(record) for record in result]

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
            OPTIONAL MATCH (p)-[roleRequirement:REQUIRES_ROLE]->(role:Role)
            WITH requiredSkills,
                 collect(DISTINCT CASE
                   WHEN role IS NULL THEN null
                   ELSE {name: role.name, count: roleRequirement.count}
                 END) AS requiredRoles
            RETURN requiredSkills,
                   [role IN requiredRoles WHERE role IS NOT NULL] AS requiredRoles
            """,
            project_id=project_id,
        ).single()
        required_skills = project_result["requiredSkills"] if project_result else []
        required_roles = project_result["requiredRoles"] if project_result else []

        candidates_result = tx.run(
            """
            MATCH (p)
            WHERE (p:ClientProject OR p:Project)
              AND p.projectId = $project_id
            MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            MATCH (f:Freelancer)-[:HAS_SKILL]->(required)
            WHERE NOT f.userId IN $exclude_user_ids
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            WITH f, role, roleMatch, collect(DISTINCT required.name) AS matchedSkills
            OPTIONAL MATCH (f)-[]-(shared)
            WITH f, role, roleMatch, matchedSkills, shared
            WHERE shared IS NULL
               OR shared:Skill
               OR shared:Institution
               OR shared:Company
               OR shared:CvProject
               OR shared:Project
               OR shared:Role
            WITH f, role, roleMatch, matchedSkills,
                 collect(DISTINCT CASE
                   WHEN shared IS NULL THEN null
                   ELSE labels(shared)[0] + ':' + coalesce(shared.name, shared.title, shared.projectId, shared.userId)
                 END) AS affinityEntities
            RETURN f.userId AS userId,
                   matchedSkills AS matchedSkills,
                   role.name AS bestRole,
                   roleMatch.score AS bestRoleScore,
                   [entity IN affinityEntities WHERE entity IS NOT NULL] AS affinityEntities
            ORDER BY size(matchedSkills) DESC, coalesce(roleMatch.score, 0) DESC, f.syncedAt DESC
            """,
            project_id=project_id,
            exclude_user_ids=exclude_user_ids,
        )

        return {
            "requiredSkills": required_skills,
            "requiredRoles": required_roles,
            "candidates": [dict(record) for record in candidates_result],
        }

    @staticmethod
    def _build_skill_coverage_teams(
        required_skills: list[str], candidates: list[dict[str, Any]], max_team_size: int, limit: int
    ) -> list[dict[str, Any]]:
        if not required_skills or not candidates:
            return []

        required_set = set(required_skills)
        teams: list[dict[str, Any]] = []
        seen_team_keys: set[tuple[str, ...]] = set()

        sorted_candidates = sorted(
            candidates,
            key=lambda candidate: (
                len(set(candidate.get("matchedSkills", []))),
                candidate.get("bestRoleScore") or 0,
            ),
            reverse=True,
        )

        for seed in sorted_candidates[: max(limit * 3, limit)]:
            selected = [seed]
            covered = set(seed.get("matchedSkills", [])) & required_set

            while len(selected) < max_team_size and covered != required_set:
                selected_ids = {member["userId"] for member in selected}
                remaining = [candidate for candidate in sorted_candidates if candidate["userId"] not in selected_ids]
                if not remaining:
                    break

                best_candidate = max(
                    remaining,
                    key=lambda candidate: (
                        len((set(candidate.get("matchedSkills", [])) & required_set) - covered),
                        len(set(candidate.get("matchedSkills", [])) & required_set),
                        candidate.get("bestRoleScore") or 0,
                    ),
                )
                new_skills = (set(best_candidate.get("matchedSkills", [])) & required_set) - covered
                if not new_skills:
                    break

                selected.append(best_candidate)
                covered.update(new_skills)

            team_key = tuple(sorted(member["userId"] for member in selected))
            if team_key in seen_team_keys:
                continue
            seen_team_keys.add(team_key)

            missing = [skill for skill in required_skills if skill not in covered]
            coverage_score = round((len(covered) / len(required_set)) * 100, 1)
            technical_score = round(
                sum(
                    len(set(member.get("matchedSkills", [])) & required_set)
                    + ((member.get("bestRoleScore") or 0) / 100)
                    for member in selected
                ),
                2,
            )
            shared_synergy_entities: set[str] = set()
            for index, member in enumerate(selected):
                member_entities = _shared_entity_names(member)
                for other in selected[index + 1 :]:
                    shared_synergy_entities.update(member_entities & _shared_entity_names(other))

            synergy_score = len(shared_synergy_entities)
            final_score = round(technical_score + (synergy_score * 0.01), 2)
            teams.append(
                {
                    "score": final_score,
                    "finalScore": final_score,
                    "technicalScore": technical_score,
                    "synergyScore": synergy_score,
                    "coverageScore": coverage_score,
                    "coveredSkills": [skill for skill in required_skills if skill in covered],
                    "missingSkills": missing,
                    "sharedEntities": sorted(shared_synergy_entities),
                    "reason": (
                        f"Tech score {technical_score} + synergy {synergy_score} * 0.01 "
                        f"= final score {final_score}"
                    ),
                    "members": [
                        {
                            "userId": member["userId"],
                            "coveredSkills": [
                                skill for skill in required_skills if skill in set(member.get("matchedSkills", []))
                            ],
                            "bestRole": member.get("bestRole"),
                            "bestRoleScore": member.get("bestRoleScore"),
                        }
                        for member in selected
                    ],
                }
            )

        teams.sort(
            key=lambda team: (
                team["finalScore"],
                team["coverageScore"],
                team["synergyScore"],
                -len(team["members"]),
            ),
            reverse=True,
        )
        return teams[:limit]


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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-kbs"}


@app.post("/projects/suggest-skills", response_model=ProjectSkillSuggestionResponse)
async def suggest_project_skills(payload: ProjectSkillSuggestionRequest) -> dict[str, list[str]]:
    try:
        skills = await asyncio.to_thread(suggest_project_skills_with_llm, payload)
        return {"skills": skills}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Project skill suggestion failed: {exc}") from exc


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
