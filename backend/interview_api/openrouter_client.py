"""
OpenRouter client for interview question generation and grading.
Uses the OpenAI-compatible API so no extra library is needed beyond `openai`.
"""

import importlib
import json
import re
from typing import cast

from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

config = (
    importlib.import_module(".config", __package__)
    if __package__
    else importlib.import_module("config")
)
INTERVIEW_MODEL = cast(str, config.INTERVIEW_MODEL)
OPENCODE_GO_API_KEY = cast(str | None, config.OPENCODE_GO_API_KEY)
OPENCODE_GO_BASE_URL = cast(str, config.OPENCODE_GO_BASE_URL)


def _get_client() -> OpenAI:
    return OpenAI(
        api_key=OPENCODE_GO_API_KEY,
        base_url=OPENCODE_GO_BASE_URL,
    )


def _call(
    messages: list[ChatCompletionMessageParam], fallback: dict[str, object]
) -> dict[str, object]:
    """Call OpenRouter and parse JSON from the response."""
    text = ""
    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=INTERVIEW_MODEL,
            messages=messages,
            temperature=0.6,
            response_format={"type": "json_object"},
        )
        if not hasattr(response, "choices") or not response.choices:
            print(
                f"[OpenRouter] API returned no choices. Raw response: {getattr(response, '__dict__', response)}"
            )
            return fallback

        text = response.choices[0].message.content or ""
        return cast(dict[str, object], json.loads(text))
    except json.JSONDecodeError:
        # Try to extract JSON block from plain text response
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return cast(dict[str, object], json.loads(match.group(0)))
            except Exception:
                pass
        print(f"[OpenRouter] JSON parse error. Raw: {text[:300]}")
        return fallback
    except Exception as exc:
        print(f"[OpenRouter] API error: {exc}")
        return fallback


def generate_question(
    skill: str,
    cv_context: str,
    previous_questions: list[str],
    difficulty: str = "medium",
) -> dict[str, object]:
    """Generate a main interview question for a skill."""
    prev_str = ""
    if previous_questions:
        prev_str = (
            "\n\nDo NOT repeat or closely paraphrase any of these already-asked questions:\n"
            + "\n".join(f"- {q}" for q in previous_questions)
        )

    messages: list[ChatCompletionMessageParam] = [
        {
            "role": "system",
            "content": (
                "You are a senior technical interviewer. Your job is to generate precise, "
                "scenario-based interview questions at the specified difficulty level. "
                "Respond ONLY with valid JSON."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Generate ONE {difficulty}-difficulty interview question to assess a candidate's "
                f"knowledge of **{skill}**.\n\n"
                f"Context from their CV:\n{cv_context}\n"
                f"{prev_str}\n\n"
                "Requirements:\n"
                "1. The question must be scenario-based or practical — NOT a definition question.\n"
                "2. The question should be answerable in 2–4 paragraphs.\n"
                "3. It must be specific to the candidate's experience shown in the CV context.\n\n"
                "Respond in exactly this JSON format:\n"
                "{\n"
                '  "question_text": "...",\n'
                '  "focus_concept": "The core concept being tested"\n'
                "}"
            ),
        },
    ]
    return _call(
        messages,
        {
            "question_text": f"Tell me about a challenging project where you used {skill}.",
            "focus_concept": skill,
        },
    )


