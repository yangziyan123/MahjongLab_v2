import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, LoaderCircle, PlayCircle } from "lucide-react";

import { ApiError, createPlaySession } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";

type AppliedAiLevel = "normal" | "hard";
type MatchType = "tonpu" | "hanchan";
type Seat = "random" | "east" | "south" | "west" | "north";
type AkaDora = 0 | 3;

interface SavedPlayConfig {
  username: string;
  aiLevel: AppliedAiLevel;
  matchType: MatchType;
  seat: Seat;
  startPoints: number;
  akaDora: AkaDora;
  kuitan: boolean;
  allowSouthEntry: boolean;
}

const configStorageKey = "mahjonglab.play-config.v2";
const defaultConfig: SavedPlayConfig = {
  username: "User1",
  aiLevel: "normal",
  matchType: "hanchan",
  seat: "random",
  startPoints: 25000,
  akaDora: 3,
  kuitan: true,
  allowSouthEntry: false,
};

function readSavedConfig(): SavedPlayConfig {
  try {
    const value = window.localStorage.getItem(configStorageKey);
    if (!value) {
      return defaultConfig;
    }
    const parsed = JSON.parse(value) as Partial<SavedPlayConfig>;
    const startPoints = Number(parsed.startPoints);
    return {
      username: typeof parsed.username === "string" && parsed.username.trim() ? parsed.username : defaultConfig.username,
      aiLevel: parsed.aiLevel === "hard" ? "hard" : "normal",
      matchType: parsed.matchType === "tonpu" ? "tonpu" : "hanchan",
      seat: ["random", "east", "south", "west", "north"].includes(parsed.seat ?? "")
        ? (parsed.seat as Seat)
        : "random",
      startPoints:
        Number.isInteger(startPoints) && startPoints >= 10000 && startPoints <= 50000
          ? startPoints
          : defaultConfig.startPoints,
      akaDora: parsed.akaDora === 0 ? 0 : 3,
      kuitan: parsed.kuitan !== false,
      allowSouthEntry: parsed.allowSouthEntry === true,
    };
  } catch {
    return defaultConfig;
  }
}

function queryChoice<T extends string>(value: string | null, choices: readonly T[], fallback: T): T {
  return value && choices.includes(value as T) ? (value as T) : fallback;
}

function queryBoolean(value: string | null, fallback: boolean) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

