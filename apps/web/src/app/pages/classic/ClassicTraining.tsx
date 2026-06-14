import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Expand,
  FileSearch,
  History,
  LoaderCircle,
  RotateCcw,
  Shrink,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  ApiError,
  getClassicTrainingSession,
  startPlayMatchReview,
  submitClassicTrainingAction,
} from "../../lib/api";
import type { ClassicTrainingComparison } from "../../lib/types";
import { MahjongAiReviewFrame } from "../../components/mahjong/MahjongAiReviewFrame";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

const HONOR_LABELS: Record<string, string> = {
  E: "东",
  S: "南",
  W: "西",
  N: "北",
  P: "白",
  F: "发",
  C: "中",
};

function formatTile(tile?: unknown) {
  if (typeof tile !== "string") {
    return "未知";
  }
  if (HONOR_LABELS[tile]) {
    return HONOR_LABELS[tile];
  }
  const suit = tile[1] === "m" ? "万" : tile[1] === "p" ? "筒" : tile[1] === "s" ? "索" : "";
  return `${tile.includes("r") ? "赤" : ""}${tile[0]}${suit}`;
}

function formatAction(action: Record<string, unknown>) {
  return action.type === "dahai" ? `打 ${formatTile(action.pai)}` : String(action.type ?? "未知动作");
}

function comparisonTone(comparison: ClassicTrainingComparison) {
  return comparison.is_same
    ? "border-emerald-800/70 bg-emerald-950/50 text-emerald-100"
    : "border-amber-700/70 bg-amber-950/40 text-amber-100";
}

