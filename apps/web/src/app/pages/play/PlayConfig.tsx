import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { ArrowLeft, Settings, Zap } from "lucide-react";

export function PlayConfig() {
  const navigate = useNavigate();
  const [useTemplate, setUseTemplate] = useState(true);

  const handleStartGame = () => {
    const roomId = `room-${Date.now()}`;
    navigate(`/play/game/${roomId}`);
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
          <h1 className="text-2xl font-bold text-slate-900 ml-4">创建对战房间</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>房间配置</CardTitle>
              <CardDescription>
                配置对局规则和 AI 对手，开始您的训练
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Template Toggle */}
              <div className="flex items-center justify-between mb-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="font-semibold text-slate-900">使用预设模板</div>
                    <div className="text-sm text-slate-600">快速开始常用规则的对局</div>
                  </div>
                </div>
                <Switch
                  checked={useTemplate}
                  onCheckedChange={setUseTemplate}
                />
              </div>

              <Tabs defaultValue={useTemplate ? "template" : "custom"} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="template" disabled={!useTemplate}>
                    预设模板
                  </TabsTrigger>
                  <TabsTrigger value="custom" disabled={useTemplate}>
                    自定义配置
                  </TabsTrigger>
                </TabsList>

                {/* Template Mode */}
                <TabsContent value="template" className="space-y-6">
                  <div>
                    <Label>选择模板</Label>
                    <Select defaultValue="tonpu">
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tonpu">东风场 - 标准规则</SelectItem>
                        <SelectItem value="hanchan">半庄场 - 标准规则</SelectItem>
                        <SelectItem value="defensive">防守训练模板</SelectItem>
                        <SelectItem value="riichi">立直判断训练</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* Custom Mode */}
                <TabsContent value="custom" className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="kyoku">场次</Label>
                      <Select defaultValue="tonpu">
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tonpu">东风场</SelectItem>
                          <SelectItem value="hanchan">半庄场</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="startPoints">初始点数</Label>
                      <Input
                        id="startPoints"
                        type="number"
                        defaultValue="25000"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="timeLimit">时间限制（秒）</Label>
                      <Input
                        id="timeLimit"
                        type="number"
                        defaultValue="10"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="akaDora">赤宝牌</Label>
                      <Select defaultValue="3">
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">无赤宝</SelectItem>
                          <SelectItem value="3">3张赤宝（各1张）</SelectItem>
                          <SelectItem value="4">4张赤宝（五万2张）</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Additional Rules */}
                  <div className="space-y-4 pt-4 border-t">
                    <Label>其他规则</Label>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">食断（副露断幺九）</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">后付（后付和了）</span>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">南入（南四局延长）</span>
                        <Switch />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* AI Configuration */}
              <div className="space-y-6 pt-6 border-t mt-6">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  <h3 className="font-semibold text-slate-900">AI 对手配置</h3>
                </div>

                <div>
                  <Label>AI 数量</Label>
                  <Select defaultValue="3">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 个 AI（三人对战）</SelectItem>
                      <SelectItem value="2">2 个 AI</SelectItem>
                      <SelectItem value="3">3 个 AI（全 AI 对手）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>AI 难度</Label>
                  <Select defaultValue="medium">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">初级 - 适合新手练习</SelectItem>
                      <SelectItem value="medium">中级 - 平衡型对手</SelectItem>
                      <SelectItem value="hard">高级 - 接近顶级水平</SelectItem>
                      <SelectItem value="mixed">混合 - 不同难度组合</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>训练目标（可选）</Label>
                  <Select defaultValue="none">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无特定目标</SelectItem>
                      <SelectItem value="attack">进攻训练 - 快速和牌</SelectItem>
                      <SelectItem value="defense">防守训练 - 避免放铳</SelectItem>
                      <SelectItem value="riichi">立直判断训练</SelectItem>
                      <SelectItem value="tile-efficiency">牌效训练</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 mt-8 pt-6 border-t">
                <Button
                  onClick={handleStartGame}
                  className="flex-1"
                  size="lg"
                >
                  开始对局
                </Button>
                <Link to="/" className="flex-1">
                  <Button variant="outline" className="w-full" size="lg">
                    取消
                  </Button>
                </Link>
              </div>

              {/* Recent Templates */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-slate-900 mb-4">最近使用的配置</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                    <div>
                      <div className="font-medium text-sm">东风场 - 中级 AI</div>
                      <div className="text-xs text-slate-600">2 天前使用</div>
                    </div>
                    <Button variant="ghost" size="sm">
                      使用
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer">
                    <div>
                      <div className="font-medium text-sm">防守训练模板</div>
                      <div className="text-xs text-slate-600">5 天前使用</div>
                    </div>
                    <Button variant="ghost" size="sm">
                      使用
                    </Button>
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
