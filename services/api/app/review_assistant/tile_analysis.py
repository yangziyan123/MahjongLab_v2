from __future__ import annotations

from collections.abc import Sequence

ORPHAN_INDICES = (0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33)


def calculate_shanten(tile_counts: Sequence[int]) -> int:
    if len(tile_counts) != 34:
        raise ValueError("tile_counts must contain 34 entries")
    counts = [int(value) for value in tile_counts]
    if any(value < 0 or value > 4 for value in counts):
        raise ValueError("each tile count must be between 0 and 4")

    concealed_count = sum(counts)
    open_melds = max(0, (14 - concealed_count) // 3)
    regular = _regular_shanten(counts, open_melds)
    if open_melds:
        return regular
    return min(regular, _seven_pairs_shanten(counts), _thirteen_orphans_shanten(counts))


def _regular_shanten(counts: list[int], open_melds: int) -> int:
    best = 8

    def update(melds: int, taatsu: int, pair: int) -> None:
        nonlocal best
        total_melds = melds + open_melds
        usable_taatsu = min(taatsu, max(0, 4 - total_melds))
        best = min(best, 8 - total_melds * 2 - usable_taatsu - pair)

    def search(index: int, melds: int, taatsu: int, pair: int) -> None:
        while index < 34 and counts[index] == 0:
            index += 1
        if index >= 34:
            update(melds, taatsu, pair)
            return

        if counts[index] >= 3:
            counts[index] -= 3
            search(index, melds + 1, taatsu, pair)
            counts[index] += 3

        if index < 27 and index % 9 <= 6 and counts[index + 1] and counts[index + 2]:
            counts[index] -= 1
            counts[index + 1] -= 1
            counts[index + 2] -= 1
            search(index, melds + 1, taatsu, pair)
            counts[index] += 1
            counts[index + 1] += 1
            counts[index + 2] += 1

        if counts[index] >= 2:
            counts[index] -= 2
            if pair == 0:
                search(index, melds, taatsu, 1)
            search(index, melds, taatsu + 1, pair)
            counts[index] += 2

        if index < 27 and index % 9 <= 7 and counts[index + 1]:
            counts[index] -= 1
            counts[index + 1] -= 1
            search(index, melds, taatsu + 1, pair)
            counts[index] += 1
            counts[index + 1] += 1

        if index < 27 and index % 9 <= 6 and counts[index + 2]:
            counts[index] -= 1
            counts[index + 2] -= 1
            search(index, melds, taatsu + 1, pair)
            counts[index] += 1
            counts[index + 2] += 1

        counts[index] -= 1
        search(index, melds, taatsu, pair)
        counts[index] += 1

    search(0, 0, 0, 0)
    return best


def _seven_pairs_shanten(counts: Sequence[int]) -> int:
    pairs = sum(1 for count in counts if count >= 2)
    unique_tiles = sum(1 for count in counts if count)
    return 6 - pairs + max(0, 7 - unique_tiles)


def _thirteen_orphans_shanten(counts: Sequence[int]) -> int:
    unique_orphans = sum(1 for index in ORPHAN_INDICES if counts[index])
    has_pair = any(counts[index] >= 2 for index in ORPHAN_INDICES)
    return 13 - unique_orphans - int(has_pair)

