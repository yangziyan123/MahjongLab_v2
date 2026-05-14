import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PlayCircle, FileSearch, History } from "lucide-react";

export function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-slate-900">MahjongLab</h1>
          <p className="text-slate-600 mt-2">面向日麻玩家的 AI 学习与训练平台</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              从打牌到复盘，构建完整训练闭环
            </h2>
            <p className="text-xl text-slate-600">
              通过 AI 驱动的复盘分析和实战训练，提升你的日麻技能
            </p>
          </div>

          {/* Main Actions */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* AI 对战 */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <PlayCircle className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>AI 对战训练</CardTitle>
                <CardDescription>
                  与 AI 对手进行实战对局，训练你的决策能力
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link to="/play/config">
                  <Button className="w-full" size="lg">
                    开始训练
                  </Button>
                </Link>
                <Link to="/play/history">
                  <Button variant="outline" className="w-full">
                    <History className="w-4 h-4 mr-2" />
                    查看历史训练
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* AI 复盘 */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <FileSearch className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle>AI 复盘分析</CardTitle>
                <CardDescription>
                  导入牌谱，让 AI 帮你分析失误和改进点
                </CardDescription>
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
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-slate-600">
          <p>MahjongLab - 日麻学习平台</p>
        </div>
      </footer>
    </div>
  );
}
