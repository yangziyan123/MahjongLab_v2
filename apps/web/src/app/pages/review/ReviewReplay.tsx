import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightCircle,
  ChevronLeft,
  ChevronRight,
  Layers3,
  SkipForward,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { getReview, listAllReviewEntries } from "../../lib/api";
import { formatDecisionType, formatKyokuLabel } from "../../lib/format";
import type { ReviewEntry } from "../../lib/types";
import { MahjongAiReviewFrame } from "../../components/mahjong/MahjongAiReviewFrame";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

type StepFilter = "all" | "problems" | "high";

function formatAction(action?: Record<string, unknown> | null) {
  if (!action) {
    return "无动作";
  }

  const type = String(action.type ?? "unknown");
  const pai = typeof action.pai === "string" ? action.pai : "";
  const consumed = Array.isArray(action.consumed) ? action.consumed.join(" ") : "";

  if (type === "dahai") {
    return `打 ${pai}`;
  }
  if (type === "reach") {
    return "立直";
  }
  if (type === "chi") {
    return `吃 ${pai} ${consumed}`.trim();
  }
  if (type === "pon") {
    return `碰 ${pai} ${consumed}`.trim();
  }
  if (type === "daiminkan" || type === "ankan" || type === "kakan") {
    return `${type} ${pai || consumed}`.trim();
  }
  if (type === "hora") {
    return "和牌";
  }
  if (type === "ryukyoku") {
    return "流局";
  }
  if (type === "none") {
    return "跳过";
  }
  return JSON.stringify(action);
}

function getDeviationBadge(entry: ReviewEntry) {
  if (entry.deviation_level === "none") {
    return <Badge variant="secondary">命中最优</Badge>;
  }
  if (entry.deviation_level === "high") {
    return <Badge variant="destructive">高偏差</Badge>;
  }
  return <Badge variant="outline">中偏差</Badge>;
}

