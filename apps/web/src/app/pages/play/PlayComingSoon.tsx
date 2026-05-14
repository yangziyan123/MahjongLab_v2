import { Link } from "react-router";
import { ArrowLeft, Bot } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export function PlayComingSoon() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex items-center px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Button>
          </Link>
          <h1 className="ml-4 text-2xl font-bold text-slate-900">AI 对战</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                <Bot className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle>AI 对战</CardTitle>
              <CardDescription>当前暂不提供在线对战，可先使用复盘分析功能。</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button asChild className="flex-1">
                <Link to="/review/import">去体验复盘</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/">
                  返回首页
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
