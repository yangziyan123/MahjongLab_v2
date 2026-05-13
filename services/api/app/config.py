from __future__ import annotations

import sys
from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(slots=True)
class Settings:
    repo_root: Path = Path(__file__).resolve().parents[3]
    service_root: Path = Path(__file__).resolve().parents[1]
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

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.source_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.normalized_dir.mkdir(parents=True, exist_ok=True)
        self.review_dir.mkdir(parents=True, exist_ok=True)
        self.play_logs_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
