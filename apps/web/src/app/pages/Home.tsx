import { useQuery } from "@tanstack/react-query";
import { FileSearch, History, PlayCircle, Target } from "lucide-react";
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
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#eff6ff_40%,_#eef2ff_100%)]">
      <header className="border-b border-slate-200/70 bg-white/85 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-slate-900">MahjongLab</h1>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-12">
        <div className="mx-auto max-w-6xl">
          {/* <div className="mb-10">
            <Card className="bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle>当前数据摘要</CardTitle>
                <CardDescription>这里显示的是系统汇总后的最新数据。</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">复盘总数</div>
                  <div className="mt-2 text-3xl font-bold text-slate-900">{reviewCount}</div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <div className="text-sm text-emerald-700">成功任务</div>
                  <div className="mt-2 text-3xl font-bold text-emerald-800">{completedJobCount}</div>
                </div>
                <div className="rounded-xl bg-rose-50 p-4">
                  <div className="text-sm text-rose-700">失败任务</div>
                  <div className="mt-2 text-3xl font-bold text-rose-800">{failedJobCount}</div>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <div className="text-sm text-amber-700">错题库条目</div>
                  <div className="mt-2 text-3xl font-bold text-amber-800">{mistakeCount}</div>
                </div>
              </CardContent>
            </Card>
          </div> */}
          <div className="mb-12 grid gap-8 md:grid-cols-2">
            <Card className="border-slate-200/80 bg-white/90 shadow-sm transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <PlayCircle className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>AI 对战训练</CardTitle>
                <CardDescription>仅支持4人麻将。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link to="/play/config">
                  <Button className="w-full" size="lg">
                    进入对战
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 shadow-sm transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                  <FileSearch className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle>AI 复盘分析</CardTitle>
                <CardDescription>导入牌谱后即可查看逐手复盘结果。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link to="/review/import">
                  <Button className="w-full" size="lg">
                    导入牌谱
                  </Button>
                </Link>
                <Link to="/review/history">
                  <Button variant="outline" className="w-full">
                    <History className="mr-2 h-4 w-4" />
                    查看历史复盘
                  </Button>
                </Link>
                <Link to="/training/mistakes">
                  <Button variant="outline" className="w-full">
                    <Target className="mr-2 h-4 w-4" />
                    进入错题库
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="bg-white/90 shadow-sm">
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

      <footer className="mt-auto border-t bg-white/90">
        <div className="container mx-auto px-4 py-6 text-center text-slate-600">
          <p>MahjongLab - 以复盘与训练为核心的日麻平台</p>
        </div>
      </footer>
    </div>
  );
}
