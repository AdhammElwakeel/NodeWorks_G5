import asyncio
import os
import re
import sys
import time
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


ROOT_DIR = Path(__file__).resolve().parents[2]
CV_BACKEND_DIR = ROOT_DIR / "backend" / "MergedCVAnalyzer-with-KBS"
load_dotenv(dotenv_path=ROOT_DIR / ".env")
load_dotenv(dotenv_path=ROOT_DIR / "frontend" / ".env")

sys.path.insert(0, str(CV_BACKEND_DIR))
from cv_analysis_module import process_cv  # noqa: E402
from cv_analysis_module.config import TECH_ROLES  # noqa: E402


RECOMMENDATION_MIN_SCORE = float(os.getenv("RECOMMENDATION_MIN_SCORE", "0"))


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


ROLE_KEYWORDS = {
    "Frontend Developer": ["react", "next.js", "vue", "angular", "frontend", "ui", "tailwind"],
    "Backend Developer": ["node", "express", "django", "fastapi", "spring", "api", "backend", "server"],
    "AI Engineer": ["ai", "machine learning", "deep learning", "nlp", "computer vision", "llm"],
    "Data Engineer": ["data", "etl", "pipeline", "spark", "analytics", "warehouse"],
    "Mobile Developer": ["mobile", "flutter", "react native", "ios", "android"],
    "DevOps Engineer": ["docker", "kubernetes", "aws", "ci/cd", "devops", "deployment"],
    "UI/UX Designer": ["ux", "ui", "figma", "wireframe", "prototype", "design"],
}


def _derive_project_roles(title: str | None, description: str | None, skills: list[str]) -> list[dict[str, Any]]:
    corpus = f"{title or ''} {description or ''} {' '.join(skills)}".lower()
    roles: list[dict[str, Any]] = []

    for role, keywords in ROLE_KEYWORDS.items():
        matched = [keyword for keyword in keywords if keyword in corpus]
        if matched:
            roles.append({"name": role, "count": 2 if len(matched) >= 5 else 1, "matchedKeywords": matched})

    if not roles and skills:
        roles.append({"name": "Technical Freelancer", "count": 1, "matchedKeywords": skills[:6]})
    return roles


