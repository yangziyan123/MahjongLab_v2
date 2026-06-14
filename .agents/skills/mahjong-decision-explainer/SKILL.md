---
name: mahjong-decision-explainer
description: Analyze and explain riichi mahjong replay decisions with MahjongLab's structured decision context, evidence ledger, counterfactual action comparison, and validation rules. Use when working on牌谱复盘、逐巡决策解释、实际动作与推荐动作比较、牌效与攻守证据审计、解释 schema、提示词或离线评测。
---

# Mahjong Decision Explainer

Use MahjongLab's review engine as the decision authority. Explain its recommendation from visible facts and deterministic derived features; do not replace or reverse-engineer the engine.

## Workflow

1. Read the current decision context and confirm `schema_version` is `decision-context.v2`.
2. Treat `visible_state` as table facts, `engine_analysis` as engine conclusions, and `derived_facts` as deterministic calculations.
3. Build every explanatory claim from `evidence_ledger`. Cite its stable `T*`, `E*`, `D*`, or `L*` IDs.
4. Compare the actual and recommended actions by changing only the action. Do not use later draws, final results, or hidden hands.
5. Produce `decision-explanation.v1`, then validate it before rendering prose.
6. Put missing or unknowable information in `uncertainties`; never fill it with plausible numbers.

## Evidence Rules

- Use `T*` for public table state.
- Use `E*` for review-engine output.
- Use `D*` for deterministic calculations.
- Use `L*` only for uncertainties and limitations.
- Do not cite a limitation as support for a recommendation.
- Keep `recommended_action` and `actual_action` identical to the context labels.
- Treat effective-tile remaining counts as public-information upper bounds when hidden hands are unknown.
- Treat visible yaku routes as candidates, not guaranteed final yaku.

Read [references/explanation-rubric.md](references/explanation-rubric.md) when changing prompts, validators, evidence features, or evaluation cases.

## Commands

Validate a saved context and explanation:

```powershell
python .agents/skills/mahjong-decision-explainer/scripts/validate_explanation.py `
  --context context.json `
  --explanation explanation.json
```

Run the repository evaluation suite:

```powershell
python .agents/skills/mahjong-decision-explainer/scripts/run_eval_cases.py
```

Regenerate the reference JSON Schemas after changing production Pydantic models:

```powershell
python .agents/skills/mahjong-decision-explainer/scripts/export_schemas.py
```

## Production Sources

- Context compiler: `services/api/app/review_assistant/context.py`
- Explanation models: `services/api/app/review_assistant/schemas.py`
- Validation and rendering: `services/api/app/review_assistant/validation.py`
- Prompt contract: `services/api/app/review_assistant/prompts.py`

Use these files as the source of truth. The schemas under `references/` are generated artifacts.