def generate_followup(
    skill: str,
    main_question: str,
    candidate_answer: str,
    followup_number: int,
    difficulty: str = "medium",
) -> dict[str, object]:
    """Generate a follow-up question based on the candidate's previous answer."""
    messages: list[ChatCompletionMessageParam] = [
        {
            "role": "system",
            "content": (
                "You are a senior technical interviewer conducting a deep-dive interview. "
                "Your role is to probe deeper into the candidate's answers by asking intelligent "
                "follow-up questions. Respond ONLY with valid JSON."
            ),
        },
        {
            "role": "user",
            "content": (
                f"You are testing the candidate on **{skill}** (follow-up #{followup_number} of 3, difficulty: {difficulty}).\n\n"
                f"Original Question:\n{main_question}\n\n"
                f"Candidate's Last Answer:\n{candidate_answer}\n\n"
                "Based on their answer, generate ONE follow-up question that:\n"
                "1. Probes deeper into a specific detail they mentioned OR challenges a potential gap.\n"
                "2. Is increasingly specific (follow-up 1 = clarify, 2 = challenge, 3 = edge case).\n"
                "3. Is NOT a new topic — stay on the same concept.\n\n"
                "Respond in exactly this JSON format:\n"
                "{\n"
                '  "question_text": "...",\n'
                '  "focus_concept": "What this follow-up is testing"\n'
                "}"
            ),
        },
    ]
    return _call(
        messages,
        {
            "question_text": f"Can you elaborate more on how you implemented that in {skill}?",
            "focus_concept": f"{skill} deep-dive",
        },
    )


def grade_answer(
    question_asked: str, user_answer: str, skill_name: str, is_followup: bool = False
) -> dict[str, object]:
    """Grade a candidate's answer and return score + feedback."""
    q_type = "follow-up" if is_followup else "main"
    messages: list[ChatCompletionMessageParam] = [
        {
            "role": "system",
            "content": (
                "You are a strict but fair technical interview grader. "
                "Score answers on a scale of 0–10. Respond ONLY with valid JSON."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Grade this {q_type} answer about **{skill_name}**.\n\n"
                f"Question:\n{question_asked}\n\n"
                f"Answer:\n{user_answer}\n\n"
                "Grade based on:\n"
                "- Technical accuracy (30%)\n"
                "- Depth and specificity (30%)\n"
                "- Practical, experience-based insight (25%)\n"
                "- Clarity (15%)\n\n"
                "Cheating flags (set cheating_flag=true if):\n"
                "- Answer is a copy-paste textbook definition\n"
                "- Answer has no personal voice or specific details\n"
                "- Answer is completely irrelevant to the question\n\n"
                "Respond in exactly this JSON format:\n"
                "{\n"
                '  "score": <0-10>,\n'
                '  "feedback": "2-3 sentence constructive feedback",\n'
                '  "cheating_flag": false\n'
                "}"
            ),
        },
    ]
    return _call(
        messages,
        {
            "score": 5,
            "feedback": "Could not grade automatically.",
            "cheating_flag": False,
        },
    )


def grade_english(user_answer: str) -> dict[str, object]:
    """Assess English quality of an answer: grammar, clarity, vocabulary, coherence."""
    messages: list[ChatCompletionMessageParam] = [
        {
            "role": "system",
            "content": (
                "You are an English-language assessor for technical interviews. "
                "Score the candidate's written English on a scale of 0–10. "
                "Respond ONLY with valid JSON."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Assess the English quality of this answer:\n\n{user_answer}\n\n"
                "Grade based on:\n"
                "- Grammar and sentence structure (30%)\n"
                "- Clarity and readability (25%)\n"
                "- Vocabulary and terminology (25%)\n"
                "- Coherence and flow (20%)\n\n"
                "Respond in exactly this JSON format:\n"
                "{\n"
                '  "score": <0-10>,\n'
                '  "feedback": "1-2 sentence note on English quality"\n'
                "}"
            ),
        },
    ]
    return _call(
        messages,
        {"score": 7, "feedback": "Could not assess English automatically."},
    )


def demo_grade(result: str) -> dict[str, object]:
    """Build a fixed grade for demo bypass (no LLM call). result='right'|'wrong'."""
    if result == "right":
        return {
            "score": 10,
            "feedback": "Demo: marked as correct.",
            "cheating_flag": False,
            "english_score": 9,
            "english_feedback": "Demo: strong English.",
        }
    return {
        "score": 2,
        "feedback": "Demo: marked as incorrect.",
        "cheating_flag": False,
        "english_score": 4,
        "english_feedback": "Demo: weak English.",
    }
