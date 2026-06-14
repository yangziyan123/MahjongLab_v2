from __future__ import annotations

import sys
from dataclasses import dataclass, field
import os
from pathlib import Path

from dotenv import load_dotenv


SERVICE_ROOT = Path(__file__).resolve().parents[1]


def load_service_env(path: Path = SERVICE_ROOT / ".env") -> None:
    load_dotenv(dotenv_path=path, override=False)


load_service_env()


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(slots=True)
class Settings:
    repo_root: Path = Path(__file__).resolve().parents[3]
    service_root: Path = SERVICE_ROOT
    workspace_root: Path = repo_root.parent
    data_dir: Path = service_root / "data"
    storage_dir: Path = data_dir / "storage"
    source_dir: Path = storage_dir / "sources"
    upload_dir: Path = storage_dir / "uploads"
    normalized_dir: Path = storage_dir / "normalized"
    review_dir: Path = storage_dir / "reviews"
    database_url: str = f"sqlite:///{(data_dir / 'mahjonglab.db').as_posix()}"
    mortal_dir: Path = repo_root / "Mortal" / "mortal"
    mortal_python: str = sys.executable
    mortal_entry: Path = mortal_dir / "mortal.py"
    mortal_cfg: Path = mortal_dir / "config.toml"
    cargo_bin: str = "cargo"
    mjai_reviewer_dir: Path = repo_root / "mjai-reviewer"
    mjai_reviewer_manifest: Path = mjai_reviewer_dir / "Cargo.toml"
    mahjong_ai_root: Path = Path(os.environ.get("MAHJONG_AI_ROOT", repo_root / "Mahjong-AI"))
    current_env_websockify: Path = Path(sys.executable).with_name("websockify.exe")
    mahjong_ai_python: str = os.environ.get(
        "MAHJONG_AI_PYTHON",
        str(mahjong_ai_root / ".venv" / "Scripts" / "python.exe")
        if (mahjong_ai_root / ".venv" / "Scripts" / "python.exe").exists()
        else sys.executable,
    )
    mahjong_ai_websockify: str = os.environ.get(
        "MAHJONG_AI_WEBSOCKIFY",
        str(mahjong_ai_root / ".venv" / "Scripts" / "websockify.exe")
        if (mahjong_ai_root / ".venv" / "Scripts" / "websockify.exe").exists()
        else str(current_env_websockify)
        if current_env_websockify.exists()
        else "websockify",
    )
    mahjong_ai_server_host: str = os.environ.get("MAHJONG_AI_HOST", "127.0.0.1")
    play_logs_dir: Path = data_dir / "play_launcher"
    review_assistant_provider: str = field(
        default_factory=lambda: os.environ.get("MAHJONGLAB_REVIEW_ASSISTANT_PROVIDER", "deterministic"),
    )
    review_assistant_base_url: str = field(
        default_factory=lambda: os.environ.get("MAHJONGLAB_REVIEW_ASSISTANT_BASE_URL", ""),
    )
    review_assistant_api_key: str = field(
        default_factory=lambda: os.environ.get("MAHJONGLAB_REVIEW_ASSISTANT_API_KEY", ""),
    )
    review_assistant_model: str = field(
        default_factory=lambda: os.environ.get("MAHJONGLAB_REVIEW_ASSISTANT_MODEL", ""),
    )
    review_assistant_timeout_seconds: int = field(
        default_factory=lambda: env_int("MAHJONGLAB_REVIEW_ASSISTANT_TIMEOUT_SECONDS", 45),
    )
    review_assistant_max_output_tokens: int = field(
        default_factory=lambda: env_int("MAHJONGLAB_REVIEW_ASSISTANT_MAX_OUTPUT_TOKENS", 900),
    )
    review_assistant_thinking: bool = field(
        default_factory=lambda: env_bool("MAHJONGLAB_REVIEW_ASSISTANT_THINKING", False),
    )

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.source_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.normalized_dir.mkdir(parents=True, exist_ok=True)
        self.review_dir.mkdir(parents=True, exist_ok=True)
        self.play_logs_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
