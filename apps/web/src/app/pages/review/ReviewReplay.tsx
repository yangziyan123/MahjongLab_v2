import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRightCircle, ChevronLeft, ChevronRight, Layers3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { getReview, listAllReviewEntries } from "../../lib/api";
import { formatDecisionType, formatKyokuLabel } from "../../lib/format";
import type { ReviewEntry } from "../../lib/types";
import { MahjongAiReviewFrame } from "../../components/mahjong/MahjongAiReviewFrame";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

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

export function ReviewReplay() {
  const { reportId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const entryFromQuery = Number(searchParams.get("entry") ?? "");
  const entryQuery = Number.isInteger(entryFromQuery) && entryFromQuery > 0 ? `?entry=${entryFromQuery}` : "";
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(
    Number.isInteger(entryFromQuery) && entryFromQuery > 0 ? entryFromQuery : null,
  );

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

  useEffect(() => {
    if (entries.length === 0 || selectedEntryId !== null) {
      return;
    }
    setSelectedEntryId(entries[0].id);
  }, [entries, selectedEntryId]);

  const selectedEntry = useMemo(() => {
    return entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null;
  }, [entries, selectedEntryId]);
  const selectedEntryIndex = selectedEntry ? entries.findIndex((entry) => entry.id === selectedEntry.id) : -1;
  const selectedEntryQuery = selectedEntry ? `?entry=${selectedEntry.id}` : entryQuery;

  if (reviewQuery.isLoading || entriesQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        正在加载逐步复盘...
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
            <CardContent className="py-12 text-center text-red-600">无法读取这份复盘。</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const review = reviewQuery.data;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center">
              <Link to={`/review/open/${reportId}${selectedEntryQuery}`}>
                <Button variant="secondary" size="sm" className="bg-slate-800 text-white hover:bg-slate-700">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回选择
                </Button>
              </Link>
              <div className="ml-4">
                <h1 className="text-2xl font-bold">逐步复盘</h1>
                <p className="text-sm text-slate-400">{review.target_player_label || `玩家 ${review.target_actor}`}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={`/review/report/${reportId}${selectedEntryQuery}`}>
                <Button variant="outline" size="sm" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  直接查看报告
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <Card className="h-fit border-slate-800 bg-slate-900 text-white">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Layers3 className="mr-2 h-5 w-5" />
                复盘步骤
              </CardTitle>
              <CardDescription className="text-slate-400">按决策点顺序推进牌桌。</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-220px)] space-y-3 overflow-y-auto pr-2">
              {entries.length === 0 && <div className="rounded-lg bg-slate-800 p-4 text-sm text-slate-400">没有可复盘的决策点。</div>}
              {entries.map((entry, index) => {
                const active = entry.id === selectedEntry?.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntryId(entry.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      active ? "border-sky-400 bg-sky-950/70" : "border-slate-800 bg-slate-950 hover:bg-slate-800"
                    }`}
                  >
                    <div className="mb-2 flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-slate-600 text-slate-200">
                        {index + 1}
                      </Badge>
                      <Badge variant="outline" className="border-slate-600 text-slate-200">
                        {formatKyokuLabel(entry.kyoku_index, entry.honba)}
                      </Badge>
                      {getDeviationBadge(entry)}
                    </div>
                    <div className="text-sm font-semibold">{formatDecisionType(entry.decision_type)}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      实际：{formatAction(entry.actual_action)}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selectedEntry ? (
              <>
                <Card className="border-slate-800 bg-slate-900 text-white">
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle>{formatKyokuLabel(selectedEntry.kyoku_index, selectedEntry.honba)}</CardTitle>
                        <CardDescription className="text-slate-400">
                          第 {selectedEntry.junme} 巡 · {formatDecisionType(selectedEntry.decision_type)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 bg-slate-950 text-white hover:bg-slate-800"
                          onClick={() => {
                            if (selectedEntryIndex > 0) {
                              setSelectedEntryId(entries[selectedEntryIndex - 1].id);
                            }
                          }}
                          disabled={selectedEntryIndex <= 0}
                        >
                          <ChevronLeft className="mr-1 h-4 w-4" />
                          上一步
                        </Button>
                        <div className="min-w-20 text-center text-sm text-slate-400">
                          {selectedEntryIndex + 1} / {entries.length}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 bg-slate-950 text-white hover:bg-slate-800"
                          onClick={() => {
                            if (selectedEntryIndex >= 0 && selectedEntryIndex < entries.length - 1) {
                              setSelectedEntryId(entries[selectedEntryIndex + 1].id);
                            }
                          }}
                          disabled={selectedEntryIndex < 0 || selectedEntryIndex >= entries.length - 1}
                        >
                          下一步
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start 2xl:grid-cols-[minmax(0,1fr)_380px]">
                      <MahjongAiReviewFrame entry={selectedEntry} targetPlayerLabel={review.target_player_label} />
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <Card className="border-rose-900/70 bg-rose-950/50 text-white">
                    <CardHeader>
                      <CardTitle>你的动作</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{formatAction(selectedEntry.actual_action)}</CardContent>
                  </Card>
                  <Card className="border-emerald-800 bg-emerald-950/50 text-white">
                    <CardHeader>
                      <CardTitle>AI 推荐</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-bold">{formatAction(selectedEntry.expected_action)}</CardContent>
                  </Card>
                </div>

                <Card className="border-slate-800 bg-slate-900 text-white">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <ArrowRightCircle className="mr-2 h-5 w-5" />
                      候选动作
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {(selectedEntry.details ?? []).map((candidate, index) => (
                      <div key={index} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                        <div className="text-sm text-slate-400">候选 {index + 1}</div>
                        <div className="mt-1 font-semibold">
                          {formatAction(candidate.expected_action ?? selectedEntry.expected_action)}
                        </div>
                        <div className="mt-2 text-sm text-slate-400">
                          Q 值 {candidate.best_q_value ?? "-"} · 概率 {candidate.prob ?? "-"}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-slate-800 bg-slate-900 text-white">
                <CardContent className="py-16 text-center text-slate-400">没有可展示的复盘步骤。</CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
