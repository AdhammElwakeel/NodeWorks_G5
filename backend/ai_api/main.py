"""AI/KBS + CV Analysis API service.

This service owns Neo4j writes for the knowledge graph and exposes CV analysis.
The Next.js app keeps MongoDB as the source of truth and calls these endpoints
only when the user manually syncs a freelancer profile or project.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(dotenv_path=ROOT_DIR / ".env")
load_dotenv(dotenv_path=ROOT_DIR / "frontend" / ".env")

KBS_MODULE_DIR = Path(
    os.getenv("KBS_MODULE_DIR", Path(__file__).parent.parent / "MergedCVAnalyzer-with-KBS")
)
if not KBS_MODULE_DIR.exists():
    KBS_MODULE_DIR = ROOT_DIR / "MergedCVAnalyzer-with-KBS"
sys.path.insert(0, str(KBS_MODULE_DIR))
from cv_analysis_module import process_cv
from cv_analysis_module.config import (
    MODEL_NAME,
    OPENCODE_GO_API_KEY,
    OPENCODE_GO_BASE_URL,
    PROVIDER_NAME,
    ZHIPUAI_API_KEY,
)

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - dependency is available in normal runtime
    OpenAI = None

try:
    from zhipuai import ZhipuAI
except ImportError:  # pragma: no cover - dependency is available in normal runtime
    ZhipuAI = None


MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY") or os.getenv("MINMAX_API_KEY")
MINIMAX_BASE_URL = os.getenv("MINIMAX_BASE_URL") or os.getenv("MINMAX_BASE_URL") or "https://api.minimax.io/v1"

RECOMMENDATION_EVALUATOR_LIMIT = int(os.getenv("RECOMMENDATION_EVALUATOR_LIMIT", "3"))
RECOMMENDATION_EVALUATOR_BATCH_SIZE = int(os.getenv("RECOMMENDATION_EVALUATOR_BATCH_SIZE", "5"))
RECOMMENDATION_EVALUATOR_TIMEOUT_SECONDS = int(os.getenv("RECOMMENDATION_EVALUATOR_TIMEOUT_SECONDS", "12"))
RECOMMENDATION_EVALUATOR_MAX_TOKENS = int(os.getenv("RECOMMENDATION_EVALUATOR_MAX_TOKENS", "700"))
RECOMMENDATION_EVALUATOR_PROVIDER = os.getenv("RECOMMENDATION_EVALUATOR_PROVIDER", "").strip().lower()
RECOMMENDATION_EVALUATOR_MODEL = os.getenv("RECOMMENDATION_EVALUATOR_MODEL", "").strip()


def _choose_evaluator_provider() -> str:
    if RECOMMENDATION_EVALUATOR_PROVIDER:
        return RECOMMENDATION_EVALUATOR_PROVIDER
    if ZHIPUAI_API_KEY:
        return "glm"
    if OPENCODE_GO_API_KEY and OPENCODE_GO_BASE_URL:
        return "opencode_go"
    if MINIMAX_API_KEY:
        return "minimax"
    return ""


def _choose_evaluator_model() -> str:
    if RECOMMENDATION_EVALUATOR_MODEL:
        return RECOMMENDATION_EVALUATOR_MODEL
    provider = _choose_evaluator_provider()
    if provider == "glm":
        return "glm-5.1"
    if provider == "minimax":
        return "MiniMax-Text-01"
    return MODEL_NAME.removeprefix("opencode-go/")


EVALUATOR_PROVIDER = _choose_evaluator_provider()
EVALUATOR_MODEL = _choose_evaluator_model()


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


CONTENT_SKILL_RULES = [
    {
        "keywords": ["content creator", "content creation", "content marketing", "content strategy"],
        "skills": ["Content Writing", "Content Creation", "Content Strategy", "Social Media Marketing"],
    },
    {
        "keywords": ["social media", "instagram", "tiktok", "reels", "bts shooting"],
        "skills": ["Social Media Marketing", "Social Media Management", "Content Creation"],
    },
    {
        "keywords": ["copywriting", "content writing", "caption", "captions", "blog", "article"],
        "skills": ["Content Writing", "Copywriting"],
    },
    {
        "keywords": ["canva", "capcut", "lightroom", "photoshop", "video editing", "photo editing"],
        "skills": ["Canva Design", "Video Editing", "Content Creation"],
    },
]


def _collect_text_parts(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            parts.extend(_collect_text_parts(item))
        return parts
    if isinstance(value, dict):
        parts = []
        for item in value.values():
            parts.extend(_collect_text_parts(item))
        return parts
    return [str(value)]


def _infer_content_skills(*values: Any) -> list[str]:
    corpus = " ".join(part.lower() for value in values for part in _collect_text_parts(value))
    inferred: list[str] = []
    for rule in CONTENT_SKILL_RULES:
        if any(keyword in corpus for keyword in rule["keywords"]):
            inferred.extend(rule["skills"])
    return _clean_string_list(inferred)


def _infer_best_role_from_profile(*values: Any) -> tuple[str | None, float | None]:
    corpus = " ".join(part.lower() for value in values for part in _collect_text_parts(value))
    if any(keyword in corpus for keyword in ["content creator", "content creation", "content writing", "copywriting", "social media"]):
        return "Content Creator", 80.0
    return None, None


def _cv_value(cv_analysis: dict[str, Any], camel_key: str, snake_key: str) -> Any:
    return cv_analysis.get(camel_key, cv_analysis.get(snake_key))


def _safe_number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_string(value: Any, default: str = "") -> str:
    text = str(value).strip() if value is not None else ""
    return text or default


def _freelancer_identity_key(record: dict[str, Any]) -> str:
    email = _safe_string(record.get("freelancerEmail") or record.get("email")).lower()
    if email:
        return f"email:{email}"
    return f"user:{_safe_string(record.get('userId'))}"


def _freelancer_record_quality(record: dict[str, Any]) -> tuple[float, int, int, int, int]:
    return (
        _safe_number(record.get("score") or record.get("roleFitScore")),
        len(set(record.get("matchedSkills") or [])),
        len(record.get("experienceDetails") or []),
        int(record.get("experienceCount") or 0),
        len(set(record.get("projectEvidenceSkills") or [])),
    )


def _dedupe_freelancer_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    indexes_by_key: dict[str, int] = {}
    for record in records:
        key = _freelancer_identity_key(record)
        if not key or key == "user:":
            deduped.append(record)
            continue

        existing_index = indexes_by_key.get(key)
        if existing_index is None:
            indexes_by_key[key] = len(deduped)
            deduped.append(record)
            continue

        if _freelancer_record_quality(record) > _freelancer_record_quality(deduped[existing_index]):
            deduped[existing_index] = record

    return deduped


def _safe_string_list(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []

    cleaned: list[str] = []
    for value in values:
        text = _safe_string(value)
        if text:
            cleaned.append(text[:180])
    return cleaned[:8]


def _add_fact(facts: list[str], fact: str | None) -> None:
    text = _safe_string(fact)
    if text and text not in facts:
        facts.append(text[:240])


def _detail_value(detail: Any, key: str) -> str:
    if isinstance(detail, dict):
        return _safe_string(detail.get(key))
    return ""


def _build_evidence_facts(record: dict[str, Any], candidate_type: str) -> list[str]:
    facts: list[str] = []
    candidate_label = "Project" if candidate_type == "project" else "Freelancer"

    if candidate_type == "project":
        _add_fact(facts, f"Project title: {record.get('projectTitle')}" if record.get("projectTitle") else None)
        _add_fact(facts, f"Project timeline: {record.get('projectTimeline')}" if record.get("projectTimeline") else None)
        if record.get("projectBudget") is not None:
            _add_fact(facts, f"Project budget: {record.get('projectBudget')}")
        else:
            _add_fact(facts, "Project budget is missing, so budget fit cannot be confirmed.")
    else:
        _add_fact(facts, f"Freelancer name: {record.get('freelancerName')}" if record.get("freelancerName") else None)
        _add_fact(facts, f"Freelancer headline: {record.get('freelancerHeadline')}" if record.get("freelancerHeadline") else None)

    for skill in record.get("matchedSkills", [])[:12]:
        _add_fact(facts, f"Matched required skill: {skill}")

    for detail in record.get("projectEvidenceDetails", [])[:12]:
        project = _detail_value(detail, "project")
        technology = _detail_value(detail, "technology")
        if project and technology:
            _add_fact(facts, f"CV project '{project}' used required technology {technology}.")
        elif technology:
            _add_fact(facts, f"CV project evidence used required technology {technology}.")

    for detail in record.get("experienceDetails", [])[:10]:
        company = _detail_value(detail, "company")
        role = _detail_value(detail, "role")
        duration = _detail_value(detail, "duration")
        parts = [part for part in [role, f"at {company}" if company else "", f"for {duration}" if duration else ""] if part]
        if parts:
            _add_fact(facts, "Work experience: " + " ".join(parts) + ".")

    for detail in record.get("certificationDetails", [])[:10]:
        certification = _detail_value(detail, "certification")
        technology = _detail_value(detail, "technology")
        if certification and technology:
            _add_fact(facts, f"Certification '{certification}' covers required technology {technology}.")
        elif certification:
            _add_fact(facts, f"Freelancer has certification '{certification}'.")

    for detail in record.get("publicationDetails", [])[:10]:
        publication = _detail_value(detail, "publication")
        technology = _detail_value(detail, "technology")
        if publication and technology:
            _add_fact(facts, f"Publication '{publication}' uses required technology {technology}.")
        elif publication:
            _add_fact(facts, f"Freelancer has publication '{publication}'.")

    if record.get("bestRole"):
        _add_fact(
            facts,
            f"Freelancer best matched role: {record.get('bestRole')} with confidence {record.get('bestRoleScore')}.",
        )
    else:
        _add_fact(facts, "No confident freelancer role match is available from CV analysis.")

    for skill in record.get("missingSkills", [])[:12]:
        _add_fact(facts, f"Missing required skill evidence: {skill}")
    for skill in record.get("requiredSkills", [])[:12]:
        _add_fact(facts, f"Required skill: {skill}")
    for role in record.get("evidence", {}).get("requiredRoles", [])[:8]:
        _add_fact(facts, f"Project requires role: {role}")

    availability = record.get("freelancerAvailability")
    hourly_rate = record.get("freelancerHourlyRate")
    years = record.get("freelancerYearsOfExperience")
    _add_fact(facts, f"Freelancer availability: {availability}" if availability else "Freelancer availability is missing.")
    _add_fact(facts, f"Freelancer hourly rate: {hourly_rate}" if hourly_rate is not None else "Freelancer hourly rate is missing.")
    _add_fact(facts, f"Freelancer years of experience field: {years}" if years else None)

    for key, value in (record.get("scoreBreakdown") or {}).items():
        _add_fact(facts, f"RecSys {key}: {value}%")

    _add_fact(facts, f"{candidate_label} KBS weighted score: {record.get('score')}%")
    return facts[:40]


def _attach_evidence_facts(records: list[dict[str, Any]], candidate_type: str) -> list[dict[str, Any]]:
    return [
        {**record, "evidenceFacts": _build_evidence_facts(record, candidate_type)}
        for record in records
    ]


def _normalize_llm_evaluation(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None

    fit_score = max(0, min(100, round(_safe_number(raw.get("fitScore")))))
    confidence = _safe_string(raw.get("confidence"), "low").lower()
    if confidence not in {"low", "medium", "high"}:
        confidence = "low"

    recommendation = _safe_string(raw.get("recommendation"), "possible_fit").lower()
    if recommendation not in {"strong_fit", "good_fit", "possible_fit", "not_recommended"}:
        recommendation = "possible_fit"

    reason = _safe_string(raw.get("reason"), "LLM evaluator did not provide a reason.")[:500]

    return {
        "fitScore": fit_score,
        "confidence": confidence,
        "recommendation": recommendation,
        "reason": reason,
        "evidenceUsed": _safe_string_list(raw.get("evidenceUsed")),
        "risks": _safe_string_list(raw.get("risks")),
        "clientQuestions": _safe_string_list(raw.get("clientQuestions")),
    }


def _llm_not_respond_evaluation(
    record: dict[str, Any],
    reason: str = "LLM not respond. Showing KBS-only recommendation for testing.",
    risk: str = "LLM evaluator did not return a usable response.",
) -> dict[str, Any]:
    return {
        "fitScore": round(_safe_number(record.get("score"))),
        "confidence": "low",
        "recommendation": "possible_fit",
        "reason": reason,
        "evidenceUsed": [],
        "risks": [risk],
        "clientQuestions": [],
    }


def _attach_llm_not_respond(
    records: list[dict[str, Any]],
    reason: str = "LLM not respond. Showing KBS-only recommendation for testing.",
    risk: str = "LLM evaluator did not return a usable response.",
) -> list[dict[str, Any]]:
    return [
        {**record, "llmEvaluation": _llm_not_respond_evaluation(record, reason, risk)}
        for record in records
    ]


def _recommendation_evaluator_client() -> Any | None:
    if EVALUATOR_PROVIDER == "glm":
        if ZhipuAI is None or not ZHIPUAI_API_KEY:
            return None
        return ZhipuAI(api_key=ZHIPUAI_API_KEY, timeout=RECOMMENDATION_EVALUATOR_TIMEOUT_SECONDS * 1000)
    if EVALUATOR_PROVIDER == "minimax":
        if OpenAI is None or not MINIMAX_API_KEY:
            return None
        return OpenAI(
            base_url=MINIMAX_BASE_URL.rstrip("/").removesuffix("/chat/completions"),
            api_key=MINIMAX_API_KEY,
            timeout=RECOMMENDATION_EVALUATOR_TIMEOUT_SECONDS,
        )
    if EVALUATOR_PROVIDER == "opencode_go":
        if OpenAI is None or not OPENCODE_GO_API_KEY or not OPENCODE_GO_BASE_URL:
            return None
        return OpenAI(
            base_url=OPENCODE_GO_BASE_URL.rstrip("/").removesuffix("/chat/completions"),
            api_key=OPENCODE_GO_API_KEY,
            timeout=RECOMMENDATION_EVALUATOR_TIMEOUT_SECONDS,
        )
    return None


def _recommendation_evaluator_model() -> str:
    return EVALUATOR_MODEL


def _build_llm_candidate(record: dict[str, Any], index: int, candidate_type: str) -> dict[str, Any]:
    candidate_id = record.get("projectId") if candidate_type == "project" else record.get("userId")
    evidence_facts = record.get("evidenceFacts") or _build_evidence_facts(record, candidate_type)
    return {
        "index": index,
        "candidateId": candidate_id,
        "candidateName": record.get("projectTitle") if candidate_type == "project" else record.get("freelancerName"),
        "kbsWeightedScore": record.get("score"),
        "evidenceFacts": evidence_facts[:10],
        "scoreBreakdown": record.get("scoreBreakdown", {}),
    }


def _evaluate_recommendations_with_llm(
    records: list[dict[str, Any]], candidate_type: str
) -> list[dict[str, Any]]:
    records = _attach_evidence_facts(records, candidate_type)
    evaluator_client = _recommendation_evaluator_client()
    if not records:
        return records

    if evaluator_client is None:
        return _attach_llm_not_respond(records)

    evaluator_limit = max(1, RECOMMENDATION_EVALUATOR_LIMIT)
    batch_size = max(1, RECOMMENDATION_EVALUATOR_BATCH_SIZE)
    evaluatable_records = records[:evaluator_limit]
    id_key = "projectId" if candidate_type == "project" else "userId"

    system_prompt = """
