import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileJson, Hash, Link as LinkIcon, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { ApiError, createReviewJob, listReplaySources, listReviews, uploadReplayFile } from "../../lib/api";
import { formatDateTime, formatRelativeSize } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";

type ImportType = "link" | "id" | "file" | "json";

function normalizeInlineJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("请先输入 JSON 内容。");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return { events: parsed };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown[] }).events)) {
      return { events: (parsed as { events: unknown[] }).events };
    }
    throw new Error("JSON 需要是事件数组，或包含 events 数组的对象。");
  } catch (error) {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      lines.forEach((line) => JSON.parse(line));
      return { jsonl: lines.join("\n") };
    }
    throw error instanceof Error ? error : new Error("无法解析 JSON 内容。");
  }
}

export function ReviewImport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [importType, setImportType] = useState<ImportType>("file");
  const [selectedPlayer, setSelectedPlayer] = useState("0");
  const [language, setLanguage] = useState("zh-CN");
  const [outputFormat, setOutputFormat] = useState("json");
  const [anonymous, setAnonymous] = useState(false);
  const [jsonContent, setJsonContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ["replay-sources"],
    queryFn: listReplaySources,
  });
  const recentReviewsQuery = useQuery({
    queryKey: ["recent-reviews"],
    queryFn: () => listReviews({ page: 1, page_size: 3 }),
  });

  const enabledSources = useMemo(
    () => new Set((sourcesQuery.data ?? []).filter((item) => item.enabled).map((item) => item.key)),
    [sourcesQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const options = {
        lang: language,
        output_format: outputFormat,
        anonymous,
      };

      if (importType === "file") {
        if (!selectedFile) {
          throw new Error("请先选择要上传的牌谱文件。");
        }
        const upload = await uploadReplayFile(selectedFile);
        return createReviewJob({
          source_type: "upload_file",
          platform: "internal",
          source: { file_key: upload.file_key },
          options,
          target_player_ref: selectedPlayer,
        });
      }

      if (importType === "json") {
        const source = normalizeInlineJson(jsonContent);
        return createReviewJob({
          source_type: "inline_json",
          platform: "internal",
          source,
          options,
          target_player_ref: selectedPlayer,
        });
      }

      throw new Error("当前阶段只开放文件上传和 JSON 复盘入口。");
    },
    onSuccess: async (job) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recent-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["review-jobs"] }),
      ]);
      navigate(`/review/task/${job.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.detail);
        return;
      }
      if (error instanceof Error) {
        setErrorMessage(error.message);
        return;
      }
      setErrorMessage("创建复盘任务失败。");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    createMutation.mutate();
  };

  const recentReviews = recentReviewsQuery.data?.items ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex items-center px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Button>
          </Link>
          <h1 className="ml-4 text-2xl font-bold text-slate-900">AI 复盘</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>导入牌谱</CardTitle>
              <CardDescription>阶段 2 已接通真实后端，当前可用入口是“文件”和“JSON”。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={importType} onValueChange={(value) => setImportType(value as ImportType)}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="link">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      链接
                    </TabsTrigger>
                    <TabsTrigger value="id">
                      <Hash className="mr-2 h-4 w-4" />
                      ID
                    </TabsTrigger>
                    <TabsTrigger value="file">
                      <Upload className="mr-2 h-4 w-4" />
                      文件
                    </TabsTrigger>
                    <TabsTrigger value="json">
                      <FileJson className="mr-2 h-4 w-4" />
                      JSON
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="link" className="space-y-4">
                    <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      当前后端尚未接入 `Tenhou / Majsoul` 外部牌谱适配。这个入口会在后续阶段开放。
                    </div>
                    <div>
                      <Label htmlFor="link">牌谱链接</Label>
                      <Input id="link" placeholder="https://..." className="mt-2" disabled />
                    </div>
                  </TabsContent>

                  <TabsContent value="id" className="space-y-4">
                    <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      当前后端尚未接入外部平台牌谱 ID 解析。阶段 2 只演示文件和 JSON 复盘链路。
                    </div>
                    <div>
                      <Label htmlFor="gameId">对局 ID</Label>
                      <Input id="gameId" placeholder="输入对局 ID" className="mt-2" disabled />
                    </div>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <Upload className="h-6 w-6 text-slate-600" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <Label htmlFor="review-file">牌谱文件</Label>
                            <Input
                              id="review-file"
                              type="file"
                              className="mt-2"
                              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                            />
                          </div>
                          <p className="text-sm text-slate-500">
                            当前推荐上传平台内导出的 `mjai` JSON / JSONL 文件。
                          </p>
                          {selectedFile && (
                            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                              已选择：
                              <span className="ml-2 font-semibold text-slate-900">{selectedFile.name}</span>
                              <span className="ml-2 text-slate-500">{formatRelativeSize(selectedFile.size)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="json" className="space-y-4">
                    <div>
                      <Label htmlFor="json">JSON 或 JSONL 数据</Label>
                      <Textarea
                        id="json"
                        className="mt-2 min-h-[260px] font-mono text-sm"
                        placeholder='[{"type":"start_kyoku", ...}, {"type":"tsumo", ...}]'
                        value={jsonContent}
                        onChange={(event) => setJsonContent(event.target.value)}
                      />
                      <p className="mt-2 text-sm text-slate-500">
                        支持 `mjai` 事件数组，或逐行 JSON 的 `JSONL`。
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="grid gap-6 border-t pt-6 md:grid-cols-2">
                  <div>
                    <Label htmlFor="player">目标玩家</Label>
                    <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">玩家 0</SelectItem>
                        <SelectItem value="1">玩家 1</SelectItem>
                        <SelectItem value="2">玩家 2</SelectItem>
                        <SelectItem value="3">玩家 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="language">语言</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zh-CN">简体中文</SelectItem>
                        <SelectItem value="ja-JP">日本語</SelectItem>
                        <SelectItem value="en-US">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="output">输出格式</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON 数据</SelectItem>
                        <SelectItem value="html">HTML 报告</SelectItem>
                        <SelectItem value="both">两者都要</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                      <Checkbox
                        id="anonymous"
                        checked={anonymous}
                        onCheckedChange={(checked) => setAnonymous(Boolean(checked))}
                      />
                      <Label htmlFor="anonymous" className="cursor-pointer">
                        匿名化处理
                      </Label>
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  已接入后端来源：
                  <span className="ml-2 font-semibold text-slate-900">
                    {Array.from(enabledSources).join(" / ") || "加载中"}
                  </span>
                </div>

                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    size="lg"
                    disabled={createMutation.isPending || (importType !== "file" && importType !== "json")}
                  >
                    {createMutation.isPending ? "正在创建任务..." : "创建复盘任务"}
                  </Button>
                  <Link to="/" className="flex-1">
                    <Button type="button" variant="outline" className="w-full" size="lg">
                      取消
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>最近生成的报告</CardTitle>
              <CardDescription>这些记录来自真实后端，可直接跳转查看。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentReviews.length === 0 && (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  暂无历史报告，创建第一份任务后这里会出现最近记录。
                </div>
              )}
              {recentReviews.map((review) => (
                <Link
                  key={review.id}
                  to={`/review/report/${review.id}`}
                  className="block rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {review.target_player_label || `玩家 ${review.target_actor}`}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{formatDateTime(review.created_at)}</div>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <div>{review.reviewed_decision_count} 个决策点</div>
                      <div>{review.high_deviation_count} 处高偏差</div>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
