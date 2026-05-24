import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, FileText, Layers3 } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import { getReview } from "../../lib/api";
import { formatDateTime, formatPlatform } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export function ReviewOpen() {
  const { reportId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const entry = searchParams.get("entry");
  const entryQuery = entry ? `?entry=${encodeURIComponent(entry)}` : "";
  const reviewQuery = useQuery({
    queryKey: ["review", reportId],
    queryFn: () => getReview(reportId),
    enabled: Boolean(reportId),
  });

  if (reviewQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">正在读取复盘...</div>
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
            <h1 className="ml-4 text-2xl font-bold text-slate-900">打开复盘</h1>
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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex items-center px-4 py-4">
          <Link to="/review/history">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回历史
            </Button>
          </Link>
          <h1 className="ml-4 text-2xl font-bold text-slate-900">选择复盘方式</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                  <ClipboardList className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm text-slate-500">
                    {formatPlatform(review.platform)} · {review.engine_name} · {formatDateTime(review.created_at)}
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    {review.target_player_label || `玩家 ${review.target_actor}`} 的复盘
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    共 {review.reviewed_decision_count} 个决策点，{review.high_deviation_count} 处高偏差。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                  <Layers3 className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle>逐步牌桌复盘</CardTitle>
                <CardDescription>按决策点一步步推进牌桌，对照你的动作和 AI 推荐。</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" size="lg">
                  <Link to={`/review/replay/${reportId}${entryQuery}`}>
                    进入逐步复盘
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                  <FileText className="h-6 w-6 text-slate-700" />
                </div>
                <CardTitle>直接查看报告</CardTitle>
                <CardDescription>查看摘要、筛选器、候选动作和完整分析信息。</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" variant="outline" size="lg">
                  <Link to={`/review/report/${reportId}${entryQuery}`}>
                    查看报告
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
