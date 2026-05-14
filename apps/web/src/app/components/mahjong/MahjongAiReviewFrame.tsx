import { useCallback, useEffect, useMemo, useRef } from "react";

import type { ReviewEntry } from "../../lib/types";
import { ReviewMahjongTable } from "./ReviewMahjongTable";

type TileDiscard = {
  pai?: string | null;
  riichi?: boolean;
  called?: boolean;
};

type Meld = {
  type?: string;
  pai?: string | null;
  consumed?: string[];
  target?: number | null;
};

type TableSnapshot = {
  target_actor?: number;
  kyoku_index?: number;
  honba?: number;
  kyotaku?: number;
  oya?: number;
  scores?: number[];
  dora_markers?: string[];
  hands?: string[][];
  drawn_tiles?: Array<string | null>;
  discards?: TileDiscard[][];
  melds?: Meld[][];
  riichi?: boolean[];
  tiles_left?: number;
};

type MahjongAiAgent = {
  username: string;
  score: number;
  tile_count: number;
  furo: Record<string, number[]>;
  kui_info: number[][];
  riichi: number;
  riichi_round: number;
  discard: number[];
  river: number[];
  riichi_tile: number;
  is_ai: boolean;
};

type MahjongAiStartMessage = {
  event: "start";
  game: {
    round: number;
    honba: number;
    riichi_ba: number;
    dora_indicator: number[];
    oya: number;
    agents: MahjongAiAgent[];
    left_num: number;
  };
  self: {
    username: string;
    seat: number;
    tiles: number[];
    furo: Record<string, number[]>;
    furo_count: number;
    kui_info: number[][];
    machi: number[];
  };
};

type MahjongAiReviewPayload = {
  startMessage: MahjongAiStartMessage;
  reviewDrawTileId: number | null;
};

const FRAME_SRC = "/api/mahjong-ai-web/review_replay.html";
const HONOR_TILE_KIND: Record<string, number> = {
  E: 27,
  S: 28,
  W: 29,
  N: 30,
  P: 31,
  F: 32,
  C: 33,
};

function getTableSnapshot(entry: ReviewEntry): TableSnapshot | null {
  const table = entry.state_snapshot?.table;
  if (!table || typeof table !== "object") {
    return null;
  }
  return table as TableSnapshot;
}

function normalizeActor(value: unknown, fallback = 0) {
  const actor = Number(value);
  return Number.isInteger(actor) && actor >= 0 && actor <= 3 ? actor : fallback;
}

function tileKind(tile: string) {
  const normalized = tile.trim();
  if (HONOR_TILE_KIND[normalized] !== undefined) {
    return HONOR_TILE_KIND[normalized];
  }

  const rank = Number(normalized[0]);
  const suit = normalized[1];
  if (!Number.isInteger(rank) || rank < 1 || rank > 9) {
    return null;
  }

  const suitOffset = suit === "m" ? 0 : suit === "p" ? 9 : suit === "s" ? 18 : null;
  if (suitOffset === null) {
    return null;
  }
  return suitOffset + rank - 1;
}

function tileToId(tile: string | null | undefined, occurrence: number) {
  if (!tile || tile === "?") {
    return null;
  }
  const kind = tileKind(tile);
  if (kind === null) {
    return null;
  }

  const base = kind * 4;
  const isRedFive = tile.includes("r") && [4, 13, 22].includes(kind);
  if (isRedFive) {
    return base;
  }
  const copyOffset = [4, 13, 22].includes(kind) ? [1, 2, 3, 0][occurrence % 4] : occurrence % 4;
  return base + copyOffset;
}

function tilesToIds(tiles: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  const ids: number[] = [];
  for (const tile of tiles) {
    if (!tile || tile === "?") {
      continue;
    }
    const family = tile.replace("r", "");
    const occurrence = counts.get(family) ?? 0;
    const id = tileToId(tile, occurrence);
    counts.set(family, occurrence + 1);
    if (id !== null) {
      ids.push(id);
    }
  }
  return ids;
}

function sameTileFamily(left: string, right: string) {
  return left.replace("r", "") === right.replace("r", "");
}

function splitDrawnTile(hand: string[], drawnTile?: string | null) {
  const baseHand = [...hand];
  if (!drawnTile || drawnTile === "?") {
    return { baseHand, reviewDrawTileId: null };
  }

  let removeIndex = -1;
  for (let index = baseHand.length - 1; index >= 0; index -= 1) {
    if (baseHand[index] === drawnTile) {
      removeIndex = index;
      break;
    }
  }
  if (removeIndex < 0) {
    for (let index = baseHand.length - 1; index >= 0; index -= 1) {
      if (sameTileFamily(baseHand[index], drawnTile)) {
        removeIndex = index;
        break;
      }
    }
  }
  if (removeIndex >= 0) {
    baseHand.splice(removeIndex, 1);
    return { baseHand, reviewDrawTileId: tileToId(drawnTile, 0) };
  }

  return { baseHand, reviewDrawTileId: baseHand.length % 3 === 1 ? tileToId(drawnTile, 0) : null };
}

function scoreToMahjongAiUnit(score: unknown) {
  const value = Number(score);
  if (!Number.isFinite(value)) {
    return 250;
  }
  return value > 1000 ? Math.round(value / 100) : Math.round(value);
}

function buildRiver(discards: TileDiscard[] | undefined) {
  const visibleDiscards = (discards ?? []).filter((discard) => !discard.called);
  const river = tilesToIds(visibleDiscards.map((discard) => discard.pai));
  const riichiIndex = visibleDiscards.findIndex((discard) => discard.riichi);
  return {
    river,
    riichiTile: riichiIndex >= 0 ? river[riichiIndex] ?? -1 : -1,
    riichiRound: riichiIndex >= 0 ? riichiIndex + 1 : 0,
  };
}

