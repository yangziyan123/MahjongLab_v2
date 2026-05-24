import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, LoaderCircle, PlayCircle, Settings, Zap } from "lucide-react";

import { ApiError, createPlaySession } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

type AppliedAiLevel = "normal" | "hard";
type ConfigMode = "template" | "custom";
type Seat = "east" | "south" | "west" | "north";
type AiStyle = "balanced" | "attack" | "defense" | "efficiency";

interface AiOpponentConfig {
  style: AiStyle;
  difficulty: AppliedAiLevel;
}

const seatLabels: Record<Seat, string> = {
  east: "东家",
  south: "南家",
  west: "西家",
  north: "北家",
};

const aiStyleLabels: Record<AiStyle, string> = {
  balanced: "均衡型",
  attack: "进攻型",
  defense: "防守型",
  efficiency: "牌效型",
};

function getLaunchAiLevel(opponents: AiOpponentConfig[]): AppliedAiLevel {
  return opponents.some((opponent) => opponent.difficulty === "hard") ? "hard" : "normal";
}

export function PlayConfig() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("User1");
  const [seat, setSeat] = useState<Seat>("east");
  const [configMode, setConfigMode] = useState<ConfigMode>("template");
  const [template, setTemplate] = useState("tonpu");
  const [matchType, setMatchType] = useState("hanchan");
  const [startPoints, setStartPoints] = useState("25000");
  const [timeLimit, setTimeLimit] = useState("10");
  const [akaDora, setAkaDora] = useState("3");
  const [kuitan, setKuitan] = useState(true);
  const [atozuke, setAtozuke] = useState(true);
  const [nanryu, setNanryu] = useState(false);
  const [aiOpponents, setAiOpponents] = useState<AiOpponentConfig[]>([
    { style: "balanced", difficulty: "normal" },
    { style: "attack", difficulty: "normal" },
    { style: "defense", difficulty: "normal" },
  ]);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateAiOpponent = (index: number, patch: Partial<AiOpponentConfig>) => {
    setAiOpponents((current) =>
      current.map((opponent, currentIndex) => (currentIndex === index ? { ...opponent, ...patch } : opponent)),
    );
  };

  const handleStartGame = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMessage("请输入用户名后再开始对局。");
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);

    try {
      const session = await createPlaySession({
        username: trimmedUsername,
        ai_level: getLaunchAiLevel(aiOpponents),
        ai_opponents: aiOpponents,
      });
      navigate(`/play/game/${session.session_id}`, {
        state: { session },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.detail);
      } else {
        setErrorMessage("启动 Mahjong-AI 失败，请检查本机 Python 依赖、websockify 和端口状态。");
      }
    } finally {
      setIsStarting(false);
    }
  };

  if (isStarting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/15">
            <LoaderCircle className="h-7 w-7 animate-spin text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold">正在启动对局</h1>
          <p className="mt-3 text-sm text-slate-300">
            正在拉起 Mahjong-AI 服务并准备对战页面，请稍候。
          </p>
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-left text-sm text-slate-400">
            <div>用户名：{username.trim() || "未填写"}</div>
            <div className="mt-1">座位：{seatLabels[seat]}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
          <Button asChild variant="ghost" size="sm" className="w-fit">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">创建对战房间</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>房间配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-7">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-slate-700" />
                  <h2 className="font-semibold text-slate-900">基础信息</h2>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="例如 User1"
                      maxLength={8}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>座位</Label>
                    <Select value={seat} onValueChange={(value) => setSeat(value as Seat)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="east">东家</SelectItem>
                        <SelectItem value="south">南家</SelectItem>
                        <SelectItem value="west">西家</SelectItem>
                        <SelectItem value="north">北家</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-slate-700" />
                    <h2 className="font-semibold text-slate-900">规则模板</h2>
                  </div>
                </div>

                <Tabs value={configMode} onValueChange={(value) => setConfigMode(value as ConfigMode)} className="space-y-5">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="template">预设模板</TabsTrigger>
                    <TabsTrigger value="custom">自定义配置</TabsTrigger>
                  </TabsList>

                  <TabsContent value="template" className="space-y-3">
                    <Label>选择模板</Label>
                    <Select value={template} onValueChange={setTemplate}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tonpu">东风战，标准规则</SelectItem>
                        <SelectItem value="hanchan">半庄战，标准规则</SelectItem>
                        <SelectItem value="defense">防守训练模板</SelectItem>
                        <SelectItem value="riichi">立直判断训练</SelectItem>
                      </SelectContent>
                    </Select>
                  </TabsContent>

                  <TabsContent value="custom" className="space-y-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>场次</Label>
                        <Select value={matchType} onValueChange={setMatchType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tonpu">东风战</SelectItem>
                            <SelectItem value="hanchan">半庄战</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="startPoints">初始点数</Label>
                        <Input id="startPoints" type="number" value={startPoints} onChange={(event) => setStartPoints(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timeLimit">时间限制，秒</Label>
                        <Input id="timeLimit" type="number" value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>赤宝牌</Label>
                        <Select value={akaDora} onValueChange={setAkaDora}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">无赤宝</SelectItem>
                            <SelectItem value="3">3 张赤宝</SelectItem>
                            <SelectItem value="4">4 张赤宝</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="kuitan" className="font-normal">食断</Label>
                        <Switch id="kuitan" checked={kuitan} onCheckedChange={setKuitan} />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="atozuke" className="font-normal">后付</Label>
                        <Switch id="atozuke" checked={atozuke} onCheckedChange={setAtozuke} />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="nanryu" className="font-normal">南入</Label>
                        <Switch id="nanryu" checked={nanryu} onCheckedChange={setNanryu} />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </section>

              <section className="space-y-4 border-t pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-slate-700" />
                    <h2 className="font-semibold text-slate-900">AI 对手配置</h2>
                  </div>
                </div>

                <div className="space-y-3">
                  {aiOpponents.map((opponent, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[120px_1fr_1fr] md:items-end">
                      <div className="font-medium text-slate-900">AI 对手 {index + 1}</div>
                      <div className="space-y-2">
                        <Label>打牌风格</Label>
                        <Select
                          value={opponent.style}
                          onValueChange={(value) => updateAiOpponent(index, { style: value as AiStyle })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(aiStyleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>难度</Label>
                        <Select
                          value={opponent.difficulty}
                          onValueChange={(value) => updateAiOpponent(index, { difficulty: value as AppliedAiLevel })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">普通</SelectItem>
                            <SelectItem value="hard">进阶</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {errorMessage ? (
                <Alert variant="destructive">
                  <AlertTitle>启动失败</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row">
                <Button onClick={handleStartGame} className="flex-1" size="lg" disabled={isStarting}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  开始对局
                </Button>
                <Button asChild variant="outline" className="flex-1" size="lg">
                  <Link to="/">取消</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