def suggest_project_skills(payload: ProjectSkillSuggestionRequest) -> list[str]:
    title = _clean_string(payload.title)
    description = _clean_string(payload.description)
    if not title or not description:
        raise ValueError("Project title and description are required")

    corpus = f"{title} {description}".lower()
    existing = {skill.lower() for skill in _clean_string_list(payload.skills)}
    scored: dict[str, float] = {}

    for role, role_skills in TECH_ROLES.items():
        role_score = 0.0
        role_terms = re.split(r"[^a-z0-9+#.]+", role.lower())
        role_score += sum(2.0 for term in role_terms if len(term) > 2 and term in corpus)

        for skill in role_skills:
            if skill.lower() in corpus:
                role_score += 3.0

        if role_score <= 0:
            continue

        for skill in role_skills:
            key = skill.lower()
            if key in existing:
                continue
            scored[skill] = scored.get(skill, 0.0) + role_score + (4.0 if key in corpus else 0.0)

    suggestions = sorted(scored, key=lambda skill: (-scored[skill], skill.lower()))
    return suggestions[:10]


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
        return {"connected": bool(result and result["ok"] == 1)}

    def ensure_constraints(self) -> None:
        queries = [
            "CREATE CONSTRAINT freelancer_user_id IF NOT EXISTS FOR (f:Freelancer) REQUIRE f.userId IS UNIQUE",
            "CREATE CONSTRAINT client_user_id IF NOT EXISTS FOR (c:Client) REQUIRE c.userId IS UNIQUE",
            "CREATE CONSTRAINT client_project_id IF NOT EXISTS FOR (p:ClientProject) REQUIRE p.projectId IS UNIQUE",
            "CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE",
            "CREATE CONSTRAINT role_name IF NOT EXISTS FOR (r:Role) REQUIRE r.name IS UNIQUE",
        ]
        with self.driver.session() as session:
            for query in queries:
                session.run(query).consume()

    def ingest_freelancer(self, payload: FreelancerIngestRequest) -> dict[str, Any]:
        profile = payload.profile or {}
        cv_analysis = profile.get("cvAnalysis") or {}
        skills = _clean_string_list(
            _clean_string_list(profile.get("skills")) + _clean_string_list(_cv_value(cv_analysis, "allSkills", "all_skills"))
        )
        data = {
            "user_id": payload.userId,
            "email": _clean_string(payload.email) or _clean_string(_cv_value(cv_analysis, "email", "email")),
            "name": _clean_string(payload.name) or _clean_string(_cv_value(cv_analysis, "name", "name")),
            "headline": _clean_string(profile.get("headline")),
            "country": _clean_string(profile.get("country")),
            "experience_level": _clean_string(profile.get("experienceLevel")),
            "years_of_experience": _clean_string(_cv_value(cv_analysis, "yearsOfExperience", "years of experience")),
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
            "skillsCount": len(skills),
            "experienceCount": len(data["experience"]),
            "educationCount": len(data["education"]),
            "projectsCount": len(data["projects"]),
        }

    def ingest_project(self, payload: ProjectIngestRequest) -> dict[str, Any]:
        skills = _clean_string_list(payload.skills)
        roles = _derive_project_roles(payload.title, payload.description, skills)
        data = {
            "project_id": payload.projectId,
            "client_id": payload.clientId,
            "title": _clean_string(payload.title),
            "description": _clean_string(payload.description),
            "budget": payload.budget,
            "skills": skills,
            "status": _clean_string(payload.status) or "open",
            "timeline": _clean_string(payload.timeline),
            "created_at": _clean_string(payload.createdAt),
            "updated_at": _clean_string(payload.updatedAt),
            "roles": roles,
            "team_size": sum(role["count"] for role in roles) or 1,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }
        self.ensure_constraints()
        with self.driver.session() as session:
            session.execute_write(self._write_project, data)

        return {
            "status": "synced",
            "entityType": "project",
            "entityId": payload.projectId,
            "skillsCount": len(skills),
            "roles": roles,
            "teamSize": data["team_size"],
        }

    def recommend_jobs(self, payload: FreelancerJobRecommendationRequest) -> dict[str, Any]:
        with self.driver.session() as session:
            records = session.execute_read(
                self._read_job_recommendations,
                payload.userId,
                payload.excludeProjectIds,
                max(1, min(payload.limit, 50)),
            )
        return {"status": "ok", "recommendations": records}

    def recommend_freelancers(self, payload: ProjectFreelancerRecommendationRequest) -> dict[str, Any]:
        with self.driver.session() as session:
            records = session.execute_read(
                self._read_freelancer_recommendations,
                payload.projectId,
                payload.excludeUserIds,
                max(1, min(payload.limit, 50)),
            )
        return {"status": "ok", "recommendations": records}

    def recommend_teams(self, payload: ProjectTeamRecommendationRequest) -> dict[str, Any]:
        with self.driver.session() as session:
            graph_data = session.execute_read(self._read_team_candidates, payload.projectId, payload.excludeUserIds)
        teams = self._build_teams(
            graph_data["requiredSkills"],
            graph_data["candidates"],
            max(1, min(payload.maxTeamSize, 8)),
            max(1, min(payload.limit, 10)),
        )
        return {
            "status": "ok",
            "requiredSkills": graph_data["requiredSkills"],
            "requiredRoles": graph_data["requiredRoles"],
            "recommendations": teams,
        }

    @staticmethod
    def _write_freelancer(tx: Any, data: dict[str, Any]) -> None:
        tx.run(
            """
            MERGE (f:Freelancer {userId: $user_id})
            SET f.email = $email, f.name = $name, f.headline = $headline,
                f.country = $country, f.experienceLevel = $experience_level,
                f.yearsOfExperience = $years_of_experience, f.about = $about,
                f.hourlyRate = $hourly_rate, f.availability = $availability,
                f.syncedAt = $synced_at
            """,
            **data,
        ).consume()
        tx.run("MATCH (f:Freelancer {userId: $user_id})-[r:HAS_SKILL|WORKED_AT|STUDIED_AT|CREATED_CV_PROJECT|MATCHES_ROLE]->() DELETE r", user_id=data["user_id"]).consume()
        tx.run("MATCH ()-[r:SKILL_OWNED_BY|EMPLOYED|ALUMNI_OF|DEVELOPED_BY|SUITABLE_CANDIDATE]->(f:Freelancer {userId: $user_id}) DELETE r", user_id=data["user_id"]).consume()

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
            if not isinstance(exp, dict):
                continue
            company = _clean_string(exp.get("company"))
            if not company:
                continue
            tx.run(
                """
                MATCH (f:Freelancer {userId: $user_id})
                MERGE (c:Company {name: $company})
                MERGE (f)-[worked:WORKED_AT]->(c)
                SET worked.role = $role, worked.duration = $duration
                MERGE (c)-[employed:EMPLOYED]->(f)
                SET employed.asRole = $role, employed.duration = $duration
                """,
                user_id=data["user_id"],
                company=company,
                role=_clean_string(exp.get("role")),
                duration=_clean_string(exp.get("years")),
            ).consume()

        for edu in data["education"]:
            if not isinstance(edu, dict):
                continue
            institution = _clean_string(edu.get("institution"))
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
                degree=_clean_string(edu.get("degree")),
            ).consume()

        for project in data["projects"]:
            if not isinstance(project, dict):
                continue
            project_name = _clean_string(project.get("name"))
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
            SET p:Project, p.title = $title, p.name = $title,
                p.description = $description, p.summary = $description,
                p.budget = $budget, p.status = $status, p.timeline = $timeline,
                p.team_size = $team_size, p.createdAt = $created_at,
                p.updatedAt = $updated_at, p.clientId = $client_id,
                p.syncedAt = $synced_at
            MERGE (c)-[:POSTED]->(p)
            """,
            **data,
        ).consume()
        tx.run("MATCH (p:ClientProject {projectId: $project_id})-[r:REQUIRES_SKILL|REQUIRES_ROLE]->() DELETE r", project_id=data["project_id"]).consume()
        tx.run("MATCH ()-[r:REQUIRED_BY]->(p:ClientProject {projectId: $project_id}) DELETE r", project_id=data["project_id"]).consume()

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

        for role in data["roles"]:
            tx.run(
                """
                MATCH (p:ClientProject {projectId: $project_id})
                MERGE (r:Role {name: $role_name})
                MERGE (p)-[requires:REQUIRES_ROLE]->(r)
                SET requires.count = $count, requires.matchedKeywords = $matched_keywords
                """,
                project_id=data["project_id"],
                role_name=role["name"],
                count=role["count"],
                matched_keywords=role["matchedKeywords"],
            ).consume()

    @staticmethod
    def _read_job_recommendations(tx: Any, user_id: str, exclude_project_ids: list[str], limit: int) -> list[dict[str, Any]]:
        result = tx.run(
            """
            MATCH (f:Freelancer {userId: $user_id})
            MATCH (p:ClientProject)
            WHERE coalesce(p.status, 'open') = 'open' AND NOT p.projectId IN $exclude_project_ids
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH f, p, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(matched:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f, p, requiredSkills, collect(DISTINCT matched.name) AS matchedSkills
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT]->(cvProject:CvProject)-[:USED_TECH]->(projectSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f, p, requiredSkills, matchedSkills, collect(DISTINCT projectSkill.name) AS projectEvidenceSkills,
                 [detail IN collect(DISTINCT {project: cvProject.name, technology: projectSkill.name}) WHERE detail.technology IS NOT NULL] AS projectEvidenceDetails
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            WITH p, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 [detail IN collect(DISTINCT {company: company.name, role: worked.role, duration: worked.duration}) WHERE detail.company IS NOT NULL] AS experienceDetails
            WITH p, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails, experienceDetails,
                 [skill IN requiredSkills WHERE NOT skill IN matchedSkills] AS missingSkills,
                 CASE WHEN size(requiredSkills) = 0 THEN 0.0 ELSE round((toFloat(size(matchedSkills)) / size(requiredSkills)) * 1000) / 10 END AS skillScore,
                 CASE WHEN size(requiredSkills) = 0 THEN 0.0 ELSE round((toFloat(size([skill IN requiredSkills WHERE skill IN projectEvidenceSkills])) / size(requiredSkills)) * 1000) / 10 END AS projectEvidenceScore,
                 CASE WHEN size(experienceDetails) >= 2 THEN 80.0 WHEN size(experienceDetails) = 1 THEN 60.0 ELSE 0.0 END AS experienceScore
            WITH p, requiredSkills, matchedSkills, missingSkills, projectEvidenceSkills, projectEvidenceDetails, experienceDetails, skillScore, projectEvidenceScore, experienceScore,
                 round((skillScore * 0.55 + projectEvidenceScore * 0.25 + experienceScore * 0.20) * 10) / 10 AS score
            WHERE score >= $min_score
            RETURN p.projectId AS projectId, score, matchedSkills, missingSkills, requiredSkills,
                   null AS bestRole, null AS bestRoleScore,
                   {skillScore: skillScore, projectEvidenceScore: projectEvidenceScore, experienceScore: experienceScore} AS scoreBreakdown,
                   {projectEvidenceSkills: projectEvidenceSkills} AS evidence,
                   projectEvidenceDetails, experienceDetails, [] AS relevantExperienceDetails,
                   'Recommended from graph skill overlap and CV evidence.' AS reason
            ORDER BY score DESC, p.syncedAt DESC
            LIMIT $limit
            """,
            user_id=user_id,
            exclude_project_ids=exclude_project_ids,
            limit=limit,
            min_score=RECOMMENDATION_MIN_SCORE,
        )
        return [dict(record) for record in result]

    @staticmethod
    def _read_freelancer_recommendations(tx: Any, project_id: str, exclude_user_ids: list[str], limit: int) -> list[dict[str, Any]]:
        result = tx.run(
            """
            MATCH (p:ClientProject {projectId: $project_id})
            MATCH (f:Freelancer)
            WHERE NOT f.userId IN $exclude_user_ids
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH p, f, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (f)-[:HAS_SKILL]->(matched:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH p, f, requiredSkills, collect(DISTINCT matched.name) AS matchedSkills
            OPTIONAL MATCH (f)-[:CREATED_CV_PROJECT]->(cvProject:CvProject)-[:USED_TECH]->(projectSkill:Skill)<-[:REQUIRES_SKILL]-(p)
            WITH f, requiredSkills, matchedSkills, collect(DISTINCT projectSkill.name) AS projectEvidenceSkills,
                 [detail IN collect(DISTINCT {project: cvProject.name, technology: projectSkill.name}) WHERE detail.technology IS NOT NULL] AS projectEvidenceDetails
            OPTIONAL MATCH (f)-[worked:WORKED_AT]->(company:Company)
            WITH f, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails,
                 [detail IN collect(DISTINCT {company: company.name, role: worked.role, duration: worked.duration}) WHERE detail.company IS NOT NULL] AS experienceDetails
            WITH f, requiredSkills, matchedSkills, projectEvidenceSkills, projectEvidenceDetails, experienceDetails,
                 [skill IN requiredSkills WHERE NOT skill IN matchedSkills] AS missingSkills,
                 CASE WHEN size(requiredSkills) = 0 THEN 0.0 ELSE round((toFloat(size(matchedSkills)) / size(requiredSkills)) * 1000) / 10 END AS skillScore,
                 CASE WHEN size(requiredSkills) = 0 THEN 0.0 ELSE round((toFloat(size([skill IN requiredSkills WHERE skill IN projectEvidenceSkills])) / size(requiredSkills)) * 1000) / 10 END AS projectEvidenceScore,
                 CASE WHEN size(experienceDetails) >= 2 THEN 80.0 WHEN size(experienceDetails) = 1 THEN 60.0 ELSE 0.0 END AS experienceScore
            WITH f, requiredSkills, matchedSkills, missingSkills, projectEvidenceSkills, projectEvidenceDetails, experienceDetails, skillScore, projectEvidenceScore, experienceScore,
                 round((skillScore * 0.55 + projectEvidenceScore * 0.25 + experienceScore * 0.20) * 10) / 10 AS score
            WHERE score >= $min_score
            RETURN f.userId AS userId, score, matchedSkills, missingSkills, requiredSkills,
                   null AS bestRole, null AS bestRoleScore,
                   {skillScore: skillScore, projectEvidenceScore: projectEvidenceScore, experienceScore: experienceScore} AS scoreBreakdown,
                   {projectEvidenceSkills: projectEvidenceSkills} AS evidence,
                   projectEvidenceDetails, experienceDetails, [] AS relevantExperienceDetails,
                   'Recommended from graph skill overlap and CV evidence.' AS reason
            ORDER BY score DESC, f.syncedAt DESC
            LIMIT $limit
            """,
            project_id=project_id,
            exclude_user_ids=exclude_user_ids,
            limit=limit,
            min_score=RECOMMENDATION_MIN_SCORE,
        )
        return [dict(record) for record in result]

    @staticmethod
    def _read_team_candidates(tx: Any, project_id: str, exclude_user_ids: list[str]) -> dict[str, Any]:
        project = tx.run(
            """
            MATCH (p:ClientProject {projectId: $project_id})
            OPTIONAL MATCH (p)-[:REQUIRES_SKILL]->(required:Skill)
            WITH p, collect(DISTINCT required.name) AS requiredSkills
            OPTIONAL MATCH (p)-[roleRequirement:REQUIRES_ROLE]->(role:Role)
            WITH requiredSkills, collect(DISTINCT CASE WHEN role IS NULL THEN null ELSE {name: role.name, count: roleRequirement.count} END) AS requiredRoles
            RETURN requiredSkills, [role IN requiredRoles WHERE role IS NOT NULL] AS requiredRoles
            """,
            project_id=project_id,
        ).single()
        required_skills = project["requiredSkills"] if project else []
        required_roles = project["requiredRoles"] if project else []
        candidates = tx.run(
            """
            MATCH (p:ClientProject {projectId: $project_id})-[:REQUIRES_SKILL]->(required:Skill)
            MATCH (f:Freelancer)-[:HAS_SKILL]->(required)
            WHERE NOT f.userId IN $exclude_user_ids
            OPTIONAL MATCH (f)-[roleMatch:MATCHES_ROLE]->(role:Role)
            RETURN f.userId AS userId, collect(DISTINCT required.name) AS matchedSkills,
                   role.name AS bestRole, roleMatch.score AS bestRoleScore, [] AS affinityEntities
            ORDER BY size(matchedSkills) DESC, coalesce(roleMatch.score, 0) DESC
            """,
            project_id=project_id,
            exclude_user_ids=exclude_user_ids,
        )
        return {"requiredSkills": required_skills, "requiredRoles": required_roles, "candidates": [dict(record) for record in candidates]}

    @staticmethod
    def _build_teams(required_skills: list[str], candidates: list[dict[str, Any]], max_team_size: int, limit: int) -> list[dict[str, Any]]:
        if not required_skills or not candidates:
            return []
        required_set = set(required_skills)
        sorted_candidates = sorted(candidates, key=lambda item: len(set(item.get("matchedSkills", [])) & required_set), reverse=True)
        teams: list[dict[str, Any]] = []
        seen: set[tuple[str, ...]] = set()

        for seed in sorted_candidates[: max(limit * 3, limit)]:
            selected = [seed]
            covered = set(seed.get("matchedSkills", [])) & required_set
            while len(selected) < max_team_size and covered != required_set:
                selected_ids = {member["userId"] for member in selected}
                remaining = [item for item in sorted_candidates if item["userId"] not in selected_ids]
                if not remaining:
                    break
                best = max(remaining, key=lambda item: len((set(item.get("matchedSkills", [])) & required_set) - covered))
                new_skills = (set(best.get("matchedSkills", [])) & required_set) - covered
                if not new_skills:
                    break
                selected.append(best)
                covered.update(new_skills)

            key = tuple(sorted(member["userId"] for member in selected))
            if key in seen:
                continue
            seen.add(key)
            missing = [skill for skill in required_skills if skill not in covered]
            coverage_score = round((len(covered) / len(required_set)) * 100, 1)
            technical_score = round(sum(len(set(member.get("matchedSkills", [])) & required_set) for member in selected), 2)
            final_score = round(technical_score + coverage_score / 100, 2)
            teams.append(
                {
                    "score": final_score,
                    "finalScore": final_score,
                    "technicalScore": technical_score,
                    "synergyScore": 0,
                    "coverageScore": coverage_score,
                    "coveredSkills": [skill for skill in required_skills if skill in covered],
                    "missingSkills": missing,
                    "sharedEntities": [],
                    "reason": f"Covers {len(covered)} of {len(required_set)} required skills.",
                    "members": [
                        {
                            "userId": member["userId"],
                            "coveredSkills": [skill for skill in required_skills if skill in set(member.get("matchedSkills", []))],
                            "bestRole": member.get("bestRole"),
                            "bestRoleScore": member.get("bestRoleScore"),
                        }
                        for member in selected
                    ],
                }
            )
        return sorted(teams, key=lambda team: (team["coverageScore"], team["finalScore"]), reverse=True)[:limit]


app = FastAPI(title="Graduation Project AI/KBS API", version="1.0.0")
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-kbs"}


@app.post("/api/analyze-cv")
async def analyze_cv(file: UploadFile = File(...)):
    started_at = time.monotonic()
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted. Please upload a .pdf file.")
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    print(
        f"CV_ANALYZE_START filename={file.filename!r} size={len(pdf_bytes)} provider={os.getenv('CV_ANALYSIS_PROVIDER', 'opencode_go')} model={os.getenv('CV_ANALYSIS_MODEL', 'deepseek-v4-flash')}",
        flush=True,
    )
    try:
        result = await asyncio.wait_for(asyncio.to_thread(process_cv, pdf_bytes), timeout=75)
    except asyncio.TimeoutError as exc:
        elapsed_ms = round((time.monotonic() - started_at) * 1000)
        print(f"CV_ANALYZE_TIMEOUT filename={file.filename!r} elapsedMs={elapsed_ms}", flush=True)
        raise HTTPException(
            status_code=504,
            detail={
                "error": "CV analysis timed out while waiting for the configured AI provider.",
                "provider": os.getenv("CV_ANALYSIS_PROVIDER", "opencode_go"),
                "model": os.getenv("CV_ANALYSIS_MODEL", "deepseek-v4-flash"),
                "elapsedMs": elapsed_ms,
            },
        ) from exc

    elapsed_ms = round((time.monotonic() - started_at) * 1000)
    print(f"CV_ANALYZE_DONE filename={file.filename!r} elapsedMs={elapsed_ms} hasError={'error' in result}", flush=True)
    if "error" in result:
        raise HTTPException(
            status_code=422,
            detail={
                "error": result["error"],
                "provider": result.get("provider", os.getenv("CV_ANALYSIS_PROVIDER", "opencode_go")),
                "model": result.get("model", os.getenv("CV_ANALYSIS_MODEL", "deepseek-v4-flash")),
                "responsePreview": result.get("response_preview"),
                "elapsedMs": elapsed_ms,
            },
        )
    return JSONResponse(content=result)


@app.post("/projects/suggest-skills")
async def suggest_skills(payload: ProjectSkillSuggestionRequest) -> dict[str, list[str]]:
    try:
        return {"skills": suggest_project_skills(payload)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/kbs/health")
def kbs_health() -> dict[str, Any]:
    try:
        return {"status": "ok", "service": "neo4j", **kg.check_connection()}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j unavailable: {exc}") from exc


@app.post("/kbs/freelancers/ingest")
def ingest_freelancer(payload: FreelancerIngestRequest) -> dict[str, Any]:
    try:
        return kg.ingest_freelancer(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j sync failed: {exc}") from exc


@app.post("/kbs/projects/ingest")
def ingest_project(payload: ProjectIngestRequest) -> dict[str, Any]:
    try:
        return kg.ingest_project(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j sync failed: {exc}") from exc


@app.post("/recommendations/jobs")
def recommend_jobs(payload: FreelancerJobRecommendationRequest) -> dict[str, Any]:
    try:
        return kg.recommend_jobs(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j recommendation failed: {exc}") from exc


@app.post("/recommendations/freelancers")
def recommend_freelancers(payload: ProjectFreelancerRecommendationRequest) -> dict[str, Any]:
    try:
        return kg.recommend_freelancers(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j recommendation failed: {exc}") from exc


@app.post("/recommendations/teams")
def recommend_teams(payload: ProjectTeamRecommendationRequest) -> dict[str, Any]:
    try:
        return kg.recommend_teams(payload)
    except Neo4jError as exc:
        raise HTTPException(status_code=503, detail=f"Neo4j team formation failed: {exc}") from exc
