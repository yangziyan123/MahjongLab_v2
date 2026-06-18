from __future__ import annotations

import sys
from pathlib import Path


def repository_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "services" / "api" / "app").is_dir():
            return parent
    raise RuntimeError("MahjongLab repository root was not found")


def add_api_to_path() -> Path:
    root = repository_root()
    api_root = root / "services" / "api"
    sys.path.insert(0, str(api_root))
    return root

