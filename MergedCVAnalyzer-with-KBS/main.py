import sys
import json
import hashlib
from pathlib import Path
from cv_analysis_module import process_cv
import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

FILE_PATH    = BASE_DIR / "CVs pdf"
CVS_JSON_DIR = BASE_DIR / "CVs Json"

CVS_JSON_DIR.mkdir(exist_ok=True)


class KnowledgeGraphBuilder:
    def __init__(self):
        uri      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
        user     = os.getenv("NEO4J_USER",     "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def ingest_cv_data(self, cv_json):
        with self.driver.session() as session:

            # 1. Freelancer node
            session.run("""
                MERGE (f:Freelancer {kbs_id: $kbs_id})
                SET f.name = $name, f.email = $email, f.phone = $phone
            """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'), name=cv_json['name'],
                 phone=cv_json.get('phone'))

            # 2. Tech Skills  (bidirectional)
            for skill in cv_json.get('all_skills', []):
                session.run("""
                    MATCH (f:Freelancer {kbs_id: $kbs_id})
                    MERGE (s:Skill {name: $skill_name})
                    MERGE (f)-[:HAS_SKILL]->(s)
                    MERGE (s)-[:SKILL_OWNED_BY]->(f)
                """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'), skill_name=skill)

            # 3. Domain Knowledge  (bidirectional)
            #    Stored as a separate Domain node so the recommender can
            #    match client project keywords against domain expertise,
            #    not just tech skills.
            session.run("""
                MATCH (f:Freelancer {kbs_id: $kbs_id})-[r:HAS_DOMAIN]->()
                DELETE r
            """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'))

            for domain in cv_json.get('domain_knowledge', []):
                if domain and domain.strip():
                    session.run("""
                        MATCH (f:Freelancer {kbs_id: $kbs_id})
                        MERGE (d:Domain {name: $domain_name})
                        MERGE (f)-[:HAS_DOMAIN]->(d)
                        MERGE (d)-[:DOMAIN_OF]->(f)
                    """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'), domain_name=domain.strip())

            # 4. Experience  (bidirectional)
            for exp in cv_json.get('experience', []):
                session.run("""
                    MATCH (f:Freelancer {kbs_id: $kbs_id})
                    MERGE (c:Company {name: $company})
                    MERGE (f)-[:WORKED_AT {role: $role, duration: $years}]->(c)
                    MERGE (c)-[:EMPLOYED {as_role: $role, for_duration: $years}]->(f)
                """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'), company=exp['company'],
                     role=exp['role'], years=exp.get('years'))

            # 5. Education  (bidirectional)
            for edu in cv_json.get('education', []):
                session.run("""
                    MATCH (f:Freelancer {kbs_id: $kbs_id})
                    MERGE (i:Institution {name: $institution})
                    MERGE (f)-[:STUDIED_AT {degree: $degree}]->(i)
                    MERGE (i)-[:ALUMNI_OF {degree_awarded: $degree}]->(f)
                """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'), institution=edu['institution'],
                     degree=edu['degree'])

            # 6. Projects + tech stack  (bidirectional)
            for proj in cv_json.get('projects', []):
                session.run("""
                    MATCH (f:Freelancer {kbs_id: $kbs_id})
                    MERGE (p:Project {name: $p_name, owner_kbs_id: $kbs_id})
                    MERGE (f)-[:CREATED_PROJECT]->(p)
                    MERGE (p)-[:DEVELOPED_BY]->(f)
                """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'), p_name=proj['name'])

                for tech in proj.get('technologies', []):
                    session.run("""
                        MATCH (p:Project {name: $p_name, owner_kbs_id: $kbs_id})
                        MERGE (s:Skill {name: $tech})
                        MERGE (p)-[:USED_TECH]->(s)
                        MERGE (s)-[:USED_IN]->(p)
                    """, kbs_id=cv_json['kbs_id'], p_name=proj['name'], tech=tech)

            # 7. ALL role rankings (delete stale edges first)
            session.run("""
                MATCH (f:Freelancer {kbs_id: $kbs_id})-[r:MATCHES_ROLE]->()
                DELETE r
            """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'))

            for ranking in cv_json.get('role_rankings', []):
                role_name = ranking.get('role')
                score     = ranking.get('score', 0)
                if role_name and score > 0:
                    session.run("""
                        MATCH (f:Freelancer {kbs_id: $kbs_id})
                        MERGE (r:Role {name: $role})
                        MERGE (f)-[:MATCHES_ROLE {score: $score}]->(r)
                        MERGE (r)-[:SUITABLE_CANDIDATE {score: $score}]->(f)
                    """, kbs_id=cv_json['kbs_id'], email=cv_json.get('email'), role=role_name, score=score)

            stored_roles   = len([r for r in cv_json.get('role_rankings', []) if r.get('score', 0) > 0])
            stored_domains = len(cv_json.get('domain_knowledge', []))
            print(f"✅ Ingested {cv_json['name']}  ({stored_roles} roles, {stored_domains} domains stored)")


def analyze_cv(cv_file: Path):
    print(f"\n🚀 Starting System...")
    print(f"📂 Target File: {cv_file.absolute()}")

    if not cv_file.exists():
        print("❌ Error: File not found.")
        return None

    print("📖 Reading file into bytes...")
    with open(cv_file, "rb") as f:
        pdf_bytes = f.read()

    print("🧠 Sending to AI & Scoring Engine...")
    result = process_cv(pdf_bytes)

    if "error" in result:
        print(f"\n❌ FAILED: {result['error']}")
        return None

    print("\n" + "=" * 50)
    print(f"👤 CANDIDATE: {result.get('name')}")
    print(f"📧 EMAIL:     {result.get('email')}")
    print("=" * 50)
    print(f"\n🏆 BEST ROLE MATCH: {result.get('best_role')}")
    print(f"📊 CONFIDENCE:      {result.get('best_score')}%")
    print("\n📜 TOP 3 ROLE RANKINGS:")
    for rank in result.get('role_rankings', [])[:3]:
        print(f"   - {rank['role']:<35} : {rank['score']}%")
    print(f"\n🌐 DOMAINS ({len(result.get('domain_knowledge', []))}):")
    for d in result.get('domain_knowledge', []):
        print(f"   - {d}")

    output_file = CVS_JSON_DIR / (cv_file.stem + "_result.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=4, ensure_ascii=False)
    print(f"\n💾 Results saved to: {output_file}")
    return result


if __name__ == "__main__":
    if FILE_PATH.is_dir():
        print(f"Analyzing multiple CV files in directory: {FILE_PATH}")
        for pdf_file in FILE_PATH.glob("*.pdf"):
            analyze_cv(pdf_file)

        print("\n📥 Ingesting all results into Neo4j...")
        kg = KnowledgeGraphBuilder()
        for json_file in CVS_JSON_DIR.glob("*_result.json"):
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # ── Graceful fallback when the LLM couldn't extract name/email ──
            # This happens when:
            #   • The CV name is embedded as an image (not selectable text).
            #   • The LLM returned null/None for the name field.
            # We derive a placeholder from the filename so the freelancer is
            # still ingested with all their skills, domains, and role scores.
            name_missing  = not data.get("name") or str(data.get("name")).lower() in ("none", "null", "")
            email_missing = not data.get("email") or str(data.get("email")).lower() in ("none", "null", "")

            if name_missing:
                # e.g.  "Farah_Mohamed_CV_result.json"  →  "Farah Mohamed CV"
                stem = json_file.stem.replace("_result", "")
                fallback_name = stem.replace("_", " ").replace("-", " ").strip()
                print(f"⚠️  Name missing in {json_file.name} — using filename fallback: '{fallback_name}'")
                data["name"] = fallback_name

            if email_missing:
                # Synthesise a placeholder email so MERGE on email still works
                safe_stem = json_file.stem.replace(" ", "_").replace("_result", "")
                data["email"] = f"unknown_{safe_stem}@placeholder.nodeworks"
                if name_missing:  # only print once
                    print(f"   Also missing email — placeholder assigned.")

            # Stable unique ID: prefer real email, fall back to hash of name+filename
            seed = data.get("email") or f"{data.get('name')}_{json_file.stem}"
            data["kbs_id"] = hashlib.md5(seed.encode()).hexdigest()[:16]
            try:
                kg.ingest_cv_data(data)
            except Exception as e:
                print(f"❌  Failed to ingest {json_file.name}: {e}")
        kg.close()

    else:
        print(f"Analyzing single CV file: {FILE_PATH}")
        result = analyze_cv(FILE_PATH)
        if result:
            kg = KnowledgeGraphBuilder()
            kg.ingest_cv_data(result)
            kg.close()