function getDeviationSummary(entry: ReviewEntry) {
  if (entry.deviation_level === "none") {
    return "这一步命中 AI 推荐，适合快速确认当时局面。";
  }
  if (entry.deviation_level === "high") {
    return "这是高偏差决策，优先对照牌桌、实际动作和候选动作。";
  }
  return "这是中偏差决策，建议检查候选动作之间的价值差。";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function ReviewReplay() {
  const { reportId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const entryFromQuery = Number(searchParams.get("entry") ?? "");
  const entryQuery = Number.isInteger(entryFromQuery) && entryFromQuery > 0 ? `?entry=${entryFromQuery}` : "";
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(
    Number.isInteger(entryFromQuery) && entryFromQuery > 0 ? entryFromQuery : null,
  );
  const [stepFilter, setStepFilter] = useState<StepFilter>("all");

  const reviewQuery = useQuery({
    queryKey: ["review", reportId],
    queryFn: () => getReview(reportId),
    enabled: Boolean(reportId),
  });

  const entriesQuery = useQuery({
    queryKey: ["review-replay-entries", reportId],
    queryFn: () => listAllReviewEntries({ reviewId: reportId }),
    enabled: Boolean(reportId),
  });

  const entries = entriesQuery.data ?? [];

  const selectedEntry = useMemo(() => {
    if (selectedEntryId === null) {
      return null;
    }
    return entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;
  }, [entries, selectedEntryId]);
  const selectedEntryIndex = selectedEntry ? entries.findIndex((entry) => entry.id === selectedEntry.id) : -1;
  const selectedEntryQuery = selectedEntry ? `?entry=${selectedEntry.id}` : entryQuery;
  const filteredEntries = useMemo(() => {
    if (stepFilter === "high") {
      return entries.filter((entry) => entry.deviation_level === "high");
    }
    if (stepFilter === "problems") {
      return entries.filter((entry) => entry.deviation_level !== "none");
    }
    return entries;
  }, [entries, stepFilter]);
  const groupedEntries = useMemo(() => {
    const groups: Array<{ key: string; label: string; entries: ReviewEntry[] }> = [];
    for (const entry of filteredEntries) {
      const key = `${entry.kyoku_index}-${entry.honba}`;
      const existing = groups.find((group) => group.key === key);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.push({
          key,
          label: formatKyokuLabel(entry.kyoku_index, entry.honba),
          entries: [entry],
        });
      }
    }
    return groups;
  }, [filteredEntries]);
  const problemCount = useMemo(() => entries.filter((entry) => entry.deviation_level !== "none").length, [entries]);
  const highDeviationCount = useMemo(() => entries.filter((entry) => entry.deviation_level === "high").length, [entries]);
  const topCandidates = selectedEntry?.details?.slice(0, 3) ?? [];

  const selectEntryByIndex = useCallback(
    (index: number) => {
      const nextEntry = entries[index];
      if (nextEntry) {
        setSelectedEntryId(nextEntry.id);
      }
    },
    [entries],
  );

  const goToAdjacentEntry = useCallback(
    (direction: -1 | 1) => {
      if (selectedEntryIndex < 0) {
        return;
      }
      selectEntryByIndex(selectedEntryIndex + direction);
    },
    [selectEntryByIndex, selectedEntryIndex],
  );

  const goToNextProblem = useCallback(() => {
    if (entries.length === 0) {
      return;
    }
    const startIndex = selectedEntryIndex >= 0 ? selectedEntryIndex + 1 : 0;
    const orderedEntries = [...entries.slice(startIndex), ...entries.slice(0, startIndex)];
    const nextProblem = orderedEntries.find((entry) => entry.deviation_level !== "none");
    if (nextProblem) {
      setSelectedEntryId(nextProblem.id);
    }
  }, [entries, selectedEntryIndex]);

  useEffect(() => {
    if (entries.length === 0 || selectedEntryId !== null) {
      return;
    }
    setSelectedEntryId(entries[0].id);
  }, [entries, selectedEntryId]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      if (selectedEntryId !== null) {
        setSelectedEntryId(null);
      }
      return;
    }
    if (selectedEntry && filteredEntries.some((entry) => entry.id === selectedEntry.id)) {
      return;
    }
    setSelectedEntryId(filteredEntries[0].id);
  }, [filteredEntries, selectedEntry, selectedEntryId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "j") {
        event.preventDefault();
        goToAdjacentEntry(-1);
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        goToAdjacentEntry(1);
      }
      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        goToNextProblem();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToAdjacentEntry, goToNextProblem]);

  if (reviewQuery.isLoading || entriesQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">正在加载逐步复盘...</div>
      </div>
    );
  }

  if (reviewQuery.isError || entriesQuery.isError || !reviewQuery.data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b bg-white shadow-sm">
          <div className="container mx-auto flex items-center px-4 py-4">
            <Link to="/review/history">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回历史
              </Button>
            </Link>
            <h1 className="ml-4 text-2xl font-bold text-slate-900">逐步复盘</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-red-600">无法读取这份复盘。</div>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  重试
                </Button>
                <Button asChild>
                  <Link to="/review/history">返回历史</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const review = reviewQuery.data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center">
              <Link to={`/review/open/${reportId}${selectedEntryQuery}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回选择
                </Button>
              </Link>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-slate-900">逐步复盘</h1>
                <p className="text-sm text-slate-500">{review.target_player_label || `玩家 ${review.target_actor}`}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                快捷键：J/← 上一步 · K/→ 下一步 · P 下一处问题
              </div>
              <Link to={`/review/report/${reportId}${selectedEntryQuery}`}>
                <Button variant="outline" size="sm">
                  直接查看报告
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="h-fit border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Layers3 className="mr-2 h-5 w-5" />
                复盘步骤
              </CardTitle>
              <CardDescription>按决策点顺序推进牌桌，优先处理偏差项。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <button
                  type="button"
                  onClick={() => setStepFilter("all")}
                  className={`min-h-11 rounded-lg border px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
                    stepFilter === "all" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  全部 {entries.length}
                </button>
                <button
                  type="button"
                  onClick={() => setStepFilter("problems")}
                  className={`min-h-11 rounded-lg border px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${
                    stepFilter === "problems"
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  问题 {problemCount}
                </button>
                <button
                  type="button"
                  onClick={() => setStepFilter("high")}
                  className={`min-h-11 rounded-lg border px-2 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 ${
                    stepFilter === "high" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  高偏差 {highDeviationCount}
                </button>
              </div>

              <div className="max-h-[calc(100vh-278px)] space-y-4 overflow-y-auto pr-2">
                {filteredEntries.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    当前筛选下没有复盘步骤。
                  </div>
                )}
                {groupedEntries.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <div className="sticky top-0 z-[1] bg-white/95 py-1 text-xs font-medium text-slate-500 backdrop-blur">
                      {group.label}
                    </div>
                    {group.entries.map((entry) => {
                      const active = entry.id === selectedEntry?.id;
                      const absoluteIndex = entries.findIndex((item) => item.id === entry.id);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedEntryId(entry.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
                            active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <div className="mb-2 flex flex-wrap gap-2">
                            <Badge variant="outline">{absoluteIndex + 1}</Badge>
                            {getDeviationBadge(entry)}
                          </div>
                          <div className="text-sm font-semibold text-slate-900">{formatDecisionType(entry.decision_type)}</div>
                          <div className="mt-1 text-xs text-slate-500">实际：{formatAction(entry.actual_action)}</div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selectedEntry ? (
              <>
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {getDeviationBadge(selectedEntry)}
                          <Badge variant="outline">
                            {selectedEntryIndex + 1} / {entries.length}
                          </Badge>
                        </div>
                        <CardTitle>{formatKyokuLabel(selectedEntry.kyoku_index, selectedEntry.honba)}</CardTitle>
                        <CardDescription>
                          第 {selectedEntry.junme} 巡 · {formatDecisionType(selectedEntry.decision_type)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            goToAdjacentEntry(-1);
                          }}
                          disabled={selectedEntryIndex <= 0}
                        >
                          <ChevronLeft className="mr-1 h-4 w-4" />
                          上一步
                        </Button>
                        <Button variant="outline" size="sm" onClick={goToNextProblem} disabled={problemCount === 0}>
                          <SkipForward className="mr-1 h-4 w-4" />
                          下一处问题
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            goToAdjacentEntry(1);
                          }}
                          disabled={selectedEntryIndex < 0 || selectedEntryIndex >= entries.length - 1}
                        >
                          下一步
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 text-sm font-medium text-slate-700">当前决策摘要</div>
                      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                          <div className="text-xs font-medium text-rose-700">你的动作</div>
                          <div className="mt-1 text-lg font-bold text-slate-950">{formatAction(selectedEntry.actual_action)}</div>
                        </div>
                        <ArrowRightCircle className="mx-auto hidden h-5 w-5 text-slate-400 md:block" />
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                          <div className="text-xs font-medium text-emerald-700">AI 推荐</div>
                          <div className="mt-1 text-lg font-bold text-slate-950">{formatAction(selectedEntry.expected_action)}</div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-600">{getDeviationSummary(selectedEntry)}</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start 2xl:grid-cols-[minmax(0,1fr)_380px]">
                      <MahjongAiReviewFrame entry={selectedEntry} targetPlayerLabel={review.target_player_label} />
                      <aside className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="mb-1 flex items-center text-base font-semibold text-slate-900">
                          <ArrowRightCircle className="mr-2 h-5 w-5" />
                          候选动作
                        </div>
                        <p className="mb-4 text-sm text-slate-500">Q 值越高，表示 AI 对该动作的局面评价越好。</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          {topCandidates.length === 0 && (
                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                              当前步骤没有候选动作明细。
                            </div>
                          )}
                          {topCandidates.map((candidate, index) => (
                            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                              <div className="text-sm text-slate-500">候选 {index + 1}</div>
                              <div className="mt-1 font-semibold text-slate-900">
                                {formatAction(candidate.expected_action ?? selectedEntry.expected_action)}
                              </div>
                              <div className="mt-2 text-sm text-slate-500">
                                Q 值 {candidate.best_q_value ?? "-"} · 概率 {candidate.prob ?? "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </aside>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="py-16 text-center">
                  <div className="text-slate-500">没有可展示的复盘步骤。</div>
                  <div className="mt-4">
                    <Button asChild>
                      <Link to={`/review/report/${reportId}`}>返回完整报告</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
