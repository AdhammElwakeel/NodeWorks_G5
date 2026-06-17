import json
import os
from pathlib import Path

from cv_analysis_module import process_cv
from dotenv import load_dotenv
from neo4j import GraphDatabase

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=ROOT_DIR / ".env")

FILE_PATH = "CVs pdf"


class KnowledgeGraphBuilder:
    def __init__(self):
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def ingest_cv_data(self, cv_json):
        """
        Takes the dictionary from CV_result.json and updates the graph with
        bidirectional relationships.
        """
        with self.driver.session() as session:
            # 1. Create the Freelancer Node
            session.run(
                """
                MERGE (f:Freelancer {email: $email})
                SET f.name = $name, f.phone = $phone
            """,
                email=cv_json["email"],
                name=cv_json["name"],
                phone=cv_json.get("phone"),
            )

            # 2. Connect Skills (Bidirectional)
            for skill in cv_json.get("all_skills", []):
                session.run(
                    """
                    MATCH (f:Freelancer {email: $email})
                    MERGE (s:Skill {name: $skill_name})
                    MERGE (f)-[:HAS_SKILL]->(s)
                    MERGE (s)-[:SKILL_OWNED_BY]->(f)
                """,
                    email=cv_json["email"],
                    skill_name=skill,
                )

            # 3. Connect Experience (Bidirectional)
            for exp in cv_json.get("experience", []):
                session.run(
                    """
                    MATCH (f:Freelancer {email: $email})
                    MERGE (c:Company {name: $company})
                    MERGE (f)-[:WORKED_AT {role: $role, duration: $years}]->(c)
                    MERGE (c)-[:EMPLOYED {as_role: $role, for_duration: $years}]->(f)
                """,
                    email=cv_json["email"],
                    company=exp["company"],
                    role=exp["role"],
                    years=exp.get("years"),
                )

            # 4. Connect Education (Bidirectional)
            for edu in cv_json.get("education", []):
                session.run(
                    """
                    MATCH (f:Freelancer {email: $email})
                    MERGE (i:Institution {name: $institution})
                    MERGE (f)-[:STUDIED_AT {degree: $degree}]->(i)
                    MERGE (i)-[:ALUMNI_OF {degree_awarded: $degree}]->(f)
                """,
                    email=cv_json["email"],
                    institution=edu["institution"],
                    degree=edu["degree"],
                )

            # 5. Connect Projects & Tech Stack (Bidirectional)
            for proj in cv_json.get("projects", []):
                # Freelancer <-> Project
                session.run(
                    """
                    MATCH (f:Freelancer {email: $email})
                    MERGE (p:Project {name: $p_name})
                    MERGE (f)-[:CREATED_PROJECT]->(p)
                    MERGE (p)-[:DEVELOPED_BY]->(f)
                """,
                    email=cv_json["email"],
                    p_name=proj["name"],
                )

                # Project <-> Skills
                for tech in proj.get("technologies", []):
                    session.run(
                        """
                        MATCH (p:Project {name: $p_name})
                        MERGE (s:Skill {name: $tech})
                        MERGE (p)-[:USED_TECH]->(s)
                        MERGE (s)-[:USED_IN]->(p)
                    """,
                        p_name=proj["name"],
                        tech=tech,
                    )

            # 6. Connect Best Role (Bidirectional)
            if "best_role" in cv_json:
                session.run(
                    """
                    MATCH (f:Freelancer {email: $email})
                    MERGE (r:Role {name: $role})
                    MERGE (f)-[:MATCHES_ROLE {score: $score}]->(r)
                    MERGE (r)-[:SUITABLE_CANDIDATE {score: $score}]->(f)
                """,
                    email=cv_json["email"],
                    role=cv_json["best_role"],
                    score=cv_json.get("best_score"),
                )

            print(
                f"✅ Successfully added data for {cv_json['name']} with bidirectional links."
            )


def analyze_cv(cv_file=None):
    # Define Path
    file_path = Path(cv_file)

    print(f"\n🚀 Starting System...")
    print(f"📂 Target File: {file_path.absolute()}")

    # 1. Simulate Frontend Upload (Read file as bytes)
    if not file_path.exists():
        print("❌ Error: File not found. Please check the cv_file variable.")
        return

    print("📖 Reading file into bytes...")
    with open(file_path, "rb") as f:
        pdf_bytes = f.read()

    # 2. Process
    print("🧠 Sending to Gemini AI & Scoring Engine...")
    result = process_cv(pdf_bytes)

    # 3. Display Results
    if "error" in result:
        print(f"\n❌ FAILED: {result['error']}")
    else:
        print("\n" + "=" * 50)
        print(f"👤 CANDIDATE: {result.get('name')}")
        print(f"📧 EMAIL:     {result.get('email')}")
        print("=" * 50)

        print(f"\n🏆 BEST ROLE MATCH: {result.get('best_role')}")
        print(f"📊 CONFIDENCE:      {result.get('best_score')}%")

        print("\n📜 TOP 3 ROLE RANKINGS:")
        for rank in result.get("role_rankings", [])[:3]:
            print(f"   - {rank['role']:<20} : {rank['score']}% Match")

        # print(f"\n🛠  SKILLS EXTRACTED: {len(result.get('all_skills', []))}")
        # print(f"   {', '.join(result.get('all_skills', [])[:10])}...")

        # Save to JSON
        output_file = "CVs Json/" + file_path.stem + "_result.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=4, ensure_ascii=False)
        print(f"\n💾 Results saved to: {output_file}")


if __name__ == "__main__":
    if not FILE_PATH.endswith(".pdf"):
        print(f"Analyzing multiple CV files in directory...{FILE_PATH}")
        for pdf_file in os.listdir(FILE_PATH):
            if pdf_file.endswith(".pdf"):
                analyze_cv(cv_file=os.path.join(FILE_PATH, pdf_file))

        for json_file in os.listdir("CVs Json"):
            if json_file.endswith("_result.json"):
                with open(
                    os.path.join("CVs Json", json_file), "r", encoding="utf-8"
                ) as f:
                    data = json.load(f)
                kg = KnowledgeGraphBuilder()
                kg.ingest_cv_data(data)
        kg.close()
    else:
        print(f"Analyzing single CV file...{FILE_PATH}")
        analyze_cv(cv_file=FILE_PATH)
        with open(
            "CVs Json/" + Path(FILE_PATH).stem + "_result.json", "r", encoding="utf-8"
        ) as f:
            data = json.load(f)
        kg = KnowledgeGraphBuilder()
        kg.ingest_cv_data(data)
        kg.close()
