import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightCircle,
  Clock3,
  Layers3,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { getReview, listAllReviewEntries } from "../../lib/api";
import { formatDateTime, formatDecisionType, formatKyokuLabel, formatPlatform } from "../../lib/format";
import { useReviewReportStore } from "../../store/review-report";
import type { ReviewEntry } from "../../lib/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

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

function formatTrainingTag(tag: string) {
  const mapping: Record<string, string> = {
    defense: "防守",
    riichi_judgment: "立直判断",
    call_judgment: "鸣牌判断",
    efficiency: "牌效率",
    attack: "进攻",
    chi_judgment: "吃牌",
    pon_judgment: "碰牌",
    kan_judgment: "杠牌",
  };
  return mapping[tag] || tag;
}

export function ReviewReport() {
  const { reportId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const {
    kyoku,
    deviationLevel,
    decisionType,
    selectedEntryId,
    setKyoku,
    setDeviationLevel,
    setDecisionType,
    setSelectedEntryId,
    reset,
  } = useReviewReportStore();
  const entryFromQuery = Number(searchParams.get("entry") ?? "");
  const entryQuery = Number.isInteger(entryFromQuery) && entryFromQuery > 0 ? `?entry=${entryFromQuery}` : "";

  useEffect(() => {
    reset();
    if (Number.isInteger(entryFromQuery) && entryFromQuery > 0) {
      setSelectedEntryId(entryFromQuery);
    }
  }, [entryFromQuery, reportId, reset, setSelectedEntryId]);

  const reviewQuery = useQuery({
    queryKey: ["review", reportId],
    queryFn: () => getReview(reportId),
    enabled: Boolean(reportId),
  });

  const allEntriesQuery = useQuery({
    queryKey: ["review-entries-all", reportId],
    queryFn: () => listAllReviewEntries({ reviewId: reportId }),
    enabled: Boolean(reportId),
  });

  const filteredEntriesQuery = useQuery({
    queryKey: ["review-entries", reportId, kyoku, deviationLevel, decisionType],
    queryFn: () =>
      listAllReviewEntries({
        reviewId: reportId,
        kyoku: kyoku === "all" ? undefined : Number(kyoku),
        deviation_level: deviationLevel === "all" ? undefined : deviationLevel,
        decision_type: decisionType === "all" ? undefined : decisionType,
      }),
    enabled: Boolean(reportId),
  });
  const allEntries = allEntriesQuery.data ?? [];
  const filteredEntries = filteredEntriesQuery.data ?? [];

  useEffect(() => {
    if (filteredEntries.length === 0) {
      if (selectedEntryId !== null) {
        setSelectedEntryId(null);
      }
      return;
    }

    if (selectedEntryId && filteredEntries.some((entry) => entry.id === selectedEntryId)) {
      return;
    }

    setSelectedEntryId(filteredEntries[0].id);
  }, [filteredEntries, selectedEntryId, setSelectedEntryId]);

  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedEntryId) ?? filteredEntries[0] ?? null;

  const kyokuOptions = useMemo(() => {
    const seen = new Set<string>();
    return allEntries
      .map((entry) => ({ value: String(entry.kyoku_index), label: formatKyokuLabel(entry.kyoku_index, entry.honba) }))
      .filter((item) => {
        if (seen.has(item.value)) {
          return false;
        }
        seen.add(item.value);
        return true;
      });
  }, [allEntries]);
  const timelineGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; entries: ReviewEntry[] }> = [];

    for (const entry of filteredEntries) {
      const key = `${entry.kyoku_index}-${entry.honba}`;
      const current = groups[groups.length - 1];

      if (current?.key === key) {
        current.entries.push(entry);
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

  if (reviewQuery.isLoading || allEntriesQuery.isLoading || filteredEntriesQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        正在加载复盘报告...
      </div>
    );
  }

  if (reviewQuery.isError || !reviewQuery.data) {
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
            <h1 className="ml-4 text-2xl font-bold text-slate-900">复盘报告</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-red-600">无法读取这份复盘报告。</div>
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

  if (allEntriesQuery.isError || filteredEntriesQuery.isError) {
    const detail =
      allEntriesQuery.error instanceof Error
        ? allEntriesQuery.error.message
        : filteredEntriesQuery.error instanceof Error
          ? filteredEntriesQuery.error.message
          : "无法读取复盘条目。";

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
            <h1 className="ml-4 text-2xl font-bold text-slate-900">复盘报告</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-red-600">{detail}</div>
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
  const summary = review.summary ?? {};
  const mistakeCount =
    typeof summary.mistake_count === "number"
      ? summary.mistake_count
      : review.medium_deviation_count + review.high_deviation_count;
  const bigMistakeCount =
    typeof summary.big_mistake_count === "number" ? summary.big_mistake_count : review.high_deviation_count;
  const riichiMistakeCount = typeof summary.riichi_mistake_count === "number" ? summary.riichi_mistake_count : 0;
  const callMistakeCount = typeof summary.call_mistake_count === "number" ? summary.call_mistake_count : 0;
  const defenseMistakeCount = typeof summary.defense_mistake_count === "number" ? summary.defense_mistake_count : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white/95 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center">
              <Link to="/review/history">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回历史记录
                </Button>
              </Link>
              <h1 className="ml-4 text-2xl font-bold text-slate-900">复盘报告</h1>
            </div>
            <div className="flex gap-2">
              <Link to={`/review/replay/${reportId}${entryQuery}`}>
                <Button variant="outline" size="sm">
                  逐步复盘
                </Button>
              </Link>
              <Link to="/review/import">
                <Button variant="outline" size="sm">
                  新建复盘
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{formatPlatform(review.platform)}</Badge>
                  <Badge variant="secondary">{review.engine_name}</Badge>
                  <Badge variant="outline">{review.model_tag || "未知模型"}</Badge>
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-normal text-slate-950">
                    {review.target_player_label || `玩家 ${review.target_actor}`} 的复盘报告
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    逐手内容、动作对比和候选建议来自结构化复盘结果，重点用于定位偏差和沉淀下一轮训练。
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm text-slate-500">报告生成时间</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDateTime(review.created_at)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm text-slate-500">决策命中率</div>
                    <div className="mt-1 font-semibold text-slate-900">{review.rating ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">总决策数</div>
                  <div className="mt-2 text-3xl font-bold text-slate-950">{review.reviewed_decision_count}</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm text-emerald-700">最优命中</div>
                  <div className="mt-2 text-3xl font-bold text-emerald-950">{review.optimal_count}</div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm text-amber-700">中偏差</div>
                  <div className="mt-2 text-3xl font-bold text-amber-950">{review.medium_deviation_count}</div>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm text-rose-700">高偏差</div>
                  <div className="mt-2 text-3xl font-bold text-rose-950">{review.high_deviation_count}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-slate-500">总失误数</div>
                <div className="mt-2 text-3xl font-bold text-slate-900">{mistakeCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-rose-600">大失误数</div>
                <div className="mt-2 text-3xl font-bold text-rose-700">{bigMistakeCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-violet-600">立直判断偏差</div>
                <div className="mt-2 text-3xl font-bold text-violet-700">{riichiMistakeCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-amber-600">鸣牌判断偏差</div>
                <div className="mt-2 text-3xl font-bold text-amber-700">{callMistakeCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="text-sm text-cyan-600">防守失误</div>
                <div className="mt-2 text-3xl font-bold text-cyan-700">{defenseMistakeCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>筛选器</CardTitle>
              <CardDescription>按局、偏差等级和动作类型切换要查看的复盘项。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">局</div>
                <Select value={kyoku} onValueChange={setKyoku}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部局</SelectItem>
                    {kyokuOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">偏差等级</div>
                <Select value={deviationLevel} onValueChange={setDeviationLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="none">最优命中</SelectItem>
                    <SelectItem value="medium">中偏差</SelectItem>
                    <SelectItem value="high">高偏差</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">动作类型</div>
                <Select value={decisionType} onValueChange={setDecisionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="discard">打牌</SelectItem>
                    <SelectItem value="riichi">立直</SelectItem>
                    <SelectItem value="chi">吃</SelectItem>
                    <SelectItem value="pon">碰</SelectItem>
                    <SelectItem value="kan">杠</SelectItem>
                    <SelectItem value="agari">和牌</SelectItem>
                    <SelectItem value="ryukyoku">流局</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <div className="w-full rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  当前显示：
                  <span className="ml-2 font-semibold text-slate-900">
                    {filteredEntries.length} / {allEntries.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
            <Card className="h-fit border-slate-200 bg-white shadow-sm lg:sticky lg:top-24">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between gap-3">
                  <span className="flex items-center">
                    <Layers3 className="mr-2 h-5 w-5" />
                    巡目时间轴
                  </span>
                  <Badge variant="outline">{filteredEntries.length} 项</Badge>
                </CardTitle>
                <CardDescription>点击任一巡目，在右侧查看动作对比和候选动作。</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredEntries.length === 0 && (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">当前筛选条件下没有复盘项。</div>
                )}
                {filteredEntries.length > 0 && (
                  <div className="max-h-[520px] space-y-4 overflow-y-auto pr-2 lg:max-h-[calc(100vh-280px)]">
                    {timelineGroups.map((group) => (
                      <div key={group.key} className="space-y-2">
                        <div className="sticky top-0 z-[1] bg-white py-1 text-xs font-semibold text-slate-500">
                          {group.label}
                        </div>
                        {group.entries.map((entry) => {
                          const active = entry.id === selectedEntry?.id;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => setSelectedEntryId(entry.id)}
                              className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge variant="outline">第 {entry.junme} 巡</Badge>
                                {getDeviationBadge(entry)}
                              </div>
                              <div className="font-semibold text-slate-900">{formatDecisionType(entry.decision_type)}</div>
                              <div className="mt-1 text-sm text-slate-600">
                                实际：{formatAction(entry.actual_action)} | 推荐：{formatAction(entry.expected_action)}
                              </div>
                              {entry.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {entry.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary">
                                      {formatTrainingTag(tag)}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {selectedEntry ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                        <span>{formatKyokuLabel(selectedEntry.kyoku_index, selectedEntry.honba)}</span>
                        <div className="flex items-center gap-2">
                          {getDeviationBadge(selectedEntry)}
                        </div>
                      </CardTitle>
                      <CardDescription>
                        第 {selectedEntry.junme} 巡 · 剩余牌 {selectedEntry.tiles_left} 张 · 动作类型{" "}
                        {formatDecisionType(selectedEntry.decision_type)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                          <div className="mb-2 text-sm font-semibold text-rose-900">你的动作</div>
                          <div className="text-lg font-bold text-slate-900">{formatAction(selectedEntry.actual_action)}</div>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="mb-2 text-sm font-semibold text-emerald-900">AI 推荐</div>
                          <div className="text-lg font-bold text-slate-900">{formatAction(selectedEntry.expected_action)}</div>
                        </div>
                      </div>

                      {!selectedEntry.is_match && (
                        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                          <div className="text-sm text-blue-900">
                            这手没有命中推荐动作。当前差异等级为
                            <span className="mx-1 font-semibold">{selectedEntry.deviation_level}</span>
                            ，可以结合下方候选动作和局面信息理解偏差原因。
                          </div>
                        </div>
                      )}

                      {selectedEntry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedEntry.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {formatTrainingTag(tag)}
                            </Badge>
                          ))}
                        </div>
                      )}

                    </CardContent>
                  </Card>

                  <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <ArrowRightCircle className="mr-2 h-5 w-5" />
                          候选动作
                        </CardTitle>
                        <CardDescription>这里展示本次分析返回的候选动作明细。</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(selectedEntry.details ?? []).length === 0 && (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                            当前复盘项没有候选动作明细。
                          </div>
                        )}
                        {(selectedEntry.details ?? []).map((candidate, index) => (
                          <div key={index} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-sm text-slate-500">候选 {index + 1}</div>
                                <div className="mt-1 font-semibold text-slate-900">
                                  {formatAction(candidate.expected_action ?? selectedEntry.expected_action)}
                                </div>
                              </div>
                              <div className="text-right text-sm">
                                <div className="font-semibold text-slate-900">
                                  Q 值 {candidate.best_q_value ?? "-"}
                                </div>
                                <div className="text-slate-500">概率 {candidate.prob ?? "-"}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Clock3 className="mr-2 h-5 w-5" />
                          局面信息
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">最后出牌者</span>
                          <span className="font-medium text-slate-900">{selectedEntry.last_actor ?? "-"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">最近相关牌</span>
                          <span className="font-medium text-slate-900">{selectedEntry.tile ?? "-"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">向听数</span>
                          <span className="font-medium text-slate-900">{selectedEntry.shanten ?? "-"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">振听</span>
                          <span className="font-medium text-slate-900">{selectedEntry.at_furiten ? "是" : "否"}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Delta</span>
                          <span className="font-medium text-slate-900">
                            {typeof selectedEntry.delta_score === "number" ? selectedEntry.delta_score.toFixed(2) : "-"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center text-slate-500">
                    当前筛选条件下没有可展示的复盘项。
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
