import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ArrowLeft, Search, PlayCircle, Eye, RotateCcw, Trophy } from "lucide-react";

export function PlayHistory() {
  const mockHistory = [
    {
      id: "session-1",
      date: "2026-03-29 15:30:00",
      rule: "东风场",
      difficulty: "中级",
      rank: 2,
      score: "+3,600",
      goal: "无特定目标",
      winRate: "50%",
    },
    {
      id: "session-2",
      date: "2026-03-27 10:15:00",
      rule: "半庄场",
      difficulty: "高级",
      rank: 3,
      score: "-8,200",
      goal: "防守训练",
      winRate: "25%",
    },
    {
      id: "session-3",
      date: "2026-03-26 14:20:00",
      rule: "东风场",
      difficulty: "中级",
      rank: 1,
      score: "+15,200",
      goal: "进攻训练",
      winRate: "100%",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回首页
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 ml-4">历史训练</h1>
            </div>
            <Link to="/play/config">
              <Button>
                <PlayCircle className="w-4 h-4 mr-2" />
                新建对局
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Statistics Summary */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">3</div>
                  <div className="text-sm text-slate-600 mt-1">总对局数</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">1</div>
                  <div className="text-sm text-slate-600 mt-1">第一位</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">2.0</div>
                  <div className="text-sm text-slate-600 mt-1">平均排名</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">58%</div>
                  <div className="text-sm text-slate-600 mt-1">和牌率</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="搜索对局 ID..."
                    className="pl-10"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="规则" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部规则</SelectItem>
                    <SelectItem value="tonpu">东风场</SelectItem>
                    <SelectItem value="hanchan">半庄场</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="难度" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部难度</SelectItem>
                    <SelectItem value="easy">初级</SelectItem>
                    <SelectItem value="medium">中级</SelectItem>
                    <SelectItem value="hard">高级</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="时间" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部时间</SelectItem>
                    <SelectItem value="today">今天</SelectItem>
                    <SelectItem value="week">最近7天</SelectItem>
                    <SelectItem value="month">最近30天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Training Goals Progress */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">训练目标完成情况</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-700">进攻训练</span>
                    <span className="text-slate-600">5 / 10 局</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: "50%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-700">防守训练</span>
                    <span className="text-slate-600">3 / 10 局</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: "30%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-700">立直判断训练</span>
                    <span className="text-slate-600">7 / 10 局</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: "70%" }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History List */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">对局记录</h3>
            {mockHistory.map((session) => (
              <Card key={session.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        {session.rank === 1 && (
                          <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                            <Trophy className="w-4 h-4 text-yellow-900" />
                          </div>
                        )}
                        <Badge variant={session.rank === 1 ? "default" : "secondary"}>
                          第 {session.rank} 位
                        </Badge>
                        <span className={`font-bold text-lg ${
                          session.score.startsWith("+") ? "text-green-600" : "text-red-600"
                        }`}>
                          {session.score}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant="outline">{session.rule}</Badge>
                          <Badge variant="outline">{session.difficulty}</Badge>
                          {session.goal !== "无特定目标" && (
                            <Badge variant="outline" className="bg-blue-50">
                              {session.goal}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>对局 ID: {session.id}</span>
                          <span>·</span>
                          <span>{session.date}</span>
                          <span>·</span>
                          <span>和牌率: {session.winRate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link to={`/play/result/${session.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          查看结果
                        </Button>
                      </Link>
                      <Link to={`/review/task/task-from-${session.id}`}>
                        <Button variant="outline" size="sm">
                          转入复盘
                        </Button>
                      </Link>
                      <Link to="/play/config">
                        <Button variant="ghost" size="sm">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State (if no records) */}
          {mockHistory.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <PlayCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  暂无训练记录
                </h3>
                <p className="text-slate-600 mb-6">
                  开始您的第一场 AI 对战训练
                </p>
                <Link to="/play/config">
                  <Button>
                    创建对局
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {mockHistory.length > 0 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled>
                上一页
              </Button>
              <Button variant="outline" size="sm">
                1
              </Button>
              <Button variant="outline" size="sm">
                2
              </Button>
              <Button variant="outline" size="sm">
                下一页
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
