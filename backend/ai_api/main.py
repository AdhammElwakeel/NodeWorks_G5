"""AI/KBS + CV Analysis API service.

This service owns Neo4j writes for the knowledge graph and exposes CV analysis.
The Next.js app keeps MongoDB as the source of truth and calls these endpoints
only when the user manually syncs a freelancer profile or project.
"""

import asyncio
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
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

sys.path.insert(0, str(Path(__file__).parent.parent / "MergedCVAnalyzer-with-KBS"))
from cv_analysis_module import process_cv


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
        "keywords": [
            "mobile",
            "flutter",
            "react native",
            "ios",
            "android",
            "swift",
            "kotlin",
        ],
    },
    {
        "role": "DevOps Engineer",
        "keywords": [
            "docker",
            "kubernetes",
            "aws",
            "azure",
            "gcp",
            "ci/cd",
            "devops",
            "deployment",
        ],
    },
    {
        "role": "UI/UX Designer",
        "keywords": [
            "ux",
            "ui",
            "figma",
            "wireframe",
            "prototype",
            "design",
            "user experience",
        ],
    },
    {
        "role": "QA Engineer",
        "keywords": [
            "qa",
            "test",
            "testing",
            "automation",
            "quality",
            "cypress",
            "playwright",
            "selenium",
        ],
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
            if re.search(
                rf"(?<![a-z0-9]){re.escape(keyword.lower())}(?![a-z0-9])", corpus
            )
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
        cv_skills = _clean_string_list(
            _cv_value(cv_analysis, "allSkills", "all_skills")
        )
        skills = _clean_string_list(app_skills + cv_skills)

        data = {
            "user_id": payload.userId,
            "email": _clean_string(payload.email)
            or _clean_string(_cv_value(cv_analysis, "email", "email")),
            "name": _clean_string(payload.name)
            or _clean_string(_cv_value(cv_analysis, "name", "name")),
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

    def recommend_jobs(
        self, payload: FreelancerJobRecommendationRequest
    ) -> dict[str, Any]:
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

    def recommend_teams(
        self, payload: ProjectTeamRecommendationRequest
    ) -> dict[str, Any]:
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
        teams = self._build_skill_coverage_teams(
            required_skills, candidates, max_team_size, limit
        )

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
            company = (
                _clean_string(exp.get("company")) if isinstance(exp, dict) else None
            )
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
                duration=_clean_string(exp.get("years"))
                if isinstance(exp, dict)
                else None,
            ).consume()

        for edu in data["education"]:
            institution = (
                _clean_string(edu.get("institution")) if isinstance(edu, dict) else None
            )
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
                degree=_clean_string(edu.get("degree"))
                if isinstance(edu, dict)
                else None,
            ).consume()

        for project in data["projects"]:
            project_name = (
                _clean_string(project.get("name"))
                if isinstance(project, dict)
                else None
            )
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
            WITH p,
                 requiredSkills,
                 collect(DISTINCT matched.name) AS matchedSkills
            WITH p,
                 requiredSkills,
                 matchedSkills,
                 [skill IN requiredSkills WHERE NOT skill IN matchedSkills] AS missingSkills
            WITH p,
                 requiredSkills,
                 matchedSkills,
                 missingSkills,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(matchedSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS score
            WHERE score > 0
            RETURN p.projectId AS projectId,
                   score AS score,
                   matchedSkills AS matchedSkills,
                   missingSkills AS missingSkills,
                   requiredSkills AS requiredSkills,
                   'Matched ' + toString(size(matchedSkills)) + ' of ' + toString(size(requiredSkills)) + ' required skills' AS reason
            ORDER BY score DESC, size(matchedSkills) DESC, p.syncedAt DESC
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
            WITH f,
                 requiredSkills,
                 collect(DISTINCT matched.name) AS matchedSkills
            WITH f,
                 requiredSkills,
                 matchedSkills,
                 [skill IN requiredSkills WHERE NOT skill IN matchedSkills] AS missingSkills
            WITH f,
                 requiredSkills,
                 matchedSkills,
                 missingSkills,
                 CASE
                   WHEN size(requiredSkills) = 0 THEN 0.0
                   ELSE round((toFloat(size(matchedSkills)) / size(requiredSkills)) * 1000) / 10
                 END AS score
            WHERE score > 0
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            RETURN f.userId AS userId,
                   score AS score,
                   matchedSkills AS matchedSkills,
                   missingSkills AS missingSkills,
                   requiredSkills AS requiredSkills,
                   role.name AS bestRole,
                   roleMatch.score AS bestRoleScore,
                   'Matched ' + toString(size(matchedSkills)) + ' of ' + toString(size(requiredSkills)) + ' required skills' AS reason
            ORDER BY score DESC, coalesce(roleMatch.score, 0) DESC, f.syncedAt DESC
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
        required_skills: list[str],
        candidates: list[dict[str, Any]],
        max_team_size: int,
        limit: int,
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
                remaining = [
                    candidate
                    for candidate in sorted_candidates
                    if candidate["userId"] not in selected_ids
                ]
                if not remaining:
                    break

                best_candidate = max(
                    remaining,
                    key=lambda candidate: (
                        len(
                            (set(candidate.get("matchedSkills", [])) & required_set)
                            - covered
                        ),
                        len(set(candidate.get("matchedSkills", [])) & required_set),
                        candidate.get("bestRoleScore") or 0,
                    ),
                )
                new_skills = (
                    set(best_candidate.get("matchedSkills", [])) & required_set
                ) - covered
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
                    shared_synergy_entities.update(
                        member_entities & _shared_entity_names(other)
                    )

            synergy_score = len(shared_synergy_entities)
            final_score = round(technical_score + (synergy_score * 0.01), 2)
            teams.append(
                {
                    "score": final_score,
                    "finalScore": final_score,
                    "technicalScore": technical_score,
                    "synergyScore": synergy_score,
                    "coverageScore": coverage_score,
                    "coveredSkills": [
                        skill for skill in required_skills if skill in covered
                    ],
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
                                skill
                                for skill in required_skills
                                if skill in set(member.get("matchedSkills", []))
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-kbs"}


@app.get("/kbs/health")
def kbs_health() -> dict[str, Any]:
    try:
        return {"status": "ok", "service": "neo4j", **kg.check_connection()}
    except Neo4jError as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j unavailable: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j unavailable: {exc}"
        ) from exc


@app.post("/kbs/freelancers/ingest")
def ingest_freelancer(payload: FreelancerIngestRequest) -> dict[str, Any]:
    try:
        return kg.ingest_freelancer(payload)
    except Neo4jError as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j sync failed: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j sync failed: {exc}"
        ) from exc


@app.post("/kbs/projects/ingest")
def ingest_project(payload: ProjectIngestRequest) -> dict[str, Any]:
    try:
        return kg.ingest_project(payload)
    except Neo4jError as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j sync failed: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j sync failed: {exc}"
        ) from exc


@app.post("/recommendations/jobs")
def recommend_jobs(payload: FreelancerJobRecommendationRequest) -> dict[str, Any]:
    try:
        return kg.recommend_jobs(payload)
    except Neo4jError as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j recommendation failed: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j recommendation failed: {exc}"
        ) from exc


@app.post("/recommendations/freelancers")
def recommend_freelancers(
    payload: ProjectFreelancerRecommendationRequest,
) -> dict[str, Any]:
    try:
        return kg.recommend_freelancers(payload)
    except Neo4jError as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j recommendation failed: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j recommendation failed: {exc}"
        ) from exc


@app.post("/recommendations/teams")
def recommend_teams(payload: ProjectTeamRecommendationRequest) -> dict[str, Any]:
    try:
        return kg.recommend_teams(payload)
    except Neo4jError as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j team formation failed: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Neo4j team formation failed: {exc}"
        ) from exc
