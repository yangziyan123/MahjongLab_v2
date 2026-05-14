import { ArrowLeft, PlayCircle, Target } from "lucide-react";
import { Link } from "react-router";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export function PlayHistory() {
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
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                <Target className="h-6 w-6 text-emerald-700" />
              </div>
              <CardTitle>训练记录暂未接入</CardTitle>
              <CardDescription>
                当前版本的 AI 对战记录会在对局结束页展示，并可直接转入复盘。独立的训练历史列表还没有后端接口。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Button asChild size="lg">
                <Link to="/play/config">开始一局训练</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/review/history">查看历史复盘</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 p-5 text-sm text-slate-600 sm:grid-cols-3">
              <div>
                <div className="font-semibold text-slate-900">训练结束后</div>
                <p className="mt-1">在结果页查看事件数、小局数和最终分数。</p>
              </div>
              <div>
                <div className="font-semibold text-slate-900">可复盘时</div>
                <p className="mt-1">直接创建当前进度的 AI 复盘任务。</p>
              </div>
              <div>
                <div className="font-semibold text-slate-900">形成闭环</div>
                <p className="mt-1">从报告中把偏差巡目加入错题库。</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