function buildFuros(melds: Meld[] | undefined, who: number) {
  const furo: Record<string, number[]> = {};
  const kuiInfo: number[][] = [];

  (melds ?? []).forEach((meld, index) => {
    const type = String(meld.type ?? "");
    const consumed = Array.isArray(meld.consumed) ? meld.consumed : [];
    const calledTile = typeof meld.pai === "string" ? meld.pai : null;
    const tiles = [...consumed, calledTile].filter((tile): tile is string => Boolean(tile));
    if (tiles.length < 3) {
      return;
    }

    const ids = tilesToIds(tiles);
    if (ids.length < 3) {
      return;
    }

    const fromWho = normalizeActor(meld.target, who);
    const typeCode = type === "chi" ? 0 : type === "pon" ? 1 : type === "ankan" ? 2 : 3;
    const key = `(${typeCode}, ${index})`;
    furo[key] = ids;

    if (type === "ankan") {
      kuiInfo.push([ids[0], who]);
    } else if (type === "kakan" && ids.length >= 4) {
      kuiInfo.push([ids[ids.length - 1], ids[0], fromWho]);
    } else {
      kuiInfo.push([ids[ids.length - 1], fromWho]);
    }
  });

  return { furo, kuiInfo };
}

function buildReviewPayload(entry: ReviewEntry, targetPlayerLabel?: string | null): MahjongAiReviewPayload | null {
  const table = getTableSnapshot(entry);
  if (!table) {
    return null;
  }

  const targetActor = normalizeActor(table.target_actor, 0);
  const hands = Array.isArray(table.hands) ? table.hands : [[], [], [], []];
  const { baseHand: targetBaseHand, reviewDrawTileId } = splitDrawnTile(
    hands[targetActor] ?? [],
    table.drawn_tiles?.[targetActor],
  );
  const melds = Array.isArray(table.melds) ? table.melds : [[], [], [], []];
  const discards = Array.isArray(table.discards) ? table.discards : [[], [], [], []];
  const selfName = targetPlayerLabel || `玩家 ${targetActor + 1}`;
  const furoByActor = [0, 1, 2, 3].map((who) => buildFuros(melds[who], who));

  const agents = [0, 1, 2, 3].map((who) => {
    const { river, riichiTile, riichiRound } = buildRiver(discards[who]);
    const hand = Array.isArray(hands[who]) ? hands[who] : [];
    return {
      username: who === targetActor ? selfName : `玩家 ${who + 1}`,
      score: scoreToMahjongAiUnit(table.scores?.[who]),
      tile_count: hand.length,
      furo: furoByActor[who].furo,
      kui_info: furoByActor[who].kuiInfo,
      riichi: table.riichi?.[who] ? 1 : 0,
      riichi_round: table.riichi?.[who] ? riichiRound : 0,
      discard: river,
      river,
      riichi_tile: riichiTile,
      is_ai: who !== targetActor,
    };
  });

  return {
    startMessage: {
      event: "start",
      game: {
        round: Number.isInteger(table.kyoku_index) ? Number(table.kyoku_index) : entry.kyoku_index,
        honba: Number.isInteger(table.honba) ? Number(table.honba) : entry.honba,
        riichi_ba: Number.isInteger(table.kyotaku) ? Number(table.kyotaku) : 0,
        dora_indicator: tilesToIds(table.dora_markers ?? []),
        oya: normalizeActor(table.oya, 0),
        agents,
        left_num: Number.isInteger(table.tiles_left) ? Number(table.tiles_left) : entry.tiles_left,
      },
      self: {
        username: selfName,
        seat: targetActor,
        tiles: tilesToIds(targetBaseHand),
        furo: furoByActor[targetActor].furo,
        furo_count: Object.keys(furoByActor[targetActor].furo).length,
        kui_info: furoByActor[targetActor].kuiInfo,
        machi: [],
      },
    },
    reviewDrawTileId,
  };
}

type MahjongAiReviewFrameProps = {
  entry: ReviewEntry;
  targetPlayerLabel?: string | null;
};

export function MahjongAiReviewFrame({ entry, targetPlayerLabel }: MahjongAiReviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const reviewPayload = useMemo(() => buildReviewPayload(entry, targetPlayerLabel), [entry, targetPlayerLabel]);

  const postSnapshot = useCallback(() => {
    if (!reviewPayload) {
      return;
    }
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "mahjonglab-review-snapshot",
        payload: { ...reviewPayload, snapshotKey: entry.id },
      },
      window.location.origin,
    );
  }, [entry.id, reviewPayload]);

  useEffect(() => {
    const handleReady = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "mahjonglab-review-ready") {
        return;
      }
      postSnapshot();
    };

    window.addEventListener("message", handleReady);
    return () => window.removeEventListener("message", handleReady);
  }, [postSnapshot]);

  useEffect(() => {
    const timer = window.setTimeout(postSnapshot, 120);
    return () => window.clearTimeout(timer);
  }, [postSnapshot]);

  if (!reviewPayload) {
    return <ReviewMahjongTable entry={entry} targetPlayerLabel={targetPlayerLabel} />;
  }

  return (
    <div className="mx-auto aspect-square w-full max-w-[780px] overflow-hidden rounded-lg border border-slate-800 bg-black">
      <iframe
        ref={iframeRef}
        src={FRAME_SRC}
        title="MahjongLab 逐步复盘牌桌"
        className="h-full w-full border-0 bg-black"
        onLoad={postSnapshot}
      />
    </div>
  );
}
