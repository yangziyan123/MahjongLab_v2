import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileSearch, LoaderCircle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { ApiError, createReviewJob, getPlayMatch, getPlayMatchExportUrl } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export function PlayResult() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const matchQuery = useQuery({
    queryKey: ["play-match", sessionId],
    queryFn: () => getPlayMatch(sessionId),
    enabled: Boolean(sessionId),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      createReviewJob({
        source_type: "internal_match",
        platform: "internal",
        source: { match_id: sessionId },
        target_player_ref: "0",
      }),
    onSuccess: (job) => {
      navigate(`/review/task/${job.id}`);
    },
  });

  const handleExport = () => {
    window.open(getPlayMatchExportUrl(sessionId), "_blank", "noopener,noreferrer");
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
  const finalScores = Array.isArray(match.result?.score) ? (match.result?.score as number[]) : [];
  const reviewError =
    reviewMutation.error instanceof ApiError
      ? reviewMutation.error.detail
      : reviewMutation.error instanceof Error
      ? reviewMutation.error.message
      : null;

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
            {finalScores.length > 0 ? <div>最终分数：{finalScores.join(" / ")}</div> : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-2 font-bold text-slate-900">转入 AI 复盘</h3>
              <p className="mb-4 text-sm text-slate-600">将当前对局事件直接交给复盘引擎，生成报告。</p>
              {reviewError ? <div className="mb-3 text-sm text-red-600">{reviewError}</div> : null}
              <Button className="w-full" onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileSearch className="mr-2 h-4 w-4" />
                )}
                开始复盘
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
