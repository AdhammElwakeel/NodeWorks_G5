import json
import os
from datetime import datetime
import uuid

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def get_session_path(session_id: str) -> str:
    return os.path.join(DATA_DIR, f"session_{session_id}.json")


def create_session(candidate_id: str, skills_to_test: list, cv_data: dict) -> dict:
    ensure_data_dir()
    session_id = str(uuid.uuid4())[:8]
    session = {
        "session_id": session_id,
        "candidate_id": candidate_id,
        "status": "in_progress",
        "started_at": datetime.now().isoformat(),
        "completed_at": None,
        "skills_to_test": skills_to_test,
        "current_skill_index": 0,
        # Track question state per skill for follow-up logic
        # questions list contains: {skill, question_text, focus_concept, is_followup, followup_number, user_answer, score, feedback, cheating_flag}
        "questions": [],
        "violations": 0,
        "cv_data": cv_data,
    }
    save_session(session)
    return session


def save_session(session: dict):
    ensure_data_dir()
    with open(get_session_path(session["session_id"]), "w") as f:
        json.dump(session, f, indent=2)


def load_session(session_id: str) -> dict | None:
    path = get_session_path(session_id)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def add_question_to_session(session_id: str, question_data: dict):
    session = load_session(session_id)
    if session:
        session["questions"].append(question_data)
        save_session(session)


def update_session(session_id: str, updates: dict):
    session = load_session(session_id)
    if session:
        session.update(updates)
        save_session(session)
    return session


def complete_session(session_id: str) -> dict | None:
    session = load_session(session_id)
    if session:
        session["status"] = "completed"
        session["completed_at"] = datetime.now().isoformat()
        save_session(session)
    return session
