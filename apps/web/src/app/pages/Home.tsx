import { useQuery } from "@tanstack/react-query";
import { FileSearch, History, PlayCircle } from "lucide-react";
import { Link } from "react-router";

import { listReviews } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function Home() {
  const recentReviewsQuery = useQuery({
    queryKey: ["home-reviews"],
    queryFn: () => listReviews({ page: 1, page_size: 3 }),
  });

  const recentReviews = recentReviewsQuery.data?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-slate-900">MahjongLab</h1>
          <p className="mt-1 text-sm text-slate-500">以复盘与训练为核心的日麻学习工作台</p>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 grid gap-8 md:grid-cols-2">
            <Card className="border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <PlayCircle className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>AI 对战训练</CardTitle>
                <CardDescription>启动本地 Mahjong-AI，对局结束后可直接转入复盘。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button asChild className="w-full" size="lg">
                  <Link to="/play/config">
                    进入对战
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/play/history">
                    <History className="mr-2 h-4 w-4" />
                    查看历史训练
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                  <FileSearch className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle>AI 复盘分析</CardTitle>
                <CardDescription>导入牌谱后即可查看逐手复盘结果。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button asChild className="w-full" size="lg">
                  <Link to="/review/import">
                    导入牌谱
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/review/history">
                    <History className="mr-2 h-4 w-4" />
                    查看历史复盘
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="mr-2 h-5 w-5" />
                  最近复盘
                </CardTitle>
                <CardDescription>
                  {recentReviewsQuery.isLoading ? "正在读取最近的报告..." : "最近三份真实复盘记录"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentReviews.length === 0 && (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                    还没有复盘记录。现在就可以从导入页创建第一份报告。
                  </div>
                )}
                {recentReviews.map((review) => (
                  <Link
                    key={review.id}
                    to={`/review/open/${review.id}`}
                    className="block rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {review.target_player_label || `玩家 ${review.target_actor}`}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{formatDateTime(review.created_at)}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-slate-900">{review.reviewed_decision_count} 个决策点</div>
                        <div className="text-rose-600">{review.high_deviation_count} 处高偏差</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-6 text-center text-slate-600">
          <p>MahjongLab - 以复盘与训练为核心的日麻平台</p>
        </div>
      </footer>
    </div>
  );
}
