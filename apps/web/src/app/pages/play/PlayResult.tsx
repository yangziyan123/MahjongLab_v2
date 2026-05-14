import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSearch, LoaderCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, getPlayMatch, getPlayMatchExportUrl, startPlayMatchReview } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import type { ReviewJobStatus } from "../../lib/types";

function formatReviewJobStatus(status: ReviewJobStatus) {
  const labels: Record<ReviewJobStatus, string> = {
    created: "已创建",
    queued: "排队中",
    parsing: "解析中",
    analyzing: "分析中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

function formatScore(score: unknown) {
  if (!Array.isArray(score)) {
    return "";
  }
  return score
    .map((item, index) => {
      if (Array.isArray(item) && item.length >= 2) {
        const actor = Number(item[0]);
        const rawScore = Number(item[1]);
        const displayScore = Number.isFinite(rawScore) ? rawScore * 100 : item[1];
        return `${index + 1}. ${Number.isFinite(actor) ? `${actor}号位` : "玩家"} ${displayScore}`;
      }
      if (typeof item === "number") {
        return `${index}号位 ${item}`;
      }
      return String(item);
    })
    .join(" / ");
}

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
        navigate(`/review/report/${job.review_id}`);
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
        <LoaderCircle className="h-8 w-8 animate-spin text-slate-500" />
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
            <CardContent className="py-12 text-center text-red-600">{detail}</CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const match = matchQuery.data;
  const finalScoreText = formatScore(match.result?.score);
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
      ? "查看复盘报告"
      : latestReviewJobForCurrentSnapshot.status === "failed"
      ? "重新开始复盘"
      : "查看复盘进度"
    : "开始复盘";

  const handleStartReview = () => {
    if (latestReviewJobForCurrentSnapshot && latestReviewJobForCurrentSnapshot.status !== "failed") {
      if (latestReviewJobForCurrentSnapshot.review_id) {
        navigate(`/review/report/${latestReviewJobForCurrentSnapshot.review_id}`);
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
        <div className="container mx-auto px-4 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/play/config">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回入口
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>对局已结束</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <div>对局 ID：{match.id}</div>
            <div>状态：{match.status}</div>
            <div>记录事件：{match.event_count}</div>
            <div>可复盘事件：{match.reviewable_event_count}</div>
            <div>已结算小局：{match.completed_kyoku_count}</div>
            {match.target_player_label ? (
              <div>
                复盘对象：{match.target_player_label}
                {typeof match.target_actor === "number" ? `（${match.target_actor}号位）` : null}
              </div>
            ) : null}
            {finalScoreText ? <div>最终分数：{finalScoreText}</div> : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-2 font-bold text-slate-900">转入 AI 复盘</h3>
              <p className="mb-4 text-sm text-slate-600">
                使用本局记录到的真实玩家座位，将对局事件直接交给复盘引擎。
              </p>
              {latestReviewJobForCurrentSnapshot ? (
                <div className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
                  当前进度复盘任务：{formatReviewJobStatus(latestReviewJobForCurrentSnapshot.status)}
                </div>
              ) : null}
              {latestReviewJob && !latestReviewJobForCurrentSnapshot ? (
                <div className="mb-3 text-sm text-slate-600">
                  已有较早进度的复盘任务，当前已结算小局有新增内容，可以重新创建复盘。
                </div>
              ) : null}
              {!canStartReview && !latestReviewJobForCurrentSnapshot ? (
                <div className="mb-3 text-sm text-amber-700">至少完成一个小局结算后才能开始复盘。</div>
              ) : null}
              {reviewError ? <div className="mb-3 text-sm text-red-600">{reviewError}</div> : null}
              <Button className="w-full" onClick={handleStartReview} disabled={reviewDisabled}>
                {reviewMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSearch className="mr-2 h-4 w-4" />
                )}
                {reviewButtonLabel}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-2 font-bold text-slate-900">生成对局文件</h3>
              <p className="mb-4 text-sm text-slate-600">导出本局事件为 JSONL 文件，用于留存或手动导入。</p>
              <Button variant="outline" className="w-full" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                导出 JSONL
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
