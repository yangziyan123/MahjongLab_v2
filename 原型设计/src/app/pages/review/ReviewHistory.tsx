import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ArrowLeft, Search, FileText, Download, Trash2, Eye } from "lucide-react";

export function ReviewHistory() {
  const mockHistory = [
    {
      id: "report-1",
      taskId: "task-1",
      date: "2026-03-29 14:35:00",
      source: "天凤",
      player: "玩家1",
      rank: 2,
      score: "+5,200",
      decisions: 12,
      highDeviation: 3,
    },
    {
      id: "report-2",
      taskId: "task-2",
      date: "2026-03-28 10:20:00",
      source: "雀魂",
      player: "玩家1",
      rank: 1,
      score: "+12,000",
      decisions: 15,
      highDeviation: 1,
    },
    {
      id: "report-3",
      taskId: "task-3",
      date: "2026-03-27 16:45:00",
      source: "天凤",
      player: "玩家1",
      rank: 4,
      score: "-15,000",
      decisions: 18,
      highDeviation: 7,
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
              <h1 className="text-2xl font-bold text-slate-900 ml-4">历史复盘</h1>
            </div>
            <Link to="/review/import">
              <Button>
                <FileText className="w-4 h-4 mr-2" />
                新建复盘
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Filter Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="搜索玩家、任务 ID..."
                    className="pl-10"
                  />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="来源平台" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部平台</SelectItem>
                    <SelectItem value="tenhou">天凤</SelectItem>
                    <SelectItem value="majsoul">雀魂</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all">
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="时间范围" />
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

          {/* History List */}
          <div className="space-y-4">
            {mockHistory.map((report) => (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{report.source}</Badge>
                        <Badge variant={report.rank === 1 ? "default" : "secondary"}>
                          第 {report.rank} 位
                        </Badge>
                        <span className={`font-semibold ${
                          report.score.startsWith("+") ? "text-green-600" : "text-red-600"
                        }`}>
                          {report.score}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>任务 ID: {report.taskId}</span>
                          <span>·</span>
                          <span>玩家: {report.player}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <span>{report.date}</span>
                          <span>·</span>
                          <span>{report.decisions} 个决策点</span>
                          {report.highDeviation > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-red-600 font-medium">
                                {report.highDeviation} 处高偏差
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link to={`/review/report/${report.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          查看
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        导出
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
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
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  暂无复盘记录
                </h3>
                <p className="text-slate-600 mb-6">
                  开始导入牌谱，创建您的第一个复盘报告
                </p>
                <Link to="/review/import">
                  <Button>
                    导入牌谱
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
