import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import { ArrowLeft, Clock, User, Bot } from "lucide-react";

export function PlayGame() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(10);
  const [currentTurn] = useState(0);
  const [kyoku] = useState("东1局0本场");

  // Mock game state
  const players = [
    { id: 1, name: "您", score: 25000, isPlayer: true },
    { id: 2, name: "AI 对手 A", score: 25000, isAI: true, status: "思考中" },
    { id: 3, name: "AI 对手 B", score: 25000, isAI: true },
    { id: 4, name: "AI 对手 C", score: 25000, isAI: true },
  ];

  const [selectedTile, setSelectedTile] = useState<number | null>(null);

  // Mock tiles
  const handTiles = ["1万", "2万", "3万", "4万", "5万", "6万", "7万", "8万", "9万", "1筒", "2筒", "3筒", "4筒"];
  const drawnTile = "5筒";
  const rivers = [
    { seat: "上家", player: players[1], tiles: ["2万", "7万", "東", "5索", "9筒", "白"] },
    { seat: "对家", player: players[2], tiles: ["1筒", "3索", "7筒", "南", "4万", "8索"] },
    { seat: "下家", player: players[3], tiles: ["5万", "9索", "2筒", "发", "6万", "西"] },
    { seat: "自家", player: players[0], tiles: ["3万", "8筒", "北", "1索", "4筒", "中"] },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleEndGame = () => {
    const sessionId = `session-${Date.now()}`;
    navigate(`/play/result/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-900 to-green-800">
      {/* Header */}
      <header className="border-b border-green-700 bg-green-950/50 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/play/config">
              <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-green-800">
                <ArrowLeft className="w-4 h-4 mr-2" />
                退出
              </Button>
            </Link>
            <div className="text-white">
              <div className="font-bold">{kyoku}</div>
              <div className="text-sm text-green-200">房间 ID: {roomId}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-white">
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{timeLeft}s</span>
            </div>
            <Badge variant="outline" className="bg-green-950/50 text-white border-green-600">
              第 {currentTurn} 巡
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-green-950/75 backdrop-blur border-green-700 px-4 py-3 text-white mb-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-[11px] text-green-300">局数</div>
                <div className="text-sm font-bold leading-tight">{kyoku}</div>
              </div>
              <div>
                <div className="text-[11px] text-green-300">本场</div>
                <div className="text-xl font-bold leading-tight">0</div>
              </div>
              <div>
                <div className="text-[11px] text-green-300">立直棒</div>
                <div className="text-xl font-bold leading-tight">0</div>
              </div>
              <div>
                <div className="text-[11px] text-green-300">宝牌</div>
                <div className="text-xl font-bold leading-tight">3万</div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {players.slice(1).map((player) => (
              <Card key={player.id} className="bg-green-950/60 backdrop-blur border-green-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-400" />
                    <span className="text-white font-medium text-sm">{player.name}</span>
                  </div>
                  {player.status ? (
                    <Badge variant="secondary" className="text-xs">
                      {player.status}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-green-200 text-sm mb-3">{player.score.toLocaleString()} 点</div>
                <div className="flex gap-1 justify-center flex-wrap">
                  {[...Array(13)].map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-9 bg-yellow-100 border border-yellow-300 rounded shadow-sm"
                    />
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card className="bg-green-950/80 backdrop-blur border-green-600 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-green-400" />
                <span className="text-xs text-green-300">自家</span>
                <span className="text-white font-bold">{players[0].name}</span>
              </div>
              <div className="text-green-200 font-bold text-lg">
                {players[0].score.toLocaleString()} 点
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-green-200 mb-2">手牌</div>
              <div className="flex gap-2 justify-center flex-wrap">
                {handTiles.map((tile, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTile(idx)}
                    className={`w-12 h-16 bg-white rounded shadow-md flex items-center justify-center font-bold text-slate-900 hover:translate-y-[-8px] transition-transform ${
                      selectedTile === idx ? "translate-y-[-8px] ring-2 ring-blue-400" : ""
                    }`}
                  >
                    {tile}
                  </button>
                ))}
                <div className="w-4" />
                <button
                  className="w-12 h-16 bg-yellow-100 rounded shadow-md flex items-center justify-center font-bold text-slate-900 border-2 border-yellow-400 hover:translate-y-[-8px] transition-transform"
                >
                  {drawnTile}
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-center pt-4 border-t border-green-700 flex-wrap">
              <Button
                variant="destructive"
                disabled={selectedTile === null}
                className="px-8"
              >
                打牌
              </Button>
              <Button variant="outline" className="bg-green-950/50 text-white border-green-600 hover:bg-green-900">
                立直
              </Button>
              <Button variant="outline" className="bg-green-950/50 text-white border-green-600 hover:bg-green-900">
                自摸
              </Button>
              <Button variant="outline" className="bg-green-950/50 text-white border-green-600 hover:bg-green-900">
                九种九牌
              </Button>
              <Button variant="ghost" className="text-white hover:bg-green-900">
                跳过
              </Button>
            </div>
          </Card>

          <Card className="bg-green-950/50 backdrop-blur border-green-700 p-4">
            <div className="text-sm text-green-200 mb-3">河牌</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rivers.map((river) => (
                <div key={river.seat} className="bg-green-950/30 rounded-lg p-3 border border-green-800/70">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-green-300">{river.seat}</div>
                    <div className="text-xs text-green-200">{river.player.name}</div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {river.tiles.map((tile, idx) => (
                      <div
                        key={`${river.seat}-${tile}-${idx}`}
                        className="w-8 h-10 bg-white/90 rounded shadow-sm flex items-center justify-center text-xs font-bold text-slate-900"
                      >
                        {tile}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="flex gap-4 mt-6">
            <Button
              variant="outline"
              onClick={handleEndGame}
              className="bg-green-950/50 text-white border-green-600 hover:bg-green-900"
            >
              结束对局（测试）
            </Button>
          </div>
        </div>
      </main>

      {/* Timer Progress */}
      <div className="fixed bottom-0 left-0 right-0 bg-green-950/50 backdrop-blur">
        <Progress value={(timeLeft / 10) * 100} className="h-1 rounded-none" />
      </div>
    </div>
  );
}
