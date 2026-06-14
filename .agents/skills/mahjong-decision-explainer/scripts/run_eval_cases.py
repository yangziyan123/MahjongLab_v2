from __future__ import annotations

import os
import subprocess
import sys

from _repo import repository_root


def main() -> None:
    root = repository_root()
    env = dict(os.environ)
    env["PYTHONPATH"] = str(root / "services" / "api")
    command = [
        sys.executable,
        "-m",
        "unittest",
        "services.api.tests.test_review_assistant",
    ]
    raise SystemExit(subprocess.run(command, cwd=root, env=env, check=False).returncode)


if __name__ == "__main__":
    main()

