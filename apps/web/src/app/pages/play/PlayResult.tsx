import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSearch, History, LoaderCircle, PlayCircle, Trophy } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, getPlayMatch, getPlayMatchExportUrl, startPlayMatchReview } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import {
  formatMatchStatus,
  formatMatchType,
  formatReviewJobStatus,
  formatSignedPoints,
  getPlayerScoreRow,
  getPlayScoreRows,
} from "../../lib/play";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export function PlayResult() {
  const { sessionId: matchId = "" } = useParams();
  const navigate = useNavigate();
  const matchQuery = useQuery({
    queryKey: ["play-match", matchId],
    queryFn: () => getPlayMatch(matchId),
    enabled: Boolean(matchId),
  });

  const reviewMutation = useMutation({
    mutationFn: () => startPlayMatchReview(matchId),
    onSuccess: (job) => {
      if (job.review_id) {
        navigate(`/review/open/${job.review_id}`);
        return;
      }
      navigate(`/review/task/${job.id}`);
    },
  });

  const handleExport = () => {
    window.open(getPlayMatchExportUrl(matchId), "_blank", "noopener,noreferrer");
  };

  if (matchQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 text-slate-500 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>正在读取对局结果...</span>
        </div>
      </div>
    );
  }

  if (matchQuery.isError || !matchQuery.data) {
    const detail = matchQuery.error instanceof ApiError ? matchQuery.error.detail : "无法读取对局结果";
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <Button asChild variant="ghost" size="sm">
              <Link to="/play/config">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回入口
              </Link>
            </Button>
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
                  <Link to="/play/config">返回入口</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const match = matchQuery.data;
  const scoreRows = getPlayScoreRows(match);
  const playerRow = getPlayerScoreRow(match);
  const latestReviewJob = match.latest_review_job;
  const latestReviewJobForCurrentSnapshot =
    latestReviewJob?.event_count === match.reviewable_event_count ? latestReviewJob : null;
  const canStartReview = match.reviewable_event_count > 0;
  const reviewError =
    reviewMutation.error instanceof ApiError
      ? reviewMutation.error.detail
      : reviewMutation.error instanceof Error
      ? reviewMutation.error.message
      : null;
  const reviewDisabled =
    reviewMutation.isPending || (!canStartReview && latestReviewJobForCurrentSnapshot?.status !== "completed");
  const reviewButtonLabel = latestReviewJobForCurrentSnapshot
    ? latestReviewJobForCurrentSnapshot.status === "completed"
      ? "打开复盘"
      : latestReviewJobForCurrentSnapshot.status === "failed"
      ? "重新开始复盘"
      : "查看复盘进度"
    : "开始复盘";

  const handleStartReview = () => {
    if (latestReviewJobForCurrentSnapshot && latestReviewJobForCurrentSnapshot.status !== "failed") {
      if (latestReviewJobForCurrentSnapshot.review_id) {
        navigate(`/review/open/${latestReviewJobForCurrentSnapshot.review_id}`);
        return;
      }
      navigate(`/review/task/${latestReviewJobForCurrentSnapshot.id}`);
      return;
    }
    reviewMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <Button asChild variant="ghost" size="sm">
              <Link to="/play/history">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回历史记录
              </Link>
            </Button>
            <h1 className="ml-4 text-2xl font-bold text-slate-900">对局结算</h1>
          </div>
          <Button asChild>
            <Link to="/play/config">
              <PlayCircle className="mr-2 h-4 w-4" />
              新建对局
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100">
                <Trophy className="h-7 w-7 text-slate-800" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {playerRow?.rank ? `第 ${playerRow.rank} 位` : "对局已记录"}
                  </h2>
                  <Badge variant={match.status === "completed" ? "default" : "secondary"}>
                    {formatMatchStatus(match.status)}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-slate-500">{formatMatchType(match.match_type)}</div>
                <div className="mt-1 text-sm text-slate-500">完成时间：{formatDateTime(match.updated_at)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                <div className="text-xl font-bold text-slate-900">{playerRow?.score?.toLocaleString() ?? "-"}</div>
                <div className="text-xs text-slate-500">最终点数</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                <div className={playerRow?.delta && playerRow.delta < 0 ? "text-xl font-bold text-rose-600" : "text-xl font-bold text-emerald-700"}>
                  {formatSignedPoints(playerRow?.delta)}
                </div>
                <div className="text-xs text-slate-500">点数变化</div>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
                <div className="text-xl font-bold text-slate-900">{match.completed_kyoku_count}</div>
                <div className="text-xs text-slate-500">已结算小局</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>最终排名</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {scoreRows.map((row) => (
                  <div
                    key={row.actor}
                    className={row.isPlayer
                      ? "rounded-lg border border-blue-200 bg-blue-50 p-4"
                      : "rounded-lg border border-slate-200 bg-white p-4"}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-700">
                          {row.rank ?? row.actor + 1}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                            {row.name}
                            {row.isPlayer ? <Badge>你</Badge> : row.isAi ? <Badge variant="secondary">AI</Badge> : null}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{row.score?.toLocaleString() ?? "-"} 点</div>
                        </div>
                      </div>
                      <div className={row.delta && row.delta < 0 ? "text-lg font-bold text-rose-600" : "text-lg font-bold text-emerald-700"}>
                        {formatSignedPoints(row.delta)}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>后续动作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestReviewJobForCurrentSnapshot ? (
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    当前复盘任务：{formatReviewJobStatus(latestReviewJobForCurrentSnapshot.status)}
                  </div>
                ) : null}
                {latestReviewJob && !latestReviewJobForCurrentSnapshot ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    当前对局记录已新增内容，可以重新创建复盘。
                  </div>
                ) : null}
                {!canStartReview && !latestReviewJobForCurrentSnapshot ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    至少完成一个小局结算后才能开始复盘。
                  </div>
                ) : null}
                {reviewError ? (
                  <Alert variant="destructive">
                    <AlertTitle>复盘任务失败</AlertTitle>
                    <AlertDescription>{reviewError}</AlertDescription>
                  </Alert>
                ) : null}
                <Button className="w-full" onClick={handleStartReview} disabled={reviewDisabled}>
                  {reviewMutation.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSearch className="mr-2 h-4 w-4" />
                  )}
                  {reviewButtonLabel}
                </Button>
                <Button variant="outline" className="w-full" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  导出 JSONL
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/play/history">
                    <History className="mr-2 h-4 w-4" />
                    查看历史训练
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
