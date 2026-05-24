import type { ReviewEntry } from "../../lib/types";
import { Badge } from "../ui/badge";

type TileDiscard = {
  pai?: string | null;
  tsumogiri?: boolean;
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
  bakaze?: string;
  kyoku?: number;
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
  pending_riichi?: number[];
  tiles_left?: number;
  last_actor?: number | null;
  last_tile?: string | null;
};

type ReviewMahjongTableEntry = Pick<ReviewEntry, "state_snapshot" | "tiles_left" | "junme" | "is_match">;

const WIND_LABELS: Record<string, string> = {
  E: "东",
  S: "南",
  W: "西",
  N: "北",
};

const HONOR_LABELS: Record<string, string> = {
  E: "东",
  S: "南",
  W: "西",
  N: "北",
  P: "白",
  F: "发",
  C: "中",
};

function getTableSnapshot(entry: ReviewMahjongTableEntry): TableSnapshot | null {
  const table = entry.state_snapshot?.table;
  if (!table || typeof table !== "object") {
    return null;
  }
  return table as TableSnapshot;
}

function formatTile(tile?: string | null) {
  if (!tile || tile === "?") {
    return "?";
  }
  if (HONOR_LABELS[tile]) {
    return HONOR_LABELS[tile];
  }

  const rank = tile[0];
  const suit = tile[1];
  const suitLabel = suit === "m" ? "万" : suit === "p" ? "筒" : suit === "s" ? "索" : "";
  return `${tile.includes("r") ? "赤" : ""}${rank}${suitLabel}`;
}

function isRedFive(tile?: string | null) {
  return Boolean(tile?.includes("r"));
}

function actorWind(actor: number, oya: number) {
  return ["东", "南", "西", "北"][(actor - oya + 4) % 4];
}

function actorName(actor: number, targetActor: number, targetPlayerLabel?: string | null) {
  if (actor === targetActor) {
    return targetPlayerLabel || "你";
  }
  return `玩家 ${actor}`;
}

function actorOrder(targetActor: number) {
  return {
    bottom: targetActor,
    right: (targetActor + 1) % 4,
    top: (targetActor + 2) % 4,
    left: (targetActor + 3) % 4,
  };
}

function TileView({
  tile,
  compact = false,
  dimmed = false,
  highlight = false,
  rotated = false,
}: {
  tile?: string | null;
  compact?: boolean;
  dimmed?: boolean;
  highlight?: boolean;
  rotated?: boolean;
}) {
  const unknown = !tile || tile === "?";
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded border text-center font-bold shadow-sm",
        compact ? "h-8 w-6 text-[10px]" : "h-12 w-9 text-xs",
        unknown ? "border-amber-700 bg-amber-200 text-amber-900" : "border-slate-200 bg-white text-slate-950",
        isRedFive(tile) ? "text-red-600" : "",
        dimmed ? "opacity-55" : "",
        highlight ? "ring-2 ring-sky-300 ring-offset-1 ring-offset-emerald-950" : "",
        rotated ? "rotate-90" : "",
      ].join(" ")}
      title={formatTile(tile)}
    >
      {unknown ? "" : formatTile(tile)}
    </span>
  );
}

function River({ discards = [] }: { discards?: TileDiscard[] }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {discards.slice(0, 24).map((discard, index) => (
        <TileView
          key={`${discard.pai ?? "unknown"}-${index}`}
          tile={discard.pai}
          compact
          dimmed={discard.called}
          highlight={discard.riichi}
          rotated={discard.riichi}
        />
      ))}
    </div>
  );
}

