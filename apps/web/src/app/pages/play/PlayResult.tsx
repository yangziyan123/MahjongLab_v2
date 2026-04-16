import { Link, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, FileSearch } from "lucide-react";

export function PlayResult() {
  const { sessionId } = useParams();

  const results = [
    { rank: 1, name: "AI 对手 B", score: 35200, delta: "+10,200", isPlayer: false },
    { rank: 2, name: "您", score: 28600, delta: "+3,600", isPlayer: true },
    { rank: 3, name: "AI 对手 A", score: 22400, delta: "-2,400", isPlayer: false },
    { rank: 4, name: "AI 对手 C", score: 13800, delta: "-11,200", isPlayer: false },
  ];

  const keyMoments = [
    {
      kyoku: "东2局1本场",
      event: "和牌",
      description: "听牌后第3巡自摸，3番30符",
      impact: "+3,900",
    },
    {
      kyoku: "东3局0本场",
      event: "放铳",
      description: "对手立直后第5巡放铳",
      impact: "-5,800",
    },
    {
      kyoku: "东4局1本场",
      event: "立直",
      description: "成功立直并自摸，逆转排名",
      impact: "+7,200",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/play/history">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回历史记录
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 ml-4">对局结算</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Celebration Banner */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-8 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">对局完成！</h2>
            <p className="text-blue-100 text-lg">您获得了第 2 位</p>
            <div className="mt-4">
              <span className="text-4xl font-bold">+3,600</span>
              <span className="text-blue-100 ml-2">点</span>
            </div>
          </div>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>最终排名</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((result) => (
                  <div
                    key={result.rank}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                      result.isPlayer
                        ? "bg-blue-50 border-blue-300"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                          result.rank === 1
                            ? "bg-yellow-400 text-yellow-900"
                            : result.rank === 2
                            ? "bg-slate-300 text-slate-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {result.rank}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {result.name}
                          {result.isPlayer && (
                            <Badge variant="default">您</Badge>
                          )}
                        </div>
                        <div className="text-sm text-slate-600">
                          {result.score.toLocaleString()} 点
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-xl font-bold ${
                          result.delta.startsWith("+")
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {result.delta}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>对局统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">2</div>
                  <div className="text-sm text-slate-600">和牌次数</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">1</div>
                  <div className="text-sm text-slate-600">立直次数</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">1</div>
                  <div className="text-sm text-slate-600">放铳次数</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">18</div>
                  <div className="text-sm text-slate-600">总巡数</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Moments */}
          <Card>
            <CardHeader>
              <CardTitle>关键转折</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {keyMoments.map((moment, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="flex-shrink-0">
                      {moment.impact.startsWith("+") ? (
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                          <TrendingDown className="w-5 h-5 text-red-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{moment.kyoku}</Badge>
                        <Badge>{moment.event}</Badge>
                      </div>
                      <p className="text-sm text-slate-700 mb-1">{moment.description}</p>
                      <p
                        className={`text-sm font-semibold ${
                          moment.impact.startsWith("+") ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {moment.impact}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Training Summary */}
          <Card>
            <CardHeader>
              <CardTitle>训练总结</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="font-semibold text-green-900 mb-2">表现良好</div>
                  <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                    <li>立直时机选择准确，成功率高</li>
                    <li>手牌效率较好，听牌速度快</li>
                  </ul>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="font-semibold text-yellow-900 mb-2">可以改进</div>
                  <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                    <li>东3局放铳可以避免，需要提高防守意识</li>
                    <li>部分鸣牌决策过于激进</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="text-center">
                  <FileSearch className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 mb-2">转入 AI 复盘</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    让 AI 分析这局对战，找出失误和改进点
                  </p>
                  <Link to={`/review/task/task-from-${sessionId}`}>
                    <Button className="w-full">
                      开始复盘
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Trophy className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <h3 className="font-bold text-slate-900 mb-2">继续训练</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    使用相同配置再来一局
                  </p>
                  <Link to="/play/config">
                    <Button variant="outline" className="w-full">
                      创建新对局
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Session Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>对局 ID：</span>
                  <span className="font-mono">{sessionId}</span>
                </div>
                <div className="flex justify-between">
                  <span>规则：</span>
                  <span>东风场 - 标准规则</span>
                </div>
                <div className="flex justify-between">
                  <span>AI 难度：</span>
                  <span>中级</span>
                </div>
                <div className="flex justify-between">
                  <span>完成时间：</span>
                  <span>2026-03-29 15:30:00</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex gap-4">
            <Link to="/play/history" className="flex-1">
              <Button variant="outline" className="w-full">
                返回历史记录
              </Button>
            </Link>
            <Link to="/" className="flex-1">
              <Button variant="outline" className="w-full">
                返回首页
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
