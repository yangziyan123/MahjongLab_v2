import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileSearch, History, PlayCircle, Sparkles } from "lucide-react";
import { Link } from "react-router";

import { getDashboardSummary, getMe, listReviews } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function Home() {
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });
  const recentReviewsQuery = useQuery({
    queryKey: ["home-reviews"],
    queryFn: () => listReviews({ page: 1, page_size: 3 }),
  });

  const reviewCount = summaryQuery.data?.review_count ?? 0;
  const completedJobCount = summaryQuery.data?.completed_job_count ?? 0;
  const failedJobCount = summaryQuery.data?.failed_job_count ?? 0;
  const recentReviews = recentReviewsQuery.data?.items ?? [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#eff6ff_40%,_#eef2ff_100%)]">
      <header className="border-b border-slate-200/70 bg-white/85 shadow-sm backdrop-blur">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">MahjongLab</h1>
              <p className="mt-2 text-slate-600">先把复盘做扎实，再把对战接上来。</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              当前用户：
              <span className="ml-2 font-semibold text-slate-900">
                {meQuery.data?.display_name ?? "加载中"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <Card className="overflow-hidden border-0 bg-slate-900 text-white shadow-xl shadow-slate-200">
              <CardContent className="relative px-8 py-10">
                <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
                <div className="relative max-w-2xl space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-slate-200">
                    <Sparkles className="h-4 w-4" />
                    阶段 2：复盘前端 MVP
                  </div>
                  <h2 className="text-4xl font-bold leading-tight">
                    从一条真实复盘链路开始，先把训练闭环做出来。
                  </h2>
                  <p className="text-lg text-slate-300">
                    当前已接通真实 API，可直接上传牌谱、查看任务状态、浏览逐手复盘报告。
                  </p>
                  <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                    <Link to="/review/import">
                      <Button size="lg" className="w-full bg-white text-slate-900 hover:bg-slate-100">
                        开始复盘
                      </Button>
                    </Link>
                    <Link to="/review/history">
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                      >
                        查看历史报告
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle>当前数据摘要</CardTitle>
                <CardDescription>这里显示的是后端真实返回的数据。</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1">
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
              </CardContent>
            </Card>
          </div>

          <div className="mb-12 grid gap-8 md:grid-cols-2">
            <Card className="border-slate-200/80 bg-white/90 shadow-sm transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <PlayCircle className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>AI 对战训练</CardTitle>
                <CardDescription>对战页面保留入口，但本阶段只做占位，不接真实对局。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link to="/play/config">
                  <Button className="w-full" size="lg">
                    查看下一阶段入口
                  </Button>
                </Link>
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  当前阶段不会展示 mock 对战流程，避免和真实进度混淆。
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 shadow-sm transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                  <FileSearch className="h-6 w-6 text-emerald-600" />
                </div>
                <CardTitle>AI 复盘分析</CardTitle>
                <CardDescription>这条链路已经接到了真实后端，可直接演示。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link to="/review/import">
                  <Button className="w-full" size="lg">
                    导入牌谱
                  </Button>
                </Link>
                <Link to="/review/history">
                  <Button variant="outline" className="w-full">
                    <History className="w-4 h-4 mr-2" />
                    查看历史复盘
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr]">
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <h3 className="mb-6 flex items-center text-2xl font-bold text-slate-900">
                <BookOpen className="mr-2 h-6 w-6" />
                平台特性
              </h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <h4 className="mb-2 font-semibold text-slate-900">真实 API 驱动</h4>
                  <p className="text-sm text-slate-600">
                    复盘任务、报告摘要、逐手分析都来自当前阶段的 FastAPI 后端。
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-slate-900">原型页面复用</h4>
                  <p className="text-sm text-slate-600">
                    保留原型的页面骨架和视觉语言，只替换业务状态和接口调用。
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-slate-900">逐手复盘准备就绪</h4>
                  <p className="text-sm text-slate-600">
                    支持按局、按动作类型、按偏差等级查看结构化分析结果。
                  </p>
                </div>
              </div>
            </div>

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
                    to={`/review/report/${review.id}`}
                    className="block rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {review.target_player_label || `玩家 ${review.target_actor}`}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {formatDateTime(review.created_at)}
                        </div>
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

      <footer className="mt-16 border-t bg-white/90">
        <div className="container mx-auto px-4 py-6 text-center text-slate-600">
          <p>MahjongLab - 阶段 2 当前可演示复盘 Web 流程</p>
        </div>
      </footer>
    </div>
  );
}
