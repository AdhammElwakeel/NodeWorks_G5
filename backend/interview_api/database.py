import json
import os
import threading
import uuid
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Per-session locks to prevent concurrent write corruption.
# Keep strong references to locks; weak references can be garbage-collected
# immediately between creation and lookup, causing intermittent KeyError.
_session_locks: dict[str, threading.Lock] = {}
_locks_lock = threading.Lock()


def _get_lock(session_id: str) -> threading.Lock:
    with _locks_lock:
        lock = _session_locks.get(session_id)
        if lock is None:
            lock = threading.Lock()
            _session_locks[session_id] = lock
        return lock


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
    session_id = session["session_id"]
    path = get_session_path(session_id)
    tmp_path = path + ".tmp"
    lock = _get_lock(session_id)
    with lock:
        with open(tmp_path, "w") as f:
            json.dump(session, f, indent=2)
        os.replace(tmp_path, path)


def load_session(session_id: str) -> dict | None:
    path = get_session_path(session_id)
    lock = _get_lock(session_id)
    with lock:
        if not os.path.exists(path):
            return None
        with open(path) as f:
            return json.load(f)


def add_question_to_session(session_id: str, question_data: dict):
    lock = _get_lock(session_id)
    with lock:
        path = get_session_path(session_id)
        if not os.path.exists(path):
            return
        with open(path) as f:
            session = json.load(f)
        session["questions"].append(question_data)
        tmp_path = path + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump(session, f, indent=2)
        os.replace(tmp_path, path)


def update_session(session_id: str, updates: dict):
    lock = _get_lock(session_id)
    with lock:
        path = get_session_path(session_id)
        if not os.path.exists(path):
            return None
        with open(path) as f:
            session = json.load(f)
        session.update(updates)
        tmp_path = path + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump(session, f, indent=2)
        os.replace(tmp_path, path)
    return session


def complete_session(session_id: str) -> dict | None:
    lock = _get_lock(session_id)
    with lock:
        path = get_session_path(session_id)
        if not os.path.exists(path):
            return None
        with open(path) as f:
            session = json.load(f)
        session["status"] = "completed"
        session["completed_at"] = datetime.now().isoformat()
        tmp_path = path + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump(session, f, indent=2)
        os.replace(tmp_path, path)
    return session
