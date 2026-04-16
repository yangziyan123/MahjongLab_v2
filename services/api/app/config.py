from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class Settings:
    repo_root: Path = Path(__file__).resolve().parents[3]
    service_root: Path = Path(__file__).resolve().parents[1]
    data_dir: Path = service_root / "data"
    storage_dir: Path = data_dir / "storage"
    upload_dir: Path = storage_dir / "uploads"
    review_dir: Path = storage_dir / "reviews"
    database_url: str = f"sqlite:///{(data_dir / 'mahjonglab.db').as_posix()}"
    mortal_dir: Path = repo_root / "Mortal" / "mortal"
    mortal_python: str = sys.executable
    mortal_entry: Path = mortal_dir / "mortal.py"
    mortal_cfg: Path = mortal_dir / "config.toml"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.review_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
