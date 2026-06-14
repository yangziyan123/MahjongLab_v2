import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  ChevronRight,
  Info,
  LoaderCircle,
  PlayCircle,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiError, createClassicTrainingSession, listClassicGames } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export function ClassicLibrary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get("game");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(requestedGameId);
  const [selectedHandIndex, setSelectedHandIndex] = useState(0);
  const [username, setUsername] = useState("训练玩家");

  const gamesQuery = useQuery({
    queryKey: ["classic-games"],
    queryFn: listClassicGames,
  });
  const games = gamesQuery.data ?? [];

  useEffect(() => {
    if (games.length === 0) {
      return;
    }
    if (selectedGameId && games.some((game) => game.id === selectedGameId)) {
      return;
    }
    setSelectedGameId(games[0].id);
  }, [games, selectedGameId]);

  const selectedGame = games.find((game) => game.id === selectedGameId) ?? null;
  const selectedHand = selectedGame?.hands.find((hand) => hand.index === selectedHandIndex) ?? null;

  const createMutation = useMutation({
    mutationFn: createClassicTrainingSession,
    onSuccess: (session) => {
      navigate(`/classic/train/${session.match_id}`);
    },
  });

  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
    setSelectedHandIndex(0);
  };

  const handleStart = () => {
    if (!selectedGame || !selectedHand) {
      return;
    }
    createMutation.mutate({
      game_id: selectedGame.id,
      start_hand_index: selectedHand.index,
      username: username.trim() || "训练玩家",
    });
  };

  const errorMessage =
    createMutation.error instanceof ApiError
      ? createMutation.error.detail
      : createMutation.error
        ? "创建经典训练失败。"
        : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回首页
              </Link>
            </Button>
            <h1 className="ml-4 text-2xl font-bold text-slate-900">经典牌谱训练</h1>
          </div>
          <Button asChild variant="outline">
            <Link to="/play/history">查看训练记录</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {gamesQuery.isLoading ? (
          <div className="flex min-h-[420px] items-center justify-center gap-3 text-slate-500">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            正在读取经典牌谱...
          </div>
        ) : gamesQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>无法读取经典牌谱</AlertTitle>
            <AlertDescription>
              {gamesQuery.error instanceof ApiError ? gamesQuery.error.detail : "请检查 API 服务后重试。"}
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="mx-auto max-w-6xl overflow-hidden border-slate-200 bg-white shadow-sm">
            <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
                <div className="border-b border-slate-200 px-5 py-5">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <BookOpenCheck className="h-5 w-5 text-blue-600" />
                    牌谱目录
                  </div>
                  <p className="mt-1 text-sm text-slate-500">选择要练习的经典对局。</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {games.map((game) => {
                    const active = game.id === selectedGame?.id;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleSelectGame(game.id)}
                        className={[
                          "flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                          active ? "bg-blue-50" : "hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div>
                          <div className={active ? "font-semibold text-blue-950" : "font-semibold text-slate-900"}>
                            {game.title}
                          </div>
                          <div className="mt-1 text-sm leading-5 text-slate-500">{game.subtitle}</div>
                          <div className="mt-2 text-xs text-slate-400">
                            {game.hand_count} 个小局 · {game.decision_count} 个决策点
                          </div>
                        </div>
                        <ChevronRight className={active ? "mt-1 h-4 w-4 text-blue-600" : "mt-1 h-4 w-4 text-slate-400"} />
                      </button>
                    );
                  })}
                </div>
              </aside>

              {selectedGame ? (
                <section>
                  <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                      <span className="inline-flex items-center">
                        <CalendarDays className="mr-1.5 h-4 w-4" />
                        {selectedGame.year} · {selectedGame.source}
                      </span>
                      <span className="inline-flex items-center">
                        <Users className="mr-1.5 h-4 w-4" />
                        {selectedGame.players.join(" / ")}
                      </span>
                    </div>
                    <h2 className="mt-3 text-2xl font-bold text-slate-900">{selectedGame.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedGame.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedGame.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-7 px-6 py-6 sm:px-8">
                    <div>
                      <div className="mb-3">
                        <h3 className="font-semibold text-slate-900">选择训练起点</h3>
                        <p className="mt-1 text-sm text-slate-500">从所选小局开始，依次完成后续决策。</p>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-slate-200" role="radiogroup" aria-label="训练起点">
                        {selectedGame.hands.map((hand, index) => {
                          const active = hand.index === selectedHandIndex;
                          return (
                            <button
                              key={hand.index}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setSelectedHandIndex(hand.index)}
                              className={[
                                "flex w-full items-center gap-4 px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                                index > 0 ? "border-t border-slate-200" : "",
                                active ? "bg-blue-50" : "hover:bg-slate-50",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                  active ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white",
                                ].join(" ")}
                                aria-hidden="true"
                              >
                                {active ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="font-medium text-slate-900">{hand.label}</span>
                                <span className="ml-3 text-sm text-slate-500">{hand.decision_count} 个决策点</span>
                              </span>
                              <span className="hidden text-sm tabular-nums text-slate-500 sm:block">
                                {hand.scores.map((score) => score.toLocaleString()).join(" / ")}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-5 border-t border-slate-200 pt-6 sm:grid-cols-[240px_minmax(0,1fr)] sm:items-end">
                      <div className="space-y-2">
                        <Label htmlFor="classic-username">训练昵称</Label>
                        <Input
                          id="classic-username"
                          value={username}
                          maxLength={8}
                          onChange={(event) => setUsername(event.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 text-sm leading-6 text-slate-500">
                        <Info className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                        <p>
                          每个决策点都是原谱当时局面的独立题目，不会沿你的分支继续推演。
                          全部作答后，再统一查看整体路线、分局表现和具体分歧。
                        </p>
                      </div>
                    </div>

                    {errorMessage ? (
                      <Alert variant="destructive">
                        <AlertTitle>无法开始训练</AlertTitle>
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="flex justify-end border-t border-slate-200 pt-6">
                      <Button size="lg" onClick={handleStart} disabled={createMutation.isPending || !selectedHand}>
                        {createMutation.isPending ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        从 {selectedHand?.label ?? "所选小局"} 开始
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