export function PlayConfig() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [savedConfig] = useState(readSavedConfig);
  const queryStartPointsValue = searchParams.get("start_points");
  const queryStartPoints = queryStartPointsValue === null ? undefined : Number(queryStartPointsValue);
  const [username, setUsername] = useState(() => {
    const value = searchParams.get("username");
    return value && value.trim() ? value.slice(0, 8) : savedConfig.username;
  });
  const [aiLevel, setAiLevel] = useState<AppliedAiLevel>(() =>
    queryChoice(searchParams.get("ai_level"), ["normal", "hard"] as const, savedConfig.aiLevel),
  );
  const [matchType, setMatchType] = useState<MatchType>(() =>
    queryChoice(searchParams.get("match_type"), ["tonpu", "hanchan"] as const, savedConfig.matchType),
  );
  const [seat, setSeat] = useState<Seat>(() =>
    queryChoice(
      searchParams.get("seat"),
      ["random", "east", "south", "west", "north"] as const,
      savedConfig.seat,
    ),
  );
  const [startPoints, setStartPoints] = useState(() =>
    Number.isInteger(queryStartPoints) &&
    (queryStartPoints ?? 0) >= 10000 &&
    (queryStartPoints ?? 0) <= 50000 &&
    (queryStartPoints ?? 0) % 100 === 0
      ? String(queryStartPoints)
      : String(savedConfig.startPoints),
  );
  const [akaDora, setAkaDora] = useState<AkaDora>(() =>
    searchParams.get("aka_dora") === "0" ? 0 : savedConfig.akaDora,
  );
  const [kuitan, setKuitan] = useState(() => queryBoolean(searchParams.get("kuitan"), savedConfig.kuitan));
  const [allowSouthEntry, setAllowSouthEntry] = useState(() =>
    queryBoolean(searchParams.get("allow_south_entry"), savedConfig.allowSouthEntry),
  );
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartGame = async () => {
    const trimmedUsername = username.trim();
    const parsedStartPoints = Number(startPoints);
    if (!trimmedUsername) {
      setErrorMessage("请输入用户名后再开始对局。");
      return;
    }
    if (
      !Number.isInteger(parsedStartPoints) ||
      parsedStartPoints < 10000 ||
      parsedStartPoints > 50000 ||
      parsedStartPoints % 100 !== 0
    ) {
      setErrorMessage("起始点数必须是 10,000 到 50,000 之间的整百数。");
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);

    const config: SavedPlayConfig = {
      username: trimmedUsername,
      aiLevel,
      matchType,
      seat,
      startPoints: parsedStartPoints,
      akaDora,
      kuitan,
      allowSouthEntry: matchType === "tonpu" && allowSouthEntry,
    };

    try {
      const session = await createPlaySession({
        username: config.username,
        ai_level: config.aiLevel,
        match_type: config.matchType,
        seat: config.seat,
        start_points: config.startPoints,
        aka_dora: config.akaDora,
        kuitan: config.kuitan,
        allow_south_entry: config.allowSouthEntry,
      });
      window.localStorage.setItem(configStorageKey, JSON.stringify(config));
      navigate(`/play/game/${session.session_id}`, {
        state: { session },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.detail);
      } else {
        setErrorMessage("对局启动失败，请稍后重试或检查服务状态。");
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
          <p className="mt-3 text-sm text-slate-300">正在准备牌桌，请稍候。</p>
          <div className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-left text-sm">
            <span className="text-slate-500">AI 难度</span>
            <span>{aiLevel === "hard" ? "进阶" : "普通"}</span>
            <span className="text-slate-500">场次</span>
            <span>{matchType === "tonpu" ? "东风战" : "半庄战"}</span>
            <span className="text-slate-500">起始点数</span>
            <span>{Number(startPoints).toLocaleString()}</span>
            <span className="text-slate-500">座位</span>
            <span>
              {{ random: "随机", east: "东家", south: "南家", west: "西家", north: "北家" }[seat]}
            </span>
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
          <h1 className="text-2xl font-bold text-slate-900">创建对战房间</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>对局设置</CardTitle>
            <CardDescription>设置本局规则，三名 AI 使用相同难度。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <section className="grid gap-5 sm:grid-cols-2">
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
                <Label htmlFor="ai-level">AI 难度</Label>
                <Select value={aiLevel} onValueChange={(value) => setAiLevel(value as AppliedAiLevel)}>
                  <SelectTrigger id="ai-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">普通</SelectItem>
                    <SelectItem value="hard">进阶</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="match-type">场次</Label>
                <Select value={matchType} onValueChange={(value) => setMatchType(value as MatchType)}>
                  <SelectTrigger id="match-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tonpu">东风战</SelectItem>
                    <SelectItem value="hanchan">半庄战</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seat">座位</Label>
                <Select value={seat} onValueChange={(value) => setSeat(value as Seat)}>
                  <SelectTrigger id="seat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">随机</SelectItem>
                    <SelectItem value="east">东家</SelectItem>
                    <SelectItem value="south">南家</SelectItem>
                    <SelectItem value="west">西家</SelectItem>
                    <SelectItem value="north">北家</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-points">起始点数</Label>
                <Input
                  id="start-points"
                  type="number"
                  min={10000}
                  max={50000}
                  step={100}
                  value={startPoints}
                  onChange={(event) => setStartPoints(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aka-dora">赤宝牌</Label>
                <Select value={String(akaDora)} onValueChange={(value) => setAkaDora(value === "0" ? 0 : 3)}>
                  <SelectTrigger id="aka-dora">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">有赤宝牌（3 张）</SelectItem>
                    <SelectItem value="0">无赤宝牌</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between gap-6 rounded-lg border p-4">
                <div>
                  <Label htmlFor="kuitan">食断</Label>
                  <p className="mt-1 text-sm text-slate-500">允许副露后以断幺九和牌。</p>
                </div>
                <Switch id="kuitan" checked={kuitan} onCheckedChange={setKuitan} />
              </div>

              {matchType === "tonpu" ? (
                <div className="flex items-center justify-between gap-6 rounded-lg border p-4">
                  <div>
                    <Label htmlFor="south-entry">南入</Label>
                    <p className="mt-1 text-sm text-slate-500">东四局结束时无人达到 30,000 点，则继续进入南场。</p>
                  </div>
                  <Switch
                    id="south-entry"
                    checked={allowSouthEntry}
                    onCheckedChange={setAllowSouthEntry}
                  />
                </div>
              ) : null}
            </section>

            {errorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>启动失败</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row">
              <Button onClick={handleStartGame} className="flex-1" size="lg">
                <PlayCircle className="mr-2 h-4 w-4" />
                开始对局
              </Button>
              <Button asChild variant="outline" className="flex-1" size="lg">
                <Link to="/">取消</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