You are an LLM recommendation evaluator for a KBS-backed hiring platform.
Use only the provided evidenceFacts and scoreBreakdown. If evidence is missing, say it is missing. Do not assume or invent skills, companies, projects, deployments, education, availability, rates, or work history.
Return strict JSON with an evaluations array matching each candidate by index or candidateId.
Each evaluation must contain index, candidateId, fitScore, confidence, recommendation, reason, evidenceUsed, risks, and clientQuestions.
fitScore must be an integer from 0 to 100. confidence must be low, medium, or high. recommendation must be strong_fit, good_fit, possible_fit, or not_recommended.
evidenceUsed must cite exact or near-exact strings from evidenceFacts. risks and clientQuestions must be grounded only in missing or weak evidenceFacts.
Keep reason under 160 characters. Return at most 3 evidenceUsed, 2 risks, and 2 clientQuestions per candidate.
""".strip()

    def run_evaluator_batch(
        batch_start: int, batch_records: list[dict[str, Any]]
    ) -> tuple[list[dict[str, Any]], set[str]]:
        candidates = [
            _build_llm_candidate(record, batch_start + index, candidate_type)
            for index, record in enumerate(batch_records)
        ]
        user_payload = {
            "task": "Validate and rerank KBS top candidates using only the evidence below.",
            "candidateType": candidate_type,
            "candidates": candidates,
        }

        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=True)},
            ]
            if EVALUATOR_PROVIDER == "glm":
                response = evaluator_client.chat.completions.create(
                    model=_recommendation_evaluator_model(),
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    thinking={"type": "disabled"},
                )
            else:
                response = evaluator_client.chat.completions.create(
                    model=_recommendation_evaluator_model(),
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.1,
                    max_tokens=RECOMMENDATION_EVALUATOR_MAX_TOKENS,
                )
            content = response.choices[0].message.content or "{}"
            parsed = json.loads(content)
            evaluations = parsed.get("evaluations", [])
            if not isinstance(evaluations, list):
                raise ValueError("LLM response did not include evaluations array")
            return evaluations, set()
        except Exception:
            return [], set(
                _safe_string(record.get(id_key)) for record in batch_records if record.get(id_key)
            )

    evaluations_by_id: dict[str, dict[str, Any]] = {}
    failed_batch_ids: set[str] = set()
    batch_specs = [
        (batch_start, evaluatable_records[batch_start : batch_start + batch_size])
        for batch_start in range(0, len(evaluatable_records), batch_size)
    ]
    if EVALUATOR_PROVIDER == "glm" and len(evaluatable_records) > 1:
        batch_specs = [(index, [record]) for index, record in enumerate(evaluatable_records)]
        with ThreadPoolExecutor(max_workers=min(3, len(batch_specs))) as executor:
            future_to_batch = {
                executor.submit(run_evaluator_batch, batch_start, batch_records): batch_records
                for batch_start, batch_records in batch_specs
            }
            batch_results = []
            for future in as_completed(future_to_batch):
                batch_results.append(future.result())
    else:
        batch_results = [
            run_evaluator_batch(batch_start, batch_records)
            for batch_start, batch_records in batch_specs
        ]

    for evaluations, failed_ids in batch_results:
        failed_batch_ids.update(failed_ids)

        for raw_evaluation in evaluations:
            if not isinstance(raw_evaluation, dict):
                continue

            candidate_id = _safe_string(raw_evaluation.get("candidateId"))
            normalized = _normalize_llm_evaluation(raw_evaluation)
            if candidate_id and normalized:
                evaluations_by_id[candidate_id] = normalized
                continue

            if not normalized:
                continue

            eval_index = raw_evaluation.get("index")
            if isinstance(eval_index, int) and 0 <= eval_index < len(evaluatable_records):
                fallback_id = _safe_string(evaluatable_records[eval_index].get(id_key))
                if fallback_id:
                    evaluations_by_id[fallback_id] = normalized

    if not evaluations_by_id:
        return _attach_llm_not_respond(records)

    enriched: list[dict[str, Any]] = []
    for record in records:
        candidate_id = _safe_string(record.get(id_key))
        evaluation = evaluations_by_id.get(candidate_id)
        if evaluation:
            record = {**record, "llmEvaluation": evaluation}
        elif candidate_id in failed_batch_ids:
            record = {**record, "llmEvaluation": _llm_not_respond_evaluation(record)}
        elif record in evaluatable_records:
            record = {
                **record,
                "llmEvaluation": _llm_not_respond_evaluation(
                    record,
                    "LLM did not return an evaluation for this candidate. Showing KBS-only recommendation.",
                    "LLM response omitted this candidate.",
                ),
            }
        else:
            record = {
                **record,
                "llmEvaluation": _llm_not_respond_evaluation(
                    record,
                    f"LLM evaluator reviews the top {evaluator_limit} KBS candidates only. Showing KBS-only recommendation.",
                    "Candidate was outside the configured LLM evaluator window.",
                ),
            }
        enriched.append(record)

    reranked = sorted(
        enriched[:evaluator_limit],
        key=lambda item: (
            item.get("llmEvaluation", {}).get("fitScore", item.get("score", 0)),
            item.get("score", 0),
        ),
        reverse=True,
    )
    return reranked + enriched[evaluator_limit:]


ROLE_KEYWORDS = [
    {
        "role": "Content Creator",
        "keywords": [
            "content creator",
            "content creation",
            "content writing",
            "copywriting",
            "social media",
            "instagram",
            "tiktok",
            "reels",
            "caption",
            "blog",
            "article",
            "canva",
            "capcut",
        ],
    },
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
        inferred_skills = _infer_content_skills(
            app_skills,
            cv_skills,
            profile.get("headline"),
            profile.get("about"),
            cv_analysis.get("experience"),
            cv_analysis.get("projects"),
            cv_analysis.get("certifications"),
        )
        skills = _clean_string_list(app_skills + cv_skills + inferred_skills)
        cv_best_role = _clean_string(_cv_value(cv_analysis, "bestRole", "best_role"))
        cv_best_score = _cv_value(cv_analysis, "bestScore", "best_score")
        inferred_role, inferred_role_score = _infer_best_role_from_profile(
            skills,
            profile.get("headline"),
            profile.get("about"),
            cv_analysis.get("experience"),
            cv_analysis.get("projects"),
        )
        best_role = cv_best_role
        best_score = cv_best_score
        if not best_role or _safe_number(best_score) <= 0:
            best_role = inferred_role
            best_score = inferred_role_score

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
            "certifications": cv_analysis.get("certifications") or [],
            "publications": cv_analysis.get("publications") or cv_analysis.get("Publications") or [],
            "best_role": best_role,
            "best_score": best_score,
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
            "certificationsCount": len(data["certifications"]),
            "publicationsCount": len(data["publications"]),
        }

    def ingest_project(self, payload: ProjectIngestRequest) -> dict[str, Any]:
        skills = _clean_string_list(
            payload.skills
            + _infer_content_skills(payload.title, payload.description, payload.skills)
        )
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
        requested_limit = max(1, min(payload.limit, 50))
        read_limit = max(requested_limit, RECOMMENDATION_EVALUATOR_LIMIT)
        with self.driver.session() as session:
            records = session.execute_read(
                self._read_job_recommendations,
                payload.userId,
                payload.excludeProjectIds,
                read_limit,
            )

        records = _evaluate_recommendations_with_llm(records, "project")[:requested_limit]

        return {
            "status": "ok",
            "recommendations": records,
        }

    def recommend_freelancers(
        self, payload: ProjectFreelancerRecommendationRequest
    ) -> dict[str, Any]:
        requested_limit = max(1, min(payload.limit, 50))
        read_limit = max(requested_limit * 3, RECOMMENDATION_EVALUATOR_LIMIT)
        with self.driver.session() as session:
            records = session.execute_read(
                self._read_freelancer_recommendations,
                payload.projectId,
                payload.excludeUserIds,
                read_limit,
            )

        records = _dedupe_freelancer_records(records)
        records = _evaluate_recommendations_with_llm(records, "freelancer")[:requested_limit]

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
        candidates = _dedupe_freelancer_records(graph_data["candidates"])
        max_team_size = max(1, min(payload.maxTeamSize, 8))
        limit = max(1, min(payload.limit, 10))
        teams = self._build_skill_coverage_teams(required_skills, candidates, max_team_size, limit)

        return {
            "status": "ok",
            "requiredSkills": required_skills,
            "requiredRoles": graph_data["requiredRoles"],
            "recommendations": teams,
        }

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
            OPTIONAL MATCH (f)-[r:HAS_SKILL|WORKED_AT|STUDIED_AT|MAJORED_IN|CREATED_CV_PROJECT|CREATED_PROJECT|HAS_CERTIFICATION|HAS_PUBLICATION|MATCHES_ROLE]->()
            DELETE r
            """,
            user_id=data["user_id"],
        ).consume()
        tx.run(
            """
            MATCH (f:Freelancer {userId: $user_id})
            OPTIONAL MATCH ()-[r:SKILL_OWNED_BY|EMPLOYED|ALUMNI_OF|DEVELOPED_BY|CERTIFIED_TO|PUBLISHED_BY|SUITABLE_CANDIDATE]->(f)
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
                SET p:Project
                MERGE (f)-[:CREATED_CV_PROJECT]->(p)
                MERGE (f)-[:CREATED_PROJECT]->(p)
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

        for certification in data["certifications"]:
            cert_name = _clean_string(certification.get("name")) if isinstance(certification, dict) else None
            if not cert_name:
                continue
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (c:Certification {name: $cert_name})
                MERGE (f)-[:HAS_CERTIFICATION]->(c)
                MERGE (c)-[:CERTIFIED_TO]->(f)
                """,
                user_id=data["user_id"],
                cert_name=cert_name,
            ).consume()
            for technology in _clean_string_list(certification.get("technologies")):
                tx.run(
                    """
                    MATCH (c:Certification {name: $cert_name})
                    MERGE (s:Skill {name: $technology})
                    MERGE (c)-[:COVERS_TECH]->(s)
                    MERGE (s)-[:COVERED_BY_CERTIFICATION]->(c)
                    """,
                    cert_name=cert_name,
                    technology=technology,
                ).consume()

        for publication in data["publications"]:
            publication_name = _clean_string(publication.get("name")) if isinstance(publication, dict) else None
            if not publication_name:
                continue
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (p:Publication {name: $publication_name})
                MERGE (f)-[:HAS_PUBLICATION]->(p)
                MERGE (p)-[:PUBLISHED_BY]->(f)
                """,
                user_id=data["user_id"],
                publication_name=publication_name,
            ).consume()
            for technology in _clean_string_list(publication.get("technologies")):
                tx.run(
                    """
                    MATCH (p:Publication {name: $publication_name})
                    MERGE (s:Skill {name: $technology})
                    MERGE (p)-[:USES_TECH]->(s)
                    MERGE (s)-[:USED_IN_PUBLICATION]->(p)
                    """,
                    publication_name=publication_name,
                    technology=technology,
                ).consume()

        if data["best_role"] and _safe_number(data.get("best_score")) > 0:
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
              AND p.projectId IS NOT NULL
              AND coalesce(p.status, 'open') = 'open'
              AND NOT p.projectId IN $exclude_project_ids
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH f, p, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(matched:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f, p, requiredSkills, collect(DISTINCT matched.name) AS matchedSkills
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT|CREATED_PROJECT]->(cvProject:CvProject)-[:USED_TECH]->(projectSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f, p, requiredSkills, matchedSkills,
                 collect(DISTINCT projectSkill.name) AS projectEvidenceSkills,
                 [detail IN collect(DISTINCT {project: cvProject.name, technology: projectSkill.name}) WHERE detail.technology IS NOT NULL] AS projectEvidenceDetails
            OPTIONAL MATCH (f)-[:HAS_CERTIFICATION]->(certification:Certification)-[:COVERS_TECH]->(certSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f, p, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 collect(DISTINCT certSkill.name) AS certificationSkills,
                 [detail IN collect(DISTINCT {certification: certification.name, technology: certSkill.name}) WHERE detail.technology IS NOT NULL] AS certificationDetails
            OPTIONAL MATCH (f)-[:HAS_PUBLICATION]->(publication:Publication)-[:USES_TECH]->(publicationSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f, p, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails, certificationSkills, certificationDetails,
                 collect(DISTINCT publicationSkill.name) AS publicationSkills,
                 [detail IN collect(DISTINCT {publication: publication.name, technology: publicationSkill.name}) WHERE detail.technology IS NOT NULL] AS publicationDetails
            OPTIONAL MATCH (p)-[:REQUIRES_ROLE]->(requiredRole:Role)
            WITH f, p, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 certificationSkills, certificationDetails, publicationSkills, publicationDetails,
                 collect(DISTINCT requiredRole.name) AS requiredRoles
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(bestRole:Role)
            WITH f, p, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 certificationSkills, certificationDetails, publicationSkills, publicationDetails,
                 requiredRoles, bestRole, roleMatch,
                 CASE
                   WHEN bestRole IS NULL THEN 0.0
                   WHEN size(requiredRoles) = 0 THEN coalesce(roleMatch.score, 0) * 0.5
                   WHEN any(roleName IN requiredRoles WHERE toLower(bestRole.name) CONTAINS toLower(roleName) OR toLower(roleName) CONTAINS toLower(bestRole.name)) THEN coalesce(roleMatch.score, 70)
                   ELSE coalesce(roleMatch.score, 0) * 0.35
                 END AS roleScore
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            WITH f, p, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 certificationSkills, certificationDetails, publicationSkills, publicationDetails,
                 requiredRoles, bestRole, roleMatch, roleScore,
                 [detail IN collect(DISTINCT {company: company.name, role: worked.role, duration: worked.duration}) WHERE detail.company IS NOT NULL] AS experienceDetails
            WITH f,
                 p,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 certificationSkills,
                 certificationDetails,
                 publicationSkills,
                 publicationDetails,
                 [skill IN requiredSkills WHERE skill IN projectEvidenceSkills OR skill IN certificationSkills OR skill IN publicationSkills] AS evidenceSkills,
                 [skill IN requiredSkills WHERE NOT skill IN matchedSkills] AS missingSkills,
                 requiredRoles,
                 bestRole,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 size(experienceDetails) AS experienceCount
            WITH f,
                 p,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 certificationSkills,
                 certificationDetails,
                 publicationSkills,
                 publicationDetails,
                 evidenceSkills,
                 missingSkills,
                 requiredRoles,
                 bestRole,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 experienceCount,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(matchedSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS skillScore,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(evidenceSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS projectEvidenceScore,
                 CASE
                   WHEN experienceCount >= 2 THEN 100.0
                   WHEN experienceCount = 1 THEN 70.0
                   WHEN f.yearsOfExperience IS NOT NULL THEN 40.0
                   ELSE 0.0
                 END AS experienceScore,
                 CASE WHEN f.availability IS NULL THEN 0.0 ELSE 100.0 END AS availabilityScore,
                 CASE
                   WHEN p.budget IS NULL OR f.hourlyRate IS NULL THEN 0.0
                   WHEN p.budget >= f.hourlyRate * 40 THEN 100.0
                   WHEN p.budget >= f.hourlyRate * 20 THEN 75.0
                   WHEN p.budget >= f.hourlyRate * 10 THEN 50.0
                   ELSE 25.0
                 END AS budgetFitScore
            WITH f, p, requiredSkills, matchedSkills, missingSkills, requiredRoles, bestRole, roleMatch,
                 projectEvidenceSkills, projectEvidenceDetails, certificationSkills, certificationDetails,
                 publicationSkills, publicationDetails, experienceDetails,
                 skillScore, roleScore, experienceScore, projectEvidenceScore, availabilityScore, budgetFitScore,
                 round((skillScore * 0.4 + experienceScore * 0.2 + projectEvidenceScore * 0.2 + roleScore * 0.1 + availabilityScore * 0.05 + budgetFitScore * 0.05) * 10) / 10 AS score
            WHERE score > 0
            RETURN p.projectId AS projectId,
                   p.title AS projectTitle,
                   p.description AS projectDescription,
                   p.budget AS projectBudget,
                   p.timeline AS projectTimeline,
                   f.name AS freelancerName,
                   f.headline AS freelancerHeadline,
                   f.availability AS freelancerAvailability,
                   f.hourlyRate AS freelancerHourlyRate,
                   f.yearsOfExperience AS freelancerYearsOfExperience,
                   score AS score,
                   matchedSkills AS matchedSkills,
                   missingSkills AS missingSkills,
                   requiredSkills AS requiredSkills,
                   bestRole.name AS bestRole,
                   roleMatch.score AS bestRoleScore,
                   {
                     skillScore: skillScore,
                     roleScore: round(roleScore * 10) / 10,
                     experienceScore: experienceScore,
                     projectEvidenceScore: projectEvidenceScore,
                     availabilityScore: availabilityScore,
                     budgetFitScore: budgetFitScore
                   } AS scoreBreakdown,
                   {
                      requiredRoles: requiredRoles,
                      projectEvidenceSkills: projectEvidenceSkills,
                      certificationSkills: certificationSkills,
                      publicationSkills: publicationSkills
                    } AS evidence,
                   projectEvidenceDetails AS projectEvidenceDetails,
                   certificationDetails AS certificationDetails,
                   publicationDetails AS publicationDetails,
                   experienceDetails AS experienceDetails,
                    'KBS weighted match: skills ' + toString(skillScore) + '%, experience ' + toString(experienceScore) + '%, CV/project evidence ' + toString(projectEvidenceScore) + '%, role ' + toString(round(roleScore * 10) / 10) + '%' AS reason
            ORDER BY score DESC, skillScore DESC, projectEvidenceScore DESC, p.syncedAt DESC
            LIMIT $limit
            """,
            user_id=user_id,
            exclude_project_ids=exclude_project_ids,
            limit=limit,
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
            WITH p, f, requiredSkills, collect(DISTINCT matched.name) AS matchedSkills
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT|CREATED_PROJECT]->(cvProject:CvProject)-[:USED_TECH]->(projectSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH p, f, requiredSkills, matchedSkills,
                 collect(DISTINCT projectSkill.name) AS projectEvidenceSkills,
                 [detail IN collect(DISTINCT {project: cvProject.name, technology: projectSkill.name}) WHERE detail.technology IS NOT NULL] AS projectEvidenceDetails
            OPTIONAL MATCH (f)-[:HAS_CERTIFICATION]->(certification:Certification)-[:COVERS_TECH]->(certSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 collect(DISTINCT certSkill.name) AS certificationSkills,
                 [detail IN collect(DISTINCT {certification: certification.name, technology: certSkill.name}) WHERE detail.technology IS NOT NULL] AS certificationDetails
            OPTIONAL MATCH (f)-[:HAS_PUBLICATION]->(publication:Publication)-[:USES_TECH]->(publicationSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails, certificationSkills, certificationDetails,
                 collect(DISTINCT publicationSkill.name) AS publicationSkills,
                 [detail IN collect(DISTINCT {publication: publication.name, technology: publicationSkill.name}) WHERE detail.technology IS NOT NULL] AS publicationDetails
            OPTIONAL MATCH (p)-[:REQUIRES_ROLE]->(requiredRole:Role)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 certificationSkills, certificationDetails, publicationSkills, publicationDetails,
                 collect(DISTINCT requiredRole.name) AS requiredRoles
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 certificationSkills, certificationDetails, publicationSkills, publicationDetails,
                 requiredRoles, role, roleMatch,
                 CASE
                   WHEN role IS NULL THEN 0.0
                   WHEN size(requiredRoles) = 0 THEN coalesce(roleMatch.score, 0) * 0.5
                   WHEN any(roleName IN requiredRoles WHERE toLower(role.name) CONTAINS toLower(roleName) OR toLower(roleName) CONTAINS toLower(role.name)) THEN coalesce(roleMatch.score, 70)
                   ELSE coalesce(roleMatch.score, 0) * 0.35
                 END AS roleScore
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 certificationSkills, certificationDetails, publicationSkills, publicationDetails,
                 requiredRoles, role, roleMatch, roleScore,
                 [detail IN collect(DISTINCT {company: company.name, role: worked.role, duration: worked.duration}) WHERE detail.company IS NOT NULL] AS experienceDetails
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 certificationSkills,
                 certificationDetails,
                 publicationSkills,
                 publicationDetails,
                 [skill IN requiredSkills WHERE skill IN projectEvidenceSkills OR skill IN certificationSkills OR skill IN publicationSkills] AS evidenceSkills,
                 [skill IN requiredSkills WHERE NOT skill IN matchedSkills] AS missingSkills,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 size(experienceDetails) AS experienceCount
            WITH p,
                 f,
                 requiredSkills,
                 matchedSkills,
                 projectEvidenceSkills,
                 projectEvidenceDetails,
                 certificationSkills,
                 certificationDetails,
                 publicationSkills,
                 publicationDetails,
                 evidenceSkills,
                 missingSkills,
                 requiredRoles,
                 role,
                 roleMatch,
                 roleScore,
                 experienceDetails,
                 experienceCount,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(matchedSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS skillScore,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(evidenceSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS projectEvidenceScore,
                 CASE
                   WHEN experienceCount >= 2 THEN 100.0
                   WHEN experienceCount = 1 THEN 70.0
                   WHEN f.yearsOfExperience IS NOT NULL THEN 40.0
                   ELSE 0.0
                 END AS experienceScore,
                 CASE WHEN f.availability IS NULL THEN 0.0 ELSE 100.0 END AS availabilityScore,
                 CASE
                   WHEN p.budget IS NULL OR f.hourlyRate IS NULL THEN 0.0
                   WHEN p.budget >= f.hourlyRate * 40 THEN 100.0
                   WHEN p.budget >= f.hourlyRate * 20 THEN 75.0
                   WHEN p.budget >= f.hourlyRate * 10 THEN 50.0
                   ELSE 25.0
                 END AS budgetFitScore
            WITH p, f, requiredSkills, matchedSkills, missingSkills, requiredRoles, role, roleMatch,
                 projectEvidenceSkills, projectEvidenceDetails, certificationSkills, certificationDetails,
                 publicationSkills, publicationDetails, experienceDetails,
                 skillScore, roleScore, experienceScore, projectEvidenceScore, availabilityScore, budgetFitScore,
                 round((skillScore * 0.4 + experienceScore * 0.2 + projectEvidenceScore * 0.2 + roleScore * 0.1 + availabilityScore * 0.05 + budgetFitScore * 0.05) * 10) / 10 AS score
            WHERE score > 0
            RETURN f.userId AS userId,
                   p.title AS projectTitle,
                   p.description AS projectDescription,
                   p.budget AS projectBudget,
                   p.timeline AS projectTimeline,
                   f.email AS freelancerEmail,
                   f.name AS freelancerName,
                   f.headline AS freelancerHeadline,
                   f.availability AS freelancerAvailability,
                   f.hourlyRate AS freelancerHourlyRate,
                   f.yearsOfExperience AS freelancerYearsOfExperience,
                   score AS score,
                   matchedSkills AS matchedSkills,
                   missingSkills AS missingSkills,
                   requiredSkills AS requiredSkills,
                   role.name AS bestRole,
                   roleMatch.score AS bestRoleScore,
                   {
                     skillScore: skillScore,
                     roleScore: round(roleScore * 10) / 10,
                     experienceScore: experienceScore,
                     projectEvidenceScore: projectEvidenceScore,
                     availabilityScore: availabilityScore,
                     budgetFitScore: budgetFitScore
                   } AS scoreBreakdown,
                   {
                      requiredRoles: requiredRoles,
                      projectEvidenceSkills: projectEvidenceSkills,
                      certificationSkills: certificationSkills,
                      publicationSkills: publicationSkills
                    } AS evidence,
                   projectEvidenceDetails AS projectEvidenceDetails,
                   certificationDetails AS certificationDetails,
                   publicationDetails AS publicationDetails,
                   experienceDetails AS experienceDetails,
                    'KBS weighted match: skills ' + toString(skillScore) + '%, experience ' + toString(experienceScore) + '%, CV/project evidence ' + toString(projectEvidenceScore) + '%, role ' + toString(round(roleScore * 10) / 10) + '%' AS reason
            ORDER BY score DESC, skillScore DESC, projectEvidenceScore DESC, f.syncedAt DESC
            LIMIT $limit
            """,
            project_id=project_id,
            exclude_user_ids=exclude_user_ids,
            limit=limit,
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
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH p, collect(DISTINCT required.name) AS requiredSkills
            MATCH (f:Freelancer)
            WHERE NOT f.userId IN $exclude_user_ids
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(matched:Skill)
            WHERE matched.name IN requiredSkills
            WITH p, f, requiredSkills, collect(DISTINCT matched.name) AS matchedSkills
            WHERE size(matchedSkills) > 0
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT|CREATED_PROJECT]->(:CvProject)-[:USED_TECH]->(projectSkill:Skill)
            WHERE projectSkill.name IN requiredSkills
            WITH p, f, requiredSkills, matchedSkills, collect(DISTINCT projectSkill.name) AS projectEvidenceSkills
            OPTIONAL MATCH (f)-[:HAS_CERTIFICATION]->(:Certification)-[:COVERS_TECH]->(certSkill:Skill)
            WHERE certSkill.name IN requiredSkills
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, collect(DISTINCT certSkill.name) AS certificationSkills
            OPTIONAL MATCH (f)-[:HAS_PUBLICATION]->(:Publication)-[:USES_TECH]->(publicationSkill:Skill)
            WHERE publicationSkill.name IN requiredSkills
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, certificationSkills, collect(DISTINCT publicationSkill.name) AS publicationSkills
            OPTIONAL MATCH (p)-[:REQUIRES_ROLE]->(requiredRole:Role)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, certificationSkills, publicationSkills,
                 collect(DISTINCT requiredRole.name) AS requiredRoles
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, certificationSkills, publicationSkills,
                 requiredRoles, role, roleMatch,
                 CASE
                   WHEN role IS NULL THEN 0.0
                   WHEN size(requiredRoles) = 0 THEN coalesce(roleMatch.score, 0) * 0.5
                   WHEN any(roleName IN requiredRoles WHERE toLower(role.name) CONTAINS toLower(roleName) OR toLower(roleName) CONTAINS toLower(role.name)) THEN coalesce(roleMatch.score, 70)
                   ELSE coalesce(roleMatch.score, 0) * 0.35
                 END AS roleFitScore
            OPTIONAL MATCH (f)-[:WORKED_AT]->(company:Company)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, certificationSkills, publicationSkills,
                 requiredRoles, role, roleMatch, roleFitScore, count(DISTINCT company) AS experienceCount
            OPTIONAL MATCH (f)-[]-(shared)
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, certificationSkills, publicationSkills,
                 role, roleMatch, roleFitScore, experienceCount, shared
            WHERE shared IS NULL
               OR shared:Skill
               OR shared:Institution
               OR shared:Company
               OR shared:CvProject
               OR shared:Project
               OR shared:Role
            WITH p, f, requiredSkills, matchedSkills, projectEvidenceSkills, certificationSkills, publicationSkills,
                 role, roleMatch, roleFitScore, experienceCount,
                 collect(DISTINCT CASE
                   WHEN shared IS NULL THEN null
                   ELSE labels(shared)[0] + ':' + coalesce(shared.name, shared.title, shared.projectId, shared.userId)
                 END) AS affinityEntities
            RETURN f.userId AS userId,
                   f.email AS freelancerEmail,
                   matchedSkills AS matchedSkills,
                   role.name AS bestRole,
                   roleMatch.score AS bestRoleScore,
                   roleFitScore AS roleFitScore,
                   projectEvidenceSkills AS projectEvidenceSkills,
                   certificationSkills AS certificationSkills,
                   publicationSkills AS publicationSkills,
                   experienceCount AS experienceCount,
                   CASE WHEN f.availability IS NULL THEN 0.0 ELSE 100.0 END AS availabilityScore,
                   CASE
                     WHEN p.budget IS NULL OR f.hourlyRate IS NULL THEN 0.0
                     WHEN p.budget >= f.hourlyRate * 40 THEN 100.0
                     WHEN p.budget >= f.hourlyRate * 20 THEN 75.0
                     WHEN p.budget >= f.hourlyRate * 10 THEN 50.0
                     ELSE 25.0
                   END AS budgetFitScore,
                   [entity IN affinityEntities WHERE entity IS NOT NULL] AS affinityEntities
            ORDER BY size(matchedSkills) DESC, roleFitScore DESC, f.syncedAt DESC
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
                candidate.get("roleFitScore") or 0,
                len(set(candidate.get("projectEvidenceSkills", []))),
                candidate.get("bestRoleScore") or 0,
                candidate.get("experienceCount") or 0,
                candidate.get("availabilityScore") or 0,
                candidate.get("budgetFitScore") or 0,
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
                        candidate.get("roleFitScore") or 0,
                        len(set(candidate.get("projectEvidenceSkills", [])) & required_set),
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
            evidence_skills: set[str] = set()
            role_fit_scores: list[float] = []
            experience_scores: list[float] = []
            availability_scores: list[float] = []
            budget_fit_scores: list[float] = []
            contributing_members = 0

            for member in selected:
                member_skills = set(member.get("matchedSkills", [])) & required_set
                if member_skills:
                    contributing_members += 1
                evidence_skills.update(set(member.get("projectEvidenceSkills", [])) & required_set)
                evidence_skills.update(set(member.get("certificationSkills", [])) & required_set)
                evidence_skills.update(set(member.get("publicationSkills", [])) & required_set)
                role_fit_scores.append(float(member.get("roleFitScore") or 0))
                experience_count = member.get("experienceCount") or 0
                if experience_count >= 2:
                    experience_scores.append(100.0)
                elif experience_count == 1:
                    experience_scores.append(70.0)
                else:
                    experience_scores.append(0.0)
                availability_scores.append(float(member.get("availabilityScore") or 0))
                budget_fit_scores.append(float(member.get("budgetFitScore") or 0))

            role_score = round(sum(role_fit_scores) / len(role_fit_scores), 1) if role_fit_scores else 0.0
            project_evidence_score = round((len(evidence_skills) / len(required_set)) * 100, 1)
            experience_score = round(sum(experience_scores) / len(experience_scores), 1) if experience_scores else 0.0
            availability_score = round(sum(availability_scores) / len(availability_scores), 1) if availability_scores else 0.0
            budget_fit_score = round(sum(budget_fit_scores) / len(budget_fit_scores), 1) if budget_fit_scores else 0.0
            complementarity_score = round((contributing_members / len(selected)) * 100, 1) if selected else 0.0
            technical_score = round(
                (coverage_score * 0.45)
                + (role_score * 0.2)
                + (project_evidence_score * 0.2)
                + (experience_score * 0.15),
                2,
            )
            shared_synergy_entities: set[str] = set()
            for index, member in enumerate(selected):
                member_entities = _shared_entity_names(member)
                for other in selected[index + 1 :]:
                    shared_synergy_entities.update(member_entities & _shared_entity_names(other))

            synergy_score = len(shared_synergy_entities)
            shared_context_score = min(100.0, round(synergy_score * 15, 1))
            final_score = round(
                (coverage_score * 0.35)
                + (role_score * 0.15)
                + (project_evidence_score * 0.15)
                + (experience_score * 0.1)
                + (availability_score * 0.075)
                + (budget_fit_score * 0.075)
                + (complementarity_score * 0.05)
                + (shared_context_score * 0.05),
                2,
            )
            teams.append(
                {
                    "score": final_score,
                    "finalScore": final_score,
                    "technicalScore": technical_score,
                    "synergyScore": synergy_score,
                    "sharedContextScore": shared_context_score,
                    "coverageScore": coverage_score,
                    "roleScore": role_score,
                    "projectEvidenceScore": project_evidence_score,
                    "experienceScore": experience_score,
                    "availabilityScore": availability_score,
                    "budgetFitScore": budget_fit_score,
                    "complementarityScore": complementarity_score,
                    "scoreBreakdown": {
                        "coverageScore": coverage_score,
                        "roleScore": role_score,
                        "projectEvidenceScore": project_evidence_score,
                        "experienceScore": experience_score,
                        "availabilityScore": availability_score,
                        "budgetFitScore": budget_fit_score,
                        "complementarityScore": complementarity_score,
                        "sharedContextScore": shared_context_score,
                    },
                    "coveredSkills": [skill for skill in required_skills if skill in covered],
                    "missingSkills": missing,
                    "evidenceSkills": [skill for skill in required_skills if skill in evidence_skills],
                    "sharedEntities": sorted(shared_synergy_entities),
                    "reason": (
                        f"KBS team score {final_score}: coverage {coverage_score}%, "
                        f"role {role_score}%, evidence {project_evidence_score}%, "
                        f"experience {experience_score}%"
                    ),
                    "members": [
                        {
                            "userId": member["userId"],
                            "coveredSkills": [
                                skill for skill in required_skills if skill in set(member.get("matchedSkills", []))
                            ],
                            "evidenceSkills": [
                                skill
                                for skill in required_skills
                                if skill
                                in (
                                    set(member.get("projectEvidenceSkills", []))
                                    | set(member.get("certificationSkills", []))
                                    | set(member.get("publicationSkills", []))
                                )
                            ],
                            "bestRole": member.get("bestRole"),
                            "bestRoleScore": member.get("bestRoleScore"),
                            "roleFitScore": member.get("roleFitScore"),
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-kbs"}


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