export function ClassicTraining() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["classic-training", matchId],
    queryFn: () => getClassicTrainingSession(matchId),
    enabled: Boolean(matchId),
  });

  const actionMutation = useMutation({
    mutationFn: (pai: string) => submitClassicTrainingAction(matchId, { type: "dahai", pai }),
    onSuccess: (session) => {
      queryClient.setQueryData(["classic-training", matchId], session);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => startPlayMatchReview(matchId),
    onSuccess: (job) => {
      navigate(job.review_id ? `/review/open/${job.review_id}` : `/review/task/${job.id}`);
    },
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const session = sessionQuery.data;
  const decision = session?.current_decision;
  const totalDecisions = session?.total_decisions ?? decision?.total_decisions ?? 0;
  const answeredCount = session?.answered_count ?? 0;
  const progress = totalDecisions > 0 ? Math.round((answeredCount / totalDecisions) * 100) : 100;

  const tableEntry = useMemo(() => {
    if (!decision) {
      return null;
    }
    const table =
      decision.state_snapshot.table && typeof decision.state_snapshot.table === "object"
        ? (decision.state_snapshot.table as Record<string, unknown>)
        : {};
    const tilesLeft = Number(table.tiles_left ?? 0);
    const kyokuIndex = Number(table.kyoku_index ?? decision.hand_index);
    const honba = Number(table.honba ?? 0);
    return {
      id: decision.decision_index + 1,
      state_snapshot: decision.state_snapshot,
      kyoku_index: Number.isFinite(kyokuIndex) ? kyokuIndex : decision.hand_index,
      honba: Number.isFinite(honba) ? honba : 0,
      tiles_left: Number.isFinite(tilesLeft) ? tilesLeft : 0,
      junme: decision.turn,
      is_match: false,
    };
  }, [decision]);

  const handleToggleFullscreen = async () => {
    try {
      if (!containerRef.current) {
        return;
      }
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen();
        return;
      }
      await containerRef.current.requestFullscreen();
    } catch {
      // Fullscreen is optional and may be blocked by browser policy.
    }
  };

  const handleTileSelect = (pai: string) => {
    if (!decision || actionMutation.isPending) {
      return;
    }
    if (!decision.options.some((option) => option.pai === pai)) {
      return;
    }
    actionMutation.mutate(pai);
  };

  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-slate-950 text-slate-200">
        <LoaderCircle className="h-5 w-5 animate-spin" />
        正在恢复经典训练...
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="container mx-auto px-4 py-16">
          <Alert variant="destructive" className="mx-auto max-w-2xl">
            <AlertTitle>无法读取经典训练</AlertTitle>
            <AlertDescription>
              {sessionQuery.error instanceof ApiError ? sessionQuery.error.detail : "训练会话不存在或已经失效。"}
            </AlertDescription>
          </Alert>
          <div className="mt-5 text-center">
            <Button asChild>
              <Link to="/classic">返回牌谱目录</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const comparison = session.comparison_summary;
  const sameCount = comparison?.same_count ?? 0;
  const differentCount = comparison?.different_count ?? 0;
  const agreementPercent = comparison ? Math.round(comparison.agreement_rate * 100) : 0;
  const actionError =
    actionMutation.error instanceof ApiError
      ? actionMutation.error.detail
      : actionMutation.error
        ? "提交动作失败，请重试。"
        : null;
  const reviewError =
    reviewMutation.error instanceof ApiError
      ? reviewMutation.error.detail
      : reviewMutation.error
        ? "创建复盘失败。"
        : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white lg:h-screen lg:overflow-hidden">
      <main className="min-h-screen w-full p-2 lg:h-screen">
        <div
          ref={containerRef}
          className="relative min-h-[calc(100vh-1rem)] overflow-hidden rounded-lg border border-slate-800 bg-black shadow-2xl lg:h-[calc(100vh-1rem)]"
        >
          <div className="grid min-h-[calc(100vh-1rem)] lg:h-full lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="relative flex min-h-[68vh] items-center justify-center overflow-hidden bg-black p-2 lg:min-h-0 lg:p-4">
              <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
                <Button asChild variant="secondary" size="sm" className="bg-slate-900/85 text-white hover:bg-slate-800">
                  <Link to="/classic">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    退出训练
                  </Link>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-slate-900/85 text-white hover:bg-slate-800"
                  onClick={() => void handleToggleFullscreen()}
                >
                  {isFullscreen ? <Shrink className="mr-2 h-4 w-4" /> : <Expand className="mr-2 h-4 w-4" />}
                  {isFullscreen ? "退出全屏" : "全屏"}
                </Button>
              </div>

              {decision && tableEntry ? (
                <>
                  <MahjongAiReviewFrame
                    entry={tableEntry}
                    targetPlayerLabel={session.username}
                    fitViewport
                    interactive
                    interactionDisabled={actionMutation.isPending}
                    onTileSelect={handleTileSelect}
                    title="MahjongLab 经典牌谱训练牌桌"
                  />
                  <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md bg-slate-900/85 px-3 py-2 text-sm text-slate-200 backdrop-blur">
                    {actionMutation.isPending ? "正在记录选择..." : "点击自家手牌作答，本题不会改写后续题面"}
                  </div>
                  {actionError ? (
                    <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-md bg-red-950/95 px-4 py-2 text-sm text-red-100 shadow-lg">
                      {actionError}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="w-[min(100%-2rem,520px)] rounded-xl border border-slate-700 bg-slate-900/95 p-8 text-center shadow-2xl">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950">
                    <Check className="h-6 w-6 text-emerald-300" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold">{comparison?.route_label ?? "经典训练完成"}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {comparison?.route_description ?? `已完成全部 ${answeredCount} 个独立决策点。`}
                  </p>
                  {comparison ? (
                    <div className="mx-auto mt-5 max-w-sm border-y border-slate-700 py-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="text-sm text-slate-400">与原谱选择一致度</span>
                        <span className="text-2xl font-bold tabular-nums text-white">{agreementPercent}%</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full bg-blue-500" style={{ width: `${agreementPercent}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {reviewError ? <div className="mt-4 text-sm text-red-300">{reviewError}</div> : null}
                  <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                    <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
                      {reviewMutation.isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileSearch className="mr-2 h-4 w-4" />
                      )}
                      进入复盘
                    </Button>
                    <Button asChild variant="outline" className="border-slate-600 bg-slate-900 text-white hover:bg-slate-800">
                      <Link to={`/classic?game=${encodeURIComponent(session.game.id)}`}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        重新训练
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <aside className="flex min-h-[520px] flex-col border-t border-slate-800 bg-slate-950 lg:min-h-0 lg:border-l lg:border-t-0">
              <div className="border-b border-slate-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400">经典牌谱训练</div>
                    <h1 className="mt-1 font-semibold text-white">{session.game.title}</h1>
                    <p className="mt-1 text-sm text-slate-400">
                      {decision ? `${decision.hand_label} · 第 ${decision.turn} 巡` : "训练已完成"}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-slate-700 text-slate-300">
                    独立决策
                  </Badge>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-xs text-slate-400">
                    <span>训练进度</span>
                    <span>
                      {answeredCount} / {totalDecisions}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-slate-800"
                    role="progressbar"
                    aria-label="经典训练进度"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <div className="h-full bg-blue-500 transition-[width] duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {comparison ? (
                  <div className="mt-4 grid grid-cols-2 divide-x divide-slate-800 border-y border-slate-800 py-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-emerald-300">{sameCount}</div>
                      <div className="text-xs text-slate-500">与原谱一致</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-amber-300">{differentCount}</div>
                      <div className="text-xs text-slate-500">形成分歧</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 border-y border-slate-800 py-3 text-sm leading-6 text-slate-400">
                    每个决策点都还原原谱当时的局面。你的选择会被记录，但答案将在全部完成后统一揭晓。
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <div className="text-sm font-medium text-slate-200">
                  {comparison ? "路线对比" : "训练说明"}
                </div>
                <Button asChild variant="ghost" size="sm" className="h-8 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <Link to="/play/history">
                    <History className="mr-2 h-4 w-4" />
                    训练记录
                  </Link>
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {!comparison ? (
                  <div className="space-y-5 px-2 py-5">
                    <div>
                      <div className="text-sm font-semibold text-slate-200">答案暂不揭晓</div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        这里不是一场从首次分歧继续推演的模拟对局，而是一组取自经典牌谱的独立决策题。
                        因此前一题的选择不会改变后一题的手牌和场况。
                      </p>
                    </div>
                    <div className="border-t border-slate-800 pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">还剩</span>
                        <span className="font-semibold tabular-nums text-white">
                          {Math.max(totalDecisions - answeredCount, 0)} 个决策点
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        全部完成后，将按整体一致度、各小局表现和具体分歧点统一展示结果。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="px-1">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <div className="text-xs text-slate-500">整体路线</div>
                          <div className="mt-1 font-semibold text-white">{comparison.route_label}</div>
                        </div>
                        <div className="text-2xl font-bold tabular-nums text-white">{agreementPercent}%</div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full bg-blue-500" style={{ width: `${agreementPercent}%` }} />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{comparison.route_description}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-600">
                        一致度只表示与原谱路线的接近程度，不代表绝对优劣；可进入复盘查看更具体的牌效分析。
                      </p>
                    </div>

                    <div className="border-t border-slate-800 pt-4">
                      <div className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        分局表现
                      </div>
                      <div className="space-y-3">
                        {comparison.hands.map((hand) => {
                          const handPercent = Math.round(hand.agreement_rate * 100);
                          return (
                            <div key={hand.hand_index} className="px-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-300">{hand.hand_label}</span>
                                <span className="tabular-nums text-slate-400">
                                  {hand.same_count}/{hand.decision_count} 一致
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                                <div className="h-full bg-slate-500" style={{ width: `${handPercent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-slate-800 pt-4">
                      <div className="mb-3 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                        决策明细
                      </div>
                      <div className="space-y-2">
                        {session.history.map((item) => (
                          <div
                            key={item.decision_index}
                            className={`rounded-lg border px-3 py-3 ${comparisonTone(item)}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs font-medium">
                                {item.hand_label} · 第 {item.turn} 巡
                              </div>
                              {item.is_same ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <div className="text-xs opacity-60">你的选择</div>
                                <div className="mt-1 font-semibold">{formatAction(item.actual_action)}</div>
                              </div>
                              <div>
                                <div className="text-xs opacity-60">原谱动作</div>
                                <div className="mt-1 font-semibold">{formatAction(item.original_action)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
