# Explanation Rubric

Use this rubric for prompt changes, model comparisons, and offline replay evaluation.

## Hard Gates

An explanation fails if any condition is true:

1. `recommended_action` differs from the review engine.
2. `actual_action` differs from the replay.
3. A cited evidence ID does not exist.
4. A limitation ID supports a positive claim.
5. A numeric claim is absent from the decision context.
6. The explanation uses later events or hidden opponent hands.
7. Existing context limitations are not disclosed.

## Quality Score

Score each dimension from 1 to 5:

| Dimension | 1 | 3 | 5 |
| --- | --- | --- | --- |
| Evidence fidelity | Claims are weakly connected to evidence | Most claims are traceable | Every material claim is directly traceable |
| Action contrast | Restates the recommendation | Compares one useful dimension | Clearly contrasts efficiency, value, defense, or flexibility |
| Uncertainty | Hides missing data | Mentions major gaps | Precisely states what is unknown and why |
| Teaching value | Gives only this-hand advice | Provides a general heuristic | Provides a reusable, bounded decision rule |
| Clarity | Long or ambiguous | Understandable | Conclusion-first and concise |

Require all hard gates to pass and an average quality score of at least 4.0 before changing the default prompt or model.

## Evaluation Coverage

Maintain cases for:

- Early-hand efficiency.
- One-shanten and tenpai choices.
- Riichi versus dama.
- Chi, pon, kan, and pass.
- Defense against one or more riichi declarations.
- Placement and score-pressure decisions.
- Missing candidate scores.
- Missing table snapshots.
- Red fives, dora indicators, and visible yaku routes.
- Attempts to cite future information or fabricate exact values.

