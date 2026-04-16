import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";
import { ArrowLeft, Upload, Link as LinkIcon, Hash, FileJson } from "lucide-react";

export function ReviewImport() {
  const navigate = useNavigate();
  const [importType, setImportType] = useState("link");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 模拟创建任务
    const taskId = `task-${Date.now()}`;
    navigate(`/review/task/${taskId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 ml-4">AI 复盘</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>导入牌谱</CardTitle>
              <CardDescription>
                选择导入方式，导入您想要分析的对局牌谱
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <Tabs value={importType} onValueChange={setImportType} className="mb-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="link">
                      <LinkIcon className="w-4 h-4 mr-2" />
                      链接
                    </TabsTrigger>
                    <TabsTrigger value="id">
                      <Hash className="w-4 h-4 mr-2" />
                      ID
                    </TabsTrigger>
                    <TabsTrigger value="file">
                      <Upload className="w-4 h-4 mr-2" />
                      文件
                    </TabsTrigger>
                    <TabsTrigger value="json">
                      <FileJson className="w-4 h-4 mr-2" />
                      JSON
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="link" className="space-y-4">
                    <div>
                      <Label htmlFor="link">牌谱链接</Label>
                      <Input
                        id="link"
                        placeholder="https://example.com/game/12345"
                        className="mt-2"
                      />
                      <p className="text-sm text-slate-500 mt-1">
                        支持主流日麻平台的牌谱链接
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="id" className="space-y-4">
                    <div>
                      <Label htmlFor="gameId">对局 ID</Label>
                      <Input
                        id="gameId"
                        placeholder="输入对局 ID"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="platform">平台</Label>
                      <Select>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="选择平台" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tenhou">天凤</SelectItem>
                          <SelectItem value="majsoul">雀魂</SelectItem>
                          <SelectItem value="mleague">M联盟</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">点击上传或拖拽文件至此</p>
                      <p className="text-sm text-slate-500">支持 .mjlog, .paipu 等格式</p>
                      <Input
                        type="file"
                        className="mt-4"
                        accept=".mjlog,.paipu,.log"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="json" className="space-y-4">
                    <div>
                      <Label htmlFor="json">JSON 数据</Label>
                      <textarea
                        id="json"
                        className="w-full mt-2 p-3 border border-slate-300 rounded-md font-mono text-sm min-h-[200px]"
                        placeholder='{"game_id": "...", "events": [...]}'
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {/* 复盘配置 */}
                <div className="space-y-6 border-t pt-6">
                  <h3 className="font-semibold text-slate-900">复盘配置</h3>

                  <div>
                    <Label htmlFor="player">目标玩家</Label>
                    <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="选择要分析的玩家" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="player1">玩家1</SelectItem>
                        <SelectItem value="player2">玩家2</SelectItem>
                        <SelectItem value="player3">玩家3</SelectItem>
                        <SelectItem value="player4">玩家4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="kyoku">局数筛选</Label>
                    <Select defaultValue="all">
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部局</SelectItem>
                        <SelectItem value="east">东场</SelectItem>
                        <SelectItem value="south">南场</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="language">语言</Label>
                    <Select defaultValue="zh">
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zh">简体中文</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="output">输出格式</Label>
                    <Select defaultValue="html">
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">HTML 报告</SelectItem>
                        <SelectItem value="json">JSON 数据</SelectItem>
                        <SelectItem value="both">两者都要</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="anonymous"
                      checked={anonymous}
                      onCheckedChange={(checked) => setAnonymous(checked as boolean)}
                    />
                    <Label htmlFor="anonymous" className="cursor-pointer">
                      匿名化处理（隐藏玩家昵称等信息）
                    </Label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-8">
                  <Button type="submit" className="flex-1" size="lg">
                    创建复盘任务
                  </Button>
                  <Link to="/" className="flex-1">
                    <Button type="button" variant="outline" className="w-full" size="lg">
                      取消
                    </Button>
                  </Link>
                </div>
              </form>

              {/* Recent Records */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-semibold text-slate-900 mb-4">最近记录</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-lg text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">对局 #12345</span>
                      <span className="text-slate-500">2 小时前</span>
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700">对局 #12344</span>
                      <span className="text-slate-500">1 天前</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
