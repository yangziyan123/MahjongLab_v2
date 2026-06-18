from __future__ import annotations

import argparse
import json
from pathlib import Path

from _repo import add_api_to_path

add_api_to_path()

from app.review_assistant.schemas import DecisionExplanation  # noqa: E402
from app.review_assistant.validation import render_explanation, validate_explanation  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a MahjongLab decision explanation")
    parser.add_argument("--context", required=True, type=Path)
    parser.add_argument("--explanation", required=True, type=Path)
    parser.add_argument("--answer-mode", choices=("concise", "deep"), default="concise")
    args = parser.parse_args()

    context = json.loads(args.context.read_text(encoding="utf-8"))
    explanation = DecisionExplanation.model_validate_json(
        args.explanation.read_text(encoding="utf-8"),
    )
    validate_explanation(explanation, context)
    print(render_explanation(explanation, answer_mode=args.answer_mode))


if __name__ == "__main__":
    main()

