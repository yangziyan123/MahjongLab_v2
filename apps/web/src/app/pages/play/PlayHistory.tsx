import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, FileSearch, LoaderCircle, PlayCircle, Search, Trophy } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { ApiError, listPlayMatches, startPlayMatchReview } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import {
  formatMatchType,
  formatReviewJobStatus,
  formatSignedPoints,
  formatTrainingHistoryStatus,
  getClassicTrainingUrl,
  getPlayConfigUrl,
  getPlayerScoreRow,
  isClassicTrainingMatch,
} from "../../lib/play";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import type { PlayMatch } from "../../lib/types";

export function PlayHistory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ruleFilter, setRuleFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [pendingReviewMatchId, setPendingReviewMatchId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const pageSize = 10;

  const matchesQuery = useQuery({
    queryKey: ["play-matches", deferredSearch, statusFilter, ruleFilter, timeFilter, page],
    queryFn: () =>
      listPlayMatches({
        q: deferredSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        match_type: ruleFilter === "all" ? undefined : ruleFilter,
        date_range: timeFilter,
        page,
        page_size: pageSize,
      }),
  });

  const matches = matchesQuery.data?.items ?? [];
  const total = matchesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const summary = useMemo(() => {
    const playerRows = matches.map(getPlayerScoreRow).filter(Boolean);
    const completedCount = matches.filter((match) => match.status === "completed").length;
    const reviewableCount = matches.filter((match) => match.reviewable_event_count > 0).length;
    const rankedRows = playerRows.filter((row) => row?.rank !== undefined);
    const avgRank = rankedRows.length
      ? rankedRows.reduce((total, row) => total + (row?.rank ?? 0), 0) / rankedRows.length
      : undefined;
    return { completedCount, reviewableCount, avgRank };
  }, [matches]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleStartReview = async (match: PlayMatch) => {
    setPendingReviewMatchId(match.id);
    setReviewError(null);
    try {
      if (match.latest_review_job && match.latest_review_job.status !== "failed") {
        if (match.latest_review_job.review_id) {
          navigate(`/review/open/${match.latest_review_job.review_id}`);
          return;
        }
        navigate(`/review/task/${match.latest_review_job.id}`);
        return;
      }
      const job = await startPlayMatchReview(match.id);
      if (job.review_id) {
        navigate(`/review/open/${job.review_id}`);
        return;
      }
      navigate(`/review/task/${job.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setReviewError(error.detail);
      } else {
        setReviewError("创建复盘任务失败。");
      }
    } finally {
      setPendingReviewMatchId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center">
              <Button asChild variant="ghost" size="sm">
                <Link to="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回首页
                </Link>
              </Button>
              <h1 className="ml-4 text-2xl font-bold text-slate-900">历史训练</h1>
            </div>
            <Button asChild>
              <Link to="/play/config">
                <PlayCircle className="mr-2 h-4 w-4" />
                新建对局
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-slate-900">{total}</div>
                <div className="mt-1 text-sm text-slate-600">筛选结果</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-slate-900">{summary.completedCount}</div>
                <div className="mt-1 text-sm text-slate-600">本页已完成</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-emerald-700">{summary.reviewableCount}</div>
                <div className="mt-1 text-sm text-slate-600">本页可复盘</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-slate-900">
                  {summary.avgRank === undefined ? "-" : summary.avgRank.toFixed(1)}
                </div>
                <div className="mt-1 text-sm text-slate-600">本页平均排名</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_repeat(3,180px)]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="搜索对局 ID 或用户名"
                    className="pl-10"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="round_finished">小局已结算</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="failed">失败</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={ruleFilter}
                  onValueChange={(value) => {
                    setRuleFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="规则" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部规则</SelectItem>
                    <SelectItem value="tonpu">东风战</SelectItem>
                    <SelectItem value="hanchan">半庄战</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={timeFilter}
                  onValueChange={(value) => {
                    setTimeFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="时间" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部时间</SelectItem>
                    <SelectItem value="today">今天</SelectItem>
                    <SelectItem value="week">最近 7 天</SelectItem>
                    <SelectItem value="month">最近 30 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {reviewError ? (
            <Alert variant="destructive">
              <AlertTitle>无法创建复盘</AlertTitle>
              <AlertDescription>{reviewError}</AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>对局记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {matchesQuery.isLoading ? (
                <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  <span>正在读取训练记录...</span>
                </div>
              ) : matchesQuery.isError ? (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  {matchesQuery.error instanceof ApiError ? matchesQuery.error.detail : "训练记录读取失败。"}
                </div>
              ) : matches.length === 0 ? (
                <div className="py-12 text-center">
                  <PlayCircle className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900">暂无训练记录</h3>
                  <p className="mt-2 text-sm text-slate-500">完成一场 AI 对战后，这里会显示可查看、可复盘的记录。</p>
                  <Button asChild className="mt-5">
                    <Link to="/play/config">创建对局</Link>
                  </Button>
                </div>
              ) : (
                matches.map((match) => {
                  const playerRow = getPlayerScoreRow(match);
                  const isClassic = isClassicTrainingMatch(match);
                  const reviewLabel = match.latest_review_job
                    ? formatReviewJobStatus(match.latest_review_job.status)
                    : match.reviewable_event_count > 0
                    ? "可复盘"
                    : "待结算";
                  return (
                    <div key={match.id} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {playerRow?.rank === 1 ? (
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                                <Trophy className="h-4 w-4 text-amber-700" />
                              </div>
                            ) : null}
                            <Badge variant={match.status === "completed" ? "default" : "secondary"}>
                              {formatTrainingHistoryStatus(match.status)}
                            </Badge>
                            {isClassic ? <Badge variant="outline">经典牌谱</Badge> : null}
                            {playerRow?.rank ? <Badge variant="outline">第 {playerRow.rank} 位</Badge> : null}
                            <span className={playerRow?.delta && playerRow.delta < 0 ? "font-bold text-rose-600" : "font-bold text-emerald-700"}>
                              {formatSignedPoints(playerRow?.delta)}
                            </span>
                          </div>
                          <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                            <div>
                              <span className="text-slate-400">玩家</span>
                              <div className="font-medium text-slate-900">{match.target_player_label || "未识别"}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">规则</span>
                              <div className="font-medium text-slate-900">{formatMatchType(match.match_type)}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">更新时间</span>
                              <div className="font-medium text-slate-900">{formatDateTime(match.updated_at)}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span className="rounded-md bg-slate-50 px-2 py-1">事件 {match.event_count}</span>
                            <span className="rounded-md bg-slate-50 px-2 py-1">可复盘 {match.reviewable_event_count}</span>
                            <span className="rounded-md bg-slate-50 px-2 py-1">{reviewLabel}</span>
                            <span className="rounded-md bg-slate-50 px-2 py-1 break-all">ID {match.id}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button asChild variant="outline" size="sm">
                            <Link to={isClassic ? getClassicTrainingUrl(match) : getPlayConfigUrl(match)}>
                              <PlayCircle className="mr-2 h-4 w-4" />
                              {isClassic ? "重新训练" : "再来一局"}
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/play/result/${match.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              查看结果
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleStartReview(match)}
                            disabled={pendingReviewMatchId === match.id || match.reviewable_event_count <= 0}
                          >
                            {pendingReviewMatchId === match.id ? (
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileSearch className="mr-2 h-4 w-4" />
                            )}
                            转入复盘
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {total > pageSize ? (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </Button>
              <div className="rounded-md border bg-white px-4 py-2 text-sm text-slate-600">
                第 {page} / {totalPages} 页，共 {total} 局
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
