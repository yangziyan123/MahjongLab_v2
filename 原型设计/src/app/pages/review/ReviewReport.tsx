import { useState } from "react";
import { Link, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ArrowLeft, Download, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";

export function ReviewReport() {
  const { reportId } = useParams();
  const [filterMode, setFilterMode] = useState("all");

  // Mock 数据
  const mockDecisions = [
    {
      id: 1,
      kyoku: "东1局0本场",
      turn: 5,
      playerAction: "打5万",
      aiAction: "打7索",
      deviation: "高",
      riskLabel: "防守偏差",
      deltaValue: -120,
    },
    {
      id: 2,
      kyoku: "东1局0本场",
      turn: 8,
      playerAction: "碰",
      aiAction: "跳过",
      deviation: "中",
      riskLabel: "进攻偏差",
      deltaValue: -80,
    },
    {
      id: 3,
      kyoku: "东2局0本场",
      turn: 12,
      playerAction: "立直",
      aiAction: "立直",
      deviation: "无",
      riskLabel: "-",
      deltaValue: 0,
    },
    {
      id: 4,
      kyoku: "东2局1本场",
      turn: 6,
      playerAction: "打2筒",
      aiAction: "打9万",
      deviation: "高",
      riskLabel: "放铳风险",
      deltaValue: -200,
    },
  ];

  const filteredDecisions = mockDecisions.filter((d) => {
    if (filterMode === "all") return true;
    if (filterMode === "diff") return d.deviation !== "无";
    if (filterMode === "high") return d.deviation === "高";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/review/history">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回历史记录
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 ml-4">复盘报告</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出 HTML
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出 JSON
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>对局摘要</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">报告 ID：</span>
                    <span className="text-slate-900 font-mono">{reportId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">对局平台：</span>
                    <span className="text-slate-900">天凤</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">场次：</span>
                    <span className="text-slate-900">东风场</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">分析引擎：</span>
                    <span className="text-slate-900">标准引擎 v1.0</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">目标玩家：</span>
                    <span className="text-slate-900">玩家1</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">最终排名：</span>
                    <span className="text-slate-900">第2位</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">得点变化：</span>
                    <span className="text-green-600 font-semibold">+5,200</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">分析时间：</span>
                    <span className="text-slate-900">2026-03-29 14:35:00</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">12</div>
                  <div className="text-sm text-slate-600">总决策数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">3</div>
                  <div className="text-sm text-slate-600">重点偏差</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">5</div>
                  <div className="text-sm text-slate-600">中等偏差</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">4</div>
                  <div className="text-sm text-slate-600">最优决策</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filter Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-700">筛选：</span>
                <Select value={filterMode} onValueChange={setFilterMode}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">显示全部</SelectItem>
                    <SelectItem value="diff">只看差异手</SelectItem>
                    <SelectItem value="high">只看高偏差</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="secondary">
                  显示 {filteredDecisions.length} / {mockDecisions.length} 个决策
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Decisions List */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">逐手分析</h2>
            {filteredDecisions.map((decision) => (
              <Card key={decision.id} className={decision.deviation === "高" ? "border-red-300" : ""}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{decision.kyoku}</Badge>
                        <Badge variant="outline">第 {decision.turn} 巡</Badge>
                        {decision.deviation !== "无" && (
                          <Badge
                            variant={decision.deviation === "高" ? "destructive" : "secondary"}
                          >
                            {decision.riskLabel}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {decision.deltaValue < 0 && (
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-sm font-semibold">{decision.deltaValue}</span>
                      </div>
                    )}
                    {decision.deltaValue === 0 && (
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-semibold">最优</span>
                      </div>
                    )}
                  </div>

                  <Tabs defaultValue="comparison" className="w-full">
                    <TabsList>
                      <TabsTrigger value="comparison">动作对比</TabsTrigger>
                      <TabsTrigger value="board">局面</TabsTrigger>
                      <TabsTrigger value="candidates">候选动作</TabsTrigger>
                    </TabsList>

                    <TabsContent value="comparison" className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                          <div className="text-sm text-red-900 font-semibold mb-2">
                            您的选择
                          </div>
                          <div className="text-lg font-bold text-slate-900">
                            {decision.playerAction}
                          </div>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="text-sm text-green-900 font-semibold mb-2">
                            AI 推荐
                          </div>
                          <div className="text-lg font-bold text-slate-900">
                            {decision.aiAction}
                          </div>
                        </div>
                      </div>
                      {decision.deviation !== "无" && (
                        <div className="flex items-start gap-2 p-4 bg-blue-50 rounded-lg">
                          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-blue-900">
                            <strong>分析：</strong>
                            这一手选择了{decision.playerAction}，但在此局面下{decision.aiAction}
                            更能保持安全性。当前局面处于{decision.riskLabel}状态，
                            建议优先考虑防守策略。
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="board">
                      <div className="p-8 bg-slate-100 rounded-lg text-center">
                        <div className="text-slate-500">
                          [局面展示区域]
                          <div className="mt-4 text-sm">
                            手牌、河牌、鸣牌、分数等信息将在此展示
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="candidates">
                      <div className="space-y-2">
                        <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <span>1. {decision.aiAction}</span>
                          <span className="font-semibold text-green-600">期望值: +250</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                          <span>2. 打6索</span>
                          <span className="font-semibold text-slate-600">期望值: +180</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                          <span>3. {decision.playerAction}</span>
                          <span className="font-semibold text-red-600">期望值: +130</span>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <Link to="/review/history" className="flex-1">
                  <Button variant="outline" className="w-full">
                    返回历史记录
                  </Button>
                </Link>
                <Link to="/review/import" className="flex-1">
                  <Button className="w-full">
                    导入新牌谱
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
