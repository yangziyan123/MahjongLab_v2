import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router";

import { deleteMistakeItem, listAllMistakes } from "../../lib/api";
import { formatDecisionType, formatKyokuLabel, formatPlatform } from "../../lib/format";
import type { MistakeItem } from "../../lib/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

function formatAction(action?: Record<string, unknown> | null) {
  if (!action) {
    return "无动作";
  }

  const type = String(action.type ?? "unknown");
  const pai = typeof action.pai === "string" ? action.pai : "";
  const consumed = Array.isArray(action.consumed) ? action.consumed.join(" ") : "";

  if (type === "dahai") {
    return `打 ${pai}`;
  }
  if (type === "reach") {
    return "立直";
  }
  if (type === "chi") {
    return `吃 ${pai} ${consumed}`.trim();
  }
  if (type === "pon") {
    return `碰 ${pai} ${consumed}`.trim();
  }
  if (type === "daiminkan" || type === "ankan" || type === "kakan") {
    return `杠 ${pai || consumed}`.trim();
  }
  if (type === "hora") {
    return "和牌";
  }
  if (type === "ryukyoku") {
    return "流局";
  }
  if (type === "none") {
    return "跳过";
  }
  return JSON.stringify(action);
}

function formatCategory(category: string) {
  const mapping: Record<string, string> = {
    defense: "防守",
    riichi_judgment: "立直判断",
    call_judgment: "鸣牌判断",
    efficiency: "牌效率",
    attack: "进攻",
    chi_judgment: "吃牌",
    pon_judgment: "碰牌",
    kan_judgment: "杠牌",
    other: "其他",
  };
  return mapping[category] || category;
}

export function MistakeLibrary() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [decisionType, setDecisionType] = useState("all");
  const [page, setPage] = useState(1);

  const deferredSearch = useDeferredValue(search.trim());
  const mistakesQuery = useQuery({
    queryKey: ["mistakes", deferredSearch, category, decisionType],
    queryFn: () =>
      listAllMistakes({
        q: deferredSearch || undefined,
        category: category === "all" ? undefined : category,
        decision_type: decisionType === "all" ? undefined : decisionType,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (mistakeId: string) => deleteMistakeItem(mistakeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mistakes"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["review-mistakes"] }),
      ]);
    },
  });

  const items = mistakesQuery.data ?? [];
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage],
  );

  const handleDelete = (mistakeId: string) => {
    if (!window.confirm("确认把这条错题从错题库中移除吗？")) {
      return;
    }
    deleteMutation.mutate(mistakeId);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回首页
                </Button>
              </Link>
              <h1 className="ml-4 text-2xl font-bold text-slate-900">错题库</h1>
            </div>
            <Link to="/review/import">
              <Button>新建复盘</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>训练入口</CardTitle>
              <CardDescription>这里汇总了已经从复盘报告中加入的偏差巡目，可直接回跳到对应报告。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="搜索备注、玩家或分类..."
                    className="pl-10"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                <Select
                  value={category}
                  onValueChange={(value) => {
                    setCategory(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部分类</SelectItem>
                    <SelectItem value="defense">防守</SelectItem>
                    <SelectItem value="riichi_judgment">立直判断</SelectItem>
                    <SelectItem value="call_judgment">鸣牌判断</SelectItem>
                    <SelectItem value="efficiency">牌效率</SelectItem>
                    <SelectItem value="attack">进攻</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={decisionType}
                  onValueChange={(value) => {
                    setDecisionType(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部动作</SelectItem>
                    <SelectItem value="discard">打牌</SelectItem>
                    <SelectItem value="riichi">立直</SelectItem>
                    <SelectItem value="chi">吃</SelectItem>
                    <SelectItem value="pon">碰</SelectItem>
                    <SelectItem value="kan">杠</SelectItem>
                    <SelectItem value="agari">和牌</SelectItem>
                    <SelectItem value="ryukyoku">流局</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {mistakesQuery.isLoading && (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">正在读取错题库...</CardContent>
            </Card>
          )}

          {mistakesQuery.isError && (
            <Card>
              <CardContent className="py-12 text-center text-red-600">
                {mistakesQuery.error instanceof Error ? mistakesQuery.error.message : "Failed to load mistakes."}
              </CardContent>
            </Card>
          )}

          {!mistakesQuery.isLoading && !mistakesQuery.isError && items.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <h3 className="mb-2 text-lg font-semibold text-slate-900">错题库还是空的</h3>
                <p className="mb-6 text-slate-600">从复盘报告里把偏差巡目加入错题库后，这里会开始积累训练材料。</p>
                <Link to="/review/history">
                  <Button>去历史报告挑选错题</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {pagedItems.length > 0 && (
            <div className="space-y-4">
              {pagedItems.map((item: MistakeItem) => (
                <Card key={item.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{formatPlatform(item.platform)}</Badge>
                          <Badge variant={item.deviation_level === "high" ? "destructive" : "secondary"}>
                            {item.deviation_level === "high" ? "大失误" : "中偏差"}
                          </Badge>
                          <Badge variant="outline">{formatCategory(item.category)}</Badge>
                          <span className="font-semibold text-slate-900">
                            {item.target_player_label || `玩家 ${item.target_actor}`}
                          </span>
                        </div>

                        <div className="text-sm text-slate-600">
                          {formatKyokuLabel(item.kyoku_index, item.honba)} · 第 {item.junme} 巡 ·{" "}
                          {formatDecisionType(item.decision_type)}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                            <div className="mb-2 text-sm font-semibold text-rose-900">你的动作</div>
                            <div className="font-semibold text-slate-900">{formatAction(item.actual_action)}</div>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                            <div className="mb-2 text-sm font-semibold text-emerald-900">推荐动作</div>
                            <div className="font-semibold text-slate-900">{formatAction(item.expected_action)}</div>
                          </div>
                        </div>

                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {formatCategory(tag)}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {item.note && <div className="text-sm text-slate-600">备注：{item.note}</div>}
                      </div>

                      <div className="flex gap-2">
                        <Link to={`/review/open/${item.review_id}?entry=${item.review_entry_id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            回到报告
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {items.length > pageSize && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                上一页
              </Button>
              <div className="rounded-md border bg-white px-4 py-2 text-sm text-slate-600">
                第 {safePage} / {totalPages} 页
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
