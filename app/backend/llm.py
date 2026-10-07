"""LLM client wrapper (OpenAI-compatible).

Env vars (fall back to deterministic offline stubs if LLM_API_KEY is unset):
    LLM_BASE_URL   e.g. https://api.deepseek.com/v1
    LLM_API_KEY    API key
    LLM_MODEL      model name, e.g. deepseek-chat
"""
from __future__ import annotations
import json
import os
from typing import Any

try:
    from openai import OpenAI  # type: ignore
except Exception:  # openai not installed yet
    OpenAI = None  # type: ignore

BASE_URL = os.getenv("LLM_BASE_URL", "https://api.deepseek.com/v1")
API_KEY = os.getenv("LLM_API_KEY", "")
MODEL = os.getenv("LLM_MODEL", "deepseek-chat")

_client: Any = None
if API_KEY and OpenAI is not None:
    _client = OpenAI(api_key=API_KEY, base_url=BASE_URL)


def chat(system: str, user: str, *, json_mode: bool = False,
         temperature: float = 0.3) -> str:
    """Return LLM output as text. If no key, returns an offline stub."""
    if _client is None:
        return _offline_stub(system, user, json_mode)
    try:
        kwargs: dict[str, Any] = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        rsp = _client.chat.completions.create(**kwargs)
        return rsp.choices[0].message.content or ""
    except Exception as exc:  # network issues, etc.
        return _offline_stub(system, user, json_mode, err=str(exc))


def chat_json(system: str, user: str) -> dict:
    txt = chat(system, user, json_mode=True)
    try:
        return json.loads(txt)
    except Exception:
        # try to locate JSON inside
        start = txt.find("{")
        end = txt.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(txt[start:end + 1])
            except Exception:
                pass
        return {"raw": txt}


def _offline_stub(system: str, user: str, json_mode: bool,
                  err: str = "") -> str:
    """Deterministic stub so the app runs without a key."""
    tag = "[offline-stub]"
    if "简历" in system or "resume" in system.lower():
        return json.dumps({
            "basic": {"name": "", "gender": "", "phone": "", "email": ""},
            "education": [],
            "experiences": [],
            "skills": ["Python", "Java"],
            "note": f"{tag} upload a resume to see real parsing",
        }, ensure_ascii=False)
    if "匹配" in system or "match" in system.lower():
        return json.dumps({
            "score": 72,
            "breakdown": {
                "基础要求": 80, "职业技能": 70, "职业素养": 75,
            },
            "explanation": f"{tag} 你的专业技能与该岗位核心要求基本吻合…",
        }, ensure_ascii=False)
    if "韦恩" in system or "venn" in system.lower() or "建议" in system:
        return (f"{tag}\n• 可基于你的项目经验快速上手该领域。\n"
                f"• 建议补充 1 段相关实习，验证规划。\n"
                f"• 关注行业头部公司的校招通道。")
    if json_mode:
        return "{}"
    return f"{tag} {err}".strip()
