import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, FileText, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router";

import { deleteReview, listReviews } from "../../lib/api";
import { formatDateTime, formatKyokuLabel, formatPlatform } from "../../lib/format";
import type { Review } from "../../lib/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

function applyDateRangeFilter(items: Review[], dateRange: string) {
  if (dateRange === "all") {
    return items;
  }

  const now = Date.now();
  const threshold =
    dateRange === "today"
      ? now - 24 * 60 * 60 * 1000
      : dateRange === "week"
        ? now - 7 * 24 * 60 * 60 * 1000
        : now - 30 * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    const created = new Date(item.created_at).getTime();
    return !Number.isNaN(created) && created >= threshold;
  });
}

export function ReviewHistory() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [page, setPage] = useState(1);

  const deferredSearch = useDeferredValue(search.trim());

  const reviewsQuery = useQuery({
    queryKey: ["reviews", deferredSearch, platform],
    queryFn: () =>
      listReviews({
        q: deferredSearch || undefined,
        platform: platform === "all" ? undefined : platform,
        page: 1,
        page_size: 100,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) => deleteReview(reviewId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["home-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      ]);
    },
  });

  const filteredReviews = useMemo(() => {
    return applyDateRangeFilter(reviewsQuery.data?.items ?? [], dateRange);
  }, [dateRange, reviewsQuery.data?.items]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedReviews = filteredReviews.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleDelete = (reviewId: string) => {
    if (!window.confirm("确认删除这份复盘报告吗？")) {
      return;
    }
    deleteMutation.mutate(reviewId);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回首页
                </Button>
              </Link>
              <h1 className="ml-4 text-2xl font-bold text-slate-900">历史复盘</h1>
            </div>
            <div className="flex gap-2">
              <Link to="/training/mistakes">
                <Button variant="outline">错题库</Button>
              </Link>
              <Link to="/review/import">
                <Button>
                  <FileText className="mr-2 h-4 w-4" />
                  新建复盘
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="搜索玩家、模型标签..."
                    className="pl-10"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <Select
                  value={platform}
                  onValueChange={(value) => {
                    setPlatform(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部平台</SelectItem>
                    <SelectItem value="internal">平台内</SelectItem>
                    <SelectItem value="tenhou">天凤</SelectItem>
                    <SelectItem value="majsoul">雀魂</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={dateRange}
                  onValueChange={(value) => {
                    setDateRange(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部时间</SelectItem>
                    <SelectItem value="today">最近 24 小时</SelectItem>
                    <SelectItem value="week">最近 7 天</SelectItem>
                    <SelectItem value="month">最近 30 天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {reviewsQuery.isLoading && (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">正在读取历史复盘...</CardContent>
            </Card>
          )}

          {pagedReviews.length > 0 && (
            <div className="space-y-4">
              {pagedReviews.map((report) => (
                <Card key={report.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{formatPlatform(report.platform)}</Badge>
                          <Badge variant={report.high_deviation_count > 0 ? "destructive" : "secondary"}>
                            {report.high_deviation_count > 0 ? "存在高偏差" : "偏差较少"}
                          </Badge>
                          <span className="font-semibold text-slate-900">
                            {report.target_player_label || `玩家 ${report.target_actor}`}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex flex-wrap items-center gap-3">
                            <span>{formatDateTime(report.created_at)}</span>
                            <span>·</span>
                            <span>{report.reviewed_decision_count} 个决策点</span>
                            <span>·</span>
                            <span>{report.medium_deviation_count} 处中偏差</span>
                            <span>·</span>
                            <span>{report.high_deviation_count} 处高偏差</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span>引擎：{report.engine_name}</span>
                            <span>·</span>
                            <span>模型：{report.model_tag || "未知"}</span>
                            <span>·</span>
                            <span>评分：{report.rating ?? 0}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link to={`/review/report/${report.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            查看
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(report.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!reviewsQuery.isLoading && filteredReviews.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                <h3 className="mb-2 text-lg font-semibold text-slate-900">暂无复盘记录</h3>
                <p className="mb-6 text-slate-600">创建第一份报告后，这里会展示真实历史记录。</p>
                <Link to="/review/import">
                  <Button>导入牌谱</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {filteredReviews.length > pageSize && (
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
