"""Single-user demo store with JSON file persistence.

数据默认保存在 app/data/store.json，跨 uvicorn 重启保留。
如果需要重置，删掉该文件即可。
"""
from __future__ import annotations
import json
import threading
from pathlib import Path
from typing import Any

DEFAULT_USER = "demo"

ROOT = Path(__file__).resolve().parents[2]
STORE_FILE = ROOT / "app" / "data" / "store.json"
STORE_FILE.parent.mkdir(parents=True, exist_ok=True)


def _default_user_state() -> dict[str, Any]:
    return {
        "avatar": None,
        "resume": None,
        "profile": {
            "basic": {}, "education": [],
            "internships": [], "work_experiences": [],
            "projects": [], "experiences": [],
            "works": [], "competitions": [], "certificates": [],
            "languages": [], "self_eval": "", "socials": [],
            "skills": [], "soft_skills": {}, "intent": {},
        },
        "assessments": {
            "holland": None, "multi_intel": None,
            "values": None, "mbti": None,
        },
        "report": None,
    }


class Store:
    def __init__(self) -> None:
        self._data: dict[str, dict[str, Any]] = self._load()
        self._lock = threading.Lock()

    # ---------- persistence ----------
    def _load(self) -> dict[str, dict[str, Any]]:
        if not STORE_FILE.exists():
            return {}
        try:
            return json.loads(STORE_FILE.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"[store] failed to load {STORE_FILE}: {exc} — starting empty")
            return {}

    def _save(self) -> None:
        try:
            STORE_FILE.write_text(
                json.dumps(self._data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            print(f"[store] failed to write {STORE_FILE}: {exc}")

    # ---------- user credentials ----------
    def get_users(self) -> dict[str, Any]:
        return self._data.get("_users", {})

    def add_user(self, username: str, password_hash: str, phone: str = "") -> bool:
        with self._lock:
            users = self._data.setdefault("_users", {})
            if username in users:
                return False
            users[username] = {"password_hash": password_hash, "phone": phone}
            self._save()
            return True

    def get_user(self, username: str) -> dict[str, Any] | None:
        return self._data.get("_users", {}).get(username)

    def find_user_by_phone(self, phone: str) -> str | None:
        for uname, info in self._data.get("_users", {}).items():
            if info.get("phone") == phone:
                return uname
        return None

    # ---------- public API ----------
    def get(self, user: str = DEFAULT_USER) -> dict[str, Any]:
        if user not in self._data:
            self._data[user] = _default_user_state()
            self._save()
        return self._data[user]

    def patch(self, path: str, value: Any, user: str = DEFAULT_USER) -> None:
        with self._lock:
            d = self.get(user)
            parts = path.split(".")
            for p in parts[:-1]:
                d = d.setdefault(p, {})
            d[parts[-1]] = value
            self._save()

    def reset(self, user: str = DEFAULT_USER) -> None:
        with self._lock:
            self._data[user] = _default_user_state()
            self._save()


store = Store()
