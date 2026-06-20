"""
role_matcher.py
================
Resolves an arbitrary client-typed role string (e.g. "AI Engineer",
"backend dev", "someone who knows React") to the closest role key in
TECH_ROLES, using sentence-embedding cosine similarity.

Why this exists
----------------
TECH_ROLES is a fixed, internal taxonomy of ~30 role names. Clients
posting projects will never type those exact strings. Hardcoding more
exact-match aliases doesn't scale — there's always another phrasing.
Instead we embed all TECH_ROLES keys once (cached to disk), and at
request time embed only the incoming query string and do a nearest-
neighbor lookup. This keeps per-request latency to ~10-20ms on CPU,
since the expensive part (embedding the 30 fixed roles) happens once,
not per request.

Usage
-----
    from role_matcher import RoleMatcher

    matcher = RoleMatcher(TECH_ROLES)  # loads/builds cache on first call
    resolved, score = matcher.match("AI Engineer")
    # resolved == "AI Agent Engineer" (or whichever is closest), score == cosine similarity

    # Batch resolve a whole requested_roles list:
    resolved_roles = matcher.match_all(["AI Engineer", "UI/UX Designer", "Full-Stack Developer"])
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Optional

import numpy as np

_MODEL_NAME = "all-MiniLM-L6-v2"
_CACHE_DIR = Path(__file__).resolve().parent / ".role_embedding_cache"

# Below this cosine similarity, we don't trust the match — better to
# raise/flag than silently assign a client to a wildly wrong role.
DEFAULT_MIN_CONFIDENCE = 0.35


class RoleMatcher:
    def __init__(
        self,
        tech_roles: dict,
        model_name: str = _MODEL_NAME,
        min_confidence: float = DEFAULT_MIN_CONFIDENCE,
        cache_dir: Path = _CACHE_DIR,
    ):
        self.role_names = list(tech_roles.keys())
        self.min_confidence = min_confidence
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(exist_ok=True)

        self._model = None  # lazy-loaded, see _get_model()
        self._model_name = model_name
        self._role_embeddings = self._load_or_build_role_embeddings()

    # ------------------------------------------------------------------
    # Model + embedding cache
    # ------------------------------------------------------------------

    def _get_model(self):
        """Lazy-load the sentence-transformer model (only when first needed)."""
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
        return self._model

    def _cache_key(self) -> str:
        """
        Hash of the role list + model name, so the cache auto-invalidates
        if you add/rename/remove roles in TECH_ROLES or change models.
        """
        payload = json.dumps({"roles": self.role_names, "model": self._model_name}, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()[:16]

    def _cache_path(self) -> Path:
        return self.cache_dir / f"role_embeddings_{self._cache_key()}.npz"

    def _load_or_build_role_embeddings(self) -> np.ndarray:
        cache_path = self._cache_path()
        if cache_path.exists():
            data = np.load(cache_path, allow_pickle=True)
            cached_roles = list(data["roles"])
            if cached_roles == self.role_names:
                return data["embeddings"]
            # Hash collision edge case / stale file — rebuild.

        embeddings = self._get_model().encode(self.role_names, normalize_embeddings=True)
        np.savez(cache_path, roles=np.array(self.role_names, dtype=object), embeddings=embeddings)
        return embeddings

    # ------------------------------------------------------------------
    # Matching
    # ------------------------------------------------------------------

    def match(self, query: str) -> tuple[str, float]:
        """
        Return (closest_role_name, cosine_similarity) for a single query string.
        Does NOT enforce min_confidence — caller decides what to do with a low score.
        """
        query_norm = query.strip().lower()

        # Exact match short-circuit — skip embedding entirely if it's already valid.
        for role in self.role_names:
            if role.strip().lower() == query_norm:
                return role, 1.0

        q_emb = self._get_model().encode([query], normalize_embeddings=True)[0]
        sims = self._role_embeddings @ q_emb  # cosine similarity since both are normalized
        best_idx = int(np.argmax(sims))
        return self.role_names[best_idx], float(sims[best_idx])

    def match_all(self, queries: list[str]) -> list[str]:
        """
        Resolve a list of role strings to their closest TECH_ROLES keys.
        Raises ValueError if any query's best match falls below min_confidence,
        naming which query failed and its best (rejected) guess + score —
        this keeps failures debuggable instead of silently wrong.
        """
        resolved = []
        for q in queries:
            role, score = self.match(q)
            if score < self.min_confidence:
                raise ValueError(
                    f"Could not confidently match role {q!r} to any known role. "
                    f"Closest guess was {role!r} (similarity={score:.2f}, "
                    f"threshold={self.min_confidence}). "
                    f"Known roles: {self.role_names}"
                )
            resolved.append(role)
        return resolved

    def match_all_verbose(self, queries: list[str]) -> list[dict]:
        """Like match_all, but returns full detail instead of raising — useful for logging/debugging/UI."""
        out = []
        for q in queries:
            role, score = self.match(q)
            out.append({
                "query": q,
                "resolved_role": role,
                "confidence": round(score, 4),
                "confident": score >= self.min_confidence,
            })
        return out
