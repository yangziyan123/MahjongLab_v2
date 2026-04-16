import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightCircle,
  CheckCircle2,
  Clock3,
  Layers3,
  TrendingDown,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router";

import { getReview, listReviewEntries } from "../../lib/api";
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

export function ReviewReport() {
  const { reportId = "" } = useParams();
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

  useEffect(() => {
    reset();
  }, [reportId, reset]);

  const reviewQuery = useQuery({
    queryKey: ["review", reportId],
    queryFn: () => getReview(reportId),
    enabled: Boolean(reportId),
  });

  const allEntriesQuery = useQuery({
    queryKey: ["review-entries-all", reportId],
    queryFn: () =>
      listReviewEntries({
        reviewId: reportId,
        page: 1,
        page_size: 500,
      }),
    enabled: Boolean(reportId),
  });

  const filteredEntriesQuery = useQuery({
    queryKey: ["review-entries", reportId, kyoku, deviationLevel, decisionType],
    queryFn: () =>
      listReviewEntries({
        reviewId: reportId,
        kyoku: kyoku === "all" ? undefined : Number(kyoku),
        deviation_level: deviationLevel === "all" ? undefined : deviationLevel,
        decision_type: decisionType === "all" ? undefined : decisionType,
        page: 1,
        page_size: 500,
      }),
    enabled: Boolean(reportId),
  });

  const allEntries = allEntriesQuery.data?.items ?? [];
  const filteredEntries = filteredEntriesQuery.data?.items ?? [];

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

  const detail = selectedEntry?.details?.[0];

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
            <CardContent className="py-12 text-center text-red-600">无法读取这份复盘报告。</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const review = reviewQuery.data;

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
          <Card className="overflow-hidden border-0 bg-slate-900 text-white shadow-xl shadow-slate-200">
            <CardContent className="grid gap-6 px-8 py-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
                  {formatPlatform(review.platform)} · {review.engine_name} · {review.model_tag || "未知模型"}
                </div>
                <h2 className="text-3xl font-bold">
                  {review.target_player_label || `玩家 ${review.target_actor}`} 的复盘报告
                </h2>
                <p className="max-w-2xl text-slate-300">
                  当前报告已接入真实后端，下面的逐手内容、动作对比和候选建议都来自结构化复盘结果。
                </p>
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/5 p-4">
                    <div className="text-sm text-slate-300">报告生成时间</div>
                    <div className="mt-1 font-semibold text-white">{formatDateTime(review.created_at)}</div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <div className="text-sm text-slate-300">决策命中率</div>
                    <div className="mt-1 font-semibold text-white">{review.rating ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/10 p-4">
                  <div className="text-sm text-slate-300">总决策数</div>
                  <div className="mt-2 text-3xl font-bold text-white">{review.reviewed_decision_count}</div>
                </div>
                <div className="rounded-2xl bg-emerald-400/15 p-4">
                  <div className="text-sm text-emerald-100">最优命中</div>
                  <div className="mt-2 text-3xl font-bold text-white">{review.optimal_count}</div>
                </div>
                <div className="rounded-2xl bg-amber-300/15 p-4">
                  <div className="text-sm text-amber-100">中偏差</div>
                  <div className="mt-2 text-3xl font-bold text-white">{review.medium_deviation_count}</div>
                </div>
                <div className="rounded-2xl bg-rose-400/15 p-4">
                  <div className="text-sm text-rose-100">高偏差</div>
                  <div className="mt-2 text-3xl font-bold text-white">{review.high_deviation_count}</div>
                </div>
              </div>
            </CardContent>
          </Card>

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

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Layers3 className="mr-2 h-5 w-5" />
                  巡目时间轴
                </CardTitle>
                <CardDescription>点击任一巡目，在右侧查看动作对比和候选动作。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredEntries.length === 0 && (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">当前筛选条件下没有复盘项。</div>
                )}
                {filteredEntries.map((entry) => {
                  const active = entry.id === selectedEntry?.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedEntryId(entry.id)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        active ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{formatKyokuLabel(entry.kyoku_index, entry.honba)}</Badge>
                        <Badge variant="outline">第 {entry.junme} 巡</Badge>
                        {getDeviationBadge(entry)}
                      </div>
                      <div className="font-semibold text-slate-900">{formatDecisionType(entry.decision_type)}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        实际：{formatAction(entry.actual_action)} | 推荐：{formatAction(entry.expected_action)}
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {selectedEntry ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{formatKyokuLabel(selectedEntry.kyoku_index, selectedEntry.honba)}</span>
                        {getDeviationBadge(selectedEntry)}
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
                            ，可以结合下方候选动作和状态快照理解偏差原因。
                          </div>
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
                        <CardDescription>当前后端会返回候选动作明细，后续阶段会补更丰富的 Top N 候选。</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
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
                          <span className="font-medium text-slate-900">{selectedEntry.delta_score ?? "-"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <TrendingDown className="mr-2 h-5 w-5" />
                        状态快照
                      </CardTitle>
                      <CardDescription>用于阶段 2 调试和人工验收，后续可替换为图形化局面展示。</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                        {JSON.stringify(selectedEntry.state_snapshot, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
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