function Melds({ melds = [] }: { melds?: Meld[] }) {
  if (melds.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {melds.map((meld, index) => {
        const tiles = [...(meld.consumed ?? []), meld.pai].filter(Boolean) as string[];
        return (
          <div key={`${meld.type ?? "meld"}-${index}`} className="flex items-center gap-1 rounded bg-emerald-950/70 p-1">
            {tiles.map((tile, tileIndex) => (
              <TileView key={`${tile}-${tileIndex}`} tile={tile} compact highlight={tile === meld.pai} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PlayerPanel({
  actor,
  table,
  targetActor,
  targetPlayerLabel,
}: {
  actor: number;
  table: TableSnapshot;
  targetActor: number;
  targetPlayerLabel?: string | null;
}) {
  const score = table.scores?.[actor] ?? 0;
  const oya = table.oya ?? 0;
  const riichi = table.riichi?.[actor] || table.pending_riichi?.includes(actor);
  const active = table.last_actor === actor;

  return (
    <div
      className={[
        "rounded-lg border p-3 text-white shadow-sm",
        active ? "border-sky-300 bg-emerald-800" : "border-emerald-700 bg-emerald-950/65",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs text-emerald-200">{actorWind(actor, oya)}家</div>
          <div className="text-sm font-semibold">{actorName(actor, targetActor, targetPlayerLabel)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">{score.toLocaleString()} 点</div>
          {riichi ? <Badge className="mt-1 bg-rose-500 text-white hover:bg-rose-500">立直</Badge> : null}
        </div>
      </div>
      <River discards={table.discards?.[actor] ?? []} />
      <Melds melds={table.melds?.[actor] ?? []} />
    </div>
  );
}

function Hand({
  table,
  actor,
}: {
  table: TableSnapshot;
  actor: number;
}) {
  const hand = table.hands?.[actor] ?? [];
  const drawnTile = table.drawn_tiles?.[actor] ?? null;
  const drawnIndex =
    drawnTile === null ? -1 : [...hand].reverse().findIndex((tile) => tile === drawnTile || tile.replace("r", "") === drawnTile.replace("r", ""));
  const actualDrawnIndex = drawnIndex >= 0 ? hand.length - 1 - drawnIndex : -1;

  return (
    <div className="rounded-lg border border-emerald-600 bg-emerald-950/80 p-4 text-white shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-emerald-200">自家手牌</div>
          <div className="text-sm font-semibold">当前决策点</div>
        </div>
        {drawnTile ? <Badge className="bg-sky-500 text-white hover:bg-sky-500">摸牌 {formatTile(drawnTile)}</Badge> : null}
      </div>
      <div className="flex min-h-14 flex-wrap items-end justify-center gap-1.5">
        {hand.length === 0 ? (
          <div className="text-sm text-emerald-200">当前复盘数据没有记录手牌，只展示河牌与动作对比。</div>
        ) : (
          hand.map((tile, index) => (
            <span key={`${tile}-${index}`} className={index === actualDrawnIndex ? "ml-3" : ""}>
              <TileView tile={tile} highlight={index === actualDrawnIndex} />
            </span>
          ))
        )}
      </div>
      <Melds melds={table.melds?.[actor] ?? []} />
    </div>
  );
}

export function ReviewMahjongTable({
  entry,
  targetPlayerLabel,
}: {
  entry: ReviewMahjongTableEntry;
  targetPlayerLabel?: string | null;
}) {
  const table = getTableSnapshot(entry);
  if (!table) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
        这条复盘记录没有牌桌快照，仍可查看下方动作对比。
      </div>
    );
  }

  const targetActor = table.target_actor ?? 0;
  const order = actorOrder(targetActor);
  const roundLabel = `${WIND_LABELS[table.bakaze ?? "E"] ?? "东"}${table.kyoku ?? 1}局`;
  const doraMarkers = table.dora_markers ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-900 bg-emerald-900 p-4 shadow-xl">
      <div className="mb-4 grid gap-3 text-white md:grid-cols-4">
        <div className="rounded-lg bg-emerald-950/70 p-3">
          <div className="text-xs text-emerald-200">局面</div>
          <div className="mt-1 font-bold">
            {roundLabel} {table.honba ?? 0} 本场
          </div>
        </div>
        <div className="rounded-lg bg-emerald-950/70 p-3">
          <div className="text-xs text-emerald-200">剩余牌</div>
          <div className="mt-1 font-bold">{table.tiles_left ?? entry.tiles_left} 张</div>
        </div>
        <div className="rounded-lg bg-emerald-950/70 p-3">
          <div className="text-xs text-emerald-200">立直棒</div>
          <div className="mt-1 font-bold">{table.kyotaku ?? 0}</div>
        </div>
        <div className="rounded-lg bg-emerald-950/70 p-3">
          <div className="text-xs text-emerald-200">宝牌指示牌</div>
          <div className="mt-2 flex gap-1">
            {doraMarkers.length === 0 ? <span className="text-sm text-emerald-200">未记录</span> : null}
            {doraMarkers.map((tile, index) => (
              <TileView key={`${tile}-${index}`} tile={tile} compact />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(190px,0.8fr)_minmax(320px,1.3fr)_minmax(190px,0.8fr)]">
        <div className="hidden lg:block" />
        <PlayerPanel actor={order.top} table={table} targetActor={targetActor} targetPlayerLabel={targetPlayerLabel} />
        <div className="hidden lg:block" />

        <PlayerPanel actor={order.left} table={table} targetActor={targetActor} targetPlayerLabel={targetPlayerLabel} />
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-emerald-700 bg-emerald-800/80 p-4 text-center text-white">
          <div>
            <div className="text-sm text-emerald-100">第 {entry.junme} 巡</div>
            <div className="mt-2 text-2xl font-bold">{entry.is_match ? "命中推荐" : "需要复盘"}</div>
            <div className="mt-2 text-sm text-emerald-100">
              最近动作：{table.last_actor !== null && table.last_actor !== undefined ? actorName(table.last_actor, targetActor, targetPlayerLabel) : "-"}
              {table.last_tile ? ` · ${formatTile(table.last_tile)}` : ""}
            </div>
          </div>
        </div>
        <PlayerPanel actor={order.right} table={table} targetActor={targetActor} targetPlayerLabel={targetPlayerLabel} />

        <div className="hidden lg:block" />
        <div className="space-y-3">
          <PlayerPanel actor={order.bottom} table={table} targetActor={targetActor} targetPlayerLabel={targetPlayerLabel} />
          <Hand table={table} actor={order.bottom} />
        </div>
        <div className="hidden lg:block" />
      </div>
    </div>
  );
}